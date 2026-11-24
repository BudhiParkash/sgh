import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

/**
 * On-demand revalidation webhook called by the API after publishing (docs/architecture/01 §3.5).
 * HMAC-SHA256 over "<timestamp>.<body>" with a 5-minute replay window.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return NextResponse.json({ ok: false }, { status: 503 });
  const ts = Number(req.headers.get("x-sgh-timestamp"));
  const sig = req.headers.get("x-sgh-signature") ?? "";
  const body = await req.text();
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 5 * 60_000) return NextResponse.json({ ok: false }, { status: 401 });
  const expected = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ ok: false }, { status: 401 });
  let tags: unknown;
  try {
    tags = (JSON.parse(body) as { tags?: unknown }).tags;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!Array.isArray(tags) || tags.length > 100 || !tags.every((t) => typeof t === "string" && t.length < 120)) return NextResponse.json({ ok: false }, { status: 400 });
  // Webhook from the API (not a Server Action): expire immediately so a corrected/cancelled
  // tournament or unpublished page is never served stale (Next.js docs: revalidateTag { expire: 0 }).
  for (const t of tags as string[]) revalidateTag(t, { expire: 0 });
  return NextResponse.json({ ok: true, revalidated: tags.length });
}
