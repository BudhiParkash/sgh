import { Router } from "express";
import type { Model } from "mongoose";
import { forbidden, notFound } from "../lib/errors.js";
import { ok } from "../lib/respond.js";
import { verifyPreviewToken } from "../lib/content/preview.js";

type Mapper = (id: string) => Promise<unknown>;
const mappers = new Map<string, Mapper>();

/** Content modules register how to render an unpublished item for draft-mode preview. */
export function registerPreview(entity: string, fn: Mapper) {
  mappers.set(entity, fn);
}
export function registerSimplePreview(entity: string, model: Model<unknown>, toDto: (doc: unknown) => unknown) {
  registerPreview(entity, async (id) => {
    const d = await model.findById(id);
    return d ? toDto(d) : null;
  });
}

export function previewRoutes(): Router {
  const r = Router();
  r.get("/:token", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const data = verifyPreviewToken(String(req.params.token));
    if (!data) throw forbidden("Preview link expired.");
    const fn = mappers.get(data.t);
    if (!fn) throw notFound();
    const item = await fn(data.id);
    if (!item) throw notFound();
    ok(res, { entity: data.t, item });
  });
  return r;
}
