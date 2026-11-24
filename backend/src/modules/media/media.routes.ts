import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { LIMITS } from "@sgh/shared";
import { badRequest, conflict, notFound } from "../../lib/errors.js";
import { buildMeta, toSkip } from "../../lib/pagination.js";
import { created, noContent, ok } from "../../lib/respond.js";
import { revalidateTags } from "../../lib/revalidate.js";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { v, validate } from "../../middleware/validate.js";
import { audit } from "../audit/audit.service.js";
import { MediaModel } from "./media.model.js";
import { deleteStoredVariants, processImage, storeVariants, toMediaRef } from "./media.service.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: LIMITS.uploadBytesMax, files: 1, fields: 10 } });

const metaSchema = z.object({
  alt: z.string().trim().min(3, "Describe the image for screen readers (alt text)").max(250),
  caption: z.string().trim().max(300).optional(),
  credit: z.string().trim().max(200).optional(),
  licence: z.enum(["original", "licensed", "press_kit", "user_submitted"]),
  licenceNotes: z.string().trim().max(500).optional(),
  category: z.enum(["general", "tournament", "sensitivity", "article", "device", "weapon", "resource", "ad"]).default("general"),
});

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  q: z.string().trim().max(100).optional(),
  category: metaSchema.shape.category.optional(),
  unused: z.enum(["true", "false"]).optional(),
});

function toAdmin(m: InstanceType<typeof MediaModel>) {
  const o = m.toObject();
  return {
    id: m.id,
    version: o.__v,
    originalFilename: o.originalFilename,
    mime: o.mime,
    sizeBytes: o.sizeBytes,
    width: o.width,
    height: o.height,
    alt: o.alt,
    caption: o.caption,
    credit: o.credit,
    licence: o.licence,
    licenceNotes: o.licenceNotes,
    category: o.category,
    usageCount: o.usageRefs.length,
    usageRefs: o.usageRefs,
    createdAt: o.createdAt,
    ref: toMediaRef(o),
  };
}

export function mediaRoutes(): Router {
  const r = Router();

  r.get("/", requireAuth(), requirePermission("media:read"), validate({ query: listSchema }), async (req, res) => {
    const q = v<z.infer<typeof listSchema>>(req.valid.query);
    const filter: Record<string, unknown> = {};
    if (q.category) filter.category = q.category;
    if (q.unused === "true") filter.usageRefs = { $size: 0 };
    if (q.q) filter.$text = { $search: q.q };
    const [items, total] = await Promise.all([
      MediaModel.find(filter).sort({ createdAt: -1 }).skip(toSkip(q)).limit(q.limit),
      MediaModel.countDocuments(filter),
    ]);
    ok(res, items.map(toAdmin), buildMeta(q, total));
  });

  r.get("/:id", requireAuth(), requirePermission("media:read"), async (req, res) => {
    const m = await MediaModel.findById(req.params.id);
    if (!m) throw notFound();
    ok(res, toAdmin(m));
  });

  r.post("/", requireAuth(), requirePermission("media:create"), upload.single("file"), validate({ body: metaSchema }), async (req, res) => {
    if (!req.file) throw badRequest("Choose an image to upload.", [{ path: "file", message: "Required" }]);
    const meta = v<z.infer<typeof metaSchema>>(req.valid.body);
    const img = await processImage(req.file.buffer);
    const dupe = await MediaModel.findOne({ checksumSha256: img.checksum });
    if (dupe) throw conflict(`This image is already in the library ("${dupe.alt}").`);
    const stored = await storeVariants(img);
    const m = await MediaModel.create({
      ...meta,
      baseKey: stored.baseKey,
      variants: stored.variants,
      originalFilename: req.file.originalname.slice(0, 200),
      mime: img.mime,
      sizeBytes: req.file.size,
      width: img.width,
      height: img.height,
      checksumSha256: img.checksum,
      uploadedBy: req.session!.adminId,
    });
    await audit(req, { action: "media.upload", entityType: "media", entityId: m.id, summary: meta.alt });
    created(res, toAdmin(m));
  });

  r.patch("/:id", requireAuth(), requirePermission("media:update"), validate({ body: metaSchema.partial() }), async (req, res) => {
    const m = await MediaModel.findById(req.params.id);
    if (!m) throw notFound();
    m.set(req.valid.body as object);
    await m.save();
    await audit(req, { action: "media.update", entityType: "media", entityId: m.id });
    await revalidateTags(m.usageRefs.map((u) => `${u.entityType}:${u.entityId}`));
    ok(res, toAdmin(m));
  });

  /** Replace the file, keep the id (and every reference to it). */
  r.post("/:id/replace", requireAuth(), requirePermission("media:update"), upload.single("file"), async (req, res) => {
    const m = await MediaModel.findById(req.params.id);
    if (!m) throw notFound();
    if (!req.file) throw badRequest("Choose an image to upload.");
    const img = await processImage(req.file.buffer);
    const stored = await storeVariants(img);
    const old = m.variants.map((x) => ({ key: x.key }));
    m.set({ baseKey: stored.baseKey, variants: stored.variants, width: img.width, height: img.height, mime: img.mime, sizeBytes: req.file.size, checksumSha256: img.checksum, originalFilename: req.file.originalname.slice(0, 200) });
    await m.save();
    await deleteStoredVariants(old);
    await audit(req, { action: "media.replace", entityType: "media", entityId: m.id });
    await revalidateTags(m.usageRefs.map((u) => `${u.entityType}:${u.entityId}`));
    ok(res, toAdmin(m));
  });

  r.delete("/:id", requireAuth(), requirePermission("media:delete"), async (req, res) => {
    const m = await MediaModel.findById(req.params.id);
    if (!m) throw notFound();
    if (m.usageRefs.length) throw conflict(`This image is used in ${m.usageRefs.length} place(s). Remove it from those items first.`);
    await deleteStoredVariants(m.variants.map((x) => ({ key: x.key })));
    await m.deleteOne();
    await audit(req, { action: "media.delete", entityType: "media", entityId: m.id, summary: m.alt });
    noContent(res);
  });

  return r;
}
