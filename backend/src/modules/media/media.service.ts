import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { Types } from "mongoose";
import { ALLOWED_IMAGE_MIME, type MediaRef } from "@sgh/shared";
import { AppError } from "../../lib/errors.js";
import { MediaModel } from "./media.model.js";
import { mediaUrl, storage } from "./storage.js";

const WIDTHS = [320, 640, 960, 1280, 1920];
sharp.cache(false);

export interface ProcessedImage {
  mime: string;
  width: number;
  height: number;
  variants: { width: number; height: number; format: "avif" | "webp" | "jpeg"; buffer: Buffer }[];
  checksum: string;
}

/**
 * Validates by magic bytes (never trusts the filename/Content-Type), re-encodes with sharp
 * (strips EXIF/GPS, defeats polyglot files), auto-orients, and builds responsive AVIF/WebP + a JPEG fallback.
 */
export async function processImage(buf: Buffer): Promise<ProcessedImage> {
  const type = await fileTypeFromBuffer(buf);
  if (!type || !(ALLOWED_IMAGE_MIME as readonly string[]).includes(type.mime)) {
    throw new AppError(415, "UNSUPPORTED_MEDIA", "Only JPEG, PNG, WebP and AVIF images are allowed.");
  }
  let base;
  try {
    base = await sharp(buf, { failOn: "error", limitInputPixels: 40_000_000 }).rotate().toBuffer({ resolveWithObject: true });
  } catch {
    throw new AppError(415, "UNSUPPORTED_MEDIA", "This image file appears to be damaged.");
  }
  const { width, height } = base.info;
  if (width < 64 || height < 64) throw new AppError(400, "VALIDATION_ERROR", "Image must be at least 64×64 pixels.");
  const widths = [...new Set([...WIDTHS.filter((w) => w < width), Math.min(width, 1920)])].sort((a, b) => a - b);
  const variants: ProcessedImage["variants"] = [];
  for (const w of widths) {
    const resized = sharp(base.data).resize({ width: w, withoutEnlargement: true });
    const h = Math.round((height * w) / width);
    variants.push({ width: w, height: h, format: "avif", buffer: await resized.clone().avif({ quality: 55, effort: 4 }).toBuffer() });
    variants.push({ width: w, height: h, format: "webp", buffer: await resized.clone().webp({ quality: 78 }).toBuffer() });
  }
  const ogW = Math.min(width, 1200);
  variants.push({ width: ogW, height: Math.round((height * ogW) / width), format: "jpeg", buffer: await sharp(base.data).resize({ width: ogW }).jpeg({ quality: 82, mozjpeg: true }).toBuffer() });
  return { mime: type.mime, width, height, variants, checksum: createHash("sha256").update(buf).digest("hex") };
}

export async function storeVariants(img: ProcessedImage) {
  const now = new Date();
  const baseKey = `public/media/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}`;
  const stored = [];
  for (const v of img.variants) {
    const key = `${baseKey}/${v.width}.${v.format === "jpeg" ? "jpg" : v.format}`;
    await storage.put(key, v.buffer, `image/${v.format}`);
    stored.push({ width: v.width, height: v.height, format: v.format, key, sizeBytes: v.buffer.length });
  }
  return { baseKey, variants: stored };
}

export async function deleteStoredVariants(variants: { key?: string | null }[]) {
  await storage.deleteMany(variants.map((v) => v.key).filter((k): k is string => Boolean(k)));
}

type MediaLike = { _id: unknown; alt?: string | null; width?: number | null; height?: number | null; variants?: { width?: number | null; format?: string | null; key?: string | null }[] } | null | undefined;

/** Public reference used in DTOs: best WebP (≤1280) as `url`, plus a srcset of all WebP widths. */
export function toMediaRef(m: MediaLike): (MediaRef & { srcSet: string; ogUrl: string | null }) | null {
  if (!m || !m.variants?.length) return null;
  const webp = m.variants.filter((v) => v.format === "webp").sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  const main = [...webp].reverse().find((v) => (v.width ?? 0) <= 1280) ?? webp[webp.length - 1];
  const og = m.variants.find((v) => v.format === "jpeg");
  return {
    url: mediaUrl(main!.key!),
    alt: m.alt ?? "",
    width: m.width ?? 0,
    height: m.height ?? 0,
    srcSet: webp.map((v) => `${mediaUrl(v.key!)} ${v.width}w`).join(", "),
    ogUrl: og?.key ? mediaUrl(og.key) : null,
  };
}

/** Keeps `usageRefs` accurate so unused media can be found and in-use media can't be deleted. */
export async function syncMediaUsage(entityType: string, entityId: unknown, mediaIds: unknown[]): Promise<void> {
  const id = new Types.ObjectId(String(entityId));
  const ids = [...new Set(mediaIds.filter(Boolean).map(String))].filter((x) => Types.ObjectId.isValid(x)).map((x) => new Types.ObjectId(x));
  await MediaModel.updateMany({ "usageRefs.entityId": id, _id: { $nin: ids } }, { $pull: { usageRefs: { entityType, entityId: id } } });
  if (ids.length) {
    await MediaModel.updateMany({ _id: { $in: ids }, "usageRefs.entityId": { $ne: id } }, { $push: { usageRefs: { entityType, entityId: id } } });
  }
}
