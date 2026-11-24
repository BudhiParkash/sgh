import { z } from "zod";
import { seoSchema, slugSchema } from "@sgh/shared";
import { crudRouter } from "../../lib/content/crud.js";
import type { Cache } from "../../lib/cache.js";
import { TagModel } from "./tag.model.js";

export const tagCreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: slugSchema.optional(),
  description: z.string().trim().max(300).optional(),
  seo: seoSchema.partial().optional(),
});

export const tagAdminRoutes = (cache: Cache) =>
  crudRouter({
    entity: "tag",
    perm: "tag",
    model: TagModel,
    createSchema: tagCreateSchema,
    searchFields: ["name", "slug"],
    sortable: ["name", "updatedAt"],
    defaultSort: "name",
    workflow: false,
    slugSource: "name",
    revalidate: (d) => [`tag:${d.slug}`, "articles"],
    cache,
    cacheTags: () => ["articles"],
  });
