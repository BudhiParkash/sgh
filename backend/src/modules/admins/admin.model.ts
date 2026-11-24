import { Schema, model, Types, type InferSchemaType, type HydratedDocument } from "mongoose";

const adminSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: Types.ObjectId, ref: "Role", required: true },
    status: { type: String, enum: ["active", "suspended", "invited"], default: "active" },
    /** "ai_agent" = service account used by Claude/ChatGPT via MCP (token auth only; cannot sign in with a password). */
    kind: { type: String, enum: ["human", "ai_agent"], default: "human" },
    twoFactor: {
      enabled: { type: Boolean, default: false },
      secretEnc: { type: String, select: false },
      pendingSecretEnc: { type: String, select: false },
      lastUsedStep: { type: Number, select: false },
      recoveryCodeHashes: { type: [String], select: false, default: undefined },
    },
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    lastLoginAt: { type: Date },
    lastLoginIpHash: { type: String },
    passwordChangedAt: { type: Date },
    /** Public author profile (opt-in), shown on articles. */
    profile: {
      displayName: { type: String, trim: true, maxlength: 80 },
      slug: { type: String, trim: true, maxlength: 80 },
      bio: { type: String, maxlength: 600 },
      isPublic: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
);
adminSchema.index({ email: 1 }, { unique: true });
adminSchema.index({ "profile.slug": 1 }, { unique: true, partialFilterExpression: { "profile.slug": { $type: "string" } } });

export type Admin = InferSchemaType<typeof adminSchema>;
export type AdminDoc = HydratedDocument<Admin>;
export const AdminModel = model("Admin", adminSchema);
