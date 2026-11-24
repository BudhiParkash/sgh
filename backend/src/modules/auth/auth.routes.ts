import { Router } from "express";
import { z } from "zod";
import { ok } from "../../lib/respond.js";
import { AdminModel } from "../admins/admin.model.js";
import { audit } from "../audit/audit.service.js";
import type { Redis } from "ioredis";
import { badRequest } from "../../lib/errors.js";
import { csrfProtect, requireAuth } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import { authController } from "./auth.controller.js";
import { changePasswordSchema, disable2faSchema, loginSchema, totpCodeSchema } from "./auth.schemas.js";
import { AuthService } from "./auth.service.js";
import type { SessionStore } from "./session.service.js";

export function authRoutes(redis: Redis, sessions: SessionStore): Router {
  const r = Router();
  const c = authController(new AuthService(sessions), sessions);

  const loginByIp = rateLimit(redis, { name: "login-ip", points: 30, durationSec: 15 * 60 });
  const loginByIpEmail = rateLimit(redis, {
    name: "login-ip-email",
    points: 5,
    durationSec: 15 * 60,
    key: (req) => `${req.ipHash}:${String((req.body as { email?: unknown })?.email ?? "").toLowerCase().slice(0, 254)}`,
  });
  const twoFaLimit = rateLimit(redis, { name: "2fa", points: 6, durationSec: 5 * 60, key: (req) => req.sessionId ?? req.ipHash });

  const pending2fa = (req: import("express").Request, _res: import("express").Response, next: import("express").NextFunction) =>
    req.session?.stage === "2fa" ? next() : next(badRequest("Two-factor verification is not pending."));

  r.post("/login", loginByIp, loginByIpEmail, validate({ body: loginSchema }), c.login);
  // Everything after the password step requires the session's CSRF token.
  r.use(csrfProtect);
  r.post("/2fa/verify", twoFaLimit, pending2fa, validate({ body: totpCodeSchema }), c.verify2fa);
  r.post("/logout", c.logout);
  r.post("/logout-all", requireAuth({ allowSetup: true }), c.logoutAll);
  r.get("/me", requireAuth({ allowSetup: true }), c.me);
  r.post("/2fa/setup", requireAuth({ allowSetup: true }), c.begin2fa);
  r.post("/2fa/enable", requireAuth({ allowSetup: true }), twoFaLimit, validate({ body: totpCodeSchema }), c.enable2fa);
  r.post("/2fa/disable", requireAuth(), twoFaLimit, validate({ body: disable2faSchema }), c.disable2fa);
  r.post("/password", requireAuth({ allowSetup: true }), validate({ body: changePasswordSchema }), c.changePassword);
  // Own public author profile (shown on articles when isPublic).
  const profileSchema = z.object({
    displayName: z.string().trim().min(2).max(80),
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens").max(80),
    bio: z.string().trim().max(600).optional(),
    isPublic: z.boolean(),
  });
  r.patch("/profile", requireAuth(), validate({ body: profileSchema }), async (req, res) => {
    const admin = await AdminModel.findByIdAndUpdate(req.session!.adminId, { $set: { profile: req.valid.body } }, { new: true, runValidators: true });
    await audit(req, { action: "admin.profile_update", entityType: "admin", entityId: req.session!.adminId });
    ok(res, admin?.profile ?? null);
  });
  return r;
}
