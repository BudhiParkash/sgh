import { z } from "zod";
import { seoSchema, slugSchema } from "@sgh/shared";
import { crudRouter } from "../../lib/content/crud.js";
import type { Cache } from "../../lib/cache.js";
import { CategoryModel } from "./category.model.js";

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: slugSchema.optional(),
  description: z.string().trim().max(500).optional(),
  kind: z.enum(["news", "guide"]),
  order: z.number().int().min(0).max(999).default(0),
  seo: seoSchema.partial().optional(),
});

export const categoryAdminRoutes = (cache: Cache) =>
  crudRouter({
    entity: "category",
    perm: "category",
    model: CategoryModel,
    createSchema: categoryCreateSchema,
    listQuery: z.object({ kind: z.enum(["news", "guide"]).optional() }),
    buildFilter: (q) => (q.kind ? { kind: q.kind } : {}),
    searchFields: ["name", "slug"],
    sortable: ["name", "order", "updatedAt"],
    defaultSort: "order",
    workflow: false,
    slugSource: "name",
    revalidate: (d) => ["categories", `category:${d.id}`, "articles"],
    cache,
    cacheTags: () => ["categories", "articles"],
  });
