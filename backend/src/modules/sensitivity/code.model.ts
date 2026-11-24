import { Schema, model, Types } from "mongoose";
import { FPS_OPTIONS, GYRO_MODES } from "@sgh/shared";

/** In-game sensitivity share codes. Only `verified` codes are public. */
const codeSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, maxlength: 40 },
    game: { type: Types.ObjectId, ref: "Game" },
    device: { type: Types.ObjectId, ref: "MobileDevice" },
    deviceText: { type: String, maxlength: 80 }, // free text from community submissions
    fps: { type: Number, enum: FPS_OPTIONS },
    gyroscope: { type: String, enum: GYRO_MODES },
    testedAt: { type: Date },
    author: { type: String, required: true, maxlength: 60 },
    authorType: { type: String, enum: ["staff", "community"], default: "community" },
    description: { type: String, maxlength: 500 },
    gameVersion: { type: String, maxlength: 20 },
    status: { type: String, enum: ["pending", "verified", "rejected", "expired"], default: "pending" },
    verifiedBy: { type: Types.ObjectId, ref: "Admin" },
    verifiedAt: { type: Date },
    reviewNote: { type: String, maxlength: 300 },
    ipHash: { type: String, select: false },
    createdBy: { type: Types.ObjectId, ref: "Admin" },
  },
  { timestamps: true, optimisticConcurrency: true },
);
codeSchema.index({ code: 1 }, { unique: true });
codeSchema.index({ status: 1, createdAt: -1 });
codeSchema.index({ device: 1, status: 1 });

export const SensitivityCodeModel = model("SensitivityCode", codeSchema, "sensitivity_codes");
