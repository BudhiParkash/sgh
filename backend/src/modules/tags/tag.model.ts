import { Schema, model } from "mongoose";
import { contentFields } from "../../lib/content/fields.js";

const tagSchema = new Schema(
  { name: { type: String, required: true, trim: true, maxlength: 60 }, description: { type: String, maxlength: 300 } },
  { timestamps: true, optimisticConcurrency: true },
);
contentFields(tagSchema, { workflow: false });
tagSchema.index({ name: "text" });

export const TagModel = model("Tag", tagSchema, "tags");
