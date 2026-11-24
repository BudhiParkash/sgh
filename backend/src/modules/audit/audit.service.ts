import type { Request } from "express";
import { logger } from "../../config/logger.js";
import { AuditLogModel } from "./audit.model.js";

const SECRET_FIELDS = /password|secret|token|hash|recovery|twoFactor/i;

/** Shallow diff of two plain objects → { field: [before, after] }, secrets removed. */
export function diff(before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined) {
  const out: Record<string, [unknown, unknown]> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const k of keys) {
    if (SECRET_FIELDS.test(k) || ["updatedAt", "createdAt", "__v", "_id"].includes(k)) continue;
    const a = before?.[k];
    const b = after?.[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) out[k] = [a, b];
  }
  return out;
}

export interface AuditInput {
  action: string;
  entityType?: string;
  entityId?: string;
  summary?: string;
  changes?: Record<string, unknown>;
}

/** Records an audit entry. Never throws into the request (audit failure is logged loudly instead). */
export async function audit(req: Request | null, input: AuditInput): Promise<void> {
  try {
    await AuditLogModel.create({
      ...input,
      actor: req?.session?.adminId ?? null,
      actorName: req?.session?.name,
      actorRole: req?.session?.roleKey,
      ipHash: req?.ipHash,
      requestId: req?.id as string | undefined,
    });
  } catch (err) {
    logger.error({ err, action: input.action }, "AUDIT WRITE FAILED");
  }
}
