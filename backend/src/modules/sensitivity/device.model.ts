import { Schema, model, Types } from "mongoose";
import { FPS_OPTIONS } from "@sgh/shared";
import { contentFields, type ContentModel } from "../../lib/content/fields.js";

const deviceSchema = new Schema(
  {
    brand: { type: String, required: true, trim: true, maxlength: 40 },
    brandSlug: { type: String, required: true, lowercase: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, maxlength: 40 },
    model: { type: String, required: true, trim: true, maxlength: 80 },
    releaseYear: { type: Number, min: 2015, max: 2100 },
    chipset: { type: String, maxlength: 80 },
    ramOptions: { type: [Number], default: [] },
    displayRefreshRateHz: { type: Number, min: 30, max: 240 },
    touchSamplingRateHz: { type: Number, min: 60, max: 4000 },
    screenSizeInches: { type: Number, min: 4, max: 14 },
    /** Highest in-game FPS options verified for this device. */
    supportedFps: { type: [Number], enum: FPS_OPTIONS, default: [] },
    fpsSourceUrl: { type: String, maxlength: 500 },
    fpsVerifiedAt: { type: Date },
    specSourceUrl: { type: String, maxlength: 500 },
    gyroscope: { type: Boolean, default: true },
    /** Derived tiers used for clearly-labelled baseline fallbacks. */
    deviceClass: {
      refreshTier: { type: String, enum: ["60", "90", "120", "144+"] },
      screenBucket: { type: String, enum: ["compact", "standard", "large", "tablet"] },
      perfTier: { type: String, enum: ["entry", "mid", "high", "flagship"] },
    },
    summary: { type: String, maxlength: 300 },
    image: { type: Types.ObjectId, ref: "Media" },
  },
  { timestamps: true, optimisticConcurrency: true },
);
contentFields(deviceSchema);
deviceSchema.index({ brandSlug: 1, model: 1 });
deviceSchema.index({ brand: "text", model: "text" });

export const DeviceModel: ContentModel = model("MobileDevice", deviceSchema, "mobile_devices");

/** Pure: derives device-class tiers from specs (unit-tested). */
export function deriveDeviceClass(d: { displayRefreshRateHz?: number | null; screenSizeInches?: number | null; supportedFps?: number[] }) {
  const hz = d.displayRefreshRateHz ?? 60;
  const refreshTier = hz >= 144 ? "144+" : hz >= 120 ? "120" : hz >= 90 ? "90" : "60";
  const size = d.screenSizeInches ?? 6.5;
  const screenBucket = size >= 7.5 ? "tablet" : size >= 6.7 ? "large" : size >= 6.2 ? "standard" : "compact";
  const maxFps = Math.max(30, ...(d.supportedFps ?? []));
  const perfTier = maxFps >= 120 ? "flagship" : maxFps >= 90 ? "high" : maxFps >= 60 ? "mid" : "entry";
  return { refreshTier, screenBucket, perfTier } as const;
}
