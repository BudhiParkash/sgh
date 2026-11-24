import { Router } from "express";
import type { Redis } from "ioredis";
import { z } from "zod";
import { FPS_OPTIONS, GYRO_MODES, PLAYSTYLES, PROVENANCES, SCOPE_KEYS, SENSITIVITY_CATEGORIES, type SensitivityFindResult } from "@sgh/shared";
import type { Cache } from "../../lib/cache.js";
import { publicFilter } from "../../lib/content/fields.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { buildMeta, toSkip } from "../../lib/pagination.js";
import { created, ok } from "../../lib/respond.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { v, validate } from "../../middleware/validate.js";
import { GameModel } from "../games/game.model.js";
import { registerSimplePreview } from "../preview.routes.js";
import { SensitivityCodeModel } from "./code.model.js";
import { SensitivityConfigModel } from "./config.model.js";
import { DeviceModel } from "./device.model.js";
import { ScopeModel } from "./scope.model.js";
import { toCodeDto, toConfigDetail, toConfigSummary, toDeviceDetail, toDeviceSummary, toWeaponDetail, toWeaponSummary } from "./sensitivity.dto.js";
import { rank } from "./sensitivity.rules.js";
import { WeaponModel } from "./weapon.model.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- lean documents */
const fps = z.coerce.number().refine((n): n is (typeof FPS_OPTIONS)[number] => (FPS_OPTIONS as readonly number[]).includes(n), "Unsupported FPS").transform((n) => n as (typeof FPS_OPTIONS)[number]);
const slug = z.string().regex(/^[a-z0-9-]{1,120}$/);
const CONFIG_POP = [{ path: "game", select: "key name" }, { path: "device", select: "brand model slug brandSlug workflow deleted" }];

/** Published config count per published device. */
async function configCounts(): Promise<Map<string, number>> {
  const rows = await SensitivityConfigModel.aggregate([{ $match: publicFilter({ device: { $ne: null } }) }, { $group: { _id: "$device", n: { $sum: 1 } } }]);
  return new Map(rows.map((r) => [String(r._id), r.n as number]));
}

export async function popularDevices(limit = 8) {
  const counts = await configCounts();
  const devices = await DeviceModel.find(publicFilter({ _id: { $in: [...counts.keys()] } })).populate("image").lean();
  return devices.map((d) => toDeviceSummary(d, counts.get(String(d._id)) ?? 0)).sort((a, b) => b.configCount - a.configCount).slice(0, limit);
}

export async function brandSummaries() {
  const counts = await configCounts();
  const devices = await DeviceModel.find(publicFilter()).select("brand brandSlug").lean();
  const map = new Map<string, { brand: string; brandSlug: string; deviceCount: number; configCount: number }>();
  for (const d of devices as any[]) {
    const b = map.get(d.brandSlug) ?? { brand: d.brand, brandSlug: d.brandSlug, deviceCount: 0, configCount: 0 };
    b.deviceCount += 1;
    b.configCount += counts.get(String(d._id)) ?? 0;
    map.set(d.brandSlug, b);
  }
  return [...map.values()].filter((b) => b.configCount > 0).sort((a, b) => b.configCount - a.configCount || a.brand.localeCompare(b.brand));
}

export async function publishedWeapons() {
  return (await WeaponModel.find(publicFilter()).populate("game", "key name").populate("image").sort({ order: 1, name: 1 }).lean()).map(toWeaponSummary);
}

export function sensitivityPublicRoutes(redis: Redis, cache: Cache): Router {
  const r = Router();
  registerSimplePreview("sensitivity", SensitivityConfigModel as never, (d: any) => toConfigDetail(d));

  const listSchema = z.object({
    device: slug.optional(),
    brand: slug.optional(),
    fps: fps.optional(),
    gyroscope: z.enum(GYRO_MODES).optional(),
    playstyle: z.enum(PLAYSTYLES).optional(),
    provenance: z.enum(PROVENANCES).optional(),
    page: z.coerce.number().int().min(1).max(200).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  });
  r.get("/", validate({ query: listSchema }), async (req, res) => {
    const q = v<z.infer<typeof listSchema>>(req.valid.query);
    const out = await cache.cached(`sens:list:${JSON.stringify(q)}`, ["sensitivity"], 300, async () => {
      const filter: Record<string, unknown> = publicFilter({ ...(q.fps && { fps: q.fps }), ...(q.gyroscope && { gyroscope: q.gyroscope }), ...(q.playstyle && { playstyle: q.playstyle }), ...(q.provenance && { provenance: q.provenance }) });
      if (q.device || q.brand) {
        const devs = await DeviceModel.find(publicFilter(q.device ? { slug: q.device } : { brandSlug: q.brand })).select("_id").lean();
        filter.device = { $in: devs.map((d) => d._id) };
      }
      const [items, total] = await Promise.all([SensitivityConfigModel.find(filter).populate(CONFIG_POP).sort({ updatedAt: -1 }).skip(toSkip(q)).limit(q.limit).lean(), SensitivityConfigModel.countDocuments(filter)]);
      return { data: items.map(toConfigSummary), meta: buildMeta(q, total) };
    });
    ok(res, out.data, out.meta);
  });

  const findSchema = z.object({ device: slug, fps, gyroscope: z.enum(GYRO_MODES), playstyle: z.enum(PLAYSTYLES) });
  /** Finder: exact → nearest on same device → device-class baseline → none (each clearly labelled). */
  r.get("/find", validate({ query: findSchema }), async (req, res) => {
    const q = v<z.infer<typeof findSchema>>(req.valid.query);
    const result = await cache.cached(`sens:find:${JSON.stringify(q)}`, ["sensitivity"], 300, async (): Promise<SensitivityFindResult> => {
      const device = await DeviceModel.findOne(publicFilter({ slug: q.device })).lean();
      if (!device) return { match: "none", config: null, alternatives: [] };
      const want = { fps: q.fps, gyroscope: q.gyroscope, playstyle: q.playstyle };
      const own = await SensitivityConfigModel.find(publicFilter({ device: device._id })).populate(CONFIG_POP).lean();
      if (own.length) {
        const ranked = rank(own as any[], want);
        const best = ranked[0]!;
        const exact = best.fps === q.fps && best.gyroscope === q.gyroscope && best.playstyle === q.playstyle;
        return { match: exact ? "exact" : "nearest", config: toConfigDetail(best), alternatives: ranked.slice(1, 6).map(toConfigSummary) };
      }
      const cls = (device as any).deviceClass ?? {};
      const baseline = await SensitivityConfigModel.find(publicFilter({ device: null, provenance: "baseline", "deviceClass.refreshTier": cls.refreshTier })).populate(CONFIG_POP).lean();
      if (baseline.length) {
        const ranked = rank(baseline as any[], want).sort((a: any, b: any) => Number(a.deviceClass?.perfTier !== cls.perfTier) - Number(b.deviceClass?.perfTier !== cls.perfTier));
        return { match: "baseline", config: toConfigDetail(ranked[0]), alternatives: ranked.slice(1, 4).map(toConfigSummary) };
      }
      return { match: "none", config: null, alternatives: [] };
    });
    ok(res, result);
  });

  const cmpSchema = z.object({ a: slug, b: slug });
  r.get("/compare", validate({ query: cmpSchema }), async (req, res) => {
    const { a, b } = v<z.infer<typeof cmpSchema>>(req.valid.query);
    if (a === b) throw badRequest("Choose two different setups.");
    const docs = await SensitivityConfigModel.find(publicFilter({ slug: { $in: [a, b] } })).populate(CONFIG_POP).lean();
    const A = docs.find((d: any) => d.slug === a);
    const B = docs.find((d: any) => d.slug === b);
    if (!A || !B) throw notFound("One of the setups wasn't found.");
    const da = toConfigDetail(A);
    const db = toConfigDetail(B);
    const deltas: Record<string, Record<string, number | null>> = {};
    for (const cat of SENSITIVITY_CATEGORIES) {
      deltas[cat] = {};
      for (const s of SCOPE_KEYS) {
        const x = da.values[cat]?.[s];
        const y = db.values[cat]?.[s];
        deltas[cat]![s] = typeof x === "number" && typeof y === "number" ? y - x : null;
      }
    }
    ok(res, { a: da, b: db, deltas });
  });

  const codeList = z.object({ device: slug.optional(), fps: fps.optional(), gyroscope: z.enum(GYRO_MODES).optional(), page: z.coerce.number().int().min(1).max(100).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) });
  r.get("/codes", validate({ query: codeList }), async (req, res) => {
    const q = v<z.infer<typeof codeList>>(req.valid.query);
    const out = await cache.cached(`codes:${JSON.stringify(q)}`, ["codes"], 300, async () => {
      const filter: Record<string, unknown> = { status: "verified", ...(q.fps && { fps: q.fps }), ...(q.gyroscope && { gyroscope: q.gyroscope }) };
      if (q.device) {
        const d = await DeviceModel.findOne({ slug: q.device }).select("_id").lean();
        filter.device = d?._id ?? null;
      }
      const [items, total] = await Promise.all([SensitivityCodeModel.find(filter).populate("device", "brand brandSlug model slug").sort({ verifiedAt: -1 }).skip(toSkip(q)).limit(q.limit).lean(), SensitivityCodeModel.countDocuments(filter)]);
      return { data: items.map(toCodeDto), meta: buildMeta(q, total) };
    });
    ok(res, out.data, out.meta);
  });

  const submitSchema = z.object({
    code: z.string().trim().regex(/^[A-Za-z0-9-]{6,40}$/, "Enter the share code exactly as shown in the game"),
    deviceText: z.string().trim().min(2).max(80),
    fps: fps.optional(),
    gyroscope: z.enum(GYRO_MODES).optional(),
    author: z.string().trim().min(2).max(60),
    description: z.string().trim().max(500).optional(),
    gameVersion: z.string().trim().max(20).optional(),
    website: z.string().max(0, "").optional(), // honeypot — must stay empty
  });
  /** Community submissions go to moderation; nothing is published automatically. */
  r.post("/codes/submit", rateLimit(redis, { name: "code-submit", points: 5, durationSec: 600 }), validate({ body: submitSchema }), async (req, res) => {
    const { website: _hp, ...body } = v<z.infer<typeof submitSchema>>(req.valid.body);
    const bgmi = await GameModel.findOne({ key: "bgmi" }).select("_id").lean();
    try {
      await SensitivityCodeModel.create({ ...body, game: bgmi?._id, authorType: "community", status: "pending", ipHash: req.ipHash });
    } catch (e: any) {
      if (e?.code !== 11000) throw e; // already submitted — respond the same way (no enumeration)
    }
    created(res, { received: true, message: "Thanks! Your code will appear after our team checks it." });
  });

  r.get("/:slug", async (req, res) => {
    const s = slug.safeParse(req.params.slug);
    if (!s.success) throw notFound();
    const data = await cache.cached(`sens:one:${s.data}`, ["sensitivity", `sensitivity:${s.data}`], 300, async () => {
      const c = await SensitivityConfigModel.findOne(publicFilter({ slug: s.data })).populate(CONFIG_POP).lean();
      return c ? toConfigDetail(c) : null;
    });
    if (!data) throw notFound("Setup not found.");
    ok(res, data);
  });
  return r;
}

export function devicePublicRoutes(cache: Cache): Router {
  const r = Router();
  const listSchema = z.object({ brand: slug.optional(), q: z.string().trim().max(60).optional(), hasConfigs: z.enum(["true", "false"]).optional(), page: z.coerce.number().int().min(1).max(100).default(1), limit: z.coerce.number().int().min(1).max(60).default(24) });
  r.get("/", validate({ query: listSchema }), async (req, res) => {
    const q = v<z.infer<typeof listSchema>>(req.valid.query);
    const out = await cache.cached(`devices:${JSON.stringify(q)}`, ["devices"], 300, async () => {
      const counts = await configCounts();
      const filter: Record<string, unknown> = publicFilter({ ...(q.brand && { brandSlug: q.brand }), ...(q.hasConfigs === "true" && { _id: { $in: [...counts.keys()] } }) });
      if (q.q) filter.$text = { $search: q.q };
      const [items, total] = await Promise.all([DeviceModel.find(filter).populate("image").sort({ brand: 1, model: 1 }).skip(toSkip(q)).limit(q.limit).lean(), DeviceModel.countDocuments(filter)]);
      return { data: items.map((d) => toDeviceSummary(d, counts.get(String(d._id)) ?? 0)), meta: buildMeta(q, total) };
    });
    ok(res, out.data, out.meta);
  });
  r.get("/brands", async (_req, res) => ok(res, await cache.cached("devices:brands", ["devices", "sensitivity"], 300, brandSummaries)));
  r.get("/:slug", async (req, res) => {
    const s = slug.safeParse(req.params.slug);
    if (!s.success) throw notFound();
    const data = await cache.cached(`devices:one:${s.data}`, ["devices", "sensitivity", `device:${s.data}`], 300, async () => {
      const d = await DeviceModel.findOne(publicFilter({ slug: s.data })).populate("image").lean();
      if (!d) return null;
      const configs = await SensitivityConfigModel.find(publicFilter({ device: d._id })).populate(CONFIG_POP).sort({ fps: -1, gyroscope: 1, playstyle: 1 }).lean();
      return toDeviceDetail(d, configs);
    });
    if (!data) throw notFound("Device not found.");
    ok(res, data);
  });
  return r;
}

export function weaponPublicRoutes(cache: Cache): Router {
  const r = Router();
  registerSimplePreview("weapon", WeaponModel as never, (d: any) => toWeaponDetail(d));
  r.get("/", async (_req, res) => ok(res, await cache.cached("weapons:all", ["weapons"], 600, publishedWeapons)));
  r.get("/:slug", async (req, res) => {
    const s = slug.safeParse(req.params.slug);
    if (!s.success) throw notFound();
    const data = await cache.cached(`weapons:one:${s.data}`, ["weapons", `weapon:${s.data}`], 600, async () => {
      const w = await WeaponModel.findOne(publicFilter({ slug: s.data })).populate("game", "key name").populate("image").lean();
      if (!w) return null;
      // Most recently tested setups, so the guide can point to real scope values.
      const configs = await SensitivityConfigModel.find(publicFilter({ provenance: "tested" })).populate(CONFIG_POP).sort({ "testing.testedAt": -1 }).limit(6).lean();
      return { ...toWeaponDetail(w), testedSetups: configs.map(toConfigSummary) };
    });
    if (!data) throw notFound("Weapon guide not found.");
    ok(res, data);
  });
  return r;
}

export function scopePublicRoutes(cache: Cache): Router {
  const r = Router();
  r.get("/", async (_req, res) => ok(res, await cache.cached("scopes", ["scopes"], 3600, async () => (await ScopeModel.find().sort({ order: 1 }).lean()).map((s) => ({ key: s.key, label: s.label })))));
  return r;
}
