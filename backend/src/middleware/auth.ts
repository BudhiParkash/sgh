import type { RequestHandler } from "express";
import { isProd, env } from "../config/env.js";
import { forbidden, unauthenticated } from "../lib/errors.js";
import { safeEqual } from "../lib/crypto.js";
import type { SessionStore } from "../modules/auth/session.service.js";
import type { Permission } from "../modules/admins/permissions.js";

const secureCookies = isProd || env.SITE_URL.startsWith("https://");
/** `__Host-` prefix: Secure, Path=/, no Domain — cannot be set or overwritten by subdomains. */
export const SESSION_COOKIE = secureCookies ? "__Host-sgh_sid" : "sgh_sid";
export const sessionCookieOptions = {
  httpOnly: true,
  secure: secureCookies,
  sameSite: "strict" as const,
  path: "/",
};

/** Loads the session (if any) for every /admin request. Never rejects by itself. */
export function loadSession(store: SessionStore): RequestHandler {
  return async (req, _res, next) => {
    const id = req.cookies?.[SESSION_COOKIE] as string | undefined;
    const data = await store.get(id);
    if (data && id) {
      req.session = data;
      req.sessionId = id;
      await store.touch(id, data);
    }
    next();
  };
}

/**
 * Requires a fully signed-in admin. Admins whose role mandates 2FA but who haven't enabled it
 * may only reach the routes flagged `allowSetup` (me, 2FA setup, logout).
 */
export function requireAuth(opts: { allowSetup?: boolean } = {}): RequestHandler {
  return (req, _res, next) => {
    const s = req.session;
    if (!s || s.stage !== "active") return next(unauthenticated());
    if (s.mustSetup2fa && !opts.allowSetup) return next(forbidden("Set up two-factor authentication to continue."));
    next();
  };
}

export function requirePermission(...perms: Permission[]): RequestHandler {
  return (req, _res, next) => {
    const granted = new Set(req.session?.permissions ?? []);
    if (!perms.every((p) => granted.has(p))) return next(forbidden());
    next();
  };
}

export const hasPermission = (perms: string[] | undefined, p: Permission) => Boolean(perms?.includes(p));

/** Synchronizer-token CSRF check for state-changing admin requests that carry a session. */
export const csrfProtect: RequestHandler = (req, _res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || !req.session) return next();
  const token = req.get("x-csrf-token") ?? "";
  if (!safeEqual(token, req.session.csrf)) return next(forbidden("Security token missing or expired. Please reload the page."));
  next();
};
