import { Schema, model, Types } from "mongoose";

/** Snapshot history for editable content (last N per entity). */
const revisionSchema = new Schema(
  {
    entityType: { type: String, required: true },
    entityId: { type: Types.ObjectId, required: true },
    rev: { type: Number, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
    editedBy: { type: Types.ObjectId, ref: "Admin" },
    editedByName: { type: String },
    note: { type: String, maxlength: 200 },
    at: { type: Date, default: () => new Date() },
  },
  { versionKey: false },
);
revisionSchema.index({ entityType: 1, entityId: 1, rev: -1 }, { unique: true });

export const RevisionModel = model("Revision", revisionSchema, "revisions");
export const MAX_REVISIONS = 50;
