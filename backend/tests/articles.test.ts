import request from "supertest";
import { describe, expect, it } from "vitest";
import { publishDue } from "../src/jobs/publish-due.js";
import { processHtml } from "../src/lib/content/html.js";
import { ArticleModel } from "../src/modules/articles/article.model.js";
import { CategoryModel } from "../src/modules/categories/category.model.js";
import { RedirectModel } from "../src/modules/redirects/redirect.model.js";
import { seedReferenceData } from "../src/modules/seed.js";
import { createAdmin, makeApp, signIn, type Agent } from "./helpers.js";

const app = makeApp();
const A = "/api/v1/admin";
const send = (a: Agent, m: "post" | "patch", p: string) => a.agent[m](A + p).set("X-Forwarded-For", a.ip).set("X-CSRF-Token", a.csrf);
const body = (n: number, extra = "") => `<h2>Overview</h2><p>${Array.from({ length: n }, (_, i) => `w${i}`).join(" ")}</p><h2>Overview</h2><h3>Details &amp; tips</h3>${extra}`;

describe("processHtml", () => {
  it("adds unique heading ids, counts words, finds internal and affiliate links, sanitises", () => {
    const p = processHtml(`<h2>Best Settings</h2><p>one two three <a href="/sensitivity">finder</a> <a href="/go/phone-cooler">cooler</a></p><h2>Best Settings</h2><script>x</script>`);
    expect(p.headings.map((h) => h.id)).toEqual(["best-settings", "best-settings-2"]);
    expect(p.html).toContain('<h2 id="best-settings">');
    expect(p.html).not.toContain("script");
    expect(p.internalLinks).toEqual(["/sensitivity", "/go/phone-cooler"]);
    expect(p.hasAffiliateLinks).toBe(true);
    expect(p.wordCount).toBe(9);
  });
});

async function setup() {
  await seedReferenceData();
  await createAdmin("editor", "ed@test.local");
  await createAdmin("content_writer", "cw@test.local");
  const ed = await signIn(app, "ed@test.local");
  const cw = await signIn(app, "cw@test.local");
  const news = String((await CategoryModel.findOne({ slug: "bgmi-news" }))!._id);
  const guides = String((await CategoryModel.findOne({ slug: "gaming-tips" }))!._id);
  return { ed, cw, news, guides };
}

describe("articles", () => {
  it("writer drafts → editor publishes; public list, detail (TOC + related) and categories", async () => {
    const { ed, cw, news } = await setup();
    const short = await send(cw, "post", "/articles").send({ title: "BGMI update rumours roundup", excerpt: "What we know so far about the next BGMI update.", type: "news", category: news, content: body(50) });
    expect(short.status).toBe(201);
    expect(short.body.data.author).toBeTruthy();
    expect((await send(cw, "post", `/articles/${short.body.data.id}/workflow`).send({ action: "publish" })).status).toBe(403); // writers can't publish
    const checks = await ed.agent.get(`${A}/articles/${short.body.data.id}/checks`).set("X-Forwarded-For", ed.ip);
    expect(checks.body.data.blocking[0]).toMatch(/300 words/);

    await send(cw, "patch", `/articles/${short.body.data.id}`).send({ content: body(320), sources: [{ title: "Official post", url: "https://example.com/post" }] });
    expect((await send(cw, "post", `/articles/${short.body.data.id}/workflow`).send({ action: "submit" })).status).toBe(200);
    expect((await send(ed, "post", `/articles/${short.body.data.id}/workflow`).send({ action: "publish" })).status).toBe(200);

    const second = await send(ed, "post", "/articles").send({ title: "BGMI patch notes explained", excerpt: "A plain-English walkthrough of the patch notes.", type: "news", category: news, content: body(320) });
    await send(ed, "post", `/articles/${second.body.data.id}/workflow`).send({ action: "publish" });

    const list = await request(app).get("/api/v1/articles?kind=news");
    expect(list.body.data).toHaveLength(2);
    expect(list.body.meta.total).toBe(2);
    const d = await request(app).get("/api/v1/articles/bgmi-update-rumours-roundup");
    expect(d.body.data.headings.map((h: { id: string }) => h.id)).toEqual(["overview", "overview-2", "details-tips"]);
    expect(d.body.data.related).toHaveLength(1);
    expect(d.body.data.category).toEqual({ slug: "bgmi-news", name: "BGMI News", kind: "news" });
    expect((await request(app).get("/api/v1/articles?kind=guide")).body.data).toHaveLength(0);
    const cats = await request(app).get("/api/v1/categories");
    expect(cats.body.data.find((c: { slug: string }) => c.slug === "bgmi-news").articleCount).toBe(2);
    const home = await request(app).get("/api/v1/home");
    expect(home.body.data.latestNews).toHaveLength(2);
  });

  it("writers can't edit others' articles; sponsored needs a sponsor; affiliate links detected", async () => {
    const { ed, cw, guides } = await setup();
    const a = await send(ed, "post", "/articles").send({ title: "Best budget gaming triggers", excerpt: "Hands-on notes on budget triggers for BGMI.", type: "review", category: guides, content: body(320, '<p><a href="/go/trigger-x">Trigger X</a></p>'), sponsored: { isSponsored: true } });
    expect(a.body.data.hasAffiliateLinks).toBe(true);
    expect((await send(cw, "patch", `/articles/${a.body.data.id}`).send({ title: "Hijacked title" })).status).toBe(403);
    const checks = await ed.agent.get(`${A}/articles/${a.body.data.id}/checks`).set("X-Forwarded-For", ed.ip);
    expect(checks.body.data.blocking.join(" ")).toMatch(/name the sponsor/);
    expect(checks.body.data.warnings.join(" ")).toMatch(/affiliate disclosure/);
  });

  it("moving a published article to another category redirects the old URL", async () => {
    const { ed, news, guides } = await setup();
    const a = await send(ed, "post", "/articles").send({ title: "Gyro basics for beginners", excerpt: "How the gyroscope works in BGMI.", type: "guide", category: news, content: body(320) });
    await send(ed, "post", `/articles/${a.body.data.id}/workflow`).send({ action: "publish" });
    await send(ed, "patch", `/articles/${a.body.data.id}`).send({ category: guides });
    expect((await RedirectModel.findOne({ from: "/news/bgmi-news/gyro-basics-for-beginners" }))?.to).toBe("/guides/gaming-tips/gyro-basics-for-beginners");
  });

  it("scheduler publishes due items exactly once", async () => {
    const { ed, guides } = await setup();
    const a = await send(ed, "post", "/articles").send({ title: "Scheduled guide post", excerpt: "This guide goes live on a schedule.", type: "guide", category: guides, content: body(320) });
    const s = await send(ed, "post", `/articles/${a.body.data.id}/workflow`).send({ action: "schedule", publishAt: new Date(Date.now() + 3_600_000).toISOString() });
    expect(s.body.data.workflow.status).toBe("scheduled");
    expect(await publishDue(undefined, new Date())).toBe(0);
    expect(await publishDue(undefined, new Date(Date.now() + 2 * 3_600_000))).toBe(1);
    expect(await publishDue(undefined, new Date(Date.now() + 3 * 3_600_000))).toBe(0);
    const doc = await ArticleModel.findById(a.body.data.id).lean();
    expect((doc as { workflow: { status: string } }).workflow.status).toBe("published");
  });

  it("search finds published content only", async () => {
    const { ed, guides } = await setup();
    const a = await send(ed, "post", "/articles").send({ title: "Recoil control drills", excerpt: "Training-ground drills for spray control.", type: "guide", category: guides, content: body(320) });
    expect((await request(app).get("/api/v1/search?q=recoil")).body.data.articles).toHaveLength(0);
    await send(ed, "post", `/articles/${a.body.data.id}/workflow`).send({ action: "publish" });
    const r = await request(app).get("/api/v1/search?q=recoil");
    expect(r.body.data.articles[0].slug).toBe("recoil-control-drills");
    expect((await request(app).get("/api/v1/search?q=a")).status).toBe(400);
  });
});
