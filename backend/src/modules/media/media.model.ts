import { Schema, model, Types } from "mongoose";

const variantSchema = new Schema(
  { width: Number, height: Number, format: { type: String, enum: ["avif", "webp", "jpeg", "png"] }, key: String, sizeBytes: Number },
  { _id: false },
);

const mediaSchema = new Schema(
  {
    baseKey: { type: String, required: true },
    originalFilename: { type: String, maxlength: 200 },
    mime: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    variants: { type: [variantSchema], default: [] },
    alt: { type: String, required: true, trim: true, maxlength: 250 },
    caption: { type: String, maxlength: 300 },
    credit: { type: String, maxlength: 200 },
    licence: { type: String, enum: ["original", "licensed", "press_kit", "user_submitted"], required: true },
    licenceNotes: { type: String, maxlength: 500 },
    category: { type: String, enum: ["general", "tournament", "sensitivity", "article", "device", "weapon", "resource", "ad"], default: "general" },
    usageRefs: { type: [{ entityType: String, entityId: Types.ObjectId, _id: false }], default: [] },
    uploadedBy: { type: Types.ObjectId, ref: "Admin" },
    checksumSha256: { type: String },
  },
  { timestamps: true, optimisticConcurrency: true },
);
mediaSchema.index({ createdAt: -1 });
mediaSchema.index({ category: 1, createdAt: -1 });
mediaSchema.index({ checksumSha256: 1 });
mediaSchema.index({ "usageRefs.entityId": 1 });
mediaSchema.index({ alt: "text", originalFilename: "text", caption: "text" });

export const MediaModel = model("Media", mediaSchema, "media");
