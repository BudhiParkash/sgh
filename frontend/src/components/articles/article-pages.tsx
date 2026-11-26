import type { Metadata } from "next";
import Link from "next/link";
import { MediaImage } from "@/components/ui/media-image";
import { notFound, permanentRedirect } from "next/navigation";
import { Flag, Megaphone, Tag } from "lucide-react";
import type { ArticleDetail, ArticleSummary, CategoryDto } from "@sgh/shared";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { PaginationLinks } from "@/components/ui/pagination-links";
import { EmptyState } from "@/components/ui/states";
import { getPreviewItem } from "@/lib/api/preview";
import { apiGet, apiGetOr } from "@/lib/api/server";
import { formatDate } from "@/lib/format";
import { JsonLd, breadcrumbLd } from "@/lib/seo/jsonld";
import { absoluteUrl, buildMetadata } from "@/lib/seo/metadata";
import { siteConfig } from "@/lib/site";
import { ArticleCard, articleHref } from "./article-card";
import { FeedbackWidget } from "@/components/forms/feedback-widget";
import { ShareButtons } from "@/components/retention/share-buttons";

type Kind = "news" | "guide";
const SECTION = { news: { path: "/news", label: "News", title: "BGMI & PUBG Mobile news", blurb: "Updates, patch notes and tournament news — each linked to its official source." }, guide: { path: "/guides", label: "Gaming Guides", title: "BGMI gaming guides, tips & tutorials", blurb: "Practical guides on sensitivity, recoil control, devices and competitive play." } } as const;
const safePage = (p?: string) => Math.min(500, Math.max(1, Number(p) || 1));

async function categories(): Promise<(CategoryDto & { seo?: { title?: string; description?: string } | null })[]> {
  return apiGetOr("/categories", [], { tags: ["categories"], revalidate: 600 });
}

function CategoryNav({ kind, active, cats }: { kind: Kind; active?: string; cats: CategoryDto[] }) {
  const list = cats.filter((c) => c.kind === kind && c.articleCount > 0);
  if (!list.length) return null;
  return (
    <nav aria-label="Categories" className="-mx-4 mb-8 overflow-x-auto px-4">
      <ul className="flex w-max gap-2">
        <li><Link href={SECTION[kind].path} aria-current={!active ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm ${!active ? "border-primary bg-primary/10" : "border-border-strong text-muted hover:text-text"}`}>All</Link></li>
        {list.map((c) => (
          <li key={c.slug}><Link href={`${SECTION[kind].path}/${c.slug}`} aria-current={active === c.slug ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm ${active === c.slug ? "border-primary bg-primary/10" : "border-border-strong text-muted hover:text-text"}`}>{c.name}</Link></li>
        ))}
      </ul>
    </nav>
  );
}

function Grid({ items }: { items: ArticleSummary[] }) {
  return <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map((a) => <li key={a.id}><ArticleCard a={a} /></li>)}</ul>;
}

/** /news and /guides */
export function makeSectionIndex(kind: Kind) {
  const s = SECTION[kind];
  async function generateMetadata({ searchParams }: { searchParams: Promise<{ page?: string }> }): Promise<Metadata> {
    const page = safePage((await searchParams).page);
    return buildMetadata({ title: page > 1 ? `${s.title} — page ${page}` : s.title, description: s.blurb, path: page > 1 ? `${s.path}?page=${page}` : s.path });
  }
  async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
    const page = safePage((await searchParams).page);
    const [res, cats] = await Promise.all([apiGet<ArticleSummary[]>("/articles", { tags: ["articles"], revalidate: 300, searchParams: { kind, page, limit: 12 } }).catch(() => null), categories()]);
    const items = res?.data ?? [];
    if (page > 1 && items.length === 0) notFound();
    return (
      <Container className="py-10 md:py-16">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: s.label }]} />
        <h1 className="mt-4 text-display font-bold">{s.title}</h1>
        <p className="mt-3 mb-8 max-w-2xl text-muted md:text-lg">{s.blurb}</p>
        <CategoryNav kind={kind} cats={cats} />
        {items.length === 0 ? <EmptyState title={`No ${kind === "news" ? "news" : "guides"} published yet`} description="New articles will appear here." /> : <Grid items={items} />}
        {res?.meta && <PaginationLinks page={res.meta.page} totalPages={res.meta.totalPages} hrefFor={(p) => (p > 1 ? `${s.path}?page=${p}` : s.path)} />}
      </Container>
    );
  }
  return { Page, generateMetadata };
}

/** /news/[category] and /guides/[category] */
export function makeCategoryPage(kind: Kind) {
  const s = SECTION[kind];
  async function load(slug: string) {
    const cats = await categories();
    const cat = cats.find((c) => c.slug === slug && c.kind === kind);
    return cat ? { cat, cats } : null;
  }
  async function generateMetadata({ params, searchParams }: { params: Promise<{ category: string }>; searchParams: Promise<{ page?: string }> }): Promise<Metadata> {
    const { category } = await params;
    const page = safePage((await searchParams).page);
    const d = await load(category);
    if (!d) return { title: "Not found", robots: { index: false } };
    return buildMetadata({
      title: d.cat.seo?.title || (page > 1 ? `${d.cat.name} — page ${page}` : d.cat.name),
      description: d.cat.seo?.description || d.cat.description || `${d.cat.name} from ${siteConfig.name}.`,
      path: `${s.path}/${category}${page > 1 ? `?page=${page}` : ""}`,
      noindex: d.cat.articleCount === 0,
    });
  }
  async function Page({ params, searchParams }: { params: Promise<{ category: string }>; searchParams: Promise<{ page?: string }> }) {
    const { category } = await params;
    const page = safePage((await searchParams).page);
    const d = await load(category);
    if (!d) notFound();
    const res = await apiGet<ArticleSummary[]>("/articles", { tags: ["articles", `category:${category}`], revalidate: 300, searchParams: { category, page, limit: 12 } }).catch(() => null);
    const items = res?.data ?? [];
    return (
      <Container className="py-10 md:py-16">
        <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: s.label, path: s.path }, { name: d.cat.name, path: `${s.path}/${category}` }])} />
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: s.label, href: s.path }, { label: d.cat.name }]} />
        <h1 className="mt-4 text-display font-bold">{d.cat.name}</h1>
        {d.cat.description && <p className="mt-3 mb-8 max-w-2xl text-muted md:text-lg">{d.cat.description}</p>}
        <CategoryNav kind={kind} active={category} cats={d.cats} />
        {items.length === 0 ? <EmptyState title="Nothing here yet" /> : <Grid items={items} />}
        {res?.meta && <PaginationLinks page={res.meta.page} totalPages={res.meta.totalPages} hrefFor={(p) => `${s.path}/${category}${p > 1 ? `?page=${p}` : ""}`} />}
      </Container>
    );
  }
  return { Page, generateMetadata };
}

async function loadArticle(slug: string): Promise<{ a: ArticleDetail; preview: boolean } | null> {
  const preview = await getPreviewItem<ArticleDetail>("article");
  if (preview && preview.slug === slug) return { a: preview, preview: true };
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const r = await apiGet<ArticleDetail>(`/articles/${slug}`, { tags: ["articles", `article:${slug}`], revalidate: 3600 });
  return r ? { a: r.data, preview: false } : null;
}

/** /news/[category]/[slug] and /guides/[category]/[slug] */
export function makeArticlePage(kind: Kind) {
  const s = SECTION[kind];
  async function generateMetadata({ params }: { params: Promise<{ category: string; slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const res = await loadArticle(slug).catch(() => null);
    if (!res) return { title: "Not found", robots: { index: false } };
    const { a } = res;
    return buildMetadata({ title: a.title, description: a.excerpt, path: articleHref(a), seo: a.seo, image: a.featuredImage, type: "article", publishedTime: a.publishedAt, modifiedTime: a.updatedAt, noindex: res.preview });
  }
  async function Page({ params }: { params: Promise<{ category: string; slug: string }> }) {
    const { category, slug } = await params;
    const res = await loadArticle(slug);
    if (!res) notFound();
    const { a, preview } = res;
    // One canonical URL per article: wrong section/category → permanent redirect.
    if (!preview && (a.category.kind !== kind || a.category.slug !== category)) permanentRedirect(articleHref(a));
    const crumbs = [{ name: "Home", path: "/" }, { name: s.label, path: s.path }, { name: a.category.name, path: `${s.path}/${a.category.slug}` }, { name: a.title, path: articleHref(a) }];
    const ld = [
      breadcrumbLd(crumbs),
      {
        "@context": "https://schema.org",
        "@type": a.type === "news" ? "NewsArticle" : "Article",
        headline: a.title,
        description: a.excerpt,
        datePublished: a.publishedAt,
        dateModified: a.updatedAt,
        ...(a.featuredImage && { image: [a.featuredImage.url] }),
        author: a.author.slug ? { "@type": "Person", name: a.author.name, url: absoluteUrl(`/authors/${a.author.slug}`) } : { "@type": "Organization", name: siteConfig.name },
        publisher: { "@id": `${siteConfig.url}/#organization` },
        mainEntityOfPage: absoluteUrl(articleHref(a)),
      },
      ...(a.faq.length ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: a.faq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) }] : []),
    ];
    return (
      <article>
        <JsonLd data={ld} />
        {preview && <p className="bg-warning/15 py-2 text-center text-sm text-warning" role="status">Preview — this version is not published.</p>}
        <Container className="py-10 md:py-14">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: s.label, href: s.path }, { label: a.category.name, href: `${s.path}/${a.category.slug}` }, { label: a.title }]} />
          <header className="mt-6 max-w-3xl">
            {a.sponsor && (
              <p role="note" className="mb-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                <Megaphone className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                <span><strong>Sponsored</strong>{a.sponsor.name && <> by {a.sponsor.name}</>}. {a.sponsor.disclosureText ?? "This article was paid for by the sponsor. Our opinions remain our own."}</span>
              </p>
            )}
            {a.hasAffiliateLinks && (
              <p role="note" className="mb-4 rounded-lg border border-border-strong bg-surface-1 p-3 text-sm text-muted">
                This article contains affiliate links. If you buy through them we may earn a commission at no extra cost to you. <Link href="/legal/affiliate-disclosure" className="text-secondary underline">Affiliate disclosure</Link>
              </p>
            )}
            <Badge tone="primary">{a.category.name}</Badge>
            <h1 className="mt-3 text-display font-bold">{a.title}</h1>
            <p className="mt-4 text-lg text-muted">{a.excerpt}</p>
            <p className="mt-5 text-sm text-subtle">
              By {a.author.slug ? <Link href={`/authors/${a.author.slug}`} className="text-text hover:underline">{a.author.name}</Link> : <span className="text-text">{a.author.name}</span>}
              {" · "}Published <time dateTime={a.publishedAt}>{formatDate(a.publishedAt)}</time>
              {a.updatedAt.slice(0, 10) !== a.publishedAt.slice(0, 10) && <> · Updated <time dateTime={a.updatedAt}>{formatDate(a.updatedAt)}</time></>}
              {" · "}{a.readingMinutes} min read
            </p>
            <div className="mt-4"><ShareButtons path={articleHref(a)} title={a.title} /></div>
          </header>
          {a.featuredImage && (
            <div className="relative mt-8 aspect-[16/9] max-w-4xl overflow-hidden rounded-xl bg-surface-2">
              <MediaImage image={a.featuredImage} fill priority sizes="(min-width:1024px) 900px, 100vw" className="object-cover" />
            </div>
          )}
          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_260px]">
            <div className="min-w-0">
              <div className="prose-sgh" dangerouslySetInnerHTML={{ __html: a.contentHtml }} />
              {a.faq.length > 0 && (
                <section aria-labelledby="faq" className="mt-12 max-w-3xl">
                  <h2 id="faq" className="text-2xl font-semibold">Frequently asked questions</h2>
                  <div className="mt-4 flex flex-col gap-2">
                    {a.faq.map((f) => (
                      <details key={f.question} className="rounded-lg border border-border bg-surface-1 p-4">
                        <summary className="cursor-pointer font-medium">{f.question}</summary>
                        <p className="mt-2 whitespace-pre-line text-muted">{f.answer}</p>
                      </details>
                    ))}
                  </div>
                </section>
              )}
              {a.sources.length > 0 && (
                <section aria-labelledby="sources" className="mt-12 max-w-3xl">
                  <h2 id="sources" className="text-xl font-semibold">Sources</h2>
                  <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-sm">
                    {a.sources.map((src) => <li key={src.url}><a href={src.url} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">{src.title}</a></li>)}
                  </ul>
                </section>
              )}
              <div className="mt-12 max-w-3xl"><FeedbackWidget targetType="article" targetSlug={a.slug} /></div>
              <footer className="mt-12 flex max-w-3xl flex-wrap items-center gap-3 border-t border-border pt-6 text-sm">
                {a.tags.map((t) => <Link key={t.slug} href={`/tags/${t.slug}`} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border-strong px-3 text-muted hover:text-text"><Tag className="size-3.5" aria-hidden="true" />{t.name}</Link>)}
                <Link href={`/report?url=${encodeURIComponent(articleHref(a))}`} className="ml-auto inline-flex items-center gap-1 text-secondary hover:underline"><Flag className="size-3.5" aria-hidden="true" /> Report a problem</Link>
              </footer>
            </div>
            {a.headings.length > 2 && (
              <aside className="hidden lg:block">
                <nav aria-labelledby="toc" className="sticky top-24 rounded-lg border border-border bg-surface-1 p-4 text-sm">
                  <h2 id="toc" className="mb-2 font-semibold">On this page</h2>
                  <ol className="flex flex-col gap-1.5">
                    {a.headings.map((h) => <li key={h.id} className={h.level === 3 ? "pl-3" : undefined}><a href={`#${h.id}`} className="text-muted hover:text-text">{h.text}</a></li>)}
                  </ol>
                </nav>
              </aside>
            )}
          </div>
        </Container>
        {a.related.length > 0 && (
          <Container className="pb-16">
            <h2 className="mb-5 text-2xl font-semibold">Related</h2>
            <Grid items={a.related} />
          </Container>
        )}
      </article>
    );
  }
  return { Page, generateMetadata };
}
