import { Schema, model, Types, type InferSchemaType } from "mongoose";

/** Append-only. The production DB user has no update/delete rights on this collection. */
const auditSchema = new Schema(
  {
    actor: { type: Types.ObjectId, ref: "Admin", default: null },
    actorName: { type: String },
    actorRole: { type: String },
    action: { type: String, required: true }, // e.g. "tournament.publish"
    entityType: { type: String },
    entityId: { type: String },
    summary: { type: String, maxlength: 300 },
    changes: { type: Schema.Types.Mixed }, // { field: [before, after] } — secrets stripped
    ipHash: { type: String },
    requestId: { type: String },
    at: { type: Date, default: () => new Date() },
  },
  { versionKey: false },
);
auditSchema.index({ entityType: 1, entityId: 1, at: -1 });
auditSchema.index({ actor: 1, at: -1 });
auditSchema.index({ at: -1 });
auditSchema.index({ action: 1, at: -1 });

export type AuditLog = InferSchemaType<typeof auditSchema>;
export const AuditLogModel = model("AuditLog", auditSchema, "audit_logs");
