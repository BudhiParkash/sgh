import request from "supertest";
import { describe, expect, it } from "vitest";
import { SCOPE_KEYS } from "@sgh/shared";
import { GameModel } from "../src/modules/games/game.model.js";
import { seedReferenceData } from "../src/modules/seed.js";
import { deriveDeviceClass } from "../src/modules/sensitivity/device.model.js";
import { matchScore, provenanceViolations, rank, valueViolations } from "../src/modules/sensitivity/sensitivity.rules.js";
import { createAdmin, makeApp, signIn, type Agent } from "./helpers.js";

const app = makeApp();
const A = "/api/v1/admin";
const send = (a: Agent, m: "post" | "patch" | "delete", p: string) => a.agent[m](A + p).set("X-Forwarded-For", a.ip).set("X-CSRF-Token", a.csrf);
const row = (n: number) => Object.fromEntries(SCOPE_KEYS.map((k, i) => [k, Math.max(1, n - i * 10)]));
const words = (n: number) => `<p>${Array.from({ length: n }, (_, i) => `word${i}`).join(" ")}</p>`;

describe("sensitivity rules (pure)", () => {
  it("validates required categories and ranges", () => {
    expect(valueViolations({ camera: row(120), ads: row(100) }, "off")).toEqual([]);
    expect(valueViolations({ camera: row(120), ads: row(100) }, "always_on").filter((x) => x.message === "Required")).toHaveLength(18);
    expect(valueViolations({ camera: { ...row(120), x8: 301 }, ads: row(100) }, "off")[0]!.path).toBe("values.camera.x8");
    expect(valueViolations({ camera: row(120), ads: row(100), gyro: { ...row(300), x2: 401 }, ads_gyro: row(300) }, "always_on")[0]!.message).toMatch(/1 to 400/);
  });
  it("tested setups need full provenance", () => {
    expect(provenanceViolations({ provenance: "tested" })[0]).toMatch(/tester name, test date, device used, game version/);
    expect(provenanceViolations({ provenance: "tested", gameVersion: "4.1", testing: { testedBy: "Shivanshi", testedAt: new Date(), deviceUsed: "iQOO Neo 9 Pro" } })).toEqual([]);
    expect(provenanceViolations({ provenance: "community_submitted" })).toEqual([]);
  });
  it("derives device class and ranks matches", () => {
    expect(deriveDeviceClass({ displayRefreshRateHz: 144, screenSizeInches: 6.78, supportedFps: [60, 90, 120] })).toEqual({ refreshTier: "144+", screenBucket: "large", perfTier: "flagship" });
    expect(deriveDeviceClass({ displayRefreshRateHz: 90, supportedFps: [60] }).perfTier).toBe("mid");
    const want = { fps: 90, gyroscope: "always_on" as const, playstyle: "balanced" as const };
    expect(matchScore(want, want)).toBe(0);
    const ranked = rank([{ fps: 60, gyroscope: "off" as const, playstyle: "rush" as const, id: "x" }, { fps: 120, gyroscope: "always_on" as const, playstyle: "balanced" as const, id: "y" }], want);
    expect(ranked[0]!.id).toBe("y");
  });
});

async function setup() {
  await seedReferenceData();
  const game = String((await GameModel.findOne({ key: "bgmi" }))!._id);
  await createAdmin("editor", "ed@test.local");
  const ed = await signIn(app, "ed@test.local");
  return { ed, game };
}

async function publishedDevice(ed: Agent, extra: Record<string, unknown> = {}) {
  const d = await send(ed, "post", "/devices").send({ brand: "iQOO", model: "Neo 9 Pro", displayRefreshRateHz: 144, screenSizeInches: 6.78, supportedFps: [60, 90, 120], specSourceUrl: "https://example.com/spec", ...extra });
  expect(d.status).toBe(201);
  expect((await send(ed, "post", `/devices/${d.body.data.id}/workflow`).send({ action: "publish" })).status).toBe(200);
  return d.body.data;
}

const testedConfig = (game: string, device: string | null, extra: Record<string, unknown> = {}) => ({
  title: "iQOO Neo 9 Pro 90 FPS gyro balanced",
  game,
  device,
  fps: 90,
  gyroscope: "always_on",
  playstyle: "balanced",
  values: { camera: row(120), ads: row(100), gyro: row(300), ads_gyro: row(280) },
  provenance: "tested",
  gameVersion: "4.1",
  testing: { testedBy: "Shivanshi", testedAt: "2026-11-20", deviceUsed: "iQOO Neo 9 Pro (12 GB)" },
  explanation: words(200),
  ...extra,
});

describe("devices & configurations", () => {
  it("device slug, brand slug and class are derived; FPS required to publish", async () => {
    const { ed } = await setup();
    const d = await send(ed, "post", "/devices").send({ brand: "POCO", model: "X6 Pro", displayRefreshRateHz: 120 });
    expect(d.body.data.slug).toBe("poco-x6-pro");
    expect(d.body.data.brandSlug).toBe("poco");
    expect(d.body.data.deviceClass.refreshTier).toBe("120");
    expect((await send(ed, "post", `/devices/${d.body.data.id}/workflow`).send({ action: "publish" })).status).toBe(400);
  });

  it("rejects out-of-range values; blocks publishing incomplete provenance; publishes a tested setup", async () => {
    const { ed, game } = await setup();
    const dev = await publishedDevice(ed);
    const bad = await send(ed, "post", "/sensitivity").send(testedConfig(game, dev.id, { values: { camera: { ...row(120), x2: 999 } } }));
    expect(bad.status).toBe(400);
    expect(bad.body.error.details[0].path).toBe("values.camera.x2");
    const c = await send(ed, "post", "/sensitivity").send(testedConfig(game, dev.id, { testing: { testedBy: "Shivanshi" } }));
    expect(c.status).toBe(201);
    const checks = await ed.agent.get(`${A}/sensitivity/${c.body.data.id}/checks`).set("X-Forwarded-For", ed.ip);
    expect(checks.body.data.blocking.join(" ")).toMatch(/test date, device used/);
    await send(ed, "patch", `/sensitivity/${c.body.data.id}`).send({ testing: { testedBy: "Shivanshi", testedAt: "2026-11-20", deviceUsed: "iQOO Neo 9 Pro" } });
    expect((await send(ed, "post", `/sensitivity/${c.body.data.id}/workflow`).send({ action: "publish" })).status).toBe(200);
    const pub = await request(app).get(`/api/v1/sensitivity/${c.body.data.slug}`);
    expect(pub.status).toBe(200);
    expect(pub.body.data.values.camera.tpp_no_scope).toBe(120);
    expect(pub.body.data.provenance).toBe("tested");
    expect(pub.body.data.seo.robots.index).toBe(true);
  });

  it("short explanations publish as noindex; value edits bump the card version", async () => {
    const { ed, game } = await setup();
    const dev = await publishedDevice(ed);
    const c = await send(ed, "post", "/sensitivity").send(testedConfig(game, dev.id, { explanation: words(60) }));
    const checks = await ed.agent.get(`${A}/sensitivity/${c.body.data.id}/checks`).set("X-Forwarded-For", ed.ip);
    expect(checks.body.data.warnings.join(" ")).toMatch(/not be indexed|not indexed/);
    await send(ed, "post", `/sensitivity/${c.body.data.id}/workflow`).send({ action: "publish" });
    expect((await request(app).get(`/api/v1/sensitivity/${c.body.data.slug}`)).body.data.seo.robots.index).toBe(false);
    const u = await send(ed, "patch", `/sensitivity/${c.body.data.id}`).send({ values: { camera: { ...row(120), x2: 55 } } });
    expect(u.body.data.valuesVersion).toBe(2);
  });

  it("finder: exact → nearest → baseline → none", async () => {
    const { ed, game } = await setup();
    const dev = await publishedDevice(ed);
    const c = await send(ed, "post", "/sensitivity").send(testedConfig(game, dev.id));
    await send(ed, "post", `/sensitivity/${c.body.data.id}/workflow`).send({ action: "publish" });
    const find = (q: string) => request(app).get(`/api/v1/sensitivity/find?${q}`);
    expect((await find("device=iqoo-neo-9-pro&fps=90&gyroscope=always_on&playstyle=balanced")).body.data.match).toBe("exact");
    const near = await find("device=iqoo-neo-9-pro&fps=120&gyroscope=always_on&playstyle=rush");
    expect(near.body.data.match).toBe("nearest");
    expect(near.body.data.config.fps).toBe(90);

    const other = await publishedDevice(ed, { brand: "Samsung", model: "Galaxy S24", displayRefreshRateHz: 120, supportedFps: [60, 90, 120] });
    expect((await find(`device=${other.slug}&fps=90&gyroscope=off&playstyle=balanced`)).body.data.match).toBe("none");
    const base = await send(ed, "post", "/sensitivity").send({
      title: "120 Hz baseline, gyro off",
      game,
      device: null,
      deviceClass: { refreshTier: "120", perfTier: "flagship" },
      fps: 90,
      gyroscope: "off",
      playstyle: "balanced",
      values: { camera: row(110), ads: row(95) },
      provenance: "baseline",
      explanation: words(60),
    });
    expect(base.status).toBe(201);
    await send(ed, "post", `/sensitivity/${base.body.data.id}/workflow`).send({ action: "publish" });
    const b = await find(`device=${other.slug}&fps=90&gyroscope=off&playstyle=balanced`);
    expect(b.body.data.match).toBe("baseline");
    expect(b.body.data.config.provenance).toBe("baseline");
    expect((await find("device=no-such-phone&fps=90&gyroscope=off&playstyle=balanced")).body.data.match).toBe("none");
    expect((await find("device=iqoo-neo-9-pro&fps=75&gyroscope=off&playstyle=balanced")).status).toBe(400);
  });

  it("baseline setups can't be tied to a device; compare returns deltas", async () => {
    const { ed, game } = await setup();
    const dev = await publishedDevice(ed);
    expect((await send(ed, "post", "/sensitivity").send(testedConfig(game, dev.id, { provenance: "baseline" }))).status).toBe(400);
    const c1 = await send(ed, "post", "/sensitivity").send(testedConfig(game, dev.id));
    const c2 = await send(ed, "post", "/sensitivity").send(testedConfig(game, dev.id, { title: "iQOO Neo 9 Pro 120 FPS", fps: 120, values: { camera: row(130), ads: row(100), gyro: row(300), ads_gyro: row(280) } }));
    for (const c of [c1, c2]) await send(ed, "post", `/sensitivity/${c.body.data.id}/workflow`).send({ action: "publish" });
    const cmp = await request(app).get(`/api/v1/sensitivity/compare?a=${c1.body.data.slug}&b=${c2.body.data.slug}`);
    expect(cmp.status).toBe(200);
    expect(cmp.body.data.deltas.camera.tpp_no_scope).toBe(10);
    expect(cmp.body.data.deltas.ads.tpp_no_scope).toBe(0);
  });

  it("public devices, brands and home feed reflect published data only", async () => {
    const { ed, game } = await setup();
    const dev = await publishedDevice(ed);
    expect((await request(app).get("/api/v1/devices/brands")).body.data).toEqual([]); // no published configs yet
    const c = await send(ed, "post", "/sensitivity").send(testedConfig(game, dev.id));
    await send(ed, "post", `/sensitivity/${c.body.data.id}/workflow`).send({ action: "publish" });
    const brands = await request(app).get("/api/v1/devices/brands");
    expect(brands.body.data).toEqual([{ brand: "iQOO", brandSlug: "iqoo", deviceCount: 1, configCount: 1 }]);
    const detail = await request(app).get("/api/v1/devices/iqoo-neo-9-pro");
    expect(detail.body.data.configs).toHaveLength(1);
    const home = await request(app).get("/api/v1/home");
    expect(home.body.data.popularDevices[0].slug).toBe("iqoo-neo-9-pro");
  });

  it("writers can only edit their own setups", async () => {
    const { game } = await setup();
    await createAdmin("content_writer", "w1@test.local");
    await createAdmin("content_writer", "w2@test.local");
    const w1 = await signIn(app, "w1@test.local");
    const w2 = await signIn(app, "w2@test.local");
    const c = await send(w1, "post", "/sensitivity").send({ ...testedConfig(game, null, { provenance: "baseline", deviceClass: { refreshTier: "90" } }) });
    expect(c.status).toBe(201);
    expect((await send(w2, "patch", `/sensitivity/${c.body.data.id}`).send({ title: "Hijacked title here" })).status).toBe(403);
    expect((await send(w1, "post", `/sensitivity/${c.body.data.id}/workflow`).send({ action: "publish" })).status).toBe(403);
  });
});

describe("share codes", () => {
  it("community submissions are moderated; honeypot and validation enforced", async () => {
    const { ed } = await setup();
    const submit = (body: Record<string, unknown>) => request(app).post("/api/v1/sensitivity/codes/submit").set("X-Forwarded-For", "10.9.9.9").send(body);
    const ok1 = await submit({ code: "7234-5678-ABCD-0001", deviceText: "iQOO Neo 9 Pro", author: "Player One", fps: 90 });
    expect(ok1.status).toBe(201);
    expect((await submit({ code: "7234-5678-ABCD-0001", deviceText: "iQOO Neo 9 Pro", author: "Player One" })).status).toBe(201); // duplicate: same response
    expect((await submit({ code: "bad code!", deviceText: "x x", author: "Me" })).status).toBe(400);
    expect((await submit({ code: "7234-5678-ABCD-0002", deviceText: "Phone", author: "Bot", website: "spam.example" })).status).toBe(400);
    expect((await request(app).get("/api/v1/sensitivity/codes")).body.data).toHaveLength(0);
    const list = await ed.agent.get(`${A}/sensitivity-codes?status=pending`).set("X-Forwarded-For", ed.ip);
    expect(list.body.data).toHaveLength(1);
    expect(JSON.stringify(list.body.data)).not.toMatch(/ipHash/);
    expect((await send(ed, "post", `/sensitivity-codes/${list.body.data[0].id}/verify`)).status).toBe(200);
    const pub = await request(app).get("/api/v1/sensitivity/codes");
    expect(pub.body.data[0].code).toBe("7234-5678-ABCD-0001");
  });
});

describe("share code moderation revalidates the website", () => {
  it("verifying a code sends the 'codes' revalidation tag", async () => {
    const { revalidateLog } = await import("../src/lib/revalidate.js");
    const { ed } = await setup();
    await request(app).post("/api/v1/sensitivity/codes/submit").set("X-Forwarded-For", "10.8.8.8").send({ code: "7234-0000-REVAL-01", deviceText: "Phone", author: "Tester" });
    const list = await ed.agent.get(`${A}/sensitivity-codes?status=pending`).set("X-Forwarded-For", ed.ip);
    revalidateLog.length = 0;
    await send(ed, "post", `/sensitivity-codes/${list.body.data[0].id}/verify`);
    expect(revalidateLog.flat()).toContain("codes");
  });
});
