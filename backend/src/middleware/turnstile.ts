import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { badRequest } from "../lib/errors.js";

/**
 * Cloudflare Turnstile verification for public forms. Token is read from the
 * `turnstileToken` body field. Skipped when TURNSTILE_SECRET is not configured.
 */
export const verifyTurnstile: RequestHandler = async (req, _res, next) => {
  if (!env.TURNSTILE_SECRET) return next();
  const token = (req.body as { turnstileToken?: unknown })?.turnstileToken;
  if (typeof token !== "string" || token.length > 4096) return next(badRequest("Please complete the security check."));
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token, remoteip: req.ip ?? "" }),
      signal: AbortSignal.timeout(5000),
    });
    const data = (await r.json()) as { success?: boolean };
    if (!data.success) return next(badRequest("Security check failed. Please try again."));
    delete (req.body as { turnstileToken?: unknown }).turnstileToken;
    next();
  } catch {
    next(badRequest("Security check unavailable. Please try again."));
  }
};
