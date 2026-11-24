import sharp from "sharp";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { AuditLogModel } from "../src/modules/audit/audit.model.js";
import { MediaModel } from "../src/modules/media/media.model.js";
import { RoleModel } from "../src/modules/admins/role.model.js";
import { seedReferenceData } from "../src/modules/seed.js";
import { createAdmin, makeApp, signIn, signInWith2fa, type Agent } from "./helpers.js";

const app = makeApp();
const API = "/api/v1/admin";

async function asSuper(): Promise<Agent> {
  await createAdmin("super_admin", "root@test.local");
  return signInWith2fa(app, "root@test.local");
}
const png = (w = 800, h = 600, color = "#8b5cf6") => sharp({ create: { width: w, height: h, channels: 3, background: color } }).png().toBuffer();
const send = (a: Agent, method: "post" | "patch" | "delete", path: string) => a.agent[method](API + path).set("X-Forwarded-For", a.ip).set("X-CSRF-Token", a.csrf);
const get = (a: Agent, path: string) => a.agent.get(API + path).set("X-Forwarded-For", a.ip);

describe("media library", () => {
  it("uploads, sniffs, strips and builds responsive variants", async () => {
    const a = await asSuper();
    const res = await send(a, "post", "/media").field("alt", "Purple test card").field("licence", "original").attach("file", await png(), "card.png");
    expect(res.status).toBe(201);
    expect(res.body.data.width).toBe(800);
    expect(res.body.data.ref.srcSet).toMatch(/320w.*640w.*800w/);
    const doc = await MediaModel.findById(res.body.data.id);
    expect(doc!.variants.map((v) => v.format)).toEqual(expect.arrayContaining(["avif", "webp", "jpeg"]));
    // served locally in dev
    const file = await request(app).get(`/api/v1/media-files/${doc!.variants[0]!.key!.replace(/^/, "")}`);
    expect(file.status).toBe(200);
  });

  it("rejects disguised files, SVG, tiny images and missing alt text", async () => {
    const a = await asSuper();
    const fake = await send(a, "post", "/media").field("alt", "Fake image").field("licence", "original").attach("file", Buffer.from("<?php echo 1; ?>"), { filename: "evil.png", contentType: "image/png" });
    expect(fake.status).toBe(415);
    const svg = await send(a, "post", "/media").field("alt", "Vector").field("licence", "original").attach("file", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), { filename: "x.svg", contentType: "image/svg+xml" });
    expect(svg.status).toBe(415);
    const tiny = await send(a, "post", "/media").field("alt", "Tiny image").field("licence", "original").attach("file", await png(10, 10), "t.png");
    expect(tiny.status).toBe(400);
    const noAlt = await send(a, "post", "/media").field("licence", "original").attach("file", await png(), "x.png");
    expect(noAlt.status).toBe(400);
  });

  it("detects duplicates, guards in-use deletion, and replace keeps the id", async () => {
    const a = await asSuper();
    const buf = await png(500, 500, "#3b82f6");
    const up = await send(a, "post", "/media").field("alt", "Blue square").field("licence", "original").attach("file", buf, "b.png");
    const id = up.body.data.id;
    expect((await send(a, "post", "/media").field("alt", "Blue again").field("licence", "original").attach("file", buf, "b2.png")).status).toBe(409);
    await MediaModel.updateOne({ _id: id }, { $push: { usageRefs: { entityType: "article", entityId: "5f0000000000000000000001" } } });
    expect((await send(a, "delete", `/media/${id}`)).status).toBe(409);
    const rep = await send(a, "post", `/media/${id}/replace`).attach("file", await png(640, 480, "#22d3ee"), "c.png");
    expect(rep.status).toBe(200);
    expect(rep.body.data.id).toBe(id);
    expect(rep.body.data.width).toBe(640);
    await MediaModel.updateOne({ _id: id }, { $set: { usageRefs: [] } });
    expect((await send(a, "delete", `/media/${id}`)).status).toBe(204);
  });
});

describe("generic CRUD (categories)", () => {
  it("create → auto slug → unique slug → update with If-Match → conflict → soft delete → restore", async () => {
    const a = await asSuper();
    const c1 = await send(a, "post", "/categories").send({ name: "Pro Tips", kind: "guide" });
    expect(c1.status).toBe(201);
    expect(c1.body.data.slug).toBe("pro-tips");
    const c2 = await send(a, "post", "/categories").send({ name: "Pro Tips", kind: "guide" });
    expect(c2.body.data.slug).toBe("pro-tips-2");
    const id = c1.body.data.id;
    const v0 = c1.body.data.version;
    const u1 = await send(a, "patch", `/categories/${id}`).set("If-Match", String(v0)).send({ description: "First edit" });
    expect(u1.status).toBe(200);
    const stale = await send(a, "patch", `/categories/${id}`).set("If-Match", String(v0)).send({ description: "Stale edit" });
    expect(stale.status).toBe(409);
    expect((await send(a, "delete", `/categories/${id}`)).status).toBe(204);
    expect((await get(a, `/categories?q=pro`)).body.data).toHaveLength(1);
    expect((await get(a, `/categories?trash=true`)).body.data).toHaveLength(1);
    expect((await send(a, "post", `/categories/${id}/restore`)).status).toBe(200);
    expect(await AuditLogModel.countDocuments({ entityType: "category" })).toBeGreaterThanOrEqual(4);
  });

  it("validates input and enforces permissions", async () => {
    const a = await asSuper();
    expect((await send(a, "post", "/categories").send({ name: "x", kind: "bogus" })).status).toBe(400);
    await createAdmin("content_writer", "cw@test.local");
    const w = await signIn(app, "cw@test.local");
    expect((await get(w, "/categories")).status).toBe(200);
    expect((await send(w, "post", "/categories").send({ name: "Writers Corner", kind: "guide" })).status).toBe(403);
  });

  it("only Super Admins can permanently delete", async () => {
    await createAdmin("editor", "ed@test.local");
    const e = await signIn(app, "ed@test.local");
    const c = await send(e, "post", "/categories").send({ name: "Temp", kind: "news" });
    expect((await send(e, "delete", `/categories/${c.body.data.id}?hard=true`)).status).toBe(403);
  });
});

describe("settings", () => {
  it("seeds owner-provided values; public view exposes no internal fields", async () => {
    await seedReferenceData();
    const pub = await request(app).get("/api/v1/settings");
    expect(pub.status).toBe(200);
    expect(pub.body.data.contactEmail).toBe("budhiparkash00@gmail.com");
    expect(pub.body.data.socials.youtube).toMatch(/ShivanshiGamings/);
    expect(JSON.stringify(pub.body.data)).not.toMatch(/retentionDays|cin|gstin|registeredAddress/);
  });
  it("validates and saves partial nested updates without wiping siblings", async () => {
    const a = await asSuper();
    await seedReferenceData();
    expect((await send(a, "patch", "/settings").send({ socials: { x: "http://insecure.example" } })).status).toBe(400);
    const res = await send(a, "patch", "/settings").send({ grievanceOfficer: { address: "To be provided" } });
    expect(res.status).toBe(200);
    expect(res.body.data.grievanceOfficer).toMatchObject({ name: "Budhi Parkash", address: "To be provided" });
  });
});

describe("admin users & roles", () => {
  it("creates an admin with a one-time temporary password; role change ends their sessions", async () => {
    const a = await asSuper();
    const editorRole = await RoleModel.findOne({ key: "editor" });
    const writerRole = await RoleModel.findOne({ key: "content_writer" });
    const created = await send(a, "post", "/admins").send({ name: "New Editor", email: "new@test.local", role: String(editorRole!._id) });
    expect(created.status).toBe(201);
    const temp = created.body.data.temporaryPassword;
    expect(temp.length).toBeGreaterThanOrEqual(16);
    const u = await signIn(app, "new@test.local", temp);
    expect((await get(u, "/categories")).status).toBe(200);
    await send(a, "patch", `/admins/${created.body.data.id}`).send({ role: String(writerRole!._id) });
    expect((await u.agent.get(`${API}/auth/me`).set("X-Forwarded-For", u.ip)).status).toBe(401);
  });
  it("refuses to delete the last Super Admin or yourself", async () => {
    const a = await asSuper();
    const me = await a.agent.get(`${API}/auth/me`).set("X-Forwarded-For", a.ip);
    expect((await send(a, "delete", `/admins/${me.body.data.id}`)).status).toBe(400);
  });
  it("custom roles: create, edit (ends members' sessions), system roles locked", async () => {
    const a = await asSuper();
    const r = await send(a, "post", "/roles").send({ name: "Guest Writer", permissions: ["article:read", "article:create"] });
    expect(r.status).toBe(201);
    expect(r.body.data.key).toBe("custom-guest-writer");
    expect((await send(a, "post", "/roles").send({ name: "Bad", permissions: ["nuke:everything"] })).status).toBe(400);
    const sys = await RoleModel.findOne({ key: "editor" });
    expect((await send(a, "patch", `/roles/${sys!._id}`).send({ permissions: [] })).status).toBe(400);
  });
});

describe("redirects & dashboard", () => {
  it("manages redirects and exposes the public list", async () => {
    const a = await asSuper();
    expect((await send(a, "post", "/redirects").send({ from: "/old-page", to: "/new-page" })).status).toBe(201);
    expect((await send(a, "post", "/redirects").send({ from: "no-slash", to: "/x" })).status).toBe(400);
    expect((await send(a, "post", "/redirects").send({ from: "/gone", code: 410 })).status).toBe(201);
    const pub = await request(app).get("/api/v1/redirects");
    expect(pub.body.data).toEqual(expect.arrayContaining([{ from: "/old-page", to: "/new-page", code: 301 }]));
  });
  it("dashboard returns real counts scoped to permissions", async () => {
    const a = await asSuper();
    await seedReferenceData();
    const d = await get(a, "/dashboard");
    expect(d.status).toBe(200);
    expect(d.body.data.content.find((c: { key: string }) => c.key === "categories").total).toBe(8);
    expect(Array.isArray(d.body.data.recent)).toBe(true);
  });
  it("preview endpoint rejects invalid tokens", async () => {
    expect((await request(app).get("/api/v1/preview/not-a-token")).status).toBe(403);
  });
});

describe("SEO subdocument (as sent by the admin form)", () => {
  it("accepts partial robots and null ogImage", async () => {
    const a = await asSuper();
    const res = await send(a, "post", "/categories").send({ name: "Seo Partial", kind: "news", seo: { robots: { index: true }, ogImage: null, title: "Short title" } });
    expect(res.status).toBe(201);
    expect(res.body.data.seo.robots).toEqual({ index: true, follow: true });
  });
});

describe("cache refresh on create (non-workflow entities)", () => {
  it("a new redirect is visible on the public list immediately", async () => {
    const a = await asSuper();
    expect((await request(app).get("/api/v1/redirects")).body.data).toEqual([]); // primes the cache
    await send(a, "post", "/redirects").send({ from: "/fresh-old", to: "/fresh-new" });
    expect((await request(app).get("/api/v1/redirects")).body.data).toEqual([{ from: "/fresh-old", to: "/fresh-new", code: 301 }]);
  });
});
