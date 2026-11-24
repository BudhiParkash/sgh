import { siteConfig } from "@/lib/site";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function urlset(entries: { path: string; updatedAt?: string | null }[]): string {
  const body = entries
    .map((e) => `<url><loc>${esc(new URL(e.path, siteConfig.url).toString())}</loc>${e.updatedAt ? `<lastmod>${e.updatedAt}</lastmod>` : ""}</url>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export function sitemapIndex(items: { loc: string; updatedAt?: string | null }[]): string {
  const body = items.map((i) => `<sitemap><loc>${esc(i.loc)}</loc>${i.updatedAt ? `<lastmod>${i.updatedAt}</lastmod>` : ""}</sitemap>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`;
}

export const xml = (s: string) => new Response(s, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=600, s-maxage=3600" } });

/** Hub pages always listed in the "pages" sitemap. */
export const STATIC_PATHS = ["/", "/tournaments", "/tournaments/upcoming", "/tournaments/ongoing", "/tournaments/completed", "/sensitivity", "/sensitivity/devices", "/sensitivity/guns", "/sensitivity/codes", "/news", "/guides", "/about", "/contact"];
export const SITEMAP_TYPES = ["pages", "tournaments", "sensitivity", "devices", "articles"] as const;
