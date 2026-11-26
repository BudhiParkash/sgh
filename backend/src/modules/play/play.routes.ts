import { Router } from "express";
import type { Redis } from "ioredis";
import { Types } from "mongoose";
import { z } from "zod";
import { decrypt, randomToken } from "../../lib/crypto.js";
import { badRequest, conflict, forbidden, notFound } from "../../lib/errors.js";
import { buildMeta, toSkip } from "../../lib/pagination.js";
import { created, noContent, ok } from "../../lib/respond.js";
import { revalidateTags } from "../../lib/revalidate.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { v, validate } from "../../middleware/validate.js";
import { toMediaRef } from "../media/media.service.js";
import { currentStreak, dailyStatus, debit, playConfig, spin } from "./coins.service.js";
import {
  clearPlayerCookie,
  loadPlayerSession,
  playerCsrf,
  publicPlayerName,
  requirePlayer,
  setPlayerCookie,
  verifyGoogleCredential,
  type PlayerSessionStore,
} from "./player-auth.js";
import { CoinTxModel, PlayerModel, RedemptionModel, RewardModel, RoomEntryMemberModel, RoomEntryModel, RoomModel, SquadModel, SQUAD_MAX_MEMBERS, SQUADS_PER_PLAYER } from "./play.models.js";
import { computeStandings, register, registrationState, revealedCredentials, withdraw } from "./room.service.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const pageQuery = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) });
const roomTags = (slug: string) => ["rooms", `room:${slug}`];

type Player = InstanceType<typeof PlayerModel>;
function meDto(p: Player, csrf?: string) {
  return {
    id: p.id,
    email: p.email,
    name: p.name,
    avatarUrl: p.avatarUrl,
    displayName: p.displayName,
    ign: p.ign,
    characterId: p.characterId ?? "",
    characterIdLocked: Boolean(p.characterIdLockedAt),
    coins: p.coins,
    streak: currentStreak(p.streak ?? undefined),
    createdAt: (p as unknown as { createdAt: Date }).createdAt,
    ...(csrf && { csrfToken: csrf }),
  };
}

// ── Public (no account needed) ──────────────────────────────────────────────
function roomCard(r: InstanceType<typeof RoomModel>, filled: number) {
  return {
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    mode: r.mode,
    perspective: r.perspective,
    slotsTotal: r.slotsTotal,
    slotsFilled: filled,
    registrationOpensAt: r.registrationOpensAt,
    registrationClosesAt: r.registrationClosesAt,
    registration: registrationState(r),
    status: r.status,
    live: r.matches.some((m) => m.status === "live"),
    firstMatchAt: r.matches.map((m) => m.scheduledAt).sort((a, b) => +a - +b)[0] ?? null,
    maps: [...new Set(r.matches.map((m) => m.map))],
    prizes: r.prizes,
  };
}

export function playPublicRoutes(): Router {
  const r = Router();

  r.get("/rooms", validate({ query: z.object({ status: z.enum(["upcoming", "completed"]).optional() }).merge(pageQuery) }), async (req, res) => {
    const q = v<{ status?: "upcoming" | "completed"; page: number; limit: number }>(req.valid.query);
    const filter = { published: true, status: q.status ?? { $ne: "cancelled" as const } };
    const [rooms, total] = await Promise.all([
      RoomModel.find(filter).sort(q.status === "completed" ? { completedAt: -1 } : { registrationClosesAt: 1 }).skip(toSkip(q)).limit(q.limit),
      RoomModel.countDocuments(filter),
    ]);
    const counts = await RoomEntryModel.aggregate<{ _id: Types.ObjectId; n: number }>([{ $match: { room: { $in: rooms.map((x) => x._id) }, status: "confirmed" } }, { $group: { _id: "$room", n: { $sum: 1 } } }]);
    ok(res, rooms.map((x) => roomCard(x, counts.find((c) => c._id.equals(x._id))?.n ?? 0)), buildMeta(q, total));
  });

  r.get("/rooms/:slug", async (req, res) => {
    const room = await RoomModel.findOne({ slug: req.params.slug, published: true });
    if (!room) throw notFound();
    const entries = await RoomEntryModel.find({ room: room._id, status: { $in: ["confirmed", "waitlist", "disqualified"] } }).sort({ slot: 1, createdAt: 1 });
    const confirmed = entries.filter((e) => e.status === "confirmed");
    const standings = room.status === "completed" && room.finalStandings ? room.finalStandings : computeStandings(room, entries);
    ok(res, {
      ...roomCard(room, confirmed.length),
      revealMinutes: room.revealMinutes,
      points: room.points,
      rulesHtml: room.rulesHtml,
      completedAt: room.completedAt,
      matches: room.matches
        .map((m) => ({ no: m.no, map: m.map, scheduledAt: m.scheduledAt, status: m.status, streamUrl: m.streamUrl, hasResults: Boolean(m.results?.length) }))
        .sort((a, b) => a.no - b.no),
      entries: confirmed.map((e) => ({ slot: e.slot, teamName: e.teamName, teamTag: e.teamTag })),
      waitlistCount: entries.filter((e) => e.status === "waitlist").length,
      standings,
    });
  });

  r.get("/rewards", async (_req, res) => {
    const rewards = await RewardModel.find({ active: true }).sort({ sort: 1, costCoins: 1 }).populate("image");
    ok(
      res,
      rewards.map((x) => ({ id: x.id, title: x.title, description: x.description, kind: x.kind, costCoins: x.costCoins, inStock: x.stock === null || (x.stock ?? 0) > 0, image: toMediaRef(x.image as never) })),
    );
  });

  r.get("/play/config", async (_req, res) => {
    const cfg = await playConfig();
    ok(res, { spinOutcomes: cfg.spinOutcomes.map((o) => o.coins), streakBonuses: cfg.streakBonuses });
  });
  return r;
}

// ── Player (signed-in) ──────────────────────────────────────────────────────
const googleSchema = z.object({ credential: z.string().min(20).max(4096), confirmAge: z.boolean().optional(), acceptTerms: z.boolean().optional() });
const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(40).optional(),
  ign: z.string().trim().min(2, "BGMI name is too short").max(30).optional(),
  characterId: z.string().trim().regex(/^\d{6,15}$/, "BGMI Character ID is 6–15 digits (Profile → Basic info in BGMI)").optional(),
});
const squadSchema = z.object({ name: z.string().trim().min(2).max(40), tag: z.string().trim().regex(/^[A-Za-z0-9]{2,5}$/, "Tag: 2–5 letters or numbers") });
const registerSchema = z.object({ squadId: objectId.optional(), playerIds: z.array(objectId).max(4).optional(), substituteId: objectId.optional() });

export function playerRoutes(redis: Redis, store: PlayerSessionStore): Router {
  const r = Router();
  r.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  r.use(loadPlayerSession(store));
  r.use(rateLimit(redis, { name: "player", points: 300, durationSec: 60, key: (req) => req.playerSessionId ?? req.ipHash }));
  const auth = requirePlayer(store);

  // Sign in with Google. First sign-in needs confirmAge + acceptTerms; otherwise the API answers consent_required.
  r.post("/auth/google", rateLimit(redis, { name: "player-login", points: 20, durationSec: 15 * 60 }), validate({ body: googleSchema }), async (req, res) => {
    const body = v<z.infer<typeof googleSchema>>(req.valid.body);
    const g = await verifyGoogleCredential(body.credential);
    if (!g.emailVerified) throw forbidden("Your Google email address isn't verified.");
    let player = await PlayerModel.findOne({ googleSub: g.sub });
    if (player?.status === "banned") throw forbidden("This account has been suspended.");
    if (!player) {
      if (!body.confirmAge || !body.acceptTerms) return ok(res, { status: "consent_required", name: g.name, email: g.email });
      const now = new Date();
      player = await PlayerModel.create({ googleSub: g.sub, email: g.email, name: g.name, avatarUrl: g.picture, displayName: g.name.slice(0, 40), ageConfirmedAt: now, termsAcceptedAt: now, signupIpHash: req.ipHash, lastIpHash: req.ipHash, lastLoginAt: now });
    } else {
      player.set({ email: g.email, name: g.name, avatarUrl: g.picture, lastLoginAt: new Date(), lastIpHash: req.ipHash });
      await player.save();
    }
    if (req.playerSessionId) await store.destroy(req.playerSessionId, req.playerSession?.playerId);
    const s = await store.create(player.id);
    setPlayerCookie(res, s.id);
    ok(res, { status: "signed_in", player: meDto(player, s.data.csrf) });
  });

  r.use(playerCsrf);
  r.post("/auth/logout", async (req, res) => {
    if (req.playerSessionId) await store.destroy(req.playerSessionId, req.playerSession?.playerId);
    clearPlayerCookie(res);
    noContent(res);
  });

  r.get("/me", auth, async (req, res) => ok(res, meDto(req.player!, req.playerSession!.csrf)));

  r.patch("/me", auth, validate({ body: profileSchema }), async (req, res) => {
    const body = v<z.infer<typeof profileSchema>>(req.valid.body);
    const p = req.player!;
    if (body.characterId !== undefined && body.characterId !== (p.characterId ?? "") && p.characterIdLockedAt) throw conflict("Your Character ID is locked after a reward redemption. Contact support to change it.");
    if (body.characterId && (await PlayerModel.exists({ characterId: body.characterId, _id: { $ne: p._id } }))) throw conflict("That Character ID is already linked to another account.");
    p.set(body);
    try {
      await p.save();
    } catch (e) {
      if ((e as { code?: number }).code === 11000) throw conflict("That Character ID is already linked to another account.");
      throw e;
    }
    ok(res, meDto(p));
  });

  r.delete("/me", auth, validate({ body: z.object({ confirm: z.literal("DELETE") }) }), async (req, res) => {
    const p = req.player!;
    // Leave open rooms (closed/played rooms keep the result under "Deleted player").
    const memberships = await RoomEntryMemberModel.find({ player: p._id });
    for (const m of memberships) {
      const [room, entry] = await Promise.all([RoomModel.findById(m.room), RoomEntryModel.findById(m.entry)]);
      if (room && entry && registrationState(room) === "open") {
        await withdraw(room, entry);
        await revalidateTags(roomTags(room.slug));
      }
    }
    // Squads: hand the captaincy over or disband.
    for (const sq of await SquadModel.find({ "members.player": p._id, disbandedAt: null })) {
      sq.members = sq.members.filter((m) => !m.player.equals(p._id)) as never;
      if (sq.captain.equals(p._id)) {
        if (sq.members.length) sq.captain = sq.members[0]!.player;
        else sq.disbandedAt = new Date();
      }
      await sq.save();
    }
    await RedemptionModel.updateMany({ player: p._id, status: "pending" }, { $set: { status: "rejected", adminNote: "Account deleted by the player", handledAt: new Date() } });
    await PlayerModel.updateOne(
      { _id: p._id },
      { $set: { googleSub: `deleted:${p.id}`, email: "", name: "", avatarUrl: "", displayName: "", ign: "", status: "deleted", deletedAt: new Date(), signupIpHash: "", lastIpHash: "" }, $unset: { characterId: 1 } },
    );
    await store.destroyAll(p.id);
    clearPlayerCookie(res);
    noContent(res);
  });

  // ── Coins & daily spin ────────────────────────────────────────────────────
  r.get("/daily", auth, async (req, res) => ok(res, { ...(await dailyStatus(req.player!)), coins: req.player!.coins }));
  r.post("/daily/spin", auth, rateLimit(redis, { name: "spin", points: 10, durationSec: 60, key: (req) => req.playerSession!.playerId }), async (req, res) => {
    ok(res, await spin(req.player!._id));
  });
  r.get("/coins", auth, validate({ query: pageQuery }), async (req, res) => {
    const q = v<{ page: number; limit: number }>(req.valid.query);
    const filter = { player: req.player!._id };
    const [items, total] = await Promise.all([CoinTxModel.find(filter).sort({ createdAt: -1 }).skip(toSkip(q)).limit(q.limit), CoinTxModel.countDocuments(filter)]);
    ok(res, items.map((t) => ({ amount: t.amount, reason: t.reason, note: t.note, balanceAfter: t.balanceAfter, at: (t as unknown as { createdAt: Date }).createdAt })), buildMeta(q, total));
  });

  // ── Squads ────────────────────────────────────────────────────────────────
  const squadDto = async (sq: InstanceType<typeof SquadModel>, me: Types.ObjectId) => {
    const members = await PlayerModel.find({ _id: { $in: sq.members.map((m) => m.player) } }).select("ign displayName status avatarUrl characterId");
    const isCaptain = sq.captain.equals(me);
    return {
      id: sq.id,
      name: sq.name,
      tag: sq.tag,
      isCaptain,
      inviteCode: isCaptain ? sq.inviteCode : undefined,
      members: sq.members.map((m) => {
        const p = members.find((x) => x._id.equals(m.player));
        return { id: String(m.player), name: publicPlayerName(p), avatarUrl: p?.avatarUrl ?? "", captain: sq.captain.equals(m.player), ready: Boolean(p?.characterId && p?.ign) };
      }),
    };
  };
  const loadSquad = async (id: string, me: Types.ObjectId) => {
    if (!Types.ObjectId.isValid(id)) throw notFound();
    const sq = await SquadModel.findOne({ _id: id, disbandedAt: null, "members.player": me });
    if (!sq) throw notFound("Squad not found.");
    return sq;
  };
  const newCode = () => randomToken(6).replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase().padEnd(8, "X");

  r.get("/squads", auth, async (req, res) => {
    const me = req.player!._id;
    const list = await SquadModel.find({ "members.player": me, disbandedAt: null }).sort({ createdAt: 1 });
    ok(res, await Promise.all(list.map((s) => squadDto(s, me))));
  });
  r.post("/squads", auth, validate({ body: squadSchema }), async (req, res) => {
    const me = req.player!._id;
    if ((await SquadModel.countDocuments({ "members.player": me, disbandedAt: null })) >= SQUADS_PER_PLAYER) throw conflict(`You can be in up to ${SQUADS_PER_PLAYER} squads.`);
    const body = v<z.infer<typeof squadSchema>>(req.valid.body);
    const sq = await SquadModel.create({ ...body, captain: me, members: [{ player: me }], inviteCode: newCode() });
    created(res, await squadDto(sq, me));
  });
  r.post("/squads/join", auth, rateLimit(redis, { name: "squad-join", points: 10, durationSec: 15 * 60, key: (req) => req.playerSession!.playerId }), validate({ body: z.object({ code: z.string().trim().toUpperCase().length(8) }) }), async (req, res) => {
    const me = req.player!._id;
    const code = v<{ code: string }>(req.valid.body).code;
    if ((await SquadModel.countDocuments({ "members.player": me, disbandedAt: null })) >= SQUADS_PER_PLAYER) throw conflict(`You can be in up to ${SQUADS_PER_PLAYER} squads.`);
    const sq = await SquadModel.findOneAndUpdate(
      { inviteCode: code, disbandedAt: null, "members.player": { $ne: me }, [`members.${SQUAD_MAX_MEMBERS - 1}`]: { $exists: false } },
      { $push: { members: { player: me, joinedAt: new Date() } } },
      { new: true },
    );
    if (!sq) {
      const exists = await SquadModel.findOne({ inviteCode: code, disbandedAt: null });
      if (!exists) throw notFound("Invite code not found.");
      if (exists.members.some((m) => m.player.equals(me))) throw conflict("You're already in this squad.");
      throw conflict(`This squad is full (${SQUAD_MAX_MEMBERS} members).`);
    }
    ok(res, await squadDto(sq, me));
  });
  r.patch("/squads/:id", auth, validate({ body: squadSchema.partial() }), async (req, res) => {
    const me = req.player!._id;
    const sq = await loadSquad(String(req.params.id), me);
    if (!sq.captain.equals(me)) throw forbidden("Only the captain can edit the squad.");
    sq.set(req.valid.body as object);
    await sq.save();
    ok(res, await squadDto(sq, me));
  });
  r.post("/squads/:id/reset-code", auth, async (req, res) => {
    const me = req.player!._id;
    const sq = await loadSquad(String(req.params.id), me);
    if (!sq.captain.equals(me)) throw forbidden("Only the captain can reset the invite code.");
    sq.inviteCode = newCode();
    await sq.save();
    ok(res, await squadDto(sq, me));
  });
  r.post("/squads/:id/kick", auth, validate({ body: z.object({ playerId: objectId }) }), async (req, res) => {
    const me = req.player!._id;
    const sq = await loadSquad(String(req.params.id), me);
    const target = v<{ playerId: string }>(req.valid.body).playerId;
    if (!sq.captain.equals(me)) throw forbidden("Only the captain can remove members.");
    if (me.equals(target)) throw badRequest("Use 'leave' to leave your own squad.");
    sq.members = sq.members.filter((m) => String(m.player) !== target) as never;
    await sq.save();
    ok(res, await squadDto(sq, me));
  });
  r.post("/squads/:id/captain", auth, validate({ body: z.object({ playerId: objectId }) }), async (req, res) => {
    const me = req.player!._id;
    const sq = await loadSquad(String(req.params.id), me);
    const target = v<{ playerId: string }>(req.valid.body).playerId;
    if (!sq.captain.equals(me)) throw forbidden("Only the captain can hand over the captaincy.");
    if (!sq.members.some((m) => String(m.player) === target)) throw badRequest("That player isn't in the squad.");
    sq.captain = new Types.ObjectId(target);
    await sq.save();
    ok(res, await squadDto(sq, me));
  });
  r.post("/squads/:id/leave", auth, async (req, res) => {
    const me = req.player!._id;
    const sq = await loadSquad(String(req.params.id), me);
    sq.members = sq.members.filter((m) => !m.player.equals(me)) as never;
    if (sq.captain.equals(me)) {
      if (sq.members.length) sq.captain = sq.members[0]!.player;
      else sq.disbandedAt = new Date();
    }
    await sq.save();
    noContent(res);
  });

  // ── Custom rooms ──────────────────────────────────────────────────────────
  const loadRoom = async (slug: string) => {
    const room = await RoomModel.findOne({ slug, published: true });
    if (!room) throw notFound();
    return room;
  };
  r.get("/rooms/:slug/me", auth, async (req, res) => {
    const room = await loadRoom(String(req.params.slug));
    const m = await RoomEntryMemberModel.findOne({ room: room._id, player: req.player!._id });
    const entry = m ? await RoomEntryModel.findById(m.entry) : null;
    ok(res, {
      registration: registrationState(room),
      entry: entry && { id: entry.id, status: entry.status, slot: entry.slot ?? null, teamName: entry.teamName, isCaptain: entry.captain.equals(req.player!._id), dqReason: entry.dqReason },
      credentials: entry?.status === "confirmed" ? revealedCredentials(room) : [],
      revealMinutes: room.revealMinutes,
    });
  });
  r.post("/rooms/:slug/register", auth, rateLimit(redis, { name: "room-register", points: 20, durationSec: 3600, key: (req) => req.playerSession!.playerId }), validate({ body: registerSchema }), async (req, res) => {
    const room = await loadRoom(String(req.params.slug));
    const entry = await register(room, req.player!._id, v<z.infer<typeof registerSchema>>(req.valid.body));
    await revalidateTags(roomTags(room.slug));
    created(res, { id: entry.id, status: entry.status, slot: entry.slot ?? null, teamName: entry.teamName });
  });
  r.delete("/rooms/:slug/entry", auth, async (req, res) => {
    const room = await loadRoom(String(req.params.slug));
    const m = await RoomEntryMemberModel.findOne({ room: room._id, player: req.player!._id });
    const entry = m ? await RoomEntryModel.findById(m.entry) : null;
    if (!entry) throw notFound("You're not registered in this room.");
    if (!entry.captain.equals(req.player!._id)) throw forbidden("Only the captain can withdraw the team.");
    await withdraw(room, entry);
    await revalidateTags(roomTags(room.slug));
    noContent(res);
  });

  // ── Rewards ───────────────────────────────────────────────────────────────
  r.post("/rewards/:id/redeem", auth, rateLimit(redis, { name: "redeem", points: 5, durationSec: 3600, key: (req) => req.playerSession!.playerId }), validate({ body: z.object({ note: z.string().trim().max(300).optional() }) }), async (req, res) => {
    const p = req.player!;
    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) throw notFound();
    const reward = await RewardModel.findOne({ _id: id, active: true });
    if (!reward) throw notFound("This reward isn't available.");
    const cfg = await playConfig();
    if (!p.characterId) throw badRequest("Add your BGMI Character ID to your profile before redeeming.");
    const ageDays = (Date.now() - (p as unknown as { createdAt: Date }).createdAt.getTime()) / 86_400_000;
    if (ageDays < cfg.redeemMinAccountAgeDays) throw conflict(`Your account must be at least ${cfg.redeemMinAccountAgeDays} days old to redeem rewards.`);
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const monthStart = new Date(Date.now() + 5.5 * 3_600_000);
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const [sameReward, thisMonth] = await Promise.all([
      RedemptionModel.countDocuments({ player: p._id, reward: reward._id, status: { $ne: "rejected" }, createdAt: { $gte: since30 } }),
      RedemptionModel.countDocuments({ player: p._id, status: { $ne: "rejected" }, createdAt: { $gte: new Date(monthStart.getTime() - 5.5 * 3_600_000) } }),
    ]);
    if (sameReward >= reward.perPlayerPer30Days) throw conflict("You've reached the limit for this reward. Try again later.");
    if (thisMonth >= cfg.redeemMonthlyCap) throw conflict(`You can redeem up to ${cfg.redeemMonthlyCap} rewards per month.`);
    if (p.coins < reward.costCoins) throw conflict("Not enough SGC coins.");
    if (reward.stock !== null && reward.stock !== undefined) {
      const took = await RewardModel.updateOne({ _id: reward._id, stock: { $gt: 0 } }, { $inc: { stock: -1 } });
      if (took.modifiedCount !== 1) throw conflict("This reward is out of stock.");
    }
    const red = await RedemptionModel.create({ player: p._id, reward: reward._id, rewardTitle: reward.title, cost: reward.costCoins, playerNote: v<{ note?: string }>(req.valid.body).note ?? "", ipHash: req.ipHash });
    try {
      await debit(p._id, reward.costCoins, "redeem", `redeem:${red.id}`, reward.title);
    } catch (e) {
      await RedemptionModel.deleteOne({ _id: red._id });
      if (reward.stock !== null && reward.stock !== undefined) await RewardModel.updateOne({ _id: reward._id }, { $inc: { stock: 1 } });
      throw e;
    }
    if (!p.characterIdLockedAt) await PlayerModel.updateOne({ _id: p._id }, { $set: { characterIdLockedAt: new Date() } });
    created(res, { id: red.id, status: red.status, rewardTitle: red.rewardTitle, cost: red.cost });
  });
  r.get("/redemptions", auth, async (req, res) => {
    const list = await RedemptionModel.find({ player: req.player!._id }).sort({ createdAt: -1 }).limit(50);
    ok(
      res,
      list.map((x) => ({
        id: x.id,
        rewardTitle: x.rewardTitle,
        cost: x.cost,
        status: x.status,
        code: x.status === "fulfilled" && x.codeEnc ? decrypt(x.codeEnc) : undefined,
        note: x.status === "rejected" ? x.adminNote : undefined,
        createdAt: (x as unknown as { createdAt: Date }).createdAt,
        handledAt: x.handledAt,
      })),
    );
  });
  return r;
}
