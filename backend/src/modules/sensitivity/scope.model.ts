import { Schema, model } from "mongoose";
import { SCOPE_KEYS, SCOPE_LABELS, SENSITIVITY_CATEGORIES } from "@sgh/shared";

const scopeSchema = new Schema(
  {
    key: { type: String, enum: SCOPE_KEYS, required: true },
    label: { type: String, required: true, maxlength: 60 },
    order: { type: Number, default: 0 },
    categoriesApplicable: { type: [String], enum: SENSITIVITY_CATEGORIES, default: [...SENSITIVITY_CATEGORIES] },
  },
  { timestamps: true, optimisticConcurrency: true },
);
scopeSchema.index({ key: 1 }, { unique: true });

export const ScopeModel = model("Scope", scopeSchema, "scopes");

export const DEFAULT_SCOPES = SCOPE_KEYS.map((key, i) => ({ key, label: SCOPE_LABELS[key], order: i }));
