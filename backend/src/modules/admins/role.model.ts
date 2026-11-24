import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const roleSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 60, match: /^[a-z][a-z0-9_-]*$/ },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, maxlength: 300 },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
    /** Incremented on permission change; sessions carry the version they were issued with. */
    version: { type: Number, default: 1 },
  },
  { timestamps: true },
);
roleSchema.index({ key: 1 }, { unique: true });

export type Role = InferSchemaType<typeof roleSchema>;
export type RoleDoc = HydratedDocument<Role>;
export const RoleModel = model("Role", roleSchema);
