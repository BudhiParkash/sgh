import request from "supertest";
import { describe, expect, it } from "vitest";
import { GameModel } from "../src/modules/games/game.model.js";
import { RedirectModel } from "../src/modules/redirects/redirect.model.js";
import { seedReferenceData } from "../src/modules/seed.js";
import { dateViolations, displayStatus, paymentWarnings, statusViolations } from "../src/modules/tournaments/tournament.rules.js";
import { createAdmin, makeApp, signIn, signInWith2fa, type Agent } from "./helpers.js";

const app = makeApp();
const API = "/api/v1/admin/tournaments";
const day = 86_400_000;
const send = (a: Agent, method: "post" | "patch", path: string) => a.agent[method](API + path).set("X-Forwarded-For", a.ip).set("X-CSRF-Token", a.csrf);
const LONG = "<p>An open online BGMI tournament announced by the organiser on their official Instagram account. Squads register through the official form.</p>";

describe("tournament rules (pure)", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  it("rumours never auto-advance; confirmed events follow their dates", () => {
    expect(displayStatus({ status: "rumour", startDate: new Date("2026-01-01") }, now)).toBe("rumour");
    expect(displayStatus({ status: "confirmed", startDate: new Date("2026-07-01") }, now)).toBe("confirmed");
    expect(displayStatus({ status: "confirmed", startDate: new Date("2026-06-10"), endDate: new Date("2026-06-20") }, now)).toBe("ongoing");
    expect(displayStatus({ status: "confirmed", startDate: new Date("2026-06-01"), endDate: new Date("2026-06-05") }, now)).toBe("completed");
    expect(displayStatus({ status: "cancelled", startDate: new Date("2026-06-10") }, now)).toBe("cancelled");
  });
  it("confirmed requires an official source and a verification", () => {
    expect(statusViolations({ status: "confirmed", sources: [{ type: "news" }] })).toHaveLength(2);
    expect(statusViolations({ status: "confirmed", sources: [{ type: "official" }], verification: { lastVerifiedAt: new Date() } })).toEqual([]);
    expect(statusViolations({ status: "rumour" })).toEqual([]);
  });
  it("date and payment checks", () => {
    expect(dateViolations({ startDate: new Date("2026-02-02"), endDate: new Date("2026-02-01") })[0]!.path).toBe("endDate");
    expect(paymentWarnings("<p>Entry fee ₹50 per squad</p>")[0]).toMatch(/entry fee/i);
    expect(paymentWarnings("<p>Free to enter</p>")).toEqual([]);
  });
});

async function setup() {
  await seedReferenceData();
  const game = await GameModel.findOne({ key: "bgmi" });
  await createAdmin("tournament_manager", "tm@test.local");
  const tm = await signIn(app, "tm@test.local");
  return { tm, gameId: String(game!._id) };
}

const base = (gameId: string, extra: Record<string, unknown> = {}) => ({
  name: "Example Open Cup",
  game: gameId,
  organiser: "Example Esports",
  officialSourceUrl: "https://www.instagram.com/p/example/",
  description: LONG,
  startDate: new Date(Date.now() + 10 * day).toISOString(),
  endDate: new Date(Date.now() + 12 * day).toISOString(),
  ...extra,
});

describe("tournament lifecycle", () => {
  it("rumour → add official source → verify → confirm → publish → public", async () => {
    const { tm, gameId } = await setup();
    const c = await send(tm, "post", "").send(base(gameId));
    expect(c.status).toBe(201);
    expect(c.body.data.status).toBe("rumour");
    const id = c.body.data.id;

    const noSource = await send(tm, "patch", `/${id}`).send({ status: "confirmed" });
    expect(noSource.status).toBe(400);
    expect(noSource.body.error.message).toMatch(/official source/);

    expect((await send(tm, "post", `/${id}/verify`).send({ notes: "Checked post", confidence: "high" })).status).toBe(400);
    await send(tm, "patch", `/${id}`).send({ sources: [{ url: "https://www.instagram.com/p/example/", type: "official", title: "Organiser announcement" }] });
    const ver = await send(tm, "post", `/${id}/verify`).send({ notes: "Matched dates on official post", confidence: "high" });
    expect(ver.status).toBe(200);
    expect(ver.body.data.verification.lastVerifiedAt).toBeTruthy();

    const conf = await send(tm, "patch", `/${id}`).send({ status: "confirmed", prizePool: { amount: 50000, verified: false } });
    expect(conf.status).toBe(200);
    // not public while draft
    expect((await request(app).get("/api/v1/tournaments/example-open-cup")).status).toBe(404);
    const pub = await send(tm, "post", `/${id}/workflow`).send({ action: "publish" });
    expect(pub.status).toBe(200);

    const detail = await request(app).get("/api/v1/tournaments/example-open-cup");
    expect(detail.status).toBe(200);
    expect(detail.body.data.status).toBe("confirmed");
    expect(detail.body.data.prizePool).toBeNull(); // unverified prize hidden
    expect(detail.body.data.sources[0].type).toBe("official");
    const list = await request(app).get("/api/v1/tournaments?status=upcoming");
    expect(list.body.data.map((t: { slug: string }) => t.slug)).toContain("example-open-cup");
    expect((await request(app).get("/api/v1/tournaments?status=rumour")).body.data).toHaveLength(0);
    const home = await request(app).get("/api/v1/home");
    expect(home.body.data.featuredTournaments).toHaveLength(1);
  });

  it("PATCH only changes the fields that were sent (no default resets)", async () => {
    const { tm, gameId } = await setup();
    const c = await send(tm, "post", "").send(base(gameId, { name: "Patch Cup", isFeatured: true, sources: [{ url: "https://example.com/p", type: "official", title: "Post" }] }));
    const p = await send(tm, "patch", `/${c.body.data.id}`).send({ organiser: "Renamed Org" });
    expect(p.body.data.organiser).toBe("Renamed Org");
    expect(p.body.data.isFeatured).toBe(true);
    expect(p.body.data.sources).toHaveLength(1);
    expect(p.body.data.status).toBe("rumour");
  });

  it("blocks publishing thin entries and warns about payment wording", async () => {
    const { tm, gameId } = await setup();
    const c = await send(tm, "post", "").send(base(gameId, { name: "Thin Cup", description: "<p>Short.</p>" }));
    const checks = await tm.agent.get(`${API}/${c.body.data.id}/checks`).set("X-Forwarded-For", tm.ip);
    expect(checks.body.data.blocking.join(" ")).toMatch(/80 characters/);
    expect((await send(tm, "post", `/${c.body.data.id}/workflow`).send({ action: "publish" })).status).toBe(400);
    const paid = await send(tm, "post", "").send(base(gameId, { name: "Paid Cup", description: `${LONG}<p>Entry fee ₹100.</p>` }));
    const c2 = await tm.agent.get(`${API}/${paid.body.data.id}/checks`).set("X-Forwarded-For", tm.ip);
    expect(c2.body.data.warnings.join(" ")).toMatch(/real-money/);
  });

  it("validates dates, https links and reserved slugs; sanitises HTML", async () => {
    const { tm, gameId } = await setup();
    expect((await send(tm, "post", "").send(base(gameId, { endDate: new Date(Date.now() + 5 * day).toISOString() }))).status).toBe(400);
    expect((await send(tm, "post", "").send(base(gameId, { officialSourceUrl: "http://insecure.example" }))).status).toBe(400);
    expect((await send(tm, "post", "").send(base(gameId, { slug: "calendar" }))).status).toBe(400);
    const x = await send(tm, "post", "").send(base(gameId, { name: "Xss Cup", description: `${LONG}<script>alert(1)</script><img src=x onerror=alert(1)>` }));
    expect(x.body.data.description.html).not.toMatch(/script|onerror/);
  });

  it("changing a published slug creates a 301 redirect", async () => {
    const { tm, gameId } = await setup();
    const c = await send(tm, "post", "").send(base(gameId, { name: "Rename Cup" }));
    await send(tm, "post", `/${c.body.data.id}/workflow`).send({ action: "publish" });
    await send(tm, "patch", `/${c.body.data.id}`).send({ slug: "renamed-cup" });
    const r = await RedirectModel.findOne({ from: "/tournaments/rename-cup" });
    expect(r?.to).toBe("/tournaments/renamed-cup");
  });

  it("calendar returns events overlapping the month (IST)", async () => {
    const { tm, gameId } = await setup();
    const c = await send(tm, "post", "").send(base(gameId, { name: "Calendar Cup", startDate: "2027-03-31T20:00:00Z", endDate: "2027-04-02T10:00:00Z" }));
    await send(tm, "post", `/${c.body.data.id}/workflow`).send({ action: "publish" });
    // 31 Mar 20:00 UTC is 1 Apr 01:30 IST → April
    const apr = await request(app).get("/api/v1/tournaments/calendar?month=2027-04");
    expect(apr.body.data.map((t: { slug: string }) => t.slug)).toContain("calendar-cup");
    expect((await request(app).get("/api/v1/tournaments/calendar?month=2027-13")).status).toBe(400);
  });

  it("permissions: writers can't manage tournaments", async () => {
    await setup();
    await createAdmin("content_writer", "cw@test.local");
    const w = await signIn(app, "cw@test.local");
    expect((await w.agent.get(API).set("X-Forwarded-For", w.ip)).status).toBe(403);
  });

  it("super admin sees the stale-verification attention item", async () => {
    const { tm, gameId } = await setup();
    const c = await send(tm, "post", "").send(base(gameId, { name: "Stale Cup", sources: [{ url: "https://example.com/a", type: "official", title: "Post" }] }));
    await send(tm, "post", `/${c.body.data.id}/verify`).send({ notes: "Checked once", confidence: "medium" });
    await send(tm, "patch", `/${c.body.data.id}`).send({ status: "confirmed" });
    await send(tm, "post", `/${c.body.data.id}/workflow`).send({ action: "publish" });
    const { TournamentModel } = await import("../src/modules/tournaments/tournament.model.js");
    await TournamentModel.updateOne({ _id: c.body.data.id }, { "verification.lastVerifiedAt": new Date(Date.now() - 10 * day) });
    await createAdmin("super_admin", "root@test.local");
    const root = await signInWith2fa(app, "root@test.local");
    const d = await root.agent.get("/api/v1/admin/dashboard").set("X-Forwarded-For", root.ip);
    expect(d.body.data.attention.find((a: { kind: string }) => a.kind === "tournament-stale")?.count).toBe(1);
  });
});
