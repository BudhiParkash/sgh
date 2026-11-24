import { z } from "zod";
import { LIMITS } from "../constants";

// No runtime code generation (works under a strict Content-Security-Policy without 'unsafe-eval').
z.config({ jitless: true });

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const slugSchema = z
  .string()
  .min(1)
  .max(LIMITS.slugMax)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens");

/** Only https URLs are accepted for anything shown to visitors. */
export const httpsUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((u) => u.startsWith("https://"), "URL must use https");

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(LIMITS.pageSizePublicMax).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const seoSchema = z.object({
  title: z.string().max(LIMITS.seoTitleMax).optional(),
  description: z.string().max(LIMITS.seoDescriptionMax).optional(),
  canonicalUrl: httpsUrlSchema.nullable().optional(),
  robots: z
    .object({ index: z.boolean().default(true), follow: z.boolean().default(true) })
    .default({ index: true, follow: true }),
  ogImage: objectIdSchema.nullable().optional(),
});

/** Converts any title into a URL slug. */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LIMITS.slugMax)
    .replace(/-+$/g, "");
}
