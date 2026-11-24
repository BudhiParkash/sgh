import { Router } from "express";
import { MIN_INDEXABLE_WORDS } from "@sgh/shared";
import { env, isTest } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import type { Cache } from "../../lib/cache.js";
import { publicFilter } from "../../lib/content/fields.js";
import { notFound } from "../../lib/errors.js";
import { ok } from "../../lib/respond.js";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { ArticleModel } from "../articles/article.model.js";
import { CategoryModel } from "../categories/category.model.js";
import { LegalPageModel } from "../legal/legal.model.js";
import { RedirectModel } from "../redirects/redirect.model.js";
import { SensitivityConfigModel } from "../sensitivity/config.model.js";
import { DeviceModel } from "../sensitivity/device.model.js";
import { WeaponModel } from "../sensitivity/weapon.model.js";
import { TagModel } from "../tags/tag.model.js";
import { TournamentModel } from "../tournaments/tournament.model.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- lean docs */
export interface SitemapEntry {
  path: string;
  updatedAt: string;
  images?: string[];
}
const indexable = (extra: Record<string, unknown> = {}) => publicFilter({ "seo.robots.index": { $ne: false }, ...extra });
const iso = (d: any) => new Date(d ?? Date.now()).toISOString();
const MIN_TAG_ARTICLES = 3;

/**
 * Only URLs that deserve indexing (docs/architecture/08): published, not noindex, not thin.
 * Mirrors the frontend's robots rules so sitemaps never list noindex pages.
 */
export async function sitemapEntries(type: string): Promise<SitemapEntry[]> {
  switch (type) {
    case "articles": {
      const docs = await ArticleModel.find(indexable()).populate("category", "slug kind").select("slug updatedAt category").lean();
      return docs.map((a: any) => ({ path: `/${a.category?.kind === "news" ? "news" : "guides"}/${a.category?.slug}/${a.slug}`, updatedAt: iso(a.updatedAt) }));
    }
    case "tournaments": {
      const docs = await TournamentModel.find(indexable({ status: { $ne: "rumour" } })).select("slug updatedAt").lean();
      return docs.map((t: any) => ({ path: `/tournaments/${t.slug}`, updatedAt: iso(t.updatedAt) }));
    }
    case "sensitivity": {
      const configs = await SensitivityConfigModel.find(indexable({ explanationWords: { $gte: MIN_INDEXABLE_WORDS } })).select("slug updatedAt").lean();
      const weapons = await WeaponModel.find(indexable()).select("slug updatedAt").lean();
      return [...configs.map((c: any) => ({ path: `/sensitivity/${c.slug}`, updatedAt: iso(c.updatedAt) })), ...weapons.map((w: any) => ({ path: `/sensitivity/guns/${w.slug}`, updatedAt: iso(w.updatedAt) }))];
    }
    case "devices": {
      const withConfigs = await SensitivityConfigModel.distinct("device", publicFilter({ device: { $ne: null } }));
      const devices = await DeviceModel.find(indexable({ _id: { $in: withConfigs } })).select("slug brandSlug updatedAt").lean();
      const brands = new Map<string, string>();
      for (const d of devices as any[]) if (!brands.has(d.brandSlug) || brands.get(d.brandSlug)! < iso(d.updatedAt)) brands.set(d.brandSlug, iso(d.updatedAt));
      return [...[...brands].map(([b, u]) => ({ path: `/sensitivity/devices/${b}`, updatedAt: u })), ...devices.map((d: any) => ({ path: `/sensitivity/devices/${d.brandSlug}/${d.slug}`, updatedAt: iso(d.updatedAt) }))];
    }
    case "pages": {
      const [legal, cats, tagCounts] = await Promise.all([
        LegalPageModel.find(publicFilter()).select("slug updatedAt").lean(),
        ArticleModel.aggregate([{ $match: publicFilter() }, { $group: { _id: "$category", n: { $sum: 1 }, u: { $max: "$updatedAt" } } }]),
        ArticleModel.aggregate([{ $match: publicFilter() }, { $unwind: "$tags" }, { $group: { _id: "$tags", n: { $sum: 1 }, u: { $max: "$updatedAt" } } }, { $match: { n: { $gte: MIN_TAG_ARTICLES } } }]),
      ]);
      const catDocs = await CategoryModel.find({ _id: { $in: cats.map((c) => c._id) }, deleted: false }).select("slug kind").lean();
      const tagDocs = await TagModel.find({ _id: { $in: tagCounts.map((t) => t._id) }, deleted: false }).select("slug").lean();
      const catU = new Map(cats.map((c) => [String(c._id), iso(c.u)]));
      const tagU = new Map(tagCounts.map((t) => [String(t._id), iso(t.u)]));
      return [
        ...legal.map((l: any) => ({ path: `/legal/${l.slug}`, updatedAt: iso(l.updatedAt) })),
        ...catDocs.map((c: any) => ({ path: `/${c.kind === "news" ? "news" : "guides"}/${c.slug}`, updatedAt: catU.get(String(c._id))! })),
        ...tagDocs.map((t: any) => ({ path: `/tags/${t.slug}`, updatedAt: tagU.get(String(t._id))! })),
      ];
    }
    default:
      return [];
  }
}

export const SITEMAP_TYPES = ["articles", "tournaments", "sensitivity", "devices", "pages"] as const;

export function seoPublicRoutes(cache: Cache): Router {
  const r = Router();
  r.get("/sitemap-data/:type", async (req, res) => {
    const type = String(req.params.type);
    if (!(SITEMAP_TYPES as readonly string[]).includes(type)) throw notFound();
    ok(res, await cache.cached(`sitemap:${type}`, ["sitemap", "articles", "tournaments", "sensitivity", "devices", "legal"], 600, () => sitemapEntries(type)));
  });
  /** Latest-updated timestamps per sitemap (for the sitemap index). */
  r.get("/sitemap-data", async (_req, res) => {
    ok(res, await cache.cached("sitemap:index", ["sitemap", "articles", "tournaments", "sensitivity", "devices", "legal"], 600, async () => {
      const out: { type: string; updatedAt: string | null; count: number }[] = [];
      for (const t of SITEMAP_TYPES) {
        const e = await sitemapEntries(t);
        out.push({ type: t, count: e.length, updatedAt: e.reduce<string | null>((m, x) => (!m || x.updatedAt > m ? x.updatedAt : m), null) });
      }
      return out;
    }));
  });
  return r;
}

/** Admin SEO audit: real issues found in published content. */
export function seoAdminRoutes(): Router {
  const r = Router();
  r.get("/overview", requireAuth(), requirePermission("seo:read"), async (_req, res) => {
    const sets: [string, any, (d: any) => string, string][] = [
      ["article", ArticleModel, (d) => d.title, "articles"],
      ["tournament", TournamentModel, (d) => d.name, "tournaments"],
      ["sensitivity", SensitivityConfigModel, (d) => d.title, "sensitivity"],
      ["device", DeviceModel, (d) => `${d.brand} ${d.model}`, "devices"],
      ["weapon", WeaponModel, (d) => d.name, "weapons"],
    ];
    const issues: { severity: "error" | "warning" | "info"; type: string; entity: string; id: string; title: string; adminPath: string; message: string }[] = [];
    const titles = new Map<string, string[]>();
    for (const [entity, model, titleOf, adminKey] of sets) {
      const docs = await model.find(publicFilter()).select("slug title name brand model seo explanationWords content.wordCount content.internalLinks").lean();
      for (const d of docs as any[]) {
        const t = (d.seo?.title || titleOf(d)).trim().toLowerCase();
        titles.set(t, [...(titles.get(t) ?? []), `${entity}:${d._id}`]);
        const base = { entity, id: String(d._id), title: titleOf(d), adminPath: `/admin/${adminKey}/${d._id}` };
        if (!d.seo?.description) issues.push({ ...base, severity: "warning", type: "missing-description", message: "No meta description — search engines will pick text themselves." });
        if (d.seo?.robots?.index === false) issues.push({ ...base, severity: "info", type: "noindex", message: "Published but set to noindex." });
        if (entity === "sensitivity" && (d.explanationWords ?? 0) < MIN_INDEXABLE_WORDS) issues.push({ ...base, severity: "warning", type: "thin", message: `Explanation has ${d.explanationWords ?? 0} words (< ${MIN_INDEXABLE_WORDS}) — page is noindex.` });
        if (entity === "article" && !(d.content?.internalLinks?.length)) issues.push({ ...base, severity: "info", type: "no-internal-links", message: "No internal links to related pages." });
      }
    }
    for (const [t, ids] of titles) if (ids.length > 1) for (const ref of ids) { const [entity, id] = ref.split(":"); issues.push({ severity: "error", type: "duplicate-title", entity: entity!, id: id!, title: t, adminPath: `/admin/${entity === "sensitivity" ? "sensitivity" : `${entity}s`}/${id}`, message: `Title is used by ${ids.length} pages.` }); }

    // Broken internal links in articles (target slug not published)
    const known = new Set<string>(["/", "/tournaments", "/sensitivity", "/news", "/guides", "/about", "/contact", "/report", "/saved", "/sensitivity/devices", "/sensitivity/guns", "/sensitivity/codes", "/sensitivity/compare", "/tournaments/upcoming", "/tournaments/ongoing", "/tournaments/completed", "/tournaments/calendar", "/privacy-request"]);
    for (const t of SITEMAP_TYPES) for (const e of await sitemapEntries(t)) known.add(e.path);
    for (const c of await SensitivityConfigModel.find(publicFilter()).select("slug").lean()) known.add(`/sensitivity/${(c as any).slug}`);
    const redirects = new Set((await RedirectModel.find().select("from").lean()).map((x) => x.from));
    const articles = await ArticleModel.find(publicFilter()).select("title content.internalLinks").lean();
    for (const a of articles as any[]) {
      for (const link of a.content?.internalLinks ?? []) {
        const path = link.split(/[?#]/)[0].replace(/\/$/, "") || "/";
        if (path.startsWith("/go/") || known.has(path) || redirects.has(path)) continue;
        issues.push({ severity: "error", type: "broken-link", entity: "article", id: String(a._id), title: a.title, adminPath: `/admin/articles/${a._id}`, message: `Links to ${path}, which isn't a published page.` });
      }
    }
    const order = { error: 0, warning: 1, info: 2 } as const;
    issues.sort((x, y) => order[x.severity] - order[y.severity]);
    ok(res, { counts: { error: issues.filter((i) => i.severity === "error").length, warning: issues.filter((i) => i.severity === "warning").length, info: issues.filter((i) => i.severity === "info").length }, issues: issues.slice(0, 500), sitemaps: await Promise.all(SITEMAP_TYPES.map(async (t) => ({ type: t, count: (await sitemapEntries(t)).length }))) });
  });
  return r;
}

/** IndexNow ping (Bing, Yandex…) for changed URLs. No-op without INDEXNOW_KEY. */
export async function pingIndexNow(paths: string[]): Promise<void> {
  if (!env.INDEXNOW_KEY || isTest || env.SITE_ENV !== "production" || paths.length === 0) return;
  const host = new URL(env.SITE_URL).host;
  try {
    await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key: env.INDEXNOW_KEY, keyLocation: `${env.SITE_URL}/${env.INDEXNOW_KEY}.txt`, urlList: paths.slice(0, 100).map((p) => `${env.SITE_URL}${p}`) }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    logger.warn({ err }, "IndexNow ping failed");
  }
}

export const indexNowKeyRoute = Router().get("/indexnow-key", (_req, res) => ok(res, { key: env.INDEXNOW_KEY ?? null }));
