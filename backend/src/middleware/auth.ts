import type { RequestHandler } from "express";
import { isProd, env } from "../config/env.js";
import { forbidden, unauthenticated } from "../lib/errors.js";
import { safeEqual } from "../lib/crypto.js";
import type { SessionData, SessionStore } from "../modules/auth/session.service.js";
import { RoleModel } from "../modules/admins/role.model.js";
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

/** Role version + permissions, cached briefly so the check costs at most one small query per role per 30 s. */
const roleCache = new Map<string, { version: number; permissions: string[]; at: number }>();
/** Tests: forget cached roles. */
export const clearRoleCache = () => roleCache.clear();
async function currentRole(roleKey: string) {
  const hit = roleCache.get(roleKey);
  if (hit && Date.now() - hit.at < 30_000) return hit;
  const role = await RoleModel.findOne({ key: roleKey }).select("version permissions").lean();
  if (!role) return null;
  const v = { version: role.version, permissions: role.permissions as string[], at: Date.now() };
  roleCache.set(roleKey, v);
  return v;
}

/**
 * Keeps a signed-in admin's permissions in step with their role. Roles change when an admin edits one (those
 * members are signed out) or when a deploy adds permissions to a system role — then the session is refreshed in
 * place, so new admin sections appear without signing in again. AI agent service sessions are left alone: they
 * carry a reduced permission set and refresh themselves (modules/mcp/admin-client).
 */
async function syncRole(store: SessionStore, id: string, data: SessionData): Promise<void> {
  if (data.uaHash === "mcp") return;
  const role = await currentRole(data.roleKey);
  if (!role || role.version === data.roleVersion) return;
  data.permissions = role.permissions;
  data.roleVersion = role.version;
  await store.update(id, data);
}

/** Loads the session (if any) for every /admin request. Never rejects by itself. */
export function loadSession(store: SessionStore): RequestHandler {
  return async (req, _res, next) => {
    const id = req.cookies?.[SESSION_COOKIE] as string | undefined;
    const data = await store.get(id);
    if (data && id) {
      await syncRole(store, id, data);
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
