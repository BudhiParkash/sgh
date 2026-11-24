import { Schema, model, Types } from "mongoose";
import { SCOPE_KEYS } from "@sgh/shared";
import { contentFields, type ContentModel } from "../../lib/content/fields.js";

const richText = { json: { type: Schema.Types.Mixed }, html: { type: String, default: "" } };

const weaponSchema = new Schema(
  {
    game: { type: Types.ObjectId, ref: "Game", required: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    type: { type: String, enum: ["AR", "SMG", "DMR", "SR", "SG", "LMG", "Pistol"], required: true },
    ammo: { type: String, maxlength: 20 },
    recommendedScopes: { type: [String], enum: SCOPE_KEYS, default: [] },
    summary: { type: String, maxlength: 300 },
    recoilNotes: richText,
    attachmentNotes: richText,
    image: { type: Types.ObjectId, ref: "Media" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true, optimisticConcurrency: true },
);
contentFields(weaponSchema);
weaponSchema.index({ game: 1, order: 1 });

export const WeaponModel: ContentModel = model("Weapon", weaponSchema, "weapons");
