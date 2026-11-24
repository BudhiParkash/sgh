import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ArticleSummary } from "@sgh/shared";
import { ArticleCard } from "@/components/articles/article-card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { apiGet, apiGetOr } from "@/lib/api/server";
import { JsonLd } from "@/lib/seo/jsonld";
import { absoluteUrl, buildMetadata } from "@/lib/seo/metadata";
import { siteConfig } from "@/lib/site";

export const revalidate = 3600;
interface Author { slug: string; name: string; bio: string | null }
const load = async (slug: string) => (/^[a-z0-9-]{1,80}$/.test(slug) ? (await apiGet<Author>(`/authors/${slug}`, { tags: ["authors"], revalidate: 3600 }).catch(() => null))?.data ?? null : null);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = await load(slug);
  if (!a) return { title: "Not found", robots: { index: false } };
  return buildMetadata({ title: `${a.name} — author`, description: a.bio ?? `Articles by ${a.name} on ${siteConfig.name}.`, path: `/authors/${slug}` });
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await load(slug);
  if (!a) notFound();
  const articles = await apiGetOr<ArticleSummary[]>("/articles", [], { tags: ["articles"], searchParams: { author: slug, limit: 24 } });
  return (
    <Container className="py-10 md:py-16">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "ProfilePage", mainEntity: { "@type": "Person", name: a.name, url: absoluteUrl(`/authors/${slug}`), ...(a.bio && { description: a.bio }), worksFor: { "@id": `${siteConfig.url}/#organization` } } }} />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: a.name }]} />
      <h1 className="mt-4 text-display font-bold">{a.name}</h1>
      {a.bio && <p className="mt-3 max-w-2xl whitespace-pre-line text-muted">{a.bio}</p>}
      <h2 className="mt-10 mb-5 text-2xl font-semibold">Articles</h2>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{articles.map((x) => <li key={x.id}><ArticleCard a={x} /></li>)}</ul>
    </Container>
  );
}
