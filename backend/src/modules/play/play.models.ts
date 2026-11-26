import { Schema, model, Types, type InferSchemaType } from "mongoose";

/**
 * Play module models (docs/architecture/15-play.md). BGMI only. Free to play: nothing here is ever bought,
 * and SGC coins can't be transferred or cashed out.
 */

// ── Players (public site accounts, Google sign-in, 18+) ─────────────────────
const playerSchema = new Schema(
  {
    googleSub: { type: String, required: true, unique: true },
    email: { type: String, default: "", lowercase: true, trim: true },
    name: { type: String, default: "", maxlength: 120 },
    avatarUrl: { type: String, default: "" },
    displayName: { type: String, default: "", maxlength: 40 },
    ign: { type: String, default: "", maxlength: 30 },
    /** BGMI Character ID (numeric). One account per Character ID. Locked once a reward has been redeemed. */
    characterId: { type: String, default: undefined },
    characterIdLockedAt: { type: Date },
    ageConfirmedAt: { type: Date, required: true },
    termsAcceptedAt: { type: Date, required: true },
    coins: { type: Number, default: 0, min: 0 },
    streak: { count: { type: Number, default: 0 }, lastDay: { type: String, default: "" } },
    status: { type: String, enum: ["active", "banned", "deleted"], default: "active" },
    banReason: { type: String, maxlength: 300 },
    signupIpHash: { type: String, default: "" },
    lastIpHash: { type: String, default: "" },
    lastLoginAt: { type: Date },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);
playerSchema.index({ characterId: 1 }, { unique: true, partialFilterExpression: { characterId: { $type: "string" } } });
playerSchema.index({ status: 1, createdAt: -1 });
playerSchema.index({ signupIpHash: 1 });
playerSchema.index({ email: 1 });
export const PlayerModel = model("Player", playerSchema);
export type PlayerDoc = InferSchemaType<typeof playerSchema> & { _id: Types.ObjectId };

// ── Squads ──────────────────────────────────────────────────────────────────
export const SQUAD_MAX_MEMBERS = 5; // 4 players + 1 substitute
export const SQUADS_PER_PLAYER = 3;
const squadSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    tag: { type: String, required: true, trim: true, uppercase: true, maxlength: 5 },
    captain: { type: Types.ObjectId, ref: "Player", required: true },
    members: [{ _id: false, player: { type: Types.ObjectId, ref: "Player", required: true }, joinedAt: { type: Date, default: Date.now } }],
    inviteCode: { type: String, required: true, unique: true },
    disbandedAt: { type: Date },
  },
  { timestamps: true },
);
squadSchema.index({ "members.player": 1 });
export const SquadModel = model("Squad", squadSchema);

// ── Custom rooms (Shivanshi Custom Rooms) ───────────────────────────────────
export const ROOM_MAPS = ["erangel", "miramar", "sanhok", "vikendi", "livik", "rondo", "karakin", "nusa"] as const;
export const ROOM_MODES = { solo: 1, duo: 2, squad: 4 } as const;
export type RoomMode = keyof typeof ROOM_MODES;
/** Current BGMI esports standard: placement 10-6-5-4-3-2-1-1 then 0, plus 1 point per kill. Editable per room. */
export const DEFAULT_PLACEMENT_POINTS = [10, 6, 5, 4, 3, 2, 1, 1];

const matchSchema = new Schema(
  {
    no: { type: Number, required: true },
    map: { type: String, enum: ROOM_MAPS, required: true },
    scheduledAt: { type: Date, required: true },
    status: { type: String, enum: ["scheduled", "live", "completed", "cancelled"], default: "scheduled" },
    /** AES-GCM encrypted (lib/crypto). Shown only to confirmed entrants from `revealMinutes` before start. */
    roomIdEnc: { type: String },
    roomPasswordEnc: { type: String },
    streamUrl: { type: String, default: "" },
    results: [{ _id: false, entry: { type: Types.ObjectId, ref: "RoomEntry", required: true }, placement: { type: Number, required: true, min: 1 }, kills: { type: Number, required: true, min: 0 } }],
    resultsEnteredAt: { type: Date },
  },
  { _id: false },
);

const roomSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true },
    summary: { type: String, default: "", maxlength: 300 },
    mode: { type: String, enum: Object.keys(ROOM_MODES), required: true },
    perspective: { type: String, enum: ["tpp", "fpp"], default: "tpp" },
    slotsTotal: { type: Number, required: true, min: 2, max: 100 },
    /** Next new slot number is nextSlot + 1; freed slots are reused first. */
    nextSlot: { type: Number, default: 0 },
    freeSlots: { type: [Number], default: [] },
    registrationOpensAt: { type: Date, required: true },
    registrationClosesAt: { type: Date, required: true },
    revealMinutes: { type: Number, default: 15, min: 5, max: 120 },
    matches: { type: [matchSchema], default: [] },
    points: {
      placement: { type: [Number], default: () => [...DEFAULT_PLACEMENT_POINTS] },
      perKill: { type: Number, default: 1 },
    },
    /** Prizes are SGC coins credited to every member of the entry (vouchers come from the rewards store). */
    prizes: [{ _id: false, rank: { type: Number, required: true, min: 1 }, coinsPerPlayer: { type: Number, default: 0, min: 0 }, label: { type: String, default: "", maxlength: 120 } }],
    rulesHtml: { type: String, default: "" },
    published: { type: Boolean, default: false },
    status: { type: String, enum: ["upcoming", "completed", "cancelled"], default: "upcoming" },
    completedAt: { type: Date },
    /** Frozen at completion. */
    finalStandings: { type: Schema.Types.Mixed },
    createdBy: { type: Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true, optimisticConcurrency: true },
);
roomSchema.index({ published: 1, status: 1, registrationClosesAt: 1 });
export const RoomModel = model("CustomRoom", roomSchema);

const entrySchema = new Schema(
  {
    room: { type: Types.ObjectId, ref: "CustomRoom", required: true },
    /** Captain (squad/duo) or the solo player. */
    captain: { type: Types.ObjectId, ref: "Player", required: true },
    squad: { type: Types.ObjectId, ref: "Squad" },
    /** Display name frozen at registration (squad name or player IGN). */
    teamName: { type: String, required: true, maxlength: 60 },
    teamTag: { type: String, default: "", maxlength: 5 },
    players: [{ type: Types.ObjectId, ref: "Player" }],
    substitute: { type: Types.ObjectId, ref: "Player" },
    slot: { type: Number },
    status: { type: String, enum: ["confirmed", "waitlist", "withdrawn", "disqualified"], required: true },
    dqReason: { type: String, maxlength: 300 },
  },
  { timestamps: true },
);
entrySchema.index({ room: 1, status: 1, createdAt: 1 });
entrySchema.index({ room: 1, slot: 1 }, { unique: true, partialFilterExpression: { status: "confirmed" } });
export const RoomEntryModel = model("RoomEntry", entrySchema);

/** One row per player per room — the unique index guarantees a player is in at most one entry. */
const entryMemberSchema = new Schema({
  room: { type: Types.ObjectId, ref: "CustomRoom", required: true },
  player: { type: Types.ObjectId, ref: "Player", required: true },
  entry: { type: Types.ObjectId, ref: "RoomEntry", required: true },
});
entryMemberSchema.index({ room: 1, player: 1 }, { unique: true });
entryMemberSchema.index({ entry: 1 });
entryMemberSchema.index({ player: 1 });
export const RoomEntryMemberModel = model("RoomEntryMember", entryMemberSchema);

// ── SGC coins ───────────────────────────────────────────────────────────────
const coinTxSchema = new Schema(
  {
    player: { type: Types.ObjectId, ref: "Player", required: true },
    amount: { type: Number, required: true },
    reason: { type: String, enum: ["spin", "streak_bonus", "room_prize", "redeem", "redeem_refund", "admin_adjust"], required: true },
    /** Idempotency key: the same credit/debit can never be applied twice. */
    refKey: { type: String, required: true, unique: true },
    note: { type: String, default: "", maxlength: 300 },
    balanceAfter: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
coinTxSchema.index({ player: 1, createdAt: -1 });
export const CoinTxModel = model("CoinTransaction", coinTxSchema);

// ── Rewards store & redemptions ─────────────────────────────────────────────
const rewardSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: "", maxlength: 500 },
    kind: { type: String, enum: ["uc_voucher", "royal_pass_voucher", "other_voucher"], required: true },
    costCoins: { type: Number, required: true, min: 1 },
    /** null = unlimited. */
    stock: { type: Number, default: null, min: 0 },
    perPlayerPer30Days: { type: Number, default: 1, min: 1 },
    image: { type: Types.ObjectId, ref: "Media" },
    active: { type: Boolean, default: false },
    sort: { type: Number, default: 0 },
  },
  { timestamps: true },
);
export const RewardModel = model("Reward", rewardSchema);

const redemptionSchema = new Schema(
  {
    player: { type: Types.ObjectId, ref: "Player", required: true },
    reward: { type: Types.ObjectId, ref: "Reward", required: true },
    rewardTitle: { type: String, required: true },
    cost: { type: Number, required: true },
    status: { type: String, enum: ["pending", "fulfilled", "rejected"], default: "pending" },
    /** Official voucher code, AES-GCM encrypted; shown only to the player. */
    codeEnc: { type: String },
    playerNote: { type: String, default: "", maxlength: 300 },
    adminNote: { type: String, default: "", maxlength: 300 },
    handledBy: { type: Types.ObjectId, ref: "Admin" },
    handledAt: { type: Date },
    ipHash: { type: String, default: "" },
  },
  { timestamps: true },
);
redemptionSchema.index({ status: 1, createdAt: 1 });
redemptionSchema.index({ player: 1, createdAt: -1 });
export const RedemptionModel = model("Redemption", redemptionSchema);
