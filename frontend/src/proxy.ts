import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIES = ["__Host-sgh_sid", "sgh_sid"];
const API = process.env.API_INTERNAL_URL ?? "http://localhost:4000/api/v1";

type Redirect = { from: string; to?: string; code: 301 | 302 | 410 };
let table: Map<string, Redirect> | null = null;
let loadedAt = 0;

/** Redirect table from the API, cached in memory for 60 s (admin edits apply within a minute). */
async function redirects(): Promise<Map<string, Redirect>> {
  if (table && Date.now() - loadedAt < 60_000) return table;
  try {
    const res = await fetch(`${API}/redirects`, { signal: AbortSignal.timeout(1500), cache: "no-store" });
    if (res.ok) {
      const body = (await res.json()) as { data: Redirect[] };
      table = new Map(body.data.map((r) => [r.from, r]));
      loadedAt = Date.now();
    }
  } catch {
    // API unreachable: keep serving with the last known table (or none).
    loadedAt = Date.now() - 45_000; // retry in ~15 s
  }
  return table ?? new Map();
}

/**
 * Edge proxy (Next.js 16 "proxy", formerly middleware):
 *  - /admin: cheap cookie-presence check → login redirect (real auth is enforced by the API); noindex.
 *  - managed redirects (301/302/410) for moved or removed public URLs.
 *  - IndexNow key file.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    const isPublicAdmin = pathname === "/admin/login";
    const hasSession = SESSION_COOKIES.some((c) => req.cookies.has(c));
    if (!isPublicAdmin && !hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = pathname === "/admin" ? "" : `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const key = process.env.INDEXNOW_KEY;
  if (key && pathname === `/${key}.txt`) return new NextResponse(key, { headers: { "Content-Type": "text/plain" } });

  const path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  const r = (await redirects()).get(path);
  if (r) {
    if (r.code === 410) return new NextResponse("This page has been permanently removed.", { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex" } });
    if (r.to) {
      const dest = r.to.startsWith("/") ? new URL(r.to + req.nextUrl.search, req.url) : new URL(r.to);
      return NextResponse.redirect(dest, r.code);
    }
  }
  return NextResponse.next();
}

export const config = {
  // Everything except Next internals, API, static files and generated assets.
  matcher: ["/((?!_next/|api/|mcp$|oauth/|authorize$|token$|register$|revoke$|\\.well-known/oauth|media/|icons/|posters/|sw\\.js|icon\\.svg|manifest\\.webmanifest|sitemap|robots\\.txt|llms\\.txt|favicon).*)"],
};
