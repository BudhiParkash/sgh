import { Schema, model, Types } from "mongoose";
import { contentFields, type ContentModel } from "../../lib/content/fields.js";

export const LEGAL_SLUGS = [
  "privacy-policy",
  "terms",
  "cookie-policy",
  "disclaimer",
  "copyright",
  "grievance",
  "community-guidelines",
  "advertising-disclosure",
  "affiliate-disclosure",
  "content-reporting",
] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

const legalSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 120 },
    content: { json: { type: Schema.Types.Mixed }, html: { type: String, default: "" }, headings: { type: Array, default: [] } },
    effectiveDate: { type: Date },
    changeSummary: { type: String, maxlength: 500 },
    /** Must be ticked (after review by qualified Indian counsel) before production publishing. */
    reviewedByCounsel: { type: Boolean, default: false },
    version: { type: Number, default: 0 },
  },
  { timestamps: true, optimisticConcurrency: true },
);
contentFields(legalSchema, { seo: true });

export const LegalPageModel: ContentModel = model("LegalPage", legalSchema, "legal_pages");

/** Every published version is kept (shown on request; needed for consent records). */
const versionSchema = new Schema(
  { slug: { type: String, required: true }, version: { type: Number, required: true }, title: String, html: String, effectiveDate: Date, changeSummary: String, publishedAt: { type: Date, default: () => new Date() }, publishedBy: { type: Types.ObjectId, ref: "Admin" } },
  { versionKey: false },
);
versionSchema.index({ slug: 1, version: -1 }, { unique: true });
export const LegalVersionModel = model("LegalPageVersion", versionSchema, "legal_page_versions");
