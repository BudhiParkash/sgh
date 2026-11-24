import { Router } from "express";
import { z } from "zod";
import type { Cache } from "../../lib/cache.js";
import { crudRouter } from "../../lib/content/crud.js";
import { ok } from "../../lib/respond.js";
import { RedirectModel } from "./redirect.model.js";

const createSchema = z
  .object({
    from: z.string().trim().regex(/^\/[^\s?#]*$/, "Start with / (no query string)").max(300),
    to: z.string().trim().max(500).optional(),
    code: z.union([z.literal(301), z.literal(302), z.literal(410)]).default(301),
    note: z.string().max(200).optional(),
  })
  .refine((d) => d.code === 410 || (d.to && (d.to.startsWith("/") || d.to.startsWith("https://"))), { message: "Destination must start with / or https://", path: ["to"] })
  .refine((d) => d.from !== d.to, { message: "Source and destination are the same", path: ["to"] });

export const redirectAdminRoutes = (cache: Cache) =>
  crudRouter({
    entity: "redirect",
    perm: "redirect",
    model: RedirectModel,
    createSchema: createSchema as unknown as z.ZodObject,
    updateSchema: z.object({ to: z.string().max(500), code: z.union([z.literal(301), z.literal(302), z.literal(410)]), note: z.string().max(200) }).partial(),
    searchFields: ["from", "to"],
    sortable: ["from", "hits", "updatedAt"],
    softDelete: false,
    workflow: false,
    revalidate: () => ["redirects"],
    cache,
    cacheTags: () => ["redirects"],
  });

/** Public list consumed by the Next.js middleware (cached). */
export function redirectPublicRoutes(cache: Cache): Router {
  const r = Router();
  r.get("/", async (_req, res) => {
    ok(res, await cache.cached("redirects:all", ["redirects"], 300, async () => (await RedirectModel.find().select("from to code -_id").lean())));
  });
  return r;
}
