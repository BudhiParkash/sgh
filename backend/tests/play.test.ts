/* eslint-disable @typescript-eslint/no-explicit-any -- JSON API bodies */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agentPermissionFilter } from "../src/modules/admins/permissions.js";
import { setGoogleVerifierForTests } from "../src/modules/play/player-auth.js";
import { CoinTxModel, PlayerModel, RedemptionModel } from "../src/modules/play/play.models.js";
import { computeStandings } from "../src/modules/play/room.service.js";
import { istDay } from "../src/modules/play/coins.service.js";
import { createAdmin, freshIp, makeApp, signInWith2fa, type Agent } from "./helpers.js";

const app = makeApp();
const P = "/api/v1/player";
const A = "/api/v1/admin";

// Fake Google: credential "sub|email|verified".
beforeAll(() =>
  setGoogleVerifierForTests(async (c) => {
    const [sub, email, verified] = c.split("|");
    if (!sub || !email) throw new Error("bad token");
    return { sub, email, emailVerified: !verified?.startsWith("no"), name: `Name ${sub}`, picture: "" };
  }),
);
afterAll(() => setGoogleVerifierForTests(null));

interface PlayerAgent {
  agent: ReturnType<typeof request.agent>;
  csrf: string;
  ip: string;
  id: string;
}
const cred = (sub: string, verified = true) => `${sub}|${sub}@example.com|${verified ? "yes" : "no"}`.padEnd(24, "_");

async function signUp(sub: string, profile: { ign?: string; characterId?: string } = {}): Promise<PlayerAgent> {
  const ip = freshIp();
  const agent = request.agent(app);
  const res = await agent.post(`${P}/auth/google`).set("X-Forwarded-For", ip).send({ credential: cred(sub), confirmAge: true, acceptTerms: true });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  const pa = { agent, csrf: res.body.data.player.csrfToken as string, ip, id: res.body.data.player.id as string };
  if (profile.ign || profile.characterId) {
    const up = await pcall(pa, "patch", "/me").send(profile);
    expect(up.status, JSON.stringify(up.body)).toBe(200);
  }
  return pa;
}
const pcall = (a: PlayerAgent, method: "get" | "post" | "patch" | "delete", path: string) => a.agent[method](P + path).set("X-Forwarded-For", a.ip).set("X-CSRF-Token", a.csrf);
const acall = (a: Agent, method: "get" | "post" | "patch" | "put" | "delete", path: string) => a.agent[method](A + path).set("X-Forwarded-For", a.ip).set("X-CSRF-Token", a.csrf);

async function owner() {
  await createAdmin("super_admin", "owner@test.local");
  return signInWith2fa(app, "owner@test.local");
}

const hour = 3_600_000;
function roomBody(over: Record<string, unknown> = {}) {
  return {
    title: "Shivanshi Custom Room — Squad Erangel",
    mode: "squad",
    slotsTotal: 2,
    registrationOpensAt: new Date(Date.now() - hour).toISOString(),
    registrationClosesAt: new Date(Date.now() + 2 * hour).toISOString(),
    matches: [
      { map: "erangel", scheduledAt: new Date(Date.now() + 10 * 60_000).toISOString() },
      { map: "livik", scheduledAt: new Date(Date.now() + 5 * hour).toISOString() },
    ],
    prizes: [{ rank: 1, coinsPerPlayer: 100, label: "Winner" }],
    published: true,
    ...over,
  };
}

/** Squad of 4 ready players (captain first). */
async function readySquad(prefix: string) {
  const members = await Promise.all([0, 1, 2, 3].map((i) => signUp(`${prefix}${i}`, { ign: `${prefix.toUpperCase()}_${i}`, characterId: `5${prefix.length}${Date.now() % 100000}${i}${Math.floor(Math.random() * 1000)}` })));
  const [cap, ...rest] = members;
  const sq = await pcall(cap!, "post", "/squads").send({ name: `Team ${prefix}`, tag: prefix.slice(0, 4).toUpperCase() });
  expect(sq.status).toBe(201);
  for (const m of rest) expect((await pcall(m, "post", "/squads/join").send({ code: sq.body.data.inviteCode })).status).toBe(200);
  return { cap: cap!, members, squadId: sq.body.data.id as string, ids: members.map((m) => m.id) };
}

describe("Play: accounts, squads, custom rooms, coins, rewards", () => {
  it("Google sign-in: consent first, 18+ and terms recorded; unverified email refused; banned players blocked", async () => {
    const ip = freshIp();
    const first = await request(app).post(`${P}/auth/google`).set("X-Forwarded-For", ip).send({ credential: cred("g1") });
    expect(first.body.data).toMatchObject({ status: "consent_required", email: "g1@example.com" });
    expect(await PlayerModel.countDocuments()).toBe(0);

    expect((await request(app).post(`${P}/auth/google`).set("X-Forwarded-For", ip).send({ credential: cred("g2", false), confirmAge: true, acceptTerms: true })).status).toBe(403);

    const a = await signUp("g1");
    const me = await pcall(a, "get", "/me");
    expect(me.body.data).toMatchObject({ email: "g1@example.com", coins: 0, characterId: "" });
    const doc = await PlayerModel.findById(a.id);
    expect(doc!.ageConfirmedAt).toBeInstanceOf(Date);
    expect(doc!.termsAcceptedAt).toBeInstanceOf(Date);

    // Admin endpoints are not reachable with a player session.
    expect((await a.agent.get(`${A}/players`).set("X-Forwarded-For", a.ip)).status).toBe(401);
    // CSRF required for state changes.
    expect((await a.agent.patch(`${P}/me`).set("X-Forwarded-For", a.ip).send({ ign: "X" })).status).toBe(403);

    const admin = await owner();
    expect((await acall(admin, "post", `/players/${a.id}/ban`).send({ reason: "Multi-accounting" })).status).toBe(200);
    expect((await pcall(a, "get", "/me")).status).toBe(401); // sessions destroyed
    expect((await request(app).post(`${P}/auth/google`).set("X-Forwarded-For", freshIp()).send({ credential: cred("g1") })).status).toBe(403);
  });

  it("profile: Character ID format and one account per Character ID", async () => {
    const a = await signUp("c1");
    const b = await signUp("c2");
    expect((await pcall(a, "patch", "/me").send({ characterId: "12ab" })).status).toBe(400);
    expect((await pcall(a, "patch", "/me").send({ ign: "ShivFan", characterId: "5123456789" })).status).toBe(200);
    expect((await pcall(b, "patch", "/me").send({ characterId: "5123456789" })).status).toBe(409);
  });

  it("daily spin: once per IST day, streak continues on consecutive days with bonus on day 3", async () => {
    const a = await signUp("s1");
    const status = await pcall(a, "get", "/daily");
    expect(status.body.data).toMatchObject({ canSpin: true, streak: 0, nextCycleDay: 1 });
    const s1 = await pcall(a, "post", "/daily/spin");
    expect(s1.status).toBe(200);
    expect(s1.body.data.streak).toBe(1);
    expect([5, 10, 15, 20, 30, 50, 100]).toContain(s1.body.data.coins);
    expect((await pcall(a, "post", "/daily/spin")).status).toBe(409);

    // Pretend the last spin was yesterday with a 2-day streak → today is day 3 (bonus +10).
    const yesterday = new Date(Date.parse(`${istDay()}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    await PlayerModel.updateOne({ _id: a.id }, { $set: { "streak.count": 2, "streak.lastDay": yesterday } });
    const s3 = await pcall(a, "post", "/daily/spin");
    expect(s3.body.data).toMatchObject({ streak: 3, cycleDay: 3, bonus: 10 });
    const p = await PlayerModel.findById(a.id);
    const ledger = await CoinTxModel.find({ player: a.id });
    expect(p!.coins).toBe(ledger.reduce((s, t) => s + t.amount, 0)); // balance always equals the ledger

    // A missed day resets the streak.
    await PlayerModel.updateOne({ _id: a.id }, { $set: { "streak.lastDay": "2020-01-01" } });
    expect((await pcall(a, "post", "/daily/spin")).body.data.streak).toBe(1);
  });

  it("squads: invite code joins, max 5 members, captain controls", async () => {
    const cap = await signUp("q0");
    const sq = (await pcall(cap, "post", "/squads").send({ name: "Night Owls", tag: "OWL" })).body.data;
    const others = await Promise.all([1, 2, 3, 4, 5].map((i) => signUp(`q${i}`)));
    for (const o of others.slice(0, 4)) expect((await pcall(o, "post", "/squads/join").send({ code: sq.inviteCode })).status).toBe(200);
    expect((await pcall(others[4]!, "post", "/squads/join").send({ code: sq.inviteCode })).status).toBe(409); // full
    const asMember = (await pcall(others[0]!, "get", "/squads")).body.data[0];
    expect(asMember.inviteCode).toBeUndefined();
    expect(asMember.members).toHaveLength(5);
    expect((await pcall(others[0]!, "post", `/squads/${sq.id}/kick`).send({ playerId: others[1]!.id })).status).toBe(403);
    expect((await pcall(cap, "post", `/squads/${sq.id}/kick`).send({ playerId: others[1]!.id })).status).toBe(200);
  });

  it("custom room: slots, waitlist promotion, one entry per player, room ID reveal, results, standings, prizes", async () => {
    const admin = await owner();
    const created = await acall(admin, "post", "/rooms").send(roomBody());
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const room = created.body.data;
    expect(room.slug).toBe("shivanshi-custom-room-squad-erangel");
    // A BGMI room holds 100 players: 26 squad slots is too many.
    expect((await acall(admin, "post", "/rooms").send(roomBody({ title: "Too big room", slotsTotal: 26 }))).status).toBe(400);

    const [A1, B1, C1] = [await readySquad("ab"), await readySquad("cd"), await readySquad("ef")];
    const reg = (s: typeof A1) => pcall(s.cap, "post", `/rooms/${room.slug}/register`).send({ squadId: s.squadId, playerIds: s.ids });
    expect((await reg(A1)).body.data).toMatchObject({ status: "confirmed", slot: 1 });
    expect((await reg(B1)).body.data).toMatchObject({ status: "confirmed", slot: 2 });
    expect((await reg(C1)).body.data).toMatchObject({ status: "waitlist", slot: null });
    expect((await reg(A1)).status).toBe(409); // same players again

    // Non-captains can't register; a player without a Character ID blocks the entry.
    const lone = await signUp("lone");
    const sq = (await pcall(lone, "post", "/squads").send({ name: "Solo Squad", tag: "SOL" })).body.data;
    expect((await pcall(lone, "post", `/rooms/${room.slug}/register`).send({ squadId: sq.id, playerIds: [lone.id] })).status).toBe(400);

    // Captain of A withdraws → C is promoted into slot 1.
    expect((await pcall(A1.cap, "delete", `/rooms/${room.slug}/entry`)).status).toBe(204);
    const cMe = await pcall(C1.members[2]!, "get", `/rooms/${room.slug}/me`);
    expect(cMe.body.data.entry).toMatchObject({ status: "confirmed", slot: 1 });

    // Room ID/password: set by admin, revealed only inside the window and only to confirmed members.
    await acall(admin, "patch", `/rooms/${room.id}/matches/1`).send({ roomId: "7654321", roomPassword: "sgh123", streamUrl: "https://www.youtube.com/live/abcdefghijk", status: "live" });
    await acall(admin, "patch", `/rooms/${room.id}/matches/2`).send({ roomId: "1111111", roomPassword: "later" });
    const creds = (await pcall(B1.members[3]!, "get", `/rooms/${room.slug}/me`)).body.data.credentials;
    expect(creds).toEqual([expect.objectContaining({ no: 1, roomId: "7654321", roomPassword: "sgh123" })]); // match 2 is 5h away
    expect((await pcall(A1.cap, "get", `/rooms/${room.slug}/me`)).body.data.credentials).toEqual([]); // withdrawn
    const pub = (await request(app).get(`/api/v1/rooms/${room.slug}`)).body.data;
    expect(JSON.stringify(pub)).not.toContain("7654321");
    expect(pub).toMatchObject({ live: true, slotsFilled: 2, waitlistCount: 0 });

    // Results → standings.
    const entries = (await acall(admin, "get", `/rooms/${room.id}/entries`)).body.data.entries.filter((e: any) => e.status === "confirmed");
    const eB = entries.find((e: any) => e.teamName === "Team cd").id;
    const eC = entries.find((e: any) => e.teamName === "Team ef").id;
    expect((await acall(admin, "put", `/rooms/${room.id}/matches/1/results`).send({ results: [{ entryId: eB, placement: 1, kills: 3 }, { entryId: eC, placement: 1, kills: 9 }] })).status).toBe(400); // duplicate placement
    const r1 = await acall(admin, "put", `/rooms/${room.id}/matches/1/results`).send({ results: [{ entryId: eB, placement: 1, kills: 3 }, { entryId: eC, placement: 2, kills: 9 }] });
    expect(r1.status).toBe(200);
    expect(r1.body.data.standings.map((s: any) => [s.teamName, s.total])).toEqual([["Team ef", 15], ["Team cd", 13]]); // 6+9 vs 10+3
    expect((await acall(admin, "post", `/rooms/${room.id}/complete`)).status).toBe(409); // match 2 still scheduled
    await acall(admin, "patch", `/rooms/${room.id}/matches/2`).send({ status: "cancelled" });

    const done = await acall(admin, "post", `/rooms/${room.id}/complete`);
    expect(done.body.data.credited).toBe(4);
    for (const m of C1.members) expect((await PlayerModel.findById(m.id))!.coins).toBe(100);
    // Completing again never pays twice.
    expect((await acall(admin, "post", `/rooms/${room.id}/complete`)).body.data.credited).toBe(0);
    expect((await PlayerModel.findById(C1.members[0]!.id))!.coins).toBe(100);
    const final = (await request(app).get(`/api/v1/rooms/${room.slug}`)).body.data;
    expect(final).toMatchObject({ status: "completed" });
    expect(final.standings[0]).toMatchObject({ rank: 1, teamName: "Team ef" });
  });

  it("standings tiebreakers: total, then placement points, then kills, then last placement", () => {
    const room = { points: { placement: [10, 6, 5, 4], perKill: 1 }, matches: [] as any[] };
    const e = (id: string) => ({ _id: id as any, slot: 1, teamName: id, teamTag: "", status: "confirmed" as const });
    room.matches = [
      { no: 1, status: "completed", results: [{ entry: "A", placement: 1, kills: 0 }, { entry: "B", placement: 2, kills: 4 }, { entry: "C", placement: 3, kills: 5 }] },
    ];
    const s = computeStandings(room as any, [e("A"), e("B"), e("C")]);
    // A=10, B=10, C=10 → placement points A10 > B6 > C5.
    expect(s.map((x) => x.teamName)).toEqual(["A", "B", "C"]);
  });

  it("rewards: account-age guard, atomic coin debit, admin fulfil shows the code only to the player, reject refunds", async () => {
    const admin = await owner();
    const reward = (await acall(admin, "post", "/rewards").send({ title: "60 UC gift voucher", kind: "uc_voucher", costCoins: 300, stock: 5, active: true })).body.data;
    const a = await signUp("r1", { ign: "Redeemer", characterId: "5999000111" });
    await PlayerModel.updateOne({ _id: a.id }, { $set: { coins: 1000 } });

    expect((await pcall(a, "post", `/rewards/${reward.id}/redeem`).send({})).status).toBe(409); // account < 7 days old
    await PlayerModel.collection.updateOne({ _id: (await PlayerModel.findById(a.id))!._id }, { $set: { createdAt: new Date(Date.now() - 10 * 86_400_000) } });

    const red = await pcall(a, "post", `/rewards/${reward.id}/redeem`).send({});
    expect(red.status, JSON.stringify(red.body)).toBe(201);
    expect((await PlayerModel.findById(a.id))!.coins).toBe(700);
    expect((await PlayerModel.findById(a.id))!.characterIdLockedAt).toBeInstanceOf(Date);
    expect((await pcall(a, "patch", "/me").send({ characterId: "5999000222" })).status).toBe(409); // locked
    expect((await pcall(a, "post", `/rewards/${reward.id}/redeem`).send({})).status).toBe(409); // 1 per 30 days

    const queue = (await acall(admin, "get", "/redemptions")).body.data;
    expect(queue[0]).toMatchObject({ rewardTitle: "60 UC gift voucher", player: { characterId: "5999000111" } });
    await acall(admin, "post", `/redemptions/${red.body.data.id}/fulfil`).send({ code: "BGMI-UC-TEST-CODE-1" });
    const mine = (await pcall(a, "get", "/redemptions")).body.data[0];
    expect(mine).toMatchObject({ status: "fulfilled", code: "BGMI-UC-TEST-CODE-1" });
    expect((await RedemptionModel.findById(red.body.data.id))!.codeEnc).not.toContain("BGMI-UC"); // encrypted at rest

    // Second reward → rejected → refunded.
    const rp = (await acall(admin, "post", "/rewards").send({ title: "Royal Pass voucher", kind: "royal_pass_voucher", costCoins: 500, active: true })).body.data;
    const red2 = await pcall(a, "post", `/rewards/${rp.id}/redeem`).send({});
    expect((await PlayerModel.findById(a.id))!.coins).toBe(200);
    await acall(admin, "post", `/redemptions/${red2.body.data.id}/reject`).send({ reason: "Suspicious activity" });
    expect((await PlayerModel.findById(a.id))!.coins).toBe(700);
    expect((await acall(admin, "post", `/redemptions/${red2.body.data.id}/reject`).send({ reason: "again" })).status).toBe(404); // never refunds twice
  });

  it("account deletion erases personal data and frees the Character ID", async () => {
    const a = await signUp("d1", { ign: "Bye", characterId: "5888777666" });
    expect((await pcall(a, "delete", "/me").send({ confirm: "DELETE" })).status).toBe(204);
    const doc = await PlayerModel.findById(a.id).lean();
    expect(doc).toMatchObject({ status: "deleted", email: "", ign: "", name: "" });
    expect(doc!.characterId).toBeUndefined();
    const b = await signUp("d2");
    expect((await pcall(b, "patch", "/me").send({ characterId: "5888777666" })).status).toBe(200);
  });

  it("AI agents can never get play permissions", () => {
    expect(["player:read", "room:create", "reward:update", "redemption:update"].some(agentPermissionFilter)).toBe(false);
  });
});
