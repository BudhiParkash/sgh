import { Router, type Request } from "express";
import { z } from "zod";
import { ARTICLE_TYPES, httpsUrlSchema, objectIdSchema, seoSchema, slugSchema } from "@sgh/shared";
import type { Cache } from "../../lib/cache.js";
import { crudRouter } from "../../lib/content/crud.js";
import { publicFilter } from "../../lib/content/fields.js";
import { processHtml } from "../../lib/content/html.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { buildMeta, toSkip } from "../../lib/pagination.js";
import { ok } from "../../lib/respond.js";
import { v, validate } from "../../middleware/validate.js";
import { AdminModel } from "../admins/admin.model.js";
import { CategoryModel } from "../categories/category.model.js";
import { syncMediaUsage } from "../media/media.service.js";
import { registerPreview } from "../preview.routes.js";
import { addSlugRedirect } from "../redirects/redirect.model.js";
import { TagModel } from "../tags/tag.model.js";
import { ArticleModel } from "./article.model.js";
import { toArticleDetail, toArticleSummary } from "./article.dto.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- documents mapped dynamically */
const POP = [
  { path: "category", select: "name slug kind" },
  { path: "tags", select: "name slug" },
  { path: "author", select: "name profile" },
  { path: "featuredImage" },
  { path: "seo.ogImage" },
];
const pathFor = (d: any) => `/${d.category?.kind === "news" ? "news" : "guides"}/${d.category?.slug ?? "uncategorised"}/${d.slug}`;

const contentInput = z.union([z.string().max(300_000), z.object({ json: z.unknown().optional(), html: z.string().max(300_000) })]);

export const articleCreateSchema = z.object({
  title: z.string().trim().min(5).max(140),
  slug: slugSchema.optional(),
  excerpt: z.string().trim().min(20, "Write a 1–2 sentence summary (20+ characters)").max(300),
  type: z.enum(ARTICLE_TYPES),
  content: contentInput,
  featuredImage: objectIdSchema.nullable().optional(),
  author: objectIdSchema.optional(),
  category: objectIdSchema,
  tags: z.array(objectIdSchema).max(10).default([]),
  sources: z.array(z.object({ title: z.string().trim().min(2).max(200), url: httpsUrlSchema })).max(20).default([]),
  faq: z.array(z.object({ question: z.string().trim().min(5).max(200), answer: z.string().trim().min(5).max(1500) })).max(10).default([]),
  sponsored: z.object({ isSponsored: z.boolean().default(false), sponsorName: z.string().trim().max(120).optional(), disclosureText: z.string().trim().max(300).optional() }).optional(),
  seo: seoSchema.partial().optional(),
});

export function articleAdminRoutes(cache: Cache) {
  return crudRouter({
    entity: "article",
    perm: "article",
    model: ArticleModel,
    createSchema: articleCreateSchema,
    listQuery: z.object({ category: objectIdSchema.optional(), type: z.enum(ARTICLE_TYPES).optional(), mine: z.enum(["true"]).optional() }),
    buildFilter: (q) => ({ ...(q.category && { category: q.category }), ...(q.type && { type: q.type }) }),
    searchFields: ["title", "slug", "excerpt"],
    sortable: ["title", "updatedAt", "workflow.publishedAt"],
    workflow: true,
    revisions: true,
    slugSource: "title",
    populate: POP,
    ownership: { bypass: "article:update_any" },
    beforeSave: async (data, { req, existing }) => {
      if (data.content !== undefined) {
        const raw = typeof data.content === "string" ? data.content : data.content.html;
        const p = processHtml(raw);
        data.content = { json: typeof data.content === "string" ? undefined : data.content.json, html: p.html, headings: p.headings, wordCount: p.wordCount, readingMinutes: p.readingMinutes, internalLinks: p.internalLinks };
        data.hasAffiliateLinks = p.hasAffiliateLinks;
      }
      if (!existing && !data.author) data.author = req.session!.adminId;
      if (data.category && !(await CategoryModel.exists({ _id: data.category, deleted: false }))) throw badRequest("Unknown category.", [{ path: "category", message: "Unknown category" }]);
      if (data.tags?.length && (await TagModel.countDocuments({ _id: { $in: data.tags }, deleted: false })) !== data.tags.length) throw badRequest("Unknown tag.", [{ path: "tags", message: "Unknown tag" }]);
      (req as Request & { _prevPath?: string })._prevPath = existing ? pathFor(existing) : undefined;
      return data;
    },
    afterSave: async (doc, { req }) => {
      await syncMediaUsage("article", doc._id, [doc.featuredImage?._id ?? doc.featuredImage, doc.seo?.ogImage?._id ?? doc.seo?.ogImage]);
      const prev = (req as Request & { _prevPath?: string })._prevPath;
      if (doc.workflow?.publishedAt && prev) {
        const fresh = await ArticleModel.findById(doc._id).populate("category", "slug kind").lean();
        const next = pathFor(fresh);
        if (prev !== next) await addSlugRedirect(prev, next, req.session?.adminId);
      }
    },
    publishChecks: (d) => {
      const blocking: string[] = [];
      const warnings: string[] = [];
      const words = d.content?.wordCount ?? 0;
      if (words < 300) blocking.push(`Article has ${words} words — write at least 300 words of original content.`);
      if (d.sponsored?.isSponsored && !d.sponsored?.sponsorName) blocking.push("Sponsored articles must name the sponsor (shown as a disclosure).");
      if (!d.featuredImage) warnings.push("No featured image.");
      if (d.type === "news" && !(d.sources?.length)) warnings.push("News without sources — link the official announcement.");
      if (!(d.content?.internalLinks?.length)) warnings.push("No internal links — link to a related guide, tournament or setup.");
      if (d.category?.kind && ((d.type === "news") !== (d.category.kind === "news"))) warnings.push(`A "${d.type}" in a ${d.category.kind} category — check the category.`);
      if (d.hasAffiliateLinks) warnings.push("Contains affiliate links — an affiliate disclosure will be shown at the top.");
      return { blocking, warnings };
    },
    publicPath: (d) => pathFor(d),
    revalidate: (d) => ["articles", `article:${d.slug}`, `category:${d.category?.slug ?? ""}`, "home", "sitemap", "search"],
    cache,
    cacheTags: () => ["articles", "home", "categories", "search"],
  });
}

export async function latestArticles(kind: "news" | "guide", limit: number) {
  const cats = await CategoryModel.find({ kind, deleted: false }).select("_id").lean();
  const items = await ArticleModel.find(publicFilter({ category: { $in: cats.map((c) => c._id) } })).populate(POP).sort({ "workflow.publishedAt": -1 }).limit(limit).lean();
  return items.map(toArticleSummary);
}

export function articlePublicRoutes(cache: Cache): Router {
  const r = Router();
  registerPreview("article", async (id) => {
    const a = await ArticleModel.findById(id).populate(POP).lean();
    return a ? toArticleDetail(a) : null;
  });

  const listSchema = z.object({
    kind: z.enum(["news", "guide"]).optional(),
    category: z.string().regex(/^[a-z0-9-]{1,120}$/).optional(),
    tag: z.string().regex(/^[a-z0-9-]{1,120}$/).optional(),
    author: z.string().regex(/^[a-z0-9-]{1,80}$/).optional(),
    type: z.enum(ARTICLE_TYPES).optional(),
    page: z.coerce.number().int().min(1).max(500).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
  });
  r.get("/", validate({ query: listSchema }), async (req, res) => {
    const q = v<z.infer<typeof listSchema>>(req.valid.query);
    const out = await cache.cached(`articles:${JSON.stringify(q)}`, ["articles"], 300, async () => {
      const filter: Record<string, unknown> = publicFilter({ ...(q.type && { type: q.type }) });
      if (q.category || q.kind) {
        const cats = await CategoryModel.find({ deleted: false, ...(q.category && { slug: q.category }), ...(q.kind && { kind: q.kind }) }).select("_id").lean();
        filter.category = { $in: cats.map((c) => c._id) };
      }
      if (q.tag) {
        const t = await TagModel.findOne({ slug: q.tag, deleted: false }).select("_id").lean();
        filter.tags = t?._id ?? null;
      }
      if (q.author) {
        const a = await AdminModel.findOne({ "profile.slug": q.author, "profile.isPublic": true }).select("_id").lean();
        filter.author = a?._id ?? null;
      }
      const [items, total] = await Promise.all([ArticleModel.find(filter).populate(POP).sort({ "workflow.publishedAt": -1 }).skip(toSkip(q)).limit(q.limit).lean(), ArticleModel.countDocuments(filter)]);
      return { data: items.map(toArticleSummary), meta: buildMeta(q, total) };
    });
    ok(res, out.data, out.meta);
  });

  r.get("/:slug", async (req, res) => {
    const slug = String(req.params.slug);
    if (!/^[a-z0-9-]{1,120}$/.test(slug)) throw notFound();
    const data = await cache.cached(`articles:one:${slug}`, ["articles", `article:${slug}`], 300, async () => {
      const a = await ArticleModel.findOne(publicFilter({ slug })).populate(POP).lean();
      if (!a) return null;
      const related = await ArticleModel.find(publicFilter({ _id: { $ne: a._id }, $or: [{ category: (a.category as any)?._id }, { tags: { $in: (a.tags as any[]).map((t) => t._id) } }] }))
        .populate(POP)
        .sort({ "workflow.publishedAt": -1 })
        .limit(3)
        .lean();
      return toArticleDetail(a, related);
    });
    if (!data) throw notFound("Article not found.");
    ok(res, data);
  });
  return r;
}

/** Categories with published-article counts; tags and public author profiles. */
export function taxonomyPublicRoutes(cache: Cache): Router {
  const r = Router();
  r.get("/categories", async (_req, res) => {
    ok(res, await cache.cached("categories:public", ["categories", "articles"], 600, async () => {
      const counts = new Map((await ArticleModel.aggregate([{ $match: publicFilter() }, { $group: { _id: "$category", n: { $sum: 1 } } }])).map((x) => [String(x._id), x.n as number]));
      return (await CategoryModel.find({ deleted: false }).sort({ kind: 1, order: 1 }).lean()).map((c: any) => ({ id: String(c._id), slug: c.slug, name: c.name, description: c.description ?? null, kind: c.kind, articleCount: counts.get(String(c._id)) ?? 0, seo: c.seo ?? null }));
    }));
  });
  r.get("/tags/:slug", async (req, res) => {
    const slug = String(req.params.slug);
    const data = await cache.cached(`tags:${slug}`, ["articles"], 600, async () => {
      const t = await TagModel.findOne({ slug, deleted: false }).lean();
      if (!t) return null;
      const count = await ArticleModel.countDocuments(publicFilter({ tags: t._id }));
      return { slug: (t as any).slug, name: (t as any).name, description: (t as any).description ?? null, articleCount: count };
    });
    if (!data) throw notFound();
    ok(res, data);
  });
  r.get("/authors/:slug", async (req, res) => {
    const slug = String(req.params.slug);
    if (!/^[a-z0-9-]{1,80}$/.test(slug)) throw notFound();
    const a = await AdminModel.findOne({ "profile.slug": slug, "profile.isPublic": true, status: "active" }).lean();
    if (!a) throw notFound();
    ok(res, { slug, name: a.profile?.displayName || a.name, bio: a.profile?.bio ?? null });
  });
  return r;
}
