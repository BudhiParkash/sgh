import { ARTICLE_TYPES } from "@sgh/shared";
import type { ResourceDef } from "./resource";
import { seoSection } from "./sections";

/* eslint-disable @typescript-eslint/no-explicit-any -- admin documents */
type Row = Record<string, any>;
const idOf = (v: any) => (v && typeof v === "object" ? (v.id ?? v._id) : v) ?? null;
const TYPE_LABEL: Record<string, string> = { news: "News", guide: "Guide", tutorial: "Tutorial", review: "Review" };

export const articles: ResourceDef<Row> = {
  key: "articles",
  title: "Articles",
  singular: "Article",
  endpoint: "/articles",
  perm: "article",
  workflow: true,
  revisions: true,
  description: "News, guides, tutorials and reviews. Writers draft and submit; editors review and publish. Minimum 300 words of original content.",
  filters: [{ name: "type", label: "Type", options: ARTICLE_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t]! })) }],
  columns: [
    { key: "title", label: "Title" },
    { key: "type", label: "Type", render: (r) => TYPE_LABEL[r.type] ?? r.type },
    { key: "category", label: "Category", render: (r) => r.category?.name ?? "—" },
    { key: "author", label: "Author", render: (r) => r.author?.profile?.displayName || r.author?.name || "—" },
    { key: "words", label: "Words", render: (r) => r.content?.wordCount ?? 0 },
  ],
  sections: [
    {
      title: "Article",
      fields: [
        { name: "title", label: "Headline", type: "text", required: true, max: 140, wide: true },
        { name: "type", label: "Type", type: "select", required: true, options: ARTICLE_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t]! })) },
        { name: "category", label: "Category", type: "reference", endpoint: "/categories", labelKey: "name", labelOf: (c) => `${c.name} (${c.kind})`, required: true },
        { name: "excerpt", label: "Summary (1–2 sentences, shown in lists and search)", type: "textarea", required: true, max: 300, rows: 3, wide: true },
        { name: "content", label: "Content", type: "richtext", required: true },
      ],
    },
    {
      title: "Details",
      fields: [
        { name: "tags", label: "Tags", type: "references", endpoint: "/tags", labelKey: "name", wide: true },
        { name: "featuredImage", label: "Featured image", type: "media", category: "article" },
        { name: "slug", label: "URL slug", type: "slug" },
        {
          name: "sources",
          label: "Sources",
          type: "list",
          addLabel: "Add source",
          max: 20,
          hint: "Link the official announcement or original source (shown at the end of the article).",
          itemFields: [
            { name: "title", label: "Title", type: "text", required: true, max: 200 },
            { name: "url", label: "URL", type: "url", required: true },
          ],
        },
        {
          name: "faq",
          label: "FAQ (only real questions readers ask)",
          type: "list",
          addLabel: "Add question",
          max: 10,
          itemFields: [
            { name: "question", label: "Question", type: "text", required: true, max: 200 },
            { name: "answer", label: "Answer", type: "textarea", required: true, max: 1500 },
          ],
        },
      ],
    },
    {
      title: "Disclosure",
      fields: [
        { name: "sponsored.isSponsored", label: "This is sponsored content", type: "checkbox", hint: "Shows a \"Sponsored\" label above the headline." },
        { name: "sponsored.sponsorName", label: "Sponsor name", type: "text", max: 120, showIf: (v) => Boolean((v.sponsored as Row | undefined)?.isSponsored) },
        { name: "sponsored.disclosureText", label: "Disclosure text (optional)", type: "textarea", max: 300, showIf: (v) => Boolean((v.sponsored as Row | undefined)?.isSponsored) },
      ],
    },
    seoSection as never,
  ],
  defaults: { type: "guide", tags: [], sources: [], faq: [], sponsored: { isSponsored: false }, seo: { robots: { index: true, follow: true } } },
  toForm: (d) => ({
    ...d,
    category: idOf(d.category),
    tags: (d.tags ?? []).map(idOf),
    featuredImage: idOf(d.featuredImage),
    seo: { ...(d.seo ?? {}), ogImage: idOf(d.seo?.ogImage), robots: d.seo?.robots ?? { index: true, follow: true } },
  }),
  fromForm: (v) => ({ ...v, author: undefined }), // author is set by the server
  titleOf: (r) => r.title,
  publicUrl: (r) => `/${r.category?.kind === "news" ? "news" : "guides"}/${r.category?.slug ?? "uncategorised"}/${r.slug}`,
};
