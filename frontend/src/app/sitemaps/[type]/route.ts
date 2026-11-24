import { apiGetOr } from "@/lib/api/server";
import { STATIC_PATHS, SITEMAP_TYPES, urlset, xml } from "@/lib/seo/sitemap";

export const revalidate = 3600;
export function generateStaticParams() {
  return SITEMAP_TYPES.map((t) => ({ type: `${t}.xml` }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ type: string }> }) {
  const type = (await params).type.replace(/\.xml$/, "");
  if (!(SITEMAP_TYPES as readonly string[]).includes(type)) return new Response("Not found", { status: 404 });
  const entries = await apiGetOr<{ path: string; updatedAt: string }[]>(`/sitemap-data/${type}`, [], { tags: ["sitemap"], revalidate: 3600 });
  return xml(urlset(type === "pages" ? [...STATIC_PATHS.map((path) => ({ path })), ...entries] : entries));
}
