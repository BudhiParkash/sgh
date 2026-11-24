import type { Request, Response } from "express";
import { ok, noContent } from "../../lib/respond.js";
import { SESSION_COOKIE, sessionCookieOptions } from "../../middleware/auth.js";
import { v } from "../../middleware/validate.js";
import { audit } from "../audit/audit.service.js";
import type { AuthService } from "./auth.service.js";
import type { SessionStore } from "./session.service.js";
import type { z } from "zod";
import type { changePasswordSchema, disable2faSchema, loginSchema, totpCodeSchema } from "./auth.schemas.js";

export function authController(auth: AuthService, sessions: SessionStore) {
  const setCookie = (res: Response, id: string) => res.cookie(SESSION_COOKIE, id, sessionCookieOptions);
  const clearCookie = (res: Response) => res.clearCookie(SESSION_COOKIE, sessionCookieOptions);

  return {
    async login(req: Request, res: Response) {
      const { email, password } = v<z.infer<typeof loginSchema>>(req.valid.body);
      try {
        const result = await auth.login(email, password, { ipHash: req.ipHash, userAgent: req.get("user-agent") });
        setCookie(res, result.sessionId);
        req.session = result.session;
        if (result.kind === "needs_2fa") {
          await audit(req, { action: "auth.password_ok_2fa_pending", entityType: "admin", entityId: result.session.adminId });
          return ok(res, { requires2fa: true, csrfToken: result.session.csrf });
        }
        await audit(req, { action: "auth.login", entityType: "admin", entityId: result.session.adminId });
        return ok(res, { requires2fa: false, mustSetup2fa: result.session.mustSetup2fa, csrfToken: result.session.csrf });
      } catch (err) {
        await audit(req, { action: "auth.login_failed" });
        throw err;
      }
    },

    async verify2fa(req: Request, res: Response) {
      const { code } = v<z.infer<typeof totpCodeSchema>>(req.valid.body);
      const result = await auth.verifySecondFactor(req.sessionId!, req.session!, code);
      setCookie(res, result.sessionId);
      req.session = result.session;
      await audit(req, { action: result.usedRecovery ? "auth.login_recovery_code" : "auth.login", entityType: "admin", entityId: result.session.adminId });
      return ok(res, { csrfToken: result.session.csrf, mustSetup2fa: result.session.mustSetup2fa });
    },

    async logout(req: Request, res: Response) {
      if (req.sessionId) await sessions.destroy(req.sessionId, req.session?.adminId);
      await audit(req, { action: "auth.logout", entityType: "admin", entityId: req.session?.adminId });
      clearCookie(res);
      return noContent(res);
    },

    async logoutAll(req: Request, res: Response) {
      const n = await sessions.destroyAllForAdmin(req.session!.adminId);
      await audit(req, { action: "auth.logout_all", entityType: "admin", entityId: req.session!.adminId, summary: `${n} sessions ended` });
      clearCookie(res);
      return noContent(res);
    },

    async me(req: Request, res: Response) {
      return ok(res, await auth.me(req.session!));
    },

    async begin2fa(req: Request, res: Response) {
      return ok(res, await auth.begin2faSetup(req.session!.adminId));
    },

    async enable2fa(req: Request, res: Response) {
      const { code } = v<z.infer<typeof totpCodeSchema>>(req.valid.body);
      const result = await auth.enable2fa(req.sessionId!, req.session!, code);
      setCookie(res, result.sessionId);
      req.session = result.session;
      await audit(req, { action: "auth.2fa_enabled", entityType: "admin", entityId: result.session.adminId });
      return ok(res, { recoveryCodes: result.recoveryCodes, csrfToken: result.session.csrf });
    },

    async disable2fa(req: Request, res: Response) {
      const { password, code } = v<z.infer<typeof disable2faSchema>>(req.valid.body);
      await auth.disable2fa(req.session!, password, code);
      await audit(req, { action: "auth.2fa_disabled", entityType: "admin", entityId: req.session!.adminId });
      return noContent(res);
    },

    async changePassword(req: Request, res: Response) {
      const { currentPassword, newPassword } = v<z.infer<typeof changePasswordSchema>>(req.valid.body);
      await auth.changePassword(req.sessionId!, req.session!, currentPassword, newPassword);
      await audit(req, { action: "auth.password_changed", entityType: "admin", entityId: req.session!.adminId });
      return noContent(res);
    },
  };
}
