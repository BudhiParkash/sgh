import { Schema, model, Types } from "mongoose";
import { FPS_OPTIONS, GYRO_MODES, PLAYSTYLES, PROVENANCES, SCOPE_KEYS } from "@sgh/shared";
import { contentFields, type ContentModel } from "../../lib/content/fields.js";

const scopeValues = new Schema(Object.fromEntries(SCOPE_KEYS.map((k) => [k, { type: Number, min: 1, max: 400 }])), { _id: false });
const richText = { json: { type: Schema.Types.Mixed }, html: { type: String, default: "" } };

const configSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    game: { type: Types.ObjectId, ref: "Game", required: true },
    device: { type: Types.ObjectId, ref: "MobileDevice" },
    deviceClass: { refreshTier: String, perfTier: String },
    fps: { type: Number, enum: FPS_OPTIONS, required: true },
    gyroscope: { type: String, enum: GYRO_MODES, required: true },
    playstyle: { type: String, enum: PLAYSTYLES, required: true },
    values: { camera: scopeValues, ads: scopeValues, gyro: scopeValues, ads_gyro: scopeValues },
    gameVersion: { type: String, maxlength: 20 },
    provenance: { type: String, enum: PROVENANCES, required: true },
    testing: {
      testedBy: { type: String, maxlength: 80 },
      testedAt: { type: Date },
      deviceUsed: { type: String, maxlength: 120 },
      method: richText,
      notes: { type: String, maxlength: 600 },
    },
    shareCode: { type: String, maxlength: 40 },
    explanation: richText,
    explanationWords: { type: Number, default: 0 },
    /** Incremented whenever values change — cache key for the downloadable PNG card. */
    valuesVersion: { type: Number, default: 1 },
  },
  { timestamps: true, optimisticConcurrency: true },
);
contentFields(configSchema);
configSchema.index({ device: 1, fps: 1, gyroscope: 1, playstyle: 1, "workflow.status": 1 });
configSchema.index({ "deviceClass.refreshTier": 1, fps: 1, gyroscope: 1, playstyle: 1 });
configSchema.index({ title: "text" });

export const SensitivityConfigModel: ContentModel = model("SensitivityConfig", configSchema, "sensitivity_configs");
