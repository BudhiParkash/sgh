import { Router } from "express";
import { z } from "zod";
import { FPS_OPTIONS, GYRO_MODES, PLAYSTYLES, PROVENANCES, SCOPE_KEYS, httpsUrlSchema, objectIdSchema, seoSchema, slugSchema, slugify } from "@sgh/shared";
import type { Cache } from "../../lib/cache.js";
import { crudRouter } from "../../lib/content/crud.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { buildMeta, toSkip } from "../../lib/pagination.js";
import { created, noContent, ok } from "../../lib/respond.js";
import { revalidateTags } from "../../lib/revalidate.js";
import { htmlToText, richTextSchema } from "../../lib/sanitize.js";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { v, validate } from "../../middleware/validate.js";
import { audit } from "../audit/audit.service.js";
import { syncMediaUsage } from "../media/media.service.js";
import { SensitivityCodeModel } from "./code.model.js";
import { SensitivityConfigModel } from "./config.model.js";
import { DeviceModel, deriveDeviceClass } from "./device.model.js";
import { ScopeModel } from "./scope.model.js";
import { countWords, provenanceViolations, valueViolations } from "./sensitivity.rules.js";
import { WeaponModel } from "./weapon.model.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- documents mapped dynamically */
const optUrl = httpsUrlSchema.nullable().optional().or(z.literal("").transform(() => null));
const scopeRow = z.object(Object.fromEntries(SCOPE_KEYS.map((k) => [k, z.number().int().nullable().optional()]))).partial();
const SENS_TAGS = (extra: string[] = []) => ["sensitivity", "devices", "home", "sitemap", ...extra];

export const weaponCreateSchema = z.object({
  name: z.string().trim().min(2).max(40),
  slug: slugSchema.optional(),
  game: objectIdSchema,
  type: z.enum(["AR", "SMG", "DMR", "SR", "SG", "LMG", "Pistol"]),
  ammo: z.string().trim().max(20).optional(),
  recommendedScopes: z.array(z.enum(SCOPE_KEYS)).max(9).default([]),
  summary: z.string().trim().max(300).optional(),
  recoilNotes: richTextSchema.optional(),
  attachmentNotes: richTextSchema.optional(),
  image: objectIdSchema.nullable().optional(),
  order: z.number().int().min(0).max(999).default(0),
  seo: seoSchema.partial().optional(),
});

export const deviceCreateSchema = z.object({
  brand: z.string().trim().min(2).max(40),
  model: z.string().trim().min(1).max(80),
  slug: slugSchema.optional(),
  releaseYear: z.number().int().min(2015).max(2100).nullable().optional(),
  chipset: z.string().trim().max(80).optional(),
  ramOptions: z.array(z.number().int().min(1).max(64)).max(8).default([]),
  displayRefreshRateHz: z.number().int().min(30).max(240).nullable().optional(),
  touchSamplingRateHz: z.number().int().min(60).max(4000).nullable().optional(),
  screenSizeInches: z.number().min(4).max(14).nullable().optional(),
  supportedFps: z.array(z.union(FPS_OPTIONS.map((f) => z.literal(f)) as [z.ZodLiteral<30>, ...z.ZodLiteral<number>[]])).max(5).default([]),
  fpsSourceUrl: optUrl,
  fpsVerifiedAt: z.coerce.date().nullable().optional(),
  specSourceUrl: optUrl,
  gyroscope: z.boolean().default(true),
  summary: z.string().trim().max(300).optional(),
  image: objectIdSchema.nullable().optional(),
  seo: seoSchema.partial().optional(),
});

export const configCreateSchema = z.object({
  title: z.string().trim().min(5).max(140),
  slug: slugSchema.optional(),
  game: objectIdSchema,
  device: objectIdSchema.nullable().optional(),
  deviceClass: z.object({ refreshTier: z.enum(["60", "90", "120", "144+"]).optional(), perfTier: z.enum(["entry", "mid", "high", "flagship"]).optional() }).optional(),
  fps: z.union(FPS_OPTIONS.map((f) => z.literal(f)) as [z.ZodLiteral<30>, ...z.ZodLiteral<number>[]]),
  gyroscope: z.enum(GYRO_MODES),
  playstyle: z.enum(PLAYSTYLES),
  values: z.object({ camera: scopeRow, ads: scopeRow, gyro: scopeRow, ads_gyro: scopeRow }).partial(),
  gameVersion: z.string().trim().max(20).optional(),
  provenance: z.enum(PROVENANCES),
  testing: z.object({ testedBy: z.string().trim().max(80).optional(), testedAt: z.coerce.date().nullable().optional(), deviceUsed: z.string().trim().max(120).optional(), method: richTextSchema.optional(), notes: z.string().trim().max(600).optional() }).optional(),
  shareCode: z.string().trim().regex(/^$|^[A-Za-z0-9-]{6,40}$/, "Share code: 6–40 letters, numbers or hyphens").optional(),
  explanation: richTextSchema.optional(),
  seo: seoSchema.partial().optional(),
});

export function scopeAdminRoutes(): Router {
  const r = Router();
  r.get("/", requireAuth(), requirePermission("scope:read"), async (_req, res) => {
    ok(res, (await ScopeModel.find().sort({ order: 1 }).lean()).map(({ _id, __v, ...x }) => ({ id: String(_id), version: __v, ...x })));
  });
  r.get("/:id", requireAuth(), requirePermission("scope:read"), async (req, res) => {
    const s = await ScopeModel.findById(req.params.id).lean();
    if (!s) throw notFound();
    const { _id, __v, ...x } = s;
    ok(res, { id: String(_id), version: __v, ...x });
  });
  r.patch("/:id", requireAuth(), requirePermission("scope:update"), validate({ body: z.object({ label: z.string().trim().min(2).max(60), order: z.number().int().min(0).max(99) }).partial() }), async (req, res) => {
    const s = await ScopeModel.findByIdAndUpdate(req.params.id, { $set: req.valid.body as object }, { new: true, runValidators: true });
    if (!s) throw notFound();
    await audit(req, { action: "scope.update", entityType: "scope", entityId: s.id });
    const { _id, __v, ...x } = s.toObject();
    ok(res, { id: String(_id), version: __v, ...x });
  });
  return r;
}

export function weaponAdminRoutes(cache: Cache) {
  return crudRouter({
    entity: "weapon",
    perm: "weapon",
    model: WeaponModel,
    createSchema: weaponCreateSchema,
    searchFields: ["name", "slug"],
    sortable: ["name", "order", "updatedAt"],
    defaultSort: "order",
    workflow: true,
    revisions: true,
    slugSource: "name",
    populate: [{ path: "game", select: "key name" }, { path: "image" }],
    publishChecks: (d) => {
      const words = countWords(htmlToText(d.recoilNotes?.html ?? ""));
      return {
        blocking: words < 60 ? ["Write at least 60 words about how this gun behaves (recoil, range, best scopes)."] : [],
        warnings: d.recommendedScopes?.length ? [] : ["No recommended scopes selected."],
      };
    },
    afterSave: (d) => syncMediaUsage("weapon", d._id, [d.image?._id ?? d.image]),
    revalidate: (d) => [...SENS_TAGS(), "weapons", `weapon:${d.slug}`],
    cache,
    cacheTags: () => ["weapons", "home"],
  });
}

export function deviceAdminRoutes(cache: Cache) {
  return crudRouter({
    entity: "device",
    perm: "device",
    model: DeviceModel,
    createSchema: deviceCreateSchema,
    listQuery: z.object({ brandSlug: z.string().max(40).optional() }),
    buildFilter: (q) => (q.brandSlug ? { brandSlug: q.brandSlug } : {}),
    searchFields: ["brand", "model", "slug"],
    sortable: ["brand", "model", "updatedAt", "releaseYear"],
    workflow: true,
    populate: [{ path: "image" }],
    beforeSave: (data, { existing }) => {
      const merged = { ...(existing?.toObject() ?? {}), ...data };
      if (data.brand) data.brandSlug = slugify(data.brand);
      if (!existing && !data.slug) data.slug = slugify(`${merged.brand} ${merged.model}`);
      if (["displayRefreshRateHz", "screenSizeInches", "supportedFps"].some((k) => k in data) || !existing) data.deviceClass = deriveDeviceClass(merged);
      return data;
    },
    publishChecks: (d) => ({
      blocking: d.supportedFps?.length ? [] : ["Add the FPS options this device supports in-game."],
      warnings: [...(d.specSourceUrl ? [] : ["No spec source link."]), ...(d.fpsSourceUrl ? [] : ["No source for supported FPS."])],
    }),
    afterSave: (d) => syncMediaUsage("device", d._id, [d.image?._id ?? d.image]),
    revalidate: (d) => [...SENS_TAGS(), `device:${d.slug}`, `brand:${d.brandSlug}`],
    cache,
    cacheTags: () => ["devices", "sensitivity", "home"],
  });
}

export function configAdminRoutes(cache: Cache) {
  return crudRouter({
    entity: "sensitivity",
    perm: "sensitivity",
    model: SensitivityConfigModel,
    createSchema: configCreateSchema,
    listQuery: z.object({ device: objectIdSchema.optional(), provenance: z.enum(PROVENANCES).optional() }),
    buildFilter: (q) => ({ ...(q.device && { device: q.device }), ...(q.provenance && { provenance: q.provenance }) }),
    searchFields: ["title", "slug"],
    sortable: ["title", "updatedAt", "fps"],
    workflow: true,
    revisions: true,
    slugSource: "title",
    populate: [{ path: "game", select: "key name" }, { path: "device", select: "brand model slug brandSlug deviceClass" }],
    ownership: { bypass: "sensitivity:publish" },
    beforeSave: async (data, { existing }) => {
      if (data.slug && ["devices", "guns", "compare", "codes", "find", "page"].includes(data.slug)) throw badRequest("That URL is reserved.", [{ path: "slug", message: "Reserved word" }]);
      const merged = { ...(existing?.toObject() ?? {}), ...data };
      // Values must be valid for the chosen gyroscope mode (blocking only once complete: allow partial drafts).
      const bad = valueViolations(merged.values, merged.gyroscope).filter((x) => x.message !== "Required");
      if (bad.length) throw badRequest("Some sensitivity values are out of range.", bad);
      if (data.explanation) data.explanationWords = countWords(htmlToText(data.explanation.html));
      if (existing && data.values && JSON.stringify(existing.toObject().values) !== JSON.stringify({ ...existing.toObject().values, ...data.values })) {
        data.valuesVersion = (existing.valuesVersion ?? 1) + 1;
      }
      const deviceId = "device" in data ? data.device : existing?.device?._id ?? existing?.device;
      if (deviceId) {
        const dev = await DeviceModel.findById(deviceId).select("deviceClass").lean();
        if (!dev) throw badRequest("Unknown device.", [{ path: "device", message: "Unknown device" }]);
        data.deviceClass = { refreshTier: (dev as any).deviceClass?.refreshTier, perfTier: (dev as any).deviceClass?.perfTier };
      } else if (!merged.deviceClass?.refreshTier) {
        throw badRequest("Baseline setups (no device) need a refresh-rate tier.", [{ path: "deviceClass.refreshTier", message: "Required for baseline" }]);
      }
      if (merged.provenance === "baseline" && deviceId) throw badRequest("Baseline setups can't be linked to a specific device.", [{ path: "provenance", message: "Use Tested or Community for a device" }]);
      return data;
    },
    publishChecks: async (d) => {
      const blocking = [...valueViolations(d.values, d.gyroscope).map((x) => `${x.path}: ${x.message}`).slice(0, 3), ...provenanceViolations(d)];
      if ((d.explanationWords ?? 0) < 40) blocking.push("Explain these settings (at least 40 words): why these values, how to fine-tune them.");
      const warnings: string[] = [];
      if ((d.explanationWords ?? 0) < 150) warnings.push(`Explanation has ${d.explanationWords ?? 0} words — under 150, so the page will be published but not indexed by search engines.`);
      if (d.device && (d.device as any).workflow?.status !== "published") {
        const dev = await DeviceModel.findById(d.device._id ?? d.device).select("workflow").lean();
        if ((dev as any)?.workflow?.status !== "published") warnings.push("The linked device isn't published yet.");
      }
      return { blocking, warnings };
    },
    publicPath: (d) => `/sensitivity/${d.slug}`,
    revalidate: (d) => SENS_TAGS([`sensitivity:${d.slug}`, ...(d.device?.slug ? [`device:${d.device.slug}`] : [])]),
    cache,
    cacheTags: () => ["sensitivity", "devices", "home"],
  });
}

const codeSchema = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9-]{6,40}$/, "6–40 letters, numbers or hyphens"),
  game: objectIdSchema.nullable().optional(),
  device: objectIdSchema.nullable().optional(),
  deviceText: z.string().trim().max(80).optional(),
  fps: z.union(FPS_OPTIONS.map((f) => z.literal(f)) as [z.ZodLiteral<30>, ...z.ZodLiteral<number>[]]).nullable().optional(),
  gyroscope: z.enum(GYRO_MODES).nullable().optional(),
  testedAt: z.coerce.date().nullable().optional(),
  author: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500).optional(),
  gameVersion: z.string().trim().max(20).optional(),
});

export function codeAdminRoutes(cache: Cache): Router {
  const r = Router();
  const list = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(30), status: z.enum(["pending", "verified", "rejected", "expired"]).optional(), q: z.string().trim().max(40).optional() });
  const dto = (c: any) => {
    const { _id, __v, ...x } = typeof c.toObject === "function" ? c.toObject() : c;
    return { id: String(_id), version: __v, ...x };
  };
  // Both caches: API (Redis) and website (Next.js tags) — otherwise the public library stays stale.
  const changed = () => Promise.all([cache.invalidateTags(["codes"]), revalidateTags(["codes"])]);

  r.get("/", requireAuth(), requirePermission("sensitivity_code:read"), validate({ query: list }), async (req, res) => {
    const q = v<z.infer<typeof list>>(req.valid.query);
    const filter: Record<string, unknown> = { ...(q.status && { status: q.status }), ...(q.q && { code: new RegExp(q.q.replace(/[^A-Za-z0-9-]/g, ""), "i") }) };
    const [items, total] = await Promise.all([SensitivityCodeModel.find(filter).populate("device", "brand model slug").sort({ createdAt: -1 }).skip(toSkip(q)).limit(q.limit).lean(), SensitivityCodeModel.countDocuments(filter)]);
    ok(res, items.map(dto), buildMeta(q, total));
  });
  r.get("/:id", requireAuth(), requirePermission("sensitivity_code:read"), async (req, res) => {
    const c = await SensitivityCodeModel.findById(req.params.id).populate("device", "brand model slug");
    if (!c) throw notFound();
    ok(res, dto(c));
  });
  r.post("/", requireAuth(), requirePermission("sensitivity_code:update"), validate({ body: codeSchema }), async (req, res) => {
    const c = await SensitivityCodeModel.create({ ...(req.valid.body as object), authorType: "staff", status: "pending", createdBy: req.session!.adminId });
    await audit(req, { action: "sensitivity_code.create", entityType: "sensitivity_code", entityId: c.id });
    created(res, dto(c));
  });
  r.patch("/:id", requireAuth(), requirePermission("sensitivity_code:update"), validate({ body: codeSchema.partial() }), async (req, res) => {
    const sent = new Set(Object.keys(req.body ?? {}));
    const data = Object.fromEntries(Object.entries(req.valid.body as object).filter(([k]) => sent.has(k)));
    const c = await SensitivityCodeModel.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true });
    if (!c) throw notFound();
    await audit(req, { action: "sensitivity_code.update", entityType: "sensitivity_code", entityId: c.id });
    await changed();
    ok(res, dto(c));
  });
  const decide = (status: "verified" | "rejected" | "expired") =>
    async (req: import("express").Request, res: import("express").Response) => {
      const note = z.object({ note: z.string().trim().max(300).optional() }).parse(req.body ?? {}).note;
      const c = await SensitivityCodeModel.findByIdAndUpdate(
        req.params.id,
        { $set: { status, reviewNote: note, ...(status === "verified" && { verifiedBy: req.session!.adminId, verifiedAt: new Date() }) } },
        { new: true },
      );
      if (!c) throw notFound();
      await audit(req, { action: `sensitivity_code.${status}`, entityType: "sensitivity_code", entityId: c.id, summary: note });
      await changed();
      ok(res, dto(c));
    };
  r.post("/:id/verify", requireAuth(), requirePermission("sensitivity_code:verify"), decide("verified"));
  r.post("/:id/reject", requireAuth(), requirePermission("sensitivity_code:verify"), decide("rejected"));
  r.post("/:id/expire", requireAuth(), requirePermission("sensitivity_code:verify"), decide("expired"));
  r.delete("/:id", requireAuth(), requirePermission("sensitivity_code:delete"), async (req, res) => {
    const c = await SensitivityCodeModel.findByIdAndDelete(req.params.id);
    if (!c) throw notFound();
    await audit(req, { action: "sensitivity_code.delete", entityType: "sensitivity_code", entityId: c.id });
    await changed();
    noContent(res);
  });
  return r;
}
