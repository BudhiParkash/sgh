import type { Response } from "express";
import type { ApiMeta, ApiSuccess } from "@sgh/shared";

export function ok<T>(res: Response, data: T, meta?: ApiMeta, status = 200): Response {
  const body: ApiSuccess<T> = meta ? { success: true, data, meta } : { success: true, data };
  return res.status(status).json(body);
}

export function created<T>(res: Response, data: T): Response {
  return ok(res, data, undefined, 201);
}

export function noContent(res: Response): Response {
  return res.status(204).end();
}
