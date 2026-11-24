import cors from "cors";
import helmet from "helmet";
import type { RequestHandler } from "express";
import { corsOrigins, env } from "../config/env.js";
import { badRequest, forbidden } from "../lib/errors.js";

/** API responses are JSON only — the strictest CSP possible. */
export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  crossOriginResourcePolicy: { policy: "same-site" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
});

export const corsMiddleware: RequestHandler = cors({
  origin: (origin, cb) => {
    // Same-origin and server-to-server requests have no Origin header.
    if (!origin || corsOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "X-CSRF-Token", "If-Match"],
  exposedHeaders: ["X-Request-Id", "ETag", "Retry-After"],
  maxAge: 600,
});

/** Rejects state-changing requests from foreign origins (defence in depth alongside SameSite + CSRF token). */
export const originGuard: RequestHandler = (req, _res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (!origin) return next();
  const allowed = new Set([...corsOrigins, new URL(env.SITE_URL).origin]);
  if (!allowed.has(origin)) return next(forbidden("Cross-origin request blocked."));
  next();
};

function hasOperatorKey(value: unknown, depth = 0): boolean {
  if (depth > 20) return true; // absurd nesting — reject
  if (Array.isArray(value)) return value.some((v) => hasOperatorKey(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.entries(value).some(([k, v]) => k.startsWith("$") || k.includes(".") || k === "__proto__" || k === "constructor" || hasOperatorKey(v, depth + 1));
  }
  return false;
}

/**
 * NoSQL-injection / prototype-pollution guard: rejects any payload containing keys like
 * `$gt`, `a.b`, `__proto__`. (Express 5's default "simple" query parser already blocks nested query objects.)
 */
export const rejectOperatorKeys: RequestHandler = (req, _res, next) => {
  if (hasOperatorKey(req.body) || hasOperatorKey(req.query)) return next(badRequest("Invalid characters in request."));
  next();
};
