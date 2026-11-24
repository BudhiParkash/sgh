import { Router } from "express";
import { z } from "zod";
import { seoSchema } from "@sgh/shared";
import { env } from "../../config/env.js";
import type { Cache } from "../../lib/cache.js";
import { crudRouter } from "../../lib/content/crud.js";
import { publicFilter } from "../../lib/content/fields.js";
import { processHtml } from "../../lib/content/html.js";
import { notFound } from "../../lib/errors.js";
import { ok } from "../../lib/respond.js";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { registerPreview } from "../preview.routes.js";
import { getSettings } from "../settings/settings.model.js";
import { LEGAL_SLUGS, LegalPageModel, LegalVersionModel } from "./legal.model.js";
import { TOKENS, renderTokens } from "./tokens.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- documents */
const contentInput = z.union([z.string().max(200_000), z.object({ json: z.unknown().optional(), html: z.string().max(200_000) })]);

export function legalAdminRoutes(cache: Cache): Router {
  const extra = Router();
  /** Token catalogue + which values are still missing (shown in the editor). */
  extra.get("/tokens", requireAuth(), requirePermission("legal:read"), async (_req, res) => {
    const s = await getSettings();
    ok(res, Object.entries(TOKENS).map(([key, t]) => ({ key, label: t.label, value: t.get(s) ?? null })));
  });
  extra.get("/:id/versions", requireAuth(), requirePermission("legal:read"), async (req, res) => {
    const d = await LegalPageModel.findById(req.params.id).lean();
    if (!d) throw notFound();
    ok(res, await LegalVersionModel.find({ slug: (d as any).slug }).sort({ version: -1 }).select("-html").lean());
  });

  const crud = crudRouter({
    entity: "legal",
    perm: "legal",
    model: LegalPageModel,
    createSchema: z.object({
      slug: z.enum(LEGAL_SLUGS),
      title: z.string().trim().min(3).max(120),
      content: contentInput,
      effectiveDate: z.coerce.date().nullable().optional(),
      changeSummary: z.string().trim().max(500).optional(),
      reviewedByCounsel: z.boolean().default(false),
      seo: seoSchema.partial().optional(),
    }),
    searchFields: ["title", "slug"],
    workflow: true,
    revisions: true,
    softDelete: true,
    beforeSave: (data, { existing }) => {
      if (data.content !== undefined) {
        const p = processHtml(typeof data.content === "string" ? data.content : data.content.html);
        data.content = { json: typeof data.content === "string" ? undefined : data.content.json, html: p.html, headings: p.headings };
      }
      // Any content change requires a fresh counsel review.
      if (existing && data.content && !("reviewedByCounsel" in data)) data.reviewedByCounsel = false;
      return data;
    },
    publishChecks: async (d) => {
      const { missing } = renderTokens(d.content?.html ?? "", await getSettings());
      const production = env.SITE_ENV === "production";
      const problems = [
        ...missing.map((m) => `Missing value: ${m} (fill it in Settings).`),
        ...(d.reviewedByCounsel ? [] : ["Not yet marked as reviewed by qualified legal counsel."]),
        ...(d.effectiveDate ? [] : ["No effective date set."]),
      ];
      // Production: hard block. Staging/local: warnings, so drafts can be previewed.
      return production ? { blocking: problems, warnings: [] } : { blocking: [], warnings: problems };
    },
    afterSave: async (doc, { req, action }) => {
      if (action !== "publish") return;
      const version = (doc.version ?? 0) + 1;
      await LegalPageModel.updateOne({ _id: doc._id }, { $set: { version } });
      await LegalVersionModel.create({ slug: doc.slug, version, title: doc.title, html: doc.content?.html, effectiveDate: doc.effectiveDate, changeSummary: doc.changeSummary, publishedBy: req.session?.adminId });
    },
    revalidate: (d) => ["legal", `legal:${d.slug}`, "sitemap"],
    cache,
    cacheTags: (d) => ["legal", `legal:${d.slug}`],
  });
  const r = Router();
  r.use(extra);
  r.use(crud);
  return r;
}

async function renderPage(d: any) {
  const { html, missing } = renderTokens(d.content?.html ?? "", await getSettings());
  return { slug: d.slug, title: d.title, contentHtml: html, headings: d.content?.headings ?? [], version: d.version ?? 1, effectiveDate: d.effectiveDate ? new Date(d.effectiveDate).toISOString() : null, updatedAt: new Date(d.updatedAt).toISOString(), hasPlaceholders: missing.length > 0 };
}

export function legalPublicRoutes(cache: Cache): Router {
  const r = Router();
  registerPreview("legal", async (id) => {
    const d = await LegalPageModel.findById(id).lean();
    return d ? renderPage(d) : null;
  });
  r.get("/", async (_req, res) => {
    ok(res, await cache.cached("legal:list", ["legal"], 600, async () => (await LegalPageModel.find(publicFilter()).select("slug title updatedAt").lean()).map((d: any) => ({ slug: d.slug, title: d.title, updatedAt: d.updatedAt }))));
  });
  r.get("/:slug", async (req, res) => {
    const slug = String(req.params.slug);
    if (!(LEGAL_SLUGS as readonly string[]).includes(slug)) throw notFound();
    const version = req.query.version ? Number(req.query.version) : null;
    const data = await cache.cached(`legal:${slug}:${version ?? "current"}`, ["legal", `legal:${slug}`, "settings"], 600, async () => {
      if (version) {
        const v = await LegalVersionModel.findOne({ slug, version }).lean();
        return v ? { ...(await renderPage({ ...v, content: { html: v.html }, updatedAt: v.publishedAt })), version: v.version } : null;
      }
      const d = await LegalPageModel.findOne(publicFilter({ slug })).lean();
      return d ? renderPage(d) : null;
    });
    if (!data) throw notFound();
    ok(res, data);
  });
  return r;
}
