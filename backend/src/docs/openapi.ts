import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

/**
 * OpenAPI registry. Modules register their paths here (see each *.docs.ts / register calls).
 * Generated document is served at /api/v1/docs (non-production or when API_DOCS_ENABLED=true).
 */
export const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "sessionCookie", {
  type: "apiKey",
  in: "cookie",
  name: "__Host-sgh_sid",
  description: "Admin session cookie (HttpOnly). State-changing requests also need the X-CSRF-Token header from /admin/auth/me.",
});

export const ErrorSchema = registry.register(
  "Error",
  z.object({
    success: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
      requestId: z.string().optional(),
    }),
  }),
);

export const envelope = <T extends z.ZodType>(data: T) => z.object({ success: z.literal(true), data, meta: z.any().optional() });

const errorResponses = {
  400: { description: "Validation error", content: { "application/json": { schema: ErrorSchema } } },
  401: { description: "Not signed in", content: { "application/json": { schema: ErrorSchema } } },
  403: { description: "Forbidden", content: { "application/json": { schema: ErrorSchema } } },
  429: { description: "Rate limited", content: { "application/json": { schema: ErrorSchema } } },
};

type Method = "get" | "post" | "patch" | "put" | "delete";

/** Compact helper so modules can document routes next to their definitions. */
export function doc(
  method: Method,
  path: string,
  opts: { tag: string; summary: string; body?: z.ZodType; query?: z.ZodObject; response?: z.ZodType; auth?: boolean; status?: number },
) {
  registry.registerPath({
    method,
    path: `/api/v1${path}`,
    tags: [opts.tag],
    summary: opts.summary,
    security: opts.auth ? [{ sessionCookie: [] }] : undefined,
    request: {
      ...(opts.body && { body: { content: { "application/json": { schema: opts.body } } } }),
      ...(opts.query && { query: opts.query }),
    },
    responses: {
      [opts.status ?? 200]: opts.response
        ? { description: "OK", content: { "application/json": { schema: envelope(opts.response) } } }
        : { description: "OK" },
      ...errorResponses,
    },
  });
}

export function buildOpenApiDocument() {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Shivanshi Gaming Hub API",
      version: "1.0.0",
      description: "Public and admin REST API (v1). Same API will serve the future Android app under /api/v1/app/*.",
    },
    servers: [{ url: "/" }],
  });
}
