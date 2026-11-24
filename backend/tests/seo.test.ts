import request from "supertest";
import { describe, expect, it } from "vitest";
import { SCOPE_KEYS } from "@sgh/shared";
import { CategoryModel } from "../src/modules/categories/category.model.js";
import { GameModel } from "../src/modules/games/game.model.js";
import { seedReferenceData } from "../src/modules/seed.js";
import { createAdmin, makeApp, signIn, signInWith2fa, type Agent } from "./helpers.js";

const app = makeApp();
const A = "/api/v1/admin";
const send = (a: Agent, m: "post" | "patch", p: string) => a.agent[m](A + p).set("X-Forwarded-For", a.ip).set("X-CSRF-Token", a.csrf);
const words = (n: number, extra = "") => `<p>${Array.from({ length: n }, (_, i) => `w${i}`).join(" ")}</p>${extra}`;
const row = (n: number) => Object.fromEntries(SCOPE_KEYS.map((k) => [k, n]));

describe("sitemaps & SEO audit", () => {
  it("lists only indexable, published, non-thin pages; audit finds duplicates, thin pages and broken links", async () => {
    await seedReferenceData();
    await createAdmin("editor", "ed@test.local");
    const ed = await signIn(app, "ed@test.local");
    const game = String((await GameModel.findOne({ key: "bgmi" }))!._id);
    const cat = String((await CategoryModel.findOne({ slug: "gaming-tips" }))!._id);
    const publish = (p: string, id: string) => send(ed, "post", `${p}/${id}/workflow`).send({ action: "publish" });

    // Articles: one normal, one noindex, one with a broken internal link and duplicate title
    const a1 = await send(ed, "post", "/articles").send({ title: "Recoil control basics", excerpt: "How to control recoil in BGMI.", type: "guide", category: cat, content: words(320, '<p><a href="/sensitivity/does-not-exist">x</a></p>') });
    const a2 = await send(ed, "post", "/articles").send({ title: "Hidden article", excerpt: "This one should not be indexed.", type: "guide", category: cat, content: words(320), seo: { robots: { index: false } } });
    const a3 = await send(ed, "post", "/articles").send({ title: "Recoil control basics", excerpt: "Duplicate headline on purpose.", type: "guide", category: cat, content: words(320) });
    const draft = await send(ed, "post", "/articles").send({ title: "Unpublished draft", excerpt: "Still a draft, not public.", type: "guide", category: cat, content: words(320) });
    for (const a of [a1, a2, a3]) await publish("/articles", a.body.data.id);

    // Rumour tournament excluded; thin setup excluded
    const t = await send(ed, "post", "/tournaments").send({ name: "Rumour Cup", game, organiser: "Someone", officialSourceUrl: "https://example.com/r", description: words(30) });
    expect(t.status).toBe(403); // editors can't create tournaments
    await createAdmin("tournament_manager", "tm@test.local");
    const tm = await signIn(app, "tm@test.local");
    const t2 = await send(tm, "post", "/tournaments").send({ name: "Rumour Cup", game, organiser: "Someone", officialSourceUrl: "https://example.com/r", description: words(30) });
    await send(tm, "post", `/tournaments/${t2.body.data.id}/workflow`).send({ action: "publish" });
    const thin = await send(ed, "post", "/sensitivity").send({ title: "Thin baseline setup", game, device: null, deviceClass: { refreshTier: "90" }, fps: 60, gyroscope: "off", playstyle: "balanced", values: { camera: row(100), ads: row(90) }, provenance: "baseline", explanation: words(60) });
    await publish("/sensitivity", thin.body.data.id);

    const arts = (await request(app).get("/api/v1/sitemap-data/articles")).body.data.map((e: { path: string }) => e.path);
    expect(arts).toContain("/guides/gaming-tips/recoil-control-basics");
    expect(arts.join(" ")).not.toMatch(/hidden-article|unpublished-draft/);
    expect((await request(app).get("/api/v1/sitemap-data/tournaments")).body.data).toEqual([]);
    expect((await request(app).get("/api/v1/sitemap-data/sensitivity")).body.data).toEqual([]);
    const pages = (await request(app).get("/api/v1/sitemap-data/pages")).body.data.map((e: { path: string }) => e.path);
    expect(pages).toContain("/guides/gaming-tips");
    expect((await request(app).get("/api/v1/sitemap-data/nope")).status).toBe(404);
    const idx = await request(app).get("/api/v1/sitemap-data");
    expect(idx.body.data.find((x: { type: string }) => x.type === "articles").count).toBe(2);

    await createAdmin("super_admin", "root@test.local");
    const root = await signInWith2fa(app, "root@test.local");
    const audit = await root.agent.get(`${A}/seo/overview`).set("X-Forwarded-For", root.ip);
    const types = audit.body.data.issues.map((i: { type: string }) => i.type);
    expect(types).toEqual(expect.arrayContaining(["duplicate-title", "broken-link", "thin", "noindex", "missing-description"]));
    expect(audit.body.data.counts.error).toBeGreaterThanOrEqual(3);
    void draft;
  });
});
