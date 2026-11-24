import type { ErrorRequestHandler, RequestHandler } from "express";
import mongoose from "mongoose";
import type { ApiErrorBody } from "@sgh/shared";
import { logger } from "../config/logger.js";
import { AppError, notFound } from "../lib/errors.js";

export const notFoundHandler: RequestHandler = (_req, _res, next) => next(notFound("Endpoint not found."));

/**
 * Central error handler: operational errors → their status and safe message;
 * everything else → generic 500 (full detail only in server logs, correlated by requestId).
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = String(req.id ?? "");
  let e: AppError;

  if (err instanceof AppError) e = err;
  else if (err?.type === "entity.parse.failed") e = new AppError(400, "VALIDATION_ERROR", "Malformed JSON body.");
  else if (err?.type === "entity.too.large") e = new AppError(413, "PAYLOAD_TOO_LARGE", "Request is too large.");
  else if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern ?? {})[0] ?? "value";
    e = new AppError(409, "CONFLICT", `That ${field} is already in use.`, [{ path: field, message: "Already in use" }]);
  } else if (err instanceof mongoose.Error.CastError) e = notFound();
  else if (err instanceof mongoose.Error.ValidationError) {
    e = new AppError(400, "VALIDATION_ERROR", "Please check the highlighted fields.", Object.values(err.errors).map((x) => ({ path: x.path, message: x.message })));
  } else if (err?.name === "MulterError") {
    e = err.code === "LIMIT_FILE_SIZE" ? new AppError(413, "PAYLOAD_TOO_LARGE", "File is too large.") : new AppError(400, "VALIDATION_ERROR", "Invalid upload.");
  } else {
    logger.error({ err, requestId }, "Unhandled error");
    e = new AppError(500, "INTERNAL", "Something went wrong. Please try again.");
  }

  if (e.status >= 500 && err instanceof AppError) logger.error({ err, requestId }, "Server error");
  if (e.headers) for (const [k, val] of Object.entries(e.headers)) res.setHeader(k, val);
  const body: ApiErrorBody = { success: false, error: { code: e.code, message: e.message, details: e.details, requestId } };
  res.status(e.status).json(body);
};
