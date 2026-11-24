import { apiGetOr } from "@/lib/api/server";
import { siteConfig } from "@/lib/site";
import { SITEMAP_TYPES, sitemapIndex, xml } from "@/lib/seo/sitemap";

export const revalidate = 3600;

/** Sitemap index → one sitemap per content type (only indexable URLs). */
export async function GET() {
  const meta = await apiGetOr<{ type: string; updatedAt: string | null; count: number }[]>("/sitemap-data", [], { tags: ["sitemap"], revalidate: 3600 });
  return xml(sitemapIndex(SITEMAP_TYPES.map((t) => ({ loc: `${siteConfig.url}/sitemaps/${t}.xml`, updatedAt: meta.find((m) => m.type === t)?.updatedAt ?? null }))));
}
