import type { ApiErrorBody } from "@sgh/shared";

type Code = ApiErrorBody["error"]["code"];

/** Operational error with a safe, user-facing message. Anything else is treated as INTERNAL. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: Code,
    message: string,
    public readonly details?: { path: string; message: string }[],
    public readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, details?: AppError["details"]) => new AppError(400, "VALIDATION_ERROR", message, details);
export const unauthenticated = (message = "Please sign in.") => new AppError(401, "UNAUTHENTICATED", message);
export const forbidden = (message = "You don't have permission to do that.") => new AppError(403, "FORBIDDEN", message);
export const notFound = (message = "Not found.") => new AppError(404, "NOT_FOUND", message);
export const conflict = (message: string) => new AppError(409, "CONFLICT", message);
export const tooMany = (retryAfterSec: number, message = "Too many requests. Please try again later.") =>
  new AppError(429, "RATE_LIMITED", message, undefined, { "Retry-After": String(Math.max(1, Math.ceil(retryAfterSec))) });
