import request from "supertest";
import { describe, expect, it } from "vitest";
import { totp } from "../src/lib/totp.js";
import { AdminModel } from "../src/modules/admins/admin.model.js";
import { AuditLogModel } from "../src/modules/audit/audit.model.js";
import { PASSWORD, createAdmin, freshIp, makeApp, signIn, signInWith2fa } from "./helpers.js";

const app = makeApp();
const LOGIN = "/api/v1/admin/auth/login";

describe("login", () => {
  it("signs in with a secure, HttpOnly, SameSite=Strict session cookie", async () => {
    await createAdmin("content_writer", "writer@test.local");
    const res = await request(app).post(LOGIN).set("X-Forwarded-For", freshIp()).send({ email: "WRITER@test.local", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.requires2fa).toBe(false);
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(/sgh_sid=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(await AuditLogModel.countDocuments({ action: "auth.login" })).toBe(1);
  });

  it("gives the same generic error for wrong password and unknown email", async () => {
    await createAdmin("editor", "ed@test.local");
    const wrong = await request(app).post(LOGIN).set("X-Forwarded-For", freshIp()).send({ email: "ed@test.local", password: "nope-nope-nope" });
    const unknown = await request(app).post(LOGIN).set("X-Forwarded-For", freshIp()).send({ email: "ghost@test.local", password: "nope-nope-nope" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it("validates input", async () => {
    const res = await request(app).post(LOGIN).set("X-Forwarded-For", freshIp()).send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(expect.arrayContaining(["email", "password"]));
  });

  it("rate-limits repeated attempts from one IP for one email (429 + Retry-After)", async () => {
    await createAdmin("editor", "rl@test.local");
    const ip = freshIp();
    for (let i = 0; i < 5; i++) await request(app).post(LOGIN).set("X-Forwarded-For", ip).send({ email: "rl@test.local", password: "wrong-password-1" });
    const res = await request(app).post(LOGIN).set("X-Forwarded-For", ip).send({ email: "rl@test.local", password: PASSWORD });
    expect(res.status).toBe(429);
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("locks the account after 5 failures even from different IPs, including for the right password", async () => {
    await createAdmin("editor", "lock@test.local");
    for (let i = 0; i < 5; i++) await request(app).post(LOGIN).set("X-Forwarded-For", freshIp()).send({ email: "lock@test.local", password: "wrong-password-1" });
    const res = await request(app).post(LOGIN).set("X-Forwarded-For", freshIp()).send({ email: "lock@test.local", password: PASSWORD });
    expect(res.status).toBe(429);
    const admin = await AdminModel.findOne({ email: "lock@test.local" });
    expect(admin!.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects suspended accounts with the generic error", async () => {
    const a = await createAdmin("editor", "sus@test.local");
    await AdminModel.updateOne({ _id: a._id }, { status: "suspended" });
    const res = await request(app).post(LOGIN).set("X-Forwarded-For", freshIp()).send({ email: "sus@test.local", password: PASSWORD });
    expect(res.status).toBe(401);
  });
});

describe("sessions", () => {
  it("me returns role, permissions and a CSRF token; passwordHash never leaks", async () => {
    await createAdmin("content_writer", "me@test.local");
    const { agent, ip } = await signIn(app, "me@test.local");
    const me = await agent.get("/api/v1/admin/auth/me").set("X-Forwarded-For", ip);
    expect(me.status).toBe(200);
    expect(me.body.data.role).toBe("content_writer");
    expect(me.body.data.permissions).toContain("article:create");
    expect(me.body.data.csrfToken).toBeTruthy();
    expect(JSON.stringify(me.body)).not.toMatch(/passwordHash|argon2/);
  });

  it("requires the CSRF token for state-changing requests", async () => {
    await createAdmin("content_writer", "csrf@test.local");
    const { agent, csrf, ip } = await signIn(app, "csrf@test.local");
    const without = await agent.post("/api/v1/admin/auth/logout-all").set("X-Forwarded-For", ip);
    expect(without.status).toBe(403);
    const withToken = await agent.post("/api/v1/admin/auth/logout-all").set("X-Forwarded-For", ip).set("X-CSRF-Token", csrf);
    expect(withToken.status).toBe(204);
    const me = await agent.get("/api/v1/admin/auth/me").set("X-Forwarded-For", ip);
    expect(me.status).toBe(401);
  });

  it("blocks cross-origin state-changing requests", async () => {
    const res = await request(app).post(LOGIN).set("Origin", "https://evil.example").send({ email: "a@b.co", password: "x" });
    expect(res.status).toBe(403);
  });

  it("logout destroys the session server-side", async () => {
    await createAdmin("content_writer", "out@test.local");
    const { agent, csrf, ip } = await signIn(app, "out@test.local");
    expect((await agent.post("/api/v1/admin/auth/logout").set("X-Forwarded-For", ip).set("X-CSRF-Token", csrf)).status).toBe(204);
    expect((await agent.get("/api/v1/admin/auth/me").set("X-Forwarded-For", ip)).status).toBe(401);
  });

  it("password change enforces policy and signs out other sessions", async () => {
    await createAdmin("content_writer", "pw@test.local");
    const s1 = await signIn(app, "pw@test.local");
    const s2 = await signIn(app, "pw@test.local");
    const weak = await s1.agent.post("/api/v1/admin/auth/password").set("X-Forwarded-For", s1.ip).set("X-CSRF-Token", s1.csrf).send({ currentPassword: PASSWORD, newPassword: "short" });
    expect(weak.status).toBe(400);
    const good = await s1.agent
      .post("/api/v1/admin/auth/password")
      .set("X-Forwarded-For", s1.ip)
      .set("X-CSRF-Token", s1.csrf)
      .send({ currentPassword: PASSWORD, newPassword: "A-much-better-passphrase-77" });
    expect(good.status).toBe(204);
    expect((await s1.agent.get("/api/v1/admin/auth/me").set("X-Forwarded-For", s1.ip)).status).toBe(200);
    expect((await s2.agent.get("/api/v1/admin/auth/me").set("X-Forwarded-For", s2.ip)).status).toBe(401);
  });
});

describe("two-factor authentication", () => {
  it("admins must enrol 2FA before using protected routes", async () => {
    await createAdmin("admin", "adm@test.local");
    const { agent, ip } = await signIn(app, "adm@test.local");
    const me = await agent.get("/api/v1/admin/auth/me").set("X-Forwarded-For", ip);
    expect(me.body.data.mustSetup2fa).toBe(true);
    expect((await agent.get("/api/v1/admin/audit-logs").set("X-Forwarded-For", ip)).status).toBe(403);
  });

  it("full flow: enrol → recovery codes → sign in with TOTP → replay rejected → recovery code works once", async () => {
    await createAdmin("admin", "tfa@test.local");
    const enrolled = await signInWith2fa(app, "tfa@test.local");
    expect((await enrolled.agent.get("/api/v1/admin/audit-logs").set("X-Forwarded-For", enrolled.ip)).status).toBe(200);
    const stored = await AdminModel.findOne({ email: "tfa@test.local" }).select("+twoFactor.secretEnc +twoFactor.recoveryCodeHashes");
    expect(stored!.twoFactor!.secretEnc).not.toContain(enrolled.secret); // encrypted at rest
    expect(stored!.twoFactor!.recoveryCodeHashes).toHaveLength(10);

    // New login → needs 2FA; the code used during enrolment can't be replayed
    const ip = freshIp();
    const agent = request.agent(app);
    const step1 = await agent.post(LOGIN).set("X-Forwarded-For", ip).send({ email: "tfa@test.local", password: PASSWORD });
    expect(step1.body.data.requires2fa).toBe(true);
    const csrf = step1.body.data.csrfToken;
    expect((await agent.get("/api/v1/admin/auth/me").set("X-Forwarded-For", ip)).status).toBe(401); // not signed in yet
    const replay = await agent.post("/api/v1/admin/auth/2fa/verify").set("X-Forwarded-For", ip).set("X-CSRF-Token", csrf).send({ code: totp(enrolled.secret) });
    expect(replay.status).toBe(401);
    const next = await agent.post("/api/v1/admin/auth/2fa/verify").set("X-Forwarded-For", ip).set("X-CSRF-Token", csrf).send({ code: totp(enrolled.secret, Date.now() + 30_000) });
    expect(next.status).toBe(200);
    expect((await agent.get("/api/v1/admin/auth/me").set("X-Forwarded-For", ip)).status).toBe(200);
  });

  it("recovery codes are single-use", async () => {
    await createAdmin("admin", "rec@test.local");
    const a = await signIn(app, "rec@test.local");
    const setup = await a.agent.post("/api/v1/admin/auth/2fa/setup").set("X-Forwarded-For", a.ip).set("X-CSRF-Token", a.csrf);
    const en = await a.agent.post("/api/v1/admin/auth/2fa/enable").set("X-Forwarded-For", a.ip).set("X-CSRF-Token", a.csrf).send({ code: totp(setup.body.data.secret) });
    const code = en.body.data.recoveryCodes[0] as string;
    const tryCode = async () => {
      const ip = freshIp();
      const agent = request.agent(app);
      const s1 = await agent.post(LOGIN).set("X-Forwarded-For", ip).send({ email: "rec@test.local", password: PASSWORD });
      return agent.post("/api/v1/admin/auth/2fa/verify").set("X-Forwarded-For", ip).set("X-CSRF-Token", s1.body.data.csrfToken).send({ code });
    };
    expect((await tryCode()).status).toBe(200);
    expect((await tryCode()).status).toBe(401);
  });

  it("2FA enrolment rejects a wrong code", async () => {
    await createAdmin("admin", "bad@test.local");
    const a = await signIn(app, "bad@test.local");
    await a.agent.post("/api/v1/admin/auth/2fa/setup").set("X-Forwarded-For", a.ip).set("X-CSRF-Token", a.csrf);
    const res = await a.agent.post("/api/v1/admin/auth/2fa/enable").set("X-Forwarded-For", a.ip).set("X-CSRF-Token", a.csrf).send({ code: "000000" });
    expect(res.status).toBe(400);
  });
});

describe("RBAC", () => {
  it("denies audit log access without audit:read", async () => {
    await createAdmin("content_writer", "w2@test.local");
    const { agent, ip } = await signIn(app, "w2@test.local");
    expect((await agent.get("/api/v1/admin/audit-logs").set("X-Forwarded-For", ip)).status).toBe(403);
  });
  it("anonymous requests to admin routes get 401", async () => {
    expect((await request(app).get("/api/v1/admin/audit-logs")).status).toBe(401);
  });
});
