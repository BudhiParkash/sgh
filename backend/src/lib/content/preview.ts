import { createHmac } from "node:crypto";
import { env } from "../../config/env.js";
import { safeEqual } from "../crypto.js";

/** Short-lived signed token that lets the website render an unpublished item in draft mode. */
export function createPreviewToken(entityType: string, id: string, ttlSec = 30 * 60): string {
  const payload = Buffer.from(JSON.stringify({ t: entityType, id, exp: Math.floor(Date.now() / 1000) + ttlSec })).toString("base64url");
  const sig = createHmac("sha256", env.REVALIDATE_SECRET).update(`preview.${payload}`).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyPreviewToken(token: string): { t: string; id: string } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", env.REVALIDATE_SECRET).update(`preview.${payload}`).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { t: string; id: string; exp: number };
    return data.exp > Date.now() / 1000 ? { t: data.t, id: data.id } : null;
  } catch {
    return null;
  }
}
