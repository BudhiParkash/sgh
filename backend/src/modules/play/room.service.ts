import { Types } from "mongoose";
import { decrypt } from "../../lib/crypto.js";
import { badRequest, conflict, forbidden, notFound } from "../../lib/errors.js";
import { credit } from "./coins.service.js";
import { publicPlayerName } from "./player-auth.js";
import { PlayerModel, RoomEntryMemberModel, RoomEntryModel, RoomModel, ROOM_MODES, SquadModel, type RoomMode } from "./play.models.js";

type Room = InstanceType<typeof RoomModel>;
type Entry = InstanceType<typeof RoomEntryModel>;

export function registrationState(room: Pick<Room, "registrationOpensAt" | "registrationClosesAt" | "status">, now = Date.now()): "not_open" | "open" | "closed" {
  if (room.status !== "upcoming") return "closed";
  if (now < room.registrationOpensAt.getTime()) return "not_open";
  if (now > room.registrationClosesAt.getTime()) return "closed";
  return "open";
}

// ── Slots ───────────────────────────────────────────────────────────────────
/** Atomically takes the lowest freed slot, else the next new one. Returns null when the room is full. */
export async function allocateSlot(roomId: Types.ObjectId): Promise<number | null> {
  const reused = await RoomModel.findOneAndUpdate({ _id: roomId, "freeSlots.0": { $exists: true } }, { $pop: { freeSlots: -1 } }, { new: false }).select("freeSlots");
  if (reused?.freeSlots?.length) return reused.freeSlots[0]!;
  const next = await RoomModel.findOneAndUpdate({ _id: roomId, $expr: { $lt: ["$nextSlot", "$slotsTotal"] } }, { $inc: { nextSlot: 1 } }, { new: true }).select("nextSlot");
  return next ? next.nextSlot : null;
}

async function releaseSlot(roomId: Types.ObjectId, slot: number): Promise<void> {
  await RoomModel.updateOne({ _id: roomId }, { $push: { freeSlots: { $each: [slot], $sort: 1 } } });
}

// ── Registration ────────────────────────────────────────────────────────────
export interface RegisterInput {
  squadId?: string;
  playerIds?: string[];
  substituteId?: string;
}

export async function register(room: Room, captainId: Types.ObjectId, input: RegisterInput): Promise<Entry> {
  if (!room.published) throw notFound();
  if (registrationState(room) !== "open") throw conflict("Registration for this room is not open.");
  const mode = room.mode as RoomMode;
  const size = ROOM_MODES[mode];

  let playerIds: Types.ObjectId[];
  let substitute: Types.ObjectId | undefined;
  let squad: InstanceType<typeof SquadModel> | null = null;
  if (mode === "solo") {
    playerIds = [captainId];
  } else {
    if (!input.squadId || !Types.ObjectId.isValid(input.squadId)) throw badRequest("Choose one of your squads.");
    squad = await SquadModel.findOne({ _id: input.squadId, disbandedAt: null });
    if (!squad) throw notFound("Squad not found.");
    if (!squad.captain.equals(captainId)) throw forbidden("Only the squad captain can register the squad.");
    const memberIds = new Set(squad.members.map((m) => String(m.player)));
    const picked = [...new Set(input.playerIds ?? [])];
    if (picked.length !== size) throw badRequest(`Pick exactly ${size} players for ${mode}.`);
    if (!picked.includes(String(captainId))) throw badRequest("The captain must be one of the players.");
    if (!picked.every((id) => memberIds.has(id))) throw badRequest("Every player must be a member of the squad.");
    playerIds = picked.map((id) => new Types.ObjectId(id));
    if (input.substituteId) {
      if (mode !== "squad") throw badRequest("Substitutes are only for squad rooms.");
      if (!memberIds.has(input.substituteId) || picked.includes(input.substituteId)) throw badRequest("The substitute must be another member of the squad.");
      substitute = new Types.ObjectId(input.substituteId);
    }
  }

  const everyone = [...playerIds, ...(substitute ? [substitute] : [])];
  const players = await PlayerModel.find({ _id: { $in: everyone } }).select("status ign displayName characterId");
  if (players.length !== everyone.length || players.some((p) => p.status !== "active")) throw badRequest("Every player needs an active account.");
  const missing = players.filter((p) => !p.characterId || !p.ign);
  if (missing.length) throw badRequest(`Add a BGMI name and Character ID to your profile first: ${missing.map((p) => publicPlayerName(p)).join(", ")}.`);

  const captain = players.find((p) => p._id.equals(captainId))!;
  const entry = await RoomEntryModel.create({
    room: room._id,
    captain: captainId,
    squad: squad?._id,
    teamName: squad ? squad.name : publicPlayerName(captain),
    teamTag: squad?.tag ?? "",
    players: playerIds,
    substitute,
    status: "waitlist",
  });
  try {
    await RoomEntryMemberModel.insertMany(
      everyone.map((p) => ({ room: room._id, player: p, entry: entry._id })),
      { ordered: true },
    );
  } catch (e) {
    await Promise.all([RoomEntryMemberModel.deleteMany({ entry: entry._id }), RoomEntryModel.deleteOne({ _id: entry._id })]);
    if ((e as { code?: number }).code === 11000) {
      const taken = await RoomEntryMemberModel.find({ room: room._id, player: { $in: everyone } }).select("player");
      const names = players.filter((p) => taken.some((t) => t.player.equals(p._id))).map((p) => publicPlayerName(p));
      throw conflict(`Already registered in this room: ${names.join(", ")}.`);
    }
    throw e;
  }
  const slot = await allocateSlot(room._id);
  if (slot !== null) {
    entry.status = "confirmed";
    entry.slot = slot;
    await entry.save();
  }
  return entry;
}

/** Withdraw before registration closes. A confirmed slot goes to the earliest waitlisted entry, or back to the pool. */
export async function withdraw(room: Room, entry: Entry): Promise<void> {
  if (registrationState(room) !== "open") throw conflict("Registration has closed — contact the organisers to withdraw.");
  if (!["confirmed", "waitlist"].includes(entry.status)) throw conflict("This entry is not active.");
  const slot = entry.status === "confirmed" ? entry.slot : undefined;
  await RoomEntryModel.updateOne({ _id: entry._id }, { $set: { status: "withdrawn" }, $unset: { slot: 1 } });
  await RoomEntryMemberModel.deleteMany({ entry: entry._id });
  if (slot === undefined || slot === null) return;
  const promoted = await RoomEntryModel.findOneAndUpdate({ room: room._id, status: "waitlist" }, { $set: { status: "confirmed", slot } }, { sort: { createdAt: 1 }, new: true });
  if (!promoted) await releaseSlot(room._id, slot);
}

// ── Standings ───────────────────────────────────────────────────────────────
export interface StandingRow {
  rank: number;
  entryId: string;
  slot: number | null;
  teamName: string;
  teamTag: string;
  matchesPlayed: number;
  placementPoints: number;
  kills: number;
  killPoints: number;
  total: number;
  lastPlacement: number | null;
}

export function computeStandings(room: Pick<Room, "matches" | "points">, entries: Pick<Entry, "_id" | "slot" | "teamName" | "teamTag" | "status">[]): StandingRow[] {
  const placementTable = room.points?.placement ?? [];
  const perKill = room.points?.perKill ?? 1;
  const rows = new Map<string, StandingRow>();
  for (const e of entries) {
    if (e.status !== "confirmed") continue;
    rows.set(String(e._id), { rank: 0, entryId: String(e._id), slot: e.slot ?? null, teamName: e.teamName, teamTag: e.teamTag ?? "", matchesPlayed: 0, placementPoints: 0, kills: 0, killPoints: 0, total: 0, lastPlacement: null });
  }
  const played = [...room.matches].filter((m) => m.status === "completed" && m.results?.length).sort((a, b) => a.no - b.no);
  for (const m of played) {
    for (const r of m.results) {
      const row = rows.get(String(r.entry));
      if (!row) continue; // disqualified/withdrawn entries don't score
      row.matchesPlayed += 1;
      row.placementPoints += placementTable[r.placement - 1] ?? 0;
      row.kills += r.kills;
      row.killPoints += r.kills * perKill;
      row.lastPlacement = r.placement;
    }
  }
  const list = [...rows.values()].map((r) => ({ ...r, total: r.placementPoints + r.killPoints }));
  list.sort((a, b) => b.total - a.total || b.placementPoints - a.placementPoints || b.kills - a.kills || (a.lastPlacement ?? 999) - (b.lastPlacement ?? 999) || (a.slot ?? 999) - (b.slot ?? 999));
  list.forEach((r, i) => (r.rank = i + 1));
  return list;
}

// ── Room credentials ────────────────────────────────────────────────────────
/** Room ID/password for matches about to start — only for players in a confirmed entry. */
export function revealedCredentials(room: Room, now = Date.now()) {
  return room.matches
    .filter((m) => (m.status === "scheduled" || m.status === "live") && now >= m.scheduledAt.getTime() - room.revealMinutes * 60_000 && m.roomIdEnc)
    .map((m) => ({ no: m.no, map: m.map, scheduledAt: m.scheduledAt, roomId: decrypt(m.roomIdEnc!), roomPassword: m.roomPasswordEnc ? decrypt(m.roomPasswordEnc) : "" }));
}

// ── Completion ──────────────────────────────────────────────────────────────
/** Freezes final standings and credits SGC prizes to every member of the winning entries (idempotent). */
export async function completeRoom(room: Room): Promise<{ standings: StandingRow[]; credited: number }> {
  if (room.status === "cancelled") throw conflict("This room was cancelled.");
  if (room.matches.some((m) => m.status === "live" || m.status === "scheduled")) throw conflict("Finish or cancel every match first.");
  const entries = await RoomEntryModel.find({ room: room._id });
  const standings = computeStandings(room, entries);
  let credited = 0;
  for (const prize of room.prizes ?? []) {
    const row = standings[prize.rank - 1];
    if (!row || !prize.coinsPerPlayer) continue;
    const entry = entries.find((e) => String(e._id) === row.entryId)!;
    for (const p of [...entry.players, ...(entry.substitute ? [entry.substitute] : [])]) {
      const done = await credit(p, prize.coinsPerPlayer, "room_prize", `room:${room._id}:rank:${prize.rank}:${p}`, `${room.title} — rank ${prize.rank}`);
      if (done !== null) credited += 1;
    }
  }
  room.status = "completed";
  room.completedAt = room.completedAt ?? new Date();
  room.finalStandings = standings;
  await room.save();
  return { standings, credited };
}
