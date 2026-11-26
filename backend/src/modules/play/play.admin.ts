import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { objectIdSchema, slugSchema, slugify } from "@sgh/shared";
import { decrypt, encrypt, randomToken } from "../../lib/crypto.js";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { buildMeta, toSkip } from "../../lib/pagination.js";
import { created, noContent, ok } from "../../lib/respond.js";
import { revalidateTags } from "../../lib/revalidate.js";
import { sanitizeRichHtml } from "../../lib/sanitize.js";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { v, validate } from "../../middleware/validate.js";
import { audit } from "../audit/audit.service.js";
import { toMediaRef } from "../media/media.service.js";
import { adjust, credit } from "./coins.service.js";
import { publicPlayerName, type PlayerSessionStore } from "./player-auth.js";
import { CoinTxModel, PlayerModel, RedemptionModel, RewardModel, RoomEntryMemberModel, RoomEntryModel, RoomModel, ROOM_MAPS, ROOM_MODES, type RoomMode } from "./play.models.js";
import { completeRoom, computeStandings } from "./room.service.js";

const pageQuery = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(30) });
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const roomTags = (slug: string) => ["rooms", `room:${slug}`];
const youtubeUrl = z.union([z.literal(""), z.string().url().regex(/^https:\/\/(www\.|m\.)?(youtube\.com\/(watch\?v=|live\/|embed\/)|youtu\.be\/)[\w-]{6,}/, "Use a YouTube video or live link")]);
const created_ = (d: { createdAt?: Date }) => d.createdAt;

// ── Players ─────────────────────────────────────────────────────────────────
export function playerAdminRoutes(store: PlayerSessionStore): Router {
  const r = Router();
  r.get("/", requireAuth(), requirePermission("player:read"), validate({ query: pageQuery.extend({ q: z.string().trim().max(100).optional(), status: z.enum(["active", "banned", "deleted"]).optional() }) }), async (req, res) => {
    const q = v<{ page: number; limit: number; q?: string; status?: string }>(req.valid.query);
    const filter: Record<string, unknown> = { status: q.status ?? { $ne: "deleted" } };
    if (q.q) {
      const re = new RegExp(escapeRe(q.q), "i");
      filter.$or = [{ email: re }, { ign: re }, { displayName: re }, { characterId: q.q }];
    }
    const [items, total] = await Promise.all([PlayerModel.find(filter).sort({ createdAt: -1 }).skip(toSkip(q)).limit(q.limit), PlayerModel.countDocuments(filter)]);
    ok(res, items.map((p) => ({ id: p.id, email: p.email, displayName: p.displayName, ign: p.ign, characterId: p.characterId ?? "", coins: p.coins, status: p.status, createdAt: created_(p as never), lastLoginAt: p.lastLoginAt })), buildMeta(q, total));
  });

  r.get("/:id", requireAuth(), requirePermission("player:read"), async (req, res) => {
    const p = Types.ObjectId.isValid(String(req.params.id)) ? await PlayerModel.findById(req.params.id) : null;
    if (!p) throw notFound();
    const hashes = [p.signupIpHash, p.lastIpHash].filter(Boolean);
    const [ledger, entries, redemptions, related] = await Promise.all([
      CoinTxModel.find({ player: p._id }).sort({ createdAt: -1 }).limit(50),
      RoomEntryMemberModel.find({ player: p._id }).populate("room", "title slug").populate("entry", "status slot teamName").limit(50),
      RedemptionModel.find({ player: p._id }).sort({ createdAt: -1 }).limit(20),
      hashes.length ? PlayerModel.find({ _id: { $ne: p._id }, $or: [{ signupIpHash: { $in: hashes } }, { lastIpHash: { $in: hashes } }] }).select("email ign status createdAt").limit(20) : [],
    ]);
    ok(res, {
      id: p.id, email: p.email, name: p.name, displayName: p.displayName, ign: p.ign, characterId: p.characterId ?? "", characterIdLocked: Boolean(p.characterIdLockedAt),
      coins: p.coins, streak: p.streak, status: p.status, banReason: p.banReason, createdAt: created_(p as never), lastLoginAt: p.lastLoginAt,
      ledger: ledger.map((t) => ({ amount: t.amount, reason: t.reason, note: t.note, balanceAfter: t.balanceAfter, at: created_(t as never) })),
      rooms: entries.map((m) => ({ room: m.room, entry: m.entry })),
      redemptions: redemptions.map((x) => ({ id: x.id, rewardTitle: x.rewardTitle, cost: x.cost, status: x.status, createdAt: created_(x as never) })),
      relatedAccounts: related.map((x) => ({ id: x.id, email: x.email, ign: x.ign, status: x.status, createdAt: created_(x as never) })),
    });
  });

  r.post("/:id/ban", requireAuth(), requirePermission("player:update"), validate({ body: z.object({ reason: z.string().trim().min(3).max(300) }) }), async (req, res) => {
    const p = await PlayerModel.findOneAndUpdate({ _id: req.params.id, status: "active" }, { $set: { status: "banned", banReason: (req.valid.body as { reason: string }).reason } }, { new: true });
    if (!p) throw notFound();
    await store.destroyAll(p.id);
    await audit(req, { action: "player.ban", entityType: "player", entityId: p.id, summary: p.banReason ?? "" });
    ok(res, { id: p.id, status: p.status });
  });
  r.post("/:id/unban", requireAuth(), requirePermission("player:update"), async (req, res) => {
    const p = await PlayerModel.findOneAndUpdate({ _id: req.params.id, status: "banned" }, { $set: { status: "active" }, $unset: { banReason: 1 } }, { new: true });
    if (!p) throw notFound();
    await audit(req, { action: "player.unban", entityType: "player", entityId: p.id });
    ok(res, { id: p.id, status: p.status });
  });
  r.post("/:id/coins", requireAuth(), requirePermission("player:update"), validate({ body: z.object({ amount: z.number().int().min(-100_000).max(100_000).refine((n) => n !== 0, "Amount can't be 0"), reason: z.string().trim().min(3).max(300) }) }), async (req, res) => {
    const { amount, reason } = req.valid.body as { amount: number; reason: string };
    const p = await PlayerModel.findById(req.params.id);
    if (!p || p.status === "deleted") throw notFound();
    const balance = await adjust(p.id, amount, reason, `adjust:${p.id}:${randomToken(9)}`);
    await audit(req, { action: "player.coins_adjust", entityType: "player", entityId: p.id, summary: `${amount > 0 ? "+" : ""}${amount} SGC: ${reason}` });
    ok(res, { coins: balance });
  });
  r.post("/:id/unlock-character-id", requireAuth(), requirePermission("player:update"), async (req, res) => {
    const p = await PlayerModel.findByIdAndUpdate(req.params.id, { $unset: { characterIdLockedAt: 1 } }, { new: true });
    if (!p) throw notFound();
    await audit(req, { action: "player.unlock_character_id", entityType: "player", entityId: p.id });
    ok(res, { id: p.id });
  });
  return r;
}

// ── Custom rooms ────────────────────────────────────────────────────────────
const matchInput = z.object({ map: z.enum(ROOM_MAPS), scheduledAt: z.coerce.date() });
const roomBase = z.object({
  title: z.string().trim().min(5).max(120),
  slug: slugSchema.optional(),
  summary: z.string().trim().max(300).default(""),
  mode: z.enum(Object.keys(ROOM_MODES) as [RoomMode, ...RoomMode[]]),
  perspective: z.enum(["tpp", "fpp"]).default("tpp"),
  slotsTotal: z.number().int().min(2).max(100),
  registrationOpensAt: z.coerce.date(),
  registrationClosesAt: z.coerce.date(),
  revealMinutes: z.number().int().min(5).max(120).default(15),
  points: z.object({ placement: z.array(z.number().int().min(0).max(100)).min(1).max(25), perKill: z.number().int().min(0).max(10) }).optional(),
  prizes: z.array(z.object({ rank: z.number().int().min(1).max(25), coinsPerPlayer: z.number().int().min(0).max(100_000), label: z.string().trim().max(120).default("") })).max(25).default([]),
  rulesHtml: z.string().max(50_000).default(""),
  published: z.boolean().default(false),
});
const playersPerMatch = (mode: RoomMode, slots: number) => ROOM_MODES[mode] * slots;
const roomCreate = roomBase.extend({ matches: z.array(matchInput).min(1).max(12) }).superRefine((d, ctx) => {
  if (d.registrationClosesAt <= d.registrationOpensAt) ctx.addIssue({ code: "custom", path: ["registrationClosesAt"], message: "Must be after registration opens" });
  if (playersPerMatch(d.mode, d.slotsTotal) > 100) ctx.addIssue({ code: "custom", path: ["slotsTotal"], message: "A BGMI room holds at most 100 players (solo 100, duo 50, squad 25 slots)" });
});
const roomUpdate = roomBase.partial();
const matchUpdate = z.object({
  map: z.enum(ROOM_MAPS).optional(),
  scheduledAt: z.coerce.date().optional(),
  status: z.enum(["scheduled", "live", "completed", "cancelled"]).optional(),
  roomId: z.string().trim().max(30).optional(),
  roomPassword: z.string().trim().max(30).optional(),
  streamUrl: youtubeUrl.optional(),
});
const resultsInput = z.object({ results: z.array(z.object({ entryId: objectIdSchema, placement: z.number().int().min(1).max(100), kills: z.number().int().min(0).max(99) })).max(100) });

type Room = InstanceType<typeof RoomModel>;
function adminRoom(room: Room) {
  const o = room.toObject() as Record<string, unknown>;
  return {
    ...o,
    id: room.id,
    version: room.__v,
    matches: room.matches
      .map((m) => ({ no: m.no, map: m.map, scheduledAt: m.scheduledAt, status: m.status, streamUrl: m.streamUrl, roomId: m.roomIdEnc ? decrypt(m.roomIdEnc) : "", roomPassword: m.roomPasswordEnc ? decrypt(m.roomPasswordEnc) : "", results: m.results, resultsEnteredAt: m.resultsEnteredAt }))
      .sort((a, b) => a.no - b.no),
  };
}

export function roomAdminRoutes(): Router {
  const r = Router();
  const load = async (id: string) => {
    const room = Types.ObjectId.isValid(id) ? await RoomModel.findById(id) : null;
    if (!room) throw notFound();
    return room;
  };

  r.get("/", requireAuth(), requirePermission("room:read"), validate({ query: pageQuery }), async (req, res) => {
    const q = v<{ page: number; limit: number }>(req.valid.query);
    const [items, total] = await Promise.all([RoomModel.find().sort({ registrationClosesAt: -1 }).skip(toSkip(q)).limit(q.limit), RoomModel.countDocuments()]);
    const counts = await RoomEntryModel.aggregate<{ _id: { room: Types.ObjectId; status: string }; n: number }>([{ $match: { room: { $in: items.map((x) => x._id) } } }, { $group: { _id: { room: "$room", status: "$status" }, n: { $sum: 1 } } }]);
    ok(res, items.map((x) => ({ id: x.id, title: x.title, slug: x.slug, mode: x.mode, slotsTotal: x.slotsTotal, status: x.status, published: x.published, registrationOpensAt: x.registrationOpensAt, registrationClosesAt: x.registrationClosesAt, live: x.matches.some((m) => m.status === "live"), confirmed: counts.find((c) => c._id.room.equals(x._id) && c._id.status === "confirmed")?.n ?? 0, waitlist: counts.find((c) => c._id.room.equals(x._id) && c._id.status === "waitlist")?.n ?? 0 })), buildMeta(q, total));
  });

  r.get("/:id", requireAuth(), requirePermission("room:read"), async (req, res) => ok(res, adminRoom(await load(String(req.params.id)))));

  r.post("/", requireAuth(), requirePermission("room:create"), validate({ body: roomCreate }), async (req, res) => {
    const body = v<z.infer<typeof roomCreate>>(req.valid.body);
    const slug = body.slug ?? slugify(body.title);
    if (await RoomModel.exists({ slug })) throw conflict("That URL slug is already used by another room.");
    const room = await RoomModel.create({
      ...body,
      slug,
      rulesHtml: sanitizeRichHtml(body.rulesHtml),
      matches: body.matches.map((m, i) => ({ no: i + 1, map: m.map, scheduledAt: m.scheduledAt })),
      createdBy: req.session!.adminId,
    });
    await audit(req, { action: "room.create", entityType: "room", entityId: room.id, summary: room.title });
    await revalidateTags(roomTags(room.slug));
    created(res, adminRoom(room));
  });

  r.patch("/:id", requireAuth(), requirePermission("room:update"), validate({ body: roomUpdate }), async (req, res) => {
    const room = await load(String(req.params.id));
    const body = v<z.infer<typeof roomUpdate>>(req.valid.body);
    const hasEntries = await RoomEntryModel.exists({ room: room._id, status: { $in: ["confirmed", "waitlist"] } });
    if (hasEntries && body.mode && body.mode !== room.mode) throw conflict("Can't change the mode after teams have registered.");
    if (body.slotsTotal !== undefined && body.slotsTotal < room.nextSlot - room.freeSlots.length) throw conflict("There are more confirmed teams than that — remove some first.");
    if (body.slug && body.slug !== room.slug && (await RoomModel.exists({ slug: body.slug }))) throw conflict("That URL slug is already used by another room.");
    const mode = (body.mode ?? room.mode) as RoomMode;
    if (playersPerMatch(mode, body.slotsTotal ?? room.slotsTotal) > 100) throw badRequest("A BGMI room holds at most 100 players.");
    const oldSlug = room.slug;
    room.set({ ...body, ...(body.rulesHtml !== undefined && { rulesHtml: sanitizeRichHtml(body.rulesHtml) }) });
    if (room.registrationClosesAt <= room.registrationOpensAt) throw badRequest("Registration must close after it opens.");
    await room.save();
    await audit(req, { action: "room.update", entityType: "room", entityId: room.id, summary: room.title });
    await revalidateTags([...roomTags(room.slug), `room:${oldSlug}`]);
    ok(res, adminRoom(room));
  });

  r.delete("/:id", requireAuth(), requirePermission("room:delete"), async (req, res) => {
    const room = await load(String(req.params.id));
    if (await RoomEntryModel.exists({ room: room._id })) throw conflict("Teams have registered — cancel the room instead of deleting it.");
    await room.deleteOne();
    await audit(req, { action: "room.delete", entityType: "room", entityId: room.id, summary: room.title });
    await revalidateTags(roomTags(room.slug));
    noContent(res);
  });

  r.post("/:id/matches", requireAuth(), requirePermission("room:update"), validate({ body: matchInput }), async (req, res) => {
    const room = await load(String(req.params.id));
    if (room.matches.length >= 12) throw conflict("A room can have up to 12 matches.");
    const m = v<z.infer<typeof matchInput>>(req.valid.body);
    room.matches.push({ no: Math.max(0, ...room.matches.map((x) => x.no)) + 1, map: m.map, scheduledAt: m.scheduledAt } as never);
    await room.save();
    await revalidateTags(roomTags(room.slug));
    ok(res, adminRoom(room));
  });

  r.patch("/:id/matches/:no", requireAuth(), requirePermission("room:update"), validate({ body: matchUpdate }), async (req, res) => {
    const room = await load(String(req.params.id));
    const m = room.matches.find((x) => x.no === Number(req.params.no));
    if (!m) throw notFound("Match not found.");
    const body = v<z.infer<typeof matchUpdate>>(req.valid.body);
    if (body.map) m.map = body.map;
    if (body.scheduledAt) m.scheduledAt = body.scheduledAt;
    if (body.streamUrl !== undefined) m.streamUrl = body.streamUrl;
    if (body.roomId !== undefined) m.roomIdEnc = body.roomId ? encrypt(body.roomId) : undefined;
    if (body.roomPassword !== undefined) m.roomPasswordEnc = body.roomPassword ? encrypt(body.roomPassword) : undefined;
    if (body.status) {
      if (body.status === "completed" && !m.results?.length) throw conflict("Enter the results before completing the match.");
      m.status = body.status;
    }
    await room.save();
    await audit(req, { action: "room.match_update", entityType: "room", entityId: room.id, summary: `Match ${m.no}: ${Object.keys(body).filter((k) => k !== "roomPassword").join(", ")}` });
    await revalidateTags(roomTags(room.slug));
    ok(res, adminRoom(room));
  });

  r.delete("/:id/matches/:no", requireAuth(), requirePermission("room:update"), async (req, res) => {
    const room = await load(String(req.params.id));
    const m = room.matches.find((x) => x.no === Number(req.params.no));
    if (!m) throw notFound("Match not found.");
    if (m.results?.length) throw conflict("This match has results — cancel it instead.");
    room.matches = room.matches.filter((x) => x.no !== m.no) as never;
    await room.save();
    await revalidateTags(roomTags(room.slug));
    ok(res, adminRoom(room));
  });

  /** Enter or correct a match's results; marks the match completed. */
  r.put("/:id/matches/:no/results", requireAuth(), requirePermission("room:results"), validate({ body: resultsInput }), async (req, res) => {
    const room = await load(String(req.params.id));
    if (room.status !== "upcoming") throw conflict("This room is already finished.");
    const m = room.matches.find((x) => x.no === Number(req.params.no));
    if (!m) throw notFound("Match not found.");
    const rows = v<z.infer<typeof resultsInput>>(req.valid.body).results;
    const confirmed = await RoomEntryModel.find({ room: room._id, status: "confirmed" }).select("_id");
    const ids = new Set(confirmed.map((e) => String(e._id)));
    const bad = rows.find((x) => !ids.has(x.entryId));
    if (bad) throw badRequest("Results can only include confirmed teams of this room.", [{ path: "results", message: `Unknown or inactive entry ${bad.entryId}` }]);
    if (new Set(rows.map((x) => x.entryId)).size !== rows.length) throw badRequest("A team appears twice.");
    if (new Set(rows.map((x) => x.placement)).size !== rows.length) throw badRequest("Two teams can't have the same placement.");
    if (rows.some((x) => x.placement > confirmed.length)) throw badRequest(`Placements go from 1 to ${confirmed.length}.`);
    m.results = rows.map((x) => ({ entry: new Types.ObjectId(x.entryId), placement: x.placement, kills: x.kills })) as never;
    m.resultsEnteredAt = new Date();
    m.status = "completed";
    await room.save();
    await audit(req, { action: "room.results", entityType: "room", entityId: room.id, summary: `Match ${m.no} results (${rows.length} teams)` });
    await revalidateTags(roomTags(room.slug));
    ok(res, { room: adminRoom(room), standings: computeStandings(room, await RoomEntryModel.find({ room: room._id })) });
  });

  r.get("/:id/entries", requireAuth(), requirePermission("room:read"), async (req, res) => {
    const room = await load(String(req.params.id));
    const entries = await RoomEntryModel.find({ room: room._id }).sort({ status: 1, slot: 1, createdAt: 1 });
    const players = await PlayerModel.find({ _id: { $in: entries.flatMap((e) => [...e.players, ...(e.substitute ? [e.substitute] : [])]) } }).select("ign displayName characterId email status");
    const pl = (id: Types.ObjectId) => {
      const p = players.find((x) => x._id.equals(id));
      return { id: String(id), name: publicPlayerName(p), characterId: p?.characterId ?? "", email: p?.email ?? "" };
    };
    ok(res, {
      entries: entries.map((e) => ({ id: e.id, status: e.status, slot: e.slot ?? null, teamName: e.teamName, teamTag: e.teamTag, dqReason: e.dqReason, createdAt: created_(e as never), players: e.players.map(pl), substitute: e.substitute ? pl(e.substitute) : null })),
      standings: room.status === "completed" && room.finalStandings ? room.finalStandings : computeStandings(room, entries),
    });
  });

  r.post("/:id/entries/:entryId/disqualify", requireAuth(), requirePermission("room:results"), validate({ body: z.object({ reason: z.string().trim().min(3).max(300) }) }), async (req, res) => {
    const room = await load(String(req.params.id));
    if (room.status === "completed") throw conflict("The room is completed — standings are final.");
    const e = await RoomEntryModel.findOneAndUpdate({ _id: req.params.entryId, room: room._id, status: "confirmed" }, { $set: { status: "disqualified", dqReason: (req.valid.body as { reason: string }).reason } }, { new: true });
    if (!e) throw notFound("Confirmed entry not found.");
    await audit(req, { action: "room.disqualify", entityType: "room", entityId: room.id, summary: `${e.teamName}: ${e.dqReason}` });
    await revalidateTags(roomTags(room.slug));
    ok(res, { id: e.id, status: e.status });
  });

  r.post("/:id/complete", requireAuth(), requirePermission("room:results"), async (req, res) => {
    const room = await load(String(req.params.id));
    const result = await completeRoom(room);
    await audit(req, { action: "room.complete", entityType: "room", entityId: room.id, summary: `${room.title}: ${result.credited} prize credits` });
    await revalidateTags(roomTags(room.slug));
    ok(res, result);
  });

  r.post("/:id/cancel", requireAuth(), requirePermission("room:update"), async (req, res) => {
    const room = await load(String(req.params.id));
    if (room.status === "completed") throw conflict("Completed rooms can't be cancelled.");
    room.status = "cancelled";
    for (const m of room.matches) if (m.status === "scheduled" || m.status === "live") m.status = "cancelled";
    await room.save();
    await audit(req, { action: "room.cancel", entityType: "room", entityId: room.id, summary: room.title });
    await revalidateTags(roomTags(room.slug));
    ok(res, adminRoom(room));
  });
  return r;
}

// ── Rewards ─────────────────────────────────────────────────────────────────
const rewardInput = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().max(500).default(""),
  kind: z.enum(["uc_voucher", "royal_pass_voucher", "other_voucher"]),
  costCoins: z.number().int().min(1).max(1_000_000),
  stock: z.number().int().min(0).max(100_000).nullable().default(null),
  perPlayerPer30Days: z.number().int().min(1).max(30).default(1),
  image: objectIdSchema.nullable().optional(),
  active: z.boolean().default(false),
  sort: z.number().int().min(0).max(1000).default(0),
});

export function rewardAdminRoutes(): Router {
  const r = Router();
  const dto = (x: InstanceType<typeof RewardModel>) => ({ id: x.id, title: x.title, description: x.description, kind: x.kind, costCoins: x.costCoins, stock: x.stock, perPlayerPer30Days: x.perPlayerPer30Days, image: x.image && typeof x.image === "object" && "variants" in x.image ? { id: String((x.image as { _id: unknown })._id), ...toMediaRef(x.image as never) } : x.image ? { id: String(x.image) } : null, active: x.active, sort: x.sort });
  r.get("/", requireAuth(), requirePermission("reward:read"), async (_req, res) => ok(res, (await RewardModel.find().sort({ sort: 1, costCoins: 1 }).populate("image")).map(dto)));
  r.post("/", requireAuth(), requirePermission("reward:create"), validate({ body: rewardInput }), async (req, res) => {
    const x = await RewardModel.create(req.valid.body as object);
    await audit(req, { action: "reward.create", entityType: "reward", entityId: x.id, summary: x.title });
    created(res, dto(x));
  });
  r.patch("/:id", requireAuth(), requirePermission("reward:update"), validate({ body: rewardInput.partial() }), async (req, res) => {
    const x = Types.ObjectId.isValid(String(req.params.id)) ? await RewardModel.findById(req.params.id) : null;
    if (!x) throw notFound();
    x.set(req.valid.body as object);
    await x.save();
    await audit(req, { action: "reward.update", entityType: "reward", entityId: x.id, summary: x.title });
    ok(res, dto(x));
  });
  r.delete("/:id", requireAuth(), requirePermission("reward:delete"), async (req, res) => {
    const x = Types.ObjectId.isValid(String(req.params.id)) ? await RewardModel.findById(req.params.id) : null;
    if (!x) throw notFound();
    if (await RedemptionModel.exists({ reward: x._id })) throw conflict("This reward has redemptions — deactivate it instead.");
    await x.deleteOne();
    await audit(req, { action: "reward.delete", entityType: "reward", entityId: x.id, summary: x.title });
    noContent(res);
  });
  return r;
}

// ── Redemption queue ────────────────────────────────────────────────────────
export function redemptionAdminRoutes(): Router {
  const r = Router();
  r.get("/", requireAuth(), requirePermission("redemption:read"), validate({ query: pageQuery.extend({ status: z.enum(["pending", "fulfilled", "rejected"]).default("pending") }) }), async (req, res) => {
    const q = v<{ page: number; limit: number; status: "pending" | "fulfilled" | "rejected" }>(req.valid.query);
    const filter = { status: q.status };
    const [items, total] = await Promise.all([
      RedemptionModel.find(filter).sort({ createdAt: q.status === "pending" ? 1 : -1 }).skip(toSkip(q)).limit(q.limit),
      RedemptionModel.countDocuments(filter),
    ]);
    const players = await PlayerModel.find({ _id: { $in: items.map((x) => x.player) } });
    const rows = await Promise.all(
      items.map(async (x) => {
        const p = players.find((pp) => pp._id.equals(x.player));
        const hashes = [p?.signupIpHash, p?.lastIpHash, x.ipHash].filter(Boolean) as string[];
        const relatedAccounts = hashes.length ? await PlayerModel.countDocuments({ _id: { $ne: x.player }, $or: [{ signupIpHash: { $in: hashes } }, { lastIpHash: { $in: hashes } }] }) : 0;
        return {
          id: x.id, rewardTitle: x.rewardTitle, cost: x.cost, status: x.status, playerNote: x.playerNote, adminNote: x.adminNote, createdAt: created_(x as never), handledAt: x.handledAt,
          player: p && { id: p.id, email: p.email, ign: p.ign, characterId: p.characterId ?? "", status: p.status, createdAt: created_(p as never), accountAgeDays: Math.floor((Date.now() - (created_(p as never) as Date).getTime()) / 86_400_000) },
          relatedAccounts,
        };
      }),
    );
    ok(res, rows, buildMeta(q, total));
  });
  r.post("/:id/fulfil", requireAuth(), requirePermission("redemption:update"), validate({ body: z.object({ code: z.string().trim().min(4).max(200), note: z.string().trim().max(300).default("") }) }), async (req, res) => {
    const body = req.valid.body as { code: string; note: string };
    const x = await RedemptionModel.findOneAndUpdate({ _id: req.params.id, status: "pending" }, { $set: { status: "fulfilled", codeEnc: encrypt(body.code), adminNote: body.note, handledBy: req.session!.adminId, handledAt: new Date() } }, { new: true });
    if (!x) throw notFound("Pending request not found.");
    await audit(req, { action: "redemption.fulfil", entityType: "redemption", entityId: x.id, summary: x.rewardTitle });
    ok(res, { id: x.id, status: x.status });
  });
  r.post("/:id/reject", requireAuth(), requirePermission("redemption:update"), validate({ body: z.object({ reason: z.string().trim().min(3).max(300) }) }), async (req, res) => {
    const reason = (req.valid.body as { reason: string }).reason;
    const x = await RedemptionModel.findOneAndUpdate({ _id: req.params.id, status: "pending" }, { $set: { status: "rejected", adminNote: reason, handledBy: req.session!.adminId, handledAt: new Date() } }, { new: true });
    if (!x) throw notFound("Pending request not found.");
    await credit(x.player, x.cost, "redeem_refund", `refund:${x.id}`, `Refund: ${x.rewardTitle}`);
    await RewardModel.updateOne({ _id: x.reward, stock: { $ne: null } }, { $inc: { stock: 1 } });
    await audit(req, { action: "redemption.reject", entityType: "redemption", entityId: x.id, summary: `${x.rewardTitle}: ${reason}` });
    ok(res, { id: x.id, status: x.status });
  });
  return r;
}
