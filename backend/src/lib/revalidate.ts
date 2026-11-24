import { createHmac } from "node:crypto";
import { env, isTest } from "../config/env.js";
import { logger } from "../config/logger.js";

/** Calls recorded in tests (no network). */
export const revalidateLog: string[][] = [];

export function signPayload(body: string, ts: number): string {
  return createHmac("sha256", env.REVALIDATE_SECRET).update(`${ts}.${body}`).digest("hex");
}

/**
 * Asks Next.js to revalidate cache tags (docs/architecture/01 §3.5). HMAC-signed with a timestamp
 * (5-minute replay window enforced by the frontend). Failures are logged, never thrown — publishing
 * must not fail because the website is briefly unreachable (ISR time-based fallback still applies).
 */
export async function revalidateTags(tags: string[]): Promise<void> {
  const unique = [...new Set(tags)].filter(Boolean);
  if (unique.length === 0) return;
  if (isTest) {
    revalidateLog.push(unique);
    return;
  }
  const body = JSON.stringify({ tags: unique });
  const ts = Date.now();
  try {
    const res = await fetch(env.REVALIDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-SGH-Timestamp": String(ts), "X-SGH-Signature": signPayload(body, ts) },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) logger.warn({ status: res.status, tags: unique }, "revalidate failed");
  } catch (err) {
    logger.warn({ err, tags: unique }, "revalidate unreachable");
  }
}
