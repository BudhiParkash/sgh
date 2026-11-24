import { Router } from "express";
import { z } from "zod";
import type { PublicSettings } from "@sgh/shared";
import type { Cache } from "../../lib/cache.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/respond.js";
import { revalidateTags } from "../../lib/revalidate.js";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { audit, diff } from "../audit/audit.service.js";
import { getSettings } from "./settings.model.js";

const url = z.union([z.literal(""), z.string().trim().url().refine((u) => u.startsWith("https://"), "Must be https")]);
const str = (max: number) => z.string().trim().max(max);

const updateSchema = z
  .object({
    siteName: str(80),
    tagline: str(200),
    owner: str(120),
    contact: z.object({ name: str(120), email: z.union([z.literal(""), z.string().email()]), phone: str(30) }).partial(),
    grievanceOfficer: z.object({ name: str(120), email: z.union([z.literal(""), z.string().email()]), address: str(400) }).partial(),
    company: z.object({ legalName: str(200), entityType: str(60), cin: str(30), gstin: z.union([z.literal(""), z.string().regex(/^[0-9A-Z]{15}$/, "GSTIN is 15 characters")]), registeredAddress: str(400), jurisdiction: str(120) }).partial(),
    socials: z.object({ youtube: url, instagram: url, instagramChannel: url, facebook: url, discord: url, telegram: url, x: url }).partial(),
    analytics: z.object({ ga4Id: z.union([z.literal(""), z.string().regex(/^G-[A-Z0-9]{4,12}$/)]), gscVerification: str(100), bingVerification: str(100) }).partial(),
    ads: z.object({ enabled: z.boolean(), gamNetworkCode: z.union([z.literal(""), z.string().regex(/^\d{4,12}$/)]), personalizedAds: z.boolean() }).partial(),
    disclaimerText: str(600),
    maintenanceMode: z.boolean(),
    retentionDays: z.object({ contactEnquiries: z.number().int().min(0).max(3650), feedback: z.number().int().min(0).max(3650), reports: z.number().int().min(0).max(3650), privacyRequests: z.number().int().min(0).max(3650), ipHashes: z.number().int().min(1).max(365) }).partial(),
  })
  .partial();

export function toPublicSettings(s: Awaited<ReturnType<typeof getSettings>>): PublicSettings & Record<string, unknown> {
  const o = s.toObject();
  return {
    siteName: o.siteName,
    contactEmail: o.contact?.email || null,
    socials: Object.fromEntries(Object.entries(o.socials ?? {}).filter(([, val]) => Boolean(val))) as Record<string, string>,
    disclaimer: o.disclaimerText,
    owner: o.owner,
    contactName: o.contact?.name || null,
    grievanceOfficer: { name: o.grievanceOfficer?.name || null, email: o.grievanceOfficer?.email || null, address: o.grievanceOfficer?.address || null },
    company: { legalName: o.company?.legalName || null, entityType: o.company?.entityType || null },
    analytics: { ga4Id: o.analytics?.ga4Id || null, gscVerification: o.analytics?.gscVerification || null, bingVerification: o.analytics?.bingVerification || null },
    ads: { enabled: Boolean(o.ads?.enabled), gamNetworkCode: o.ads?.gamNetworkCode || null, personalizedAds: Boolean(o.ads?.personalizedAds) },
    maintenanceMode: Boolean(o.maintenanceMode),
  };
}

export function settingsPublicRoutes(cache: Cache): Router {
  const r = Router();
  r.get("/", async (_req, res) => {
    ok(res, await cache.cached("settings:public", ["settings"], 300, async () => toPublicSettings(await getSettings())));
  });
  return r;
}

export function settingsAdminRoutes(cache: Cache): Router {
  const r = Router();
  r.get("/", requireAuth(), requirePermission("settings:read"), async (_req, res) => {
    const s = await getSettings();
    const { _id, __v, ...rest } = s.toObject();
    ok(res, { ...rest, version: __v });
  });
  r.patch("/", requireAuth(), requirePermission("settings:update"), validate({ body: updateSchema }), async (req, res) => {
    const s = await getSettings();
    const ifMatch = req.get("if-match");
    if (ifMatch !== undefined && Number(ifMatch) !== s.__v) throw new AppError(409, "CONFLICT", "Settings were changed by someone else. Reload and try again.");
    const before = s.toObject();
    const body = req.valid.body as Record<string, unknown>;
    // Dotted set so partial nested objects don't wipe sibling fields.
    for (const [k, val] of Object.entries(body)) {
      if (val && typeof val === "object" && !Array.isArray(val)) for (const [k2, v2] of Object.entries(val)) s.set(`${k}.${k2}`, v2);
      else s.set(k, val);
    }
    await s.save();
    await audit(req, { action: "settings.update", entityType: "settings", entityId: "global", changes: diff(before, s.toObject()) });
    await Promise.all([cache.invalidateTags(["settings"]), revalidateTags(["settings", "layout"])]);
    const { _id, __v, ...rest } = s.toObject();
    ok(res, { ...rest, version: __v });
  });
  return r;
}
