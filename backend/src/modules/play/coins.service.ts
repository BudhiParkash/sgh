import { randomInt } from "node:crypto";
import type { Types } from "mongoose";
import { conflict } from "../../lib/errors.js";
import { getSettings } from "../settings/settings.model.js";
import { CoinTxModel, PlayerModel } from "./play.models.js";

type Reason = "spin" | "streak_bonus" | "room_prize" | "redeem" | "redeem_refund" | "admin_adjust";
const IST_OFFSET_MS = 5.5 * 3_600_000;

/** Calendar day in India (IST), YYYY-MM-DD. */
export function istDay(at = Date.now()): string {
  return new Date(at + IST_OFFSET_MS).toISOString().slice(0, 10);
}
/** Next IST midnight as a Date. */
export function nextIstMidnight(at = Date.now()): Date {
  const d = new Date(at + IST_OFFSET_MS);
  d.setUTCHours(24, 0, 0, 0);
  return new Date(d.getTime() - IST_OFFSET_MS);
}
const previousDay = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

const isDuplicate = (e: unknown) => (e as { code?: number })?.code === 11000;

/**
 * Credits coins exactly once per refKey (the ledger row is written first; its unique index makes retries
 * and double clicks harmless). Returns the new balance, or null if this refKey was already applied.
 */
export async function credit(playerId: Types.ObjectId | string, amount: number, reason: Reason, refKey: string, note = ""): Promise<number | null> {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("credit amount must be a positive integer");
  let tx;
  try {
    tx = await CoinTxModel.create({ player: playerId, amount, reason, refKey, note });
  } catch (e) {
    if (isDuplicate(e)) return null;
    throw e;
  }
  const p = await PlayerModel.findByIdAndUpdate(playerId, { $inc: { coins: amount } }, { new: true }).select("coins");
  await CoinTxModel.updateOne({ _id: tx._id }, { $set: { balanceAfter: p?.coins } });
  return p?.coins ?? null;
}

/** Spends coins atomically (never below zero). Throws 409 when the balance is too low. */
export async function debit(playerId: Types.ObjectId | string, amount: number, reason: Reason, refKey: string, note = ""): Promise<number> {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("debit amount must be a positive integer");
  const p = await PlayerModel.findOneAndUpdate({ _id: playerId, status: "active", coins: { $gte: amount } }, { $inc: { coins: -amount } }, { new: true }).select("coins");
  if (!p) throw conflict("Not enough SGC coins.");
  try {
    await CoinTxModel.create({ player: playerId, amount: -amount, reason, refKey, note, balanceAfter: p.coins });
  } catch (e) {
    await PlayerModel.updateOne({ _id: playerId }, { $inc: { coins: amount } });
    if (isDuplicate(e)) throw conflict("This request was already processed.");
    throw e;
  }
  return p.coins;
}

/** Admin adjustment (positive or negative), always with a reason. Negative adjustments never go below zero. */
export async function adjust(playerId: string, amount: number, note: string, refKey: string): Promise<number | null> {
  if (amount > 0) return credit(playerId, amount, "admin_adjust", refKey, note);
  return debit(playerId, -amount, "admin_adjust", refKey, note);
}

export function pickWeighted<T extends { weight: number }>(outcomes: T[]): { index: number; outcome: T } {
  const total = outcomes.reduce((s, o) => s + o.weight, 0);
  let r = randomInt(total);
  for (let i = 0; i < outcomes.length; i++) {
    r -= outcomes[i]!.weight;
    if (r < 0) return { index: i, outcome: outcomes[i]! };
  }
  return { index: outcomes.length - 1, outcome: outcomes[outcomes.length - 1]! };
}

export async function playConfig() {
  const s = await getSettings();
  const play = s.play;
  return {
    spinOutcomes: (play?.spinOutcomes ?? []).map((o) => ({ coins: o.coins, weight: o.weight })),
    streakBonuses: (play?.streakBonuses ?? []).map((b) => ({ day: b.day, coins: b.coins })),
    redeemMinAccountAgeDays: play?.redeemMinAccountAgeDays ?? 7,
    redeemMonthlyCap: play?.redeemMonthlyCap ?? 2,
  };
}

/** Streak as the player sees it today (0 once a day has been missed). */
export function currentStreak(streak: { count?: number | null; lastDay?: string | null } | undefined, today = istDay()): number {
  if (!streak?.lastDay) return 0;
  return streak.lastDay === today || streak.lastDay === previousDay(today) ? (streak.count ?? 0) : 0;
}

export async function dailyStatus(player: { streak?: { count?: number | null; lastDay?: string | null } | null }) {
  const today = istDay();
  const cfg = await playConfig();
  const streak = currentStreak(player.streak ?? undefined, today);
  const spunToday = player.streak?.lastDay === today;
  // 7-day cycle position of the next spin (today's if not spun yet, else tomorrow's — both continue the streak).
  const nextDay = (streak % 7) + 1;
  return {
    canSpin: !spunToday,
    streak,
    nextCycleDay: nextDay,
    nextResetAt: nextIstMidnight(),
    outcomes: cfg.spinOutcomes.map((o) => o.coins),
    streakBonuses: cfg.streakBonuses,
  };
}

/** One free spin per IST day. The streak update is an optimistic, conditional write, so double clicks can't spin twice. */
export async function spin(playerId: Types.ObjectId) {
  const today = istDay();
  const player = await PlayerModel.findById(playerId).select("streak status");
  if (!player || player.status !== "active") throw conflict("Account not active.");
  const lastDay = player.streak?.lastDay ?? "";
  if (lastDay === today) throw conflict("You've already spun today. Come back after midnight (IST).");
  const count = lastDay === previousDay(today) ? (player.streak?.count ?? 0) + 1 : 1;
  const claimed = await PlayerModel.updateOne({ _id: playerId, "streak.lastDay": lastDay }, { $set: { "streak.count": count, "streak.lastDay": today } });
  if (claimed.modifiedCount !== 1) throw conflict("You've already spun today. Come back after midnight (IST).");

  const cfg = await playConfig();
  const { index, outcome } = pickWeighted(cfg.spinOutcomes);
  let balance = await credit(playerId, outcome.coins, "spin", `spin:${playerId}:${today}`, `Daily spin ${today}`);
  const cycleDay = ((count - 1) % 7) + 1;
  const bonus = cfg.streakBonuses.find((b) => b.day === cycleDay)?.coins ?? 0;
  if (bonus > 0) balance = (await credit(playerId, bonus, "streak_bonus", `streak:${playerId}:${today}`, `Streak day ${cycleDay}`)) ?? balance;
  return { coins: outcome.coins, outcomeIndex: index, streak: count, cycleDay, bonus, balance };
}
