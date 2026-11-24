import request from "supertest";
import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, totp, verifyTotp } from "../src/lib/totp.js";
import { decrypt, encrypt } from "../src/lib/crypto.js";
import { passwordPolicyError } from "../src/lib/password.js";
import { ALL_PERMISSIONS, DEFAULT_ROLES } from "../src/modules/admins/permissions.js";
import { makeApp } from "./helpers.js";

const app = makeApp();

describe("platform", () => {
  it("health reports ok with version only", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: "ok", version: expect.any(String) } });
  });

  it("sets security headers and a request id; hides x-powered-by", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(res.headers["x-request-id"]).toMatch(/^[0-9A-Z]{26}$/);
  });

  it("unknown endpoints return the JSON error envelope", async () => {
    const res = await request(app).get("/api/v1/nope");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
  });

  it("malformed JSON → 400 without leaking internals", async () => {
    const res = await request(app).post("/api/v1/admin/auth/login").set("Content-Type", "application/json").send('{"email":');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/SyntaxError|at .*\.js/);
  });

  it("rejects NoSQL operator / prototype-pollution keys", async () => {
    const a = await request(app).post("/api/v1/admin/auth/login").send({ email: { $ne: null }, password: { $gt: "" } });
    expect(a.status).toBe(400);
    const b = await request(app).post("/api/v1/admin/auth/login").set("Content-Type", "application/json").send('{"__proto__":{"admin":true},"email":"a@b.co","password":"x"}');
    expect(b.status).toBe(400);
  });

  it("rejects oversized bodies", async () => {
    const res = await request(app).post("/api/v1/admin/auth/login").send({ email: "a@b.co", password: "x".repeat(200_000) });
    expect(res.status).toBe(413);
  });

  it("serves the OpenAPI document outside production", async () => {
    const res = await request(app).get("/api/v1/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.paths["/api/v1/admin/auth/login"]).toBeDefined();
  });
});

describe("crypto & TOTP", () => {
  it("base32 round-trips and matches RFC 6238 test vector", () => {
    const buf = Buffer.from("12345678901234567890");
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
    // RFC 6238 Appendix B, SHA-1, T=59s → 94287082 (8 digits) → last 6 digits 287082
    expect(totp(base32Encode(buf), 59_000)).toBe("287082");
    expect(verifyTotp(base32Encode(buf), "287082", 59_000)).not.toBeNull();
    expect(verifyTotp(base32Encode(buf), "123456", 59_000)).toBeNull();
  });
  it("AES-GCM encrypt/decrypt and tamper detection", () => {
    const c = encrypt("secret");
    expect(decrypt(c)).toBe("secret");
    const parts = c.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decrypt(parts.join("."))).toThrow();
  });
  it("password policy", () => {
    expect(passwordPolicyError("short")).toMatch(/12/);
    expect(passwordPolicyError("password123")).toBeTruthy();
    expect(passwordPolicyError("shivanshi-rocks-2026", "shivanshi@x.com")).toMatch(/email/);
    expect(passwordPolicyError("A-good-long-passphrase-9")).toBeNull();
  });
});

describe("permission matrix", () => {
  it("super admin has everything; writers cannot publish or manage users", () => {
    expect(DEFAULT_ROLES.super_admin.permissions).toEqual(ALL_PERMISSIONS);
    const w = DEFAULT_ROLES.content_writer.permissions;
    expect(w).not.toContain("article:publish");
    expect(w).not.toContain("admin:create");
    expect(DEFAULT_ROLES.admin.permissions).not.toContain("admin:create");
    expect(DEFAULT_ROLES.tournament_manager.permissions).toContain("tournament:verify");
  });
});
