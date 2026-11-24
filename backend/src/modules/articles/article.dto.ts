import type { ArticleDetail, ArticleSummary } from "@sgh/shared";
import { toMediaRef } from "../media/media.service.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- populated lean docs */
const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null);

export function authorRef(a: any): { name: string; slug: string | null } {
  if (!a || typeof a !== "object") return { name: "Shivanshi Gaming Hub", slug: null };
  const p = a.profile ?? {};
  return { name: p.displayName || a.name || "Shivanshi Gaming Hub", slug: p.isPublic && p.slug ? p.slug : null };
}

export function toArticleSummary(a: any): ArticleSummary {
  return {
    id: String(a._id),
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    type: a.type,
    category: a.category && typeof a.category === "object" ? { slug: a.category.slug, name: a.category.name, kind: a.category.kind } : { slug: "uncategorised", name: "Uncategorised", kind: "guide" },
    featuredImage: toMediaRef(a.featuredImage),
    author: authorRef(a.author),
    publishedAt: iso(a.workflow?.publishedAt ?? a.createdAt)!,
    updatedAt: iso(a.updatedAt)!,
    readingMinutes: a.content?.readingMinutes ?? 1,
    isSponsored: Boolean(a.sponsored?.isSponsored),
  };
}

export function toArticleDetail(a: any, related: any[] = []): ArticleDetail {
  return {
    ...toArticleSummary(a),
    contentHtml: a.content?.html ?? "",
    headings: a.content?.headings ?? [],
    tags: (a.tags ?? []).filter((t: any) => t && typeof t === "object").map((t: any) => ({ slug: t.slug, name: t.name })),
    sources: a.sources ?? [],
    faq: a.faq ?? [],
    sponsor: a.sponsored?.isSponsored ? { name: a.sponsored.sponsorName ?? "", disclosureText: a.sponsored.disclosureText ?? null } : null,
    hasAffiliateLinks: Boolean(a.hasAffiliateLinks),
    related: related.map(toArticleSummary),
    seo: {
      title: a.seo?.title ?? null,
      description: a.seo?.description ?? null,
      canonicalUrl: a.seo?.canonicalUrl ?? null,
      robots: { index: a.seo?.robots?.index ?? true, follow: a.seo?.robots?.follow ?? true },
      ogImage: toMediaRef(a.seo?.ogImage),
    },
  };
}
