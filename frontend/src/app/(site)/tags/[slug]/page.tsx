import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ArticleSummary } from "@sgh/shared";
import { ArticleCard } from "@/components/articles/article-card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { PaginationLinks } from "@/components/ui/pagination-links";
import { apiGet } from "@/lib/api/server";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 600;
/** Tag pages with fewer articles than this are noindex (thin-content guard). */
const MIN_INDEXABLE = 3;

interface TagInfo { slug: string; name: string; description: string | null; articleCount: number }
const load = async (slug: string) => (/^[a-z0-9-]{1,120}$/.test(slug) ? (await apiGet<TagInfo>(`/tags/${slug}`, { tags: ["articles"], revalidate: 600 }).catch(() => null))?.data ?? null : null);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = await load(slug);
  if (!t) return { title: "Not found", robots: { index: false } };
  return buildMetadata({ title: `${t.name} — articles`, description: t.description ?? `Articles tagged ${t.name}.`, path: `/tags/${slug}`, noindex: t.articleCount < MIN_INDEXABLE });
}

export default async function TagPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }) {
  const { slug } = await params;
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const t = await load(slug);
  if (!t || t.articleCount === 0) notFound();
  const res = await apiGet<ArticleSummary[]>("/articles", { tags: ["articles"], revalidate: 600, searchParams: { tag: slug, page, limit: 12 } }).catch(() => null);
  return (
    <Container className="py-10 md:py-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: `Tag: ${t.name}` }]} />
      <h1 className="mt-4 text-display font-bold">{t.name}</h1>
      {t.description && <p className="mt-3 max-w-2xl text-muted">{t.description}</p>}
      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{res?.data.map((a) => <li key={a.id}><ArticleCard a={a} /></li>)}</ul>
      {res?.meta && <PaginationLinks page={res.meta.page} totalPages={res.meta.totalPages} hrefFor={(p) => `/tags/${slug}${p > 1 ? `?page=${p}` : ""}`} />}
    </Container>
  );
}
