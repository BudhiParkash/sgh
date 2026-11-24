import { Schema, model, Types } from "mongoose";
import { contentFields } from "../../lib/content/fields.js";

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, maxlength: 500 },
    kind: { type: String, enum: ["news", "guide"], required: true },
    parent: { type: Types.ObjectId, ref: "Category" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true, optimisticConcurrency: true },
);
contentFields(categorySchema, { workflow: false });
categorySchema.index({ kind: 1, order: 1 });

export const CategoryModel = model("Category", categorySchema, "categories");

export const DEFAULT_CATEGORIES = [
  { name: "BGMI News", slug: "bgmi-news", kind: "news", order: 1 },
  { name: "PUBG Mobile News", slug: "pubg-mobile-news", kind: "news", order: 2 },
  { name: "Tournament Updates", slug: "tournament-updates", kind: "news", order: 3 },
  { name: "Mobile Gaming", slug: "mobile-gaming", kind: "news", order: 4 },
  { name: "Sensitivity Guides", slug: "sensitivity-guides", kind: "guide", order: 1 },
  { name: "Gaming Tips", slug: "gaming-tips", kind: "guide", order: 2 },
  { name: "Gaming Tutorials", slug: "gaming-tutorials", kind: "guide", order: 3 },
  { name: "Gaming Accessories", slug: "gaming-accessories", kind: "guide", order: 4 },
] as const;
