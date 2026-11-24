import { Router } from "express";
import { z } from "zod";
import { objectIdSchema } from "@sgh/shared";
import { buildMeta, toSkip } from "../../lib/pagination.js";
import { ok } from "../../lib/respond.js";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { v, validate } from "../../middleware/validate.js";
import { AuditLogModel } from "./audit.model.js";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  actor: objectIdSchema.optional(),
  entityType: z.string().max(40).optional(),
  entityId: z.string().max(40).optional(),
  action: z.string().max(60).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export function auditRoutes(): Router {
  const r = Router();
  r.get("/", requireAuth(), requirePermission("audit:read"), validate({ query: querySchema }), async (req, res) => {
    const q = v<z.infer<typeof querySchema>>(req.valid.query);
    const filter: Record<string, unknown> = {};
    if (q.actor) filter.actor = q.actor;
    if (q.entityType) filter.entityType = q.entityType;
    if (q.entityId) filter.entityId = q.entityId;
    if (q.action) filter.action = q.action;
    if (q.from || q.to) filter.at = { ...(q.from && { $gte: q.from }), ...(q.to && { $lte: q.to }) };
    const [items, total] = await Promise.all([
      AuditLogModel.find(filter).sort({ at: -1 }).skip(toSkip(q)).limit(q.limit).lean(),
      AuditLogModel.countDocuments(filter),
    ]);
    ok(res, items.map(({ _id, ...rest }) => ({ id: String(_id), ...rest })), buildMeta(q, total));
  });
  return r;
}
