import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { badRequest } from "../lib/errors.js";

interface Schemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/** Validates and parses body/query/params with Zod. Parsed values land on `req.valid`. */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    for (const part of ["params", "query", "body"] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        return next(
          badRequest(
            "Please check the highlighted fields.",
            result.error.issues.map((i) => ({ path: i.path.join(".") || part, message: i.message })),
          ),
        );
      }
      req.valid[part] = result.data;
    }
    next();
  };
}

/** Typed accessor for validated data inside controllers. */
export function v<T>(value: unknown): T {
  return value as T;
}
