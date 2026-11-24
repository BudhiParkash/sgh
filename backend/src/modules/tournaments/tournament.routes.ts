import { Router, type Request } from "express";
import { z } from "zod";
import { SOURCE_TYPES, TOURNAMENT_STATUSES, httpsUrlSchema, objectIdSchema, seoSchema, slugSchema } from "@sgh/shared";
import type { Cache } from "../../lib/cache.js";
import { crudRouter } from "../../lib/content/crud.js";
import { publicFilter } from "../../lib/content/fields.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { buildMeta, toSkip } from "../../lib/pagination.js";
import { ok } from "../../lib/respond.js";
import { revalidateTags } from "../../lib/revalidate.js";
import { htmlToText, richTextSchema } from "../../lib/sanitize.js";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { v, validate } from "../../middleware/validate.js";
import { audit } from "../audit/audit.service.js";
import { syncMediaUsage } from "../media/media.service.js";
import { registerSimplePreview } from "../preview.routes.js";
import { addSlugRedirect } from "../redirects/redirect.model.js";
import { TournamentModel } from "./tournament.model.js";
import { toTournamentDetail, toTournamentSummary } from "./tournament.dto.js";
import { RESERVED_TOURNAMENT_SLUGS, dateViolations, paymentWarnings, statusViolations } from "./tournament.rules.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- documents mapped dynamically */
const optUrl = httpsUrlSchema.nullable().optional().or(z.literal("").transform(() => null));
const optDate = z.coerce.date().nullable().optional();

const sourceInput = z.object({
  _id: objectIdSchema.optional(),
  url: httpsUrlSchema,
  type: z.enum(SOURCE_TYPES),
  title: z.string().trim().min(2).max(200),
  publisher: z.string().trim().max(120).optional(),
  accessedAt: optDate,
  archivedUrl: optUrl,
  notes: z.string().trim().max(300).optional(),
});

export const tournamentCreateSchema = z.object({
  name: z.string().trim().min(3).max(140),
  slug: slugSchema.optional(),
  game: objectIdSchema,
  organiser: z.string().trim().min(2).max(120),
  organiserUrl: optUrl,
  description: richTextSchema.optional(),
  format: richTextSchema.optional(),
  startDate: optDate,
  endDate: optDate,
  registrationDeadline: optDate,
  prizePool: z.object({ amount: z.number().min(0).max(1e10).nullable().optional(), display: z.string().trim().max(80).optional(), verified: z.boolean().default(false) }).optional(),
  eligibility: z.object({ summary: z.string().trim().max(160).optional(), minAge: z.number().int().min(0).max(99).nullable().optional(), region: z.string().trim().max(120).optional(), notes: z.string().trim().max(600).optional() }).optional(),
  registrationUrl: optUrl,
  officialSourceUrl: httpsUrlSchema,
  featuredImage: objectIdSchema.nullable().optional(),
  status: z.enum(TOURNAMENT_STATUSES).default("rumour"),
  sources: z.array(sourceInput).max(20).default([]),
  isFeatured: z.boolean().default(false),
  seo: seoSchema.partial().optional(),
});

const tags = (d: any) => ["tournaments", `tournament:${d.slug}`, `tournament:${d.id ?? d._id}`, "home", "sitemap"];
const populate = [{ path: "game", select: "key name" }, { path: "featuredImage" }, { path: "seo.ogImage" }];

export function tournamentAdminRoutes(cache: Cache): Router {
  const extra = Router();
  const verifySchema = z.object({ notes: z.string().trim().min(5, "Describe what you checked").max(600), confidence: z.enum(["low", "medium", "high"]) });

  /** Records that someone checked the official sources (who, when, how confident). */
  extra.post("/:id/verify", requireAuth(), requirePermission("tournament:verify"), validate({ body: verifySchema }), async (req, res) => {
    const t = await TournamentModel.findById(req.params.id);
    if (!t || t.deleted) throw notFound();
    if (!t.sources.some((s: { type: string }) => s.type === "official")) throw badRequest("Add at least one official source before recording a verification.");
    const body = v<z.infer<typeof verifySchema>>(req.valid.body);
    t.verification = { lastVerifiedAt: new Date(), verifiedBy: req.session!.adminId as never, notes: body.notes, confidence: body.confidence };
    t.updatedBy = req.session!.adminId as never;
    await t.save();
    await audit(req, { action: "tournament.verify", entityType: "tournament", entityId: t.id, summary: `${body.confidence}: ${body.notes}` });
    if (t.workflow?.status === "published") await Promise.all([revalidateTags(tags(t)), cache.invalidateTags(["tournaments", "home"])]);
    await t.populate(populate);
    const { _id, __v, ...rest } = t.toObject();
    ok(res, { id: String(_id), version: __v, ...rest });
  });

  const crud = crudRouter({
    entity: "tournament",
    perm: "tournament",
    model: TournamentModel,
    createSchema: tournamentCreateSchema,
    listQuery: z.object({ tstatus: z.enum(TOURNAMENT_STATUSES).optional(), game: objectIdSchema.optional() }),
    buildFilter: (q) => ({ ...(q.tstatus && { status: q.tstatus }), ...(q.game && { game: q.game }) }),
    searchFields: ["name", "organiser", "slug"],
    sortable: ["name", "startDate", "updatedAt"],
    workflow: true,
    revisions: true,
    slugSource: "name",
    populate,
    beforeSave: async (data, { req, existing }) => {
      if (data.slug && RESERVED_TOURNAMENT_SLUGS.has(data.slug)) throw badRequest("That URL is reserved.", [{ path: "slug", message: "Reserved word" }]);
      const merged = { ...(existing?.toObject() ?? {}), ...data };
      const dv = dateViolations(merged);
      if (dv.length) throw badRequest("Please check the dates.", dv);
      const sv = statusViolations(merged);
      if (sv.length) throw badRequest(sv[0]!, [{ path: "status", message: sv[0]! }]);
      (req as Request & { _prevSlug?: string })._prevSlug = existing?.slug;
      return data;
    },
    afterSave: async (doc, { req }) => {
      await syncMediaUsage("tournament", doc._id, [doc.featuredImage?._id ?? doc.featuredImage, doc.seo?.ogImage?._id ?? doc.seo?.ogImage]);
      const prev = (req as Request & { _prevSlug?: string })._prevSlug;
      if (prev && prev !== doc.slug && doc.workflow?.publishedAt) await addSlugRedirect(`/tournaments/${prev}`, `/tournaments/${doc.slug}`, req.session?.adminId);
    },
    publishChecks: (doc) => {
      const blocking = [...statusViolations(doc)];
      const text = htmlToText(doc.description?.html ?? "");
      if (text.length < 80) blocking.push("Add a helpful description (at least 80 characters) — what the event is, who can join, where it's announced.");
      const warnings = [...paymentWarnings(doc.description?.html)];
      if (!doc.featuredImage) warnings.push("No featured image (a default graphic will be used).");
      if (!doc.startDate && doc.status !== "rumour") warnings.push("No start date — shown as \"Dates not announced\".");
      if (doc.prizePool?.amount != null && !doc.prizePool.verified) warnings.push("Prize pool is entered but not marked verified, so it won't be shown.");
      const lv = doc.verification?.lastVerifiedAt;
      if (doc.status !== "rumour" && doc.status !== "completed" && lv && Date.now() - new Date(lv).getTime() > 7 * 86_400_000) warnings.push("Last verification is more than 7 days old — re-check the official source.");
      return { blocking, warnings };
    },
    publicPath: (d) => `/tournaments/${d.slug}`,
    revalidate: tags,
    cache,
    cacheTags: () => ["tournaments", "home", "search"],
  });

  const r = Router();
  r.use(extra);
  r.use(crud);
  return r;
}

const listSchema = z.object({
  status: z.enum(["upcoming", "ongoing", "completed", "cancelled", "rumour", "all"]).default("upcoming"),
  game: z.enum(["bgmi", "pubg-mobile"]).optional(),
  q: z.string().trim().max(80).optional(),
  featured: z.enum(["true"]).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

/** Mongo filter for the visitor-facing (date-derived) status. */
export function statusFilter(status: z.infer<typeof listSchema>["status"], now = new Date()): Record<string, unknown> {
  switch (status) {
    case "upcoming":
      return { status: { $in: ["confirmed", "ongoing"] }, $or: [{ startDate: { $gt: now } }, { startDate: null }] };
    case "ongoing":
      return { status: { $in: ["confirmed", "ongoing"] }, startDate: { $lte: now }, endDate: { $gte: now } };
    case "completed":
      return { $or: [{ status: "completed" }, { status: { $in: ["confirmed", "ongoing"] }, $or: [{ endDate: { $lt: now } }, { endDate: null, startDate: { $lt: now } }] }] };
    case "cancelled":
      return { status: "cancelled" };
    case "rumour":
      return { status: "rumour" };
    default:
      return {};
  }
}

export function tournamentPublicRoutes(cache: Cache): Router {
  const r = Router();
  registerSimplePreview("tournament", TournamentModel as never, (d: any) => toTournamentDetail(d));

  r.get("/", validate({ query: listSchema }), async (req, res) => {
    const q = v<z.infer<typeof listSchema>>(req.valid.query);
    const key = `tournaments:list:${JSON.stringify(q)}`;
    const result = await cache.cached(key, ["tournaments"], 120, async () => {
      const games = q.game ? await (await import("../games/game.model.js")).GameModel.find({ key: q.game }).select("_id").lean() : null;
      const filter: Record<string, unknown> = publicFilter({ ...statusFilter(q.status), ...(games && { game: { $in: games.map((g) => g._id) } }), ...(q.featured && { isFeatured: true }) });
      if (q.q) filter.$text = { $search: q.q };
      const sort: Record<string, 1 | -1> = q.status === "upcoming" ? { startDate: 1 } : q.status === "completed" ? { endDate: -1, startDate: -1 } : { startDate: -1 };
      const [items, total] = await Promise.all([
        TournamentModel.find(filter).populate(populate).sort(sort).skip(toSkip(q)).limit(q.limit).lean(),
        TournamentModel.countDocuments(filter),
      ]);
      return { data: items.map((t) => toTournamentSummary(t)), meta: buildMeta(q, total) };
    });
    ok(res, result.data, result.meta);
  });

  const calSchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });
  r.get("/calendar", validate({ query: calSchema }), async (req, res) => {
    const { month } = v<z.infer<typeof calSchema>>(req.valid.query);
    const data = await cache.cached(`tournaments:cal:${month}`, ["tournaments"], 300, async () => {
      // Month boundaries in IST (UTC+05:30)
      const [y, m] = month.split("-").map(Number) as [number, number];
      const from = new Date(Date.UTC(y, m - 1, 1) - 5.5 * 3_600_000);
      const to = new Date(Date.UTC(y, m, 1) - 5.5 * 3_600_000);
      const items = await TournamentModel.find(publicFilter({ startDate: { $lt: to }, $or: [{ endDate: { $gte: from } }, { endDate: null, startDate: { $gte: from } }] })).populate(populate).sort({ startDate: 1 }).limit(200).lean();
      return items.map((t) => toTournamentSummary(t));
    });
    ok(res, data);
  });

  r.get("/:slug", async (req, res) => {
    const slug = String(req.params.slug);
    if (!/^[a-z0-9-]{1,120}$/.test(slug)) throw notFound();
    const data = await cache.cached(`tournaments:one:${slug}`, ["tournaments", `tournament:${slug}`], 120, async () => {
      const t = await TournamentModel.findOne(publicFilter({ slug })).populate(populate).lean();
      if (!t) return null;
      const related = await TournamentModel.find(publicFilter({ _id: { $ne: t._id }, game: (t.game as any)?._id ?? t.game, status: { $in: ["confirmed", "ongoing"] } })).populate(populate).sort({ startDate: 1 }).limit(3).lean();
      return toTournamentDetail(t, related);
    });
    if (!data) throw notFound("Tournament not found.");
    ok(res, data);
  });
  return r;
}

/** Featured tournaments for the homepage (published, not completed, featured first). */
export async function featuredTournaments(limit = 3) {
  const now = new Date();
  const items = await TournamentModel.find(publicFilter({ status: { $in: ["confirmed", "ongoing"] }, $or: [{ endDate: { $gte: now } }, { endDate: null }] }))
    .populate(populate)
    .sort({ isFeatured: -1, startDate: 1 })
    .limit(limit)
    .lean();
  return items.map((t) => toTournamentSummary(t, now));
}
