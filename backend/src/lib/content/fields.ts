import { Schema, Types, type Model } from "mongoose";
import { WORKFLOW_STATUSES } from "@sgh/shared";

export const seoSubSchema = new Schema(
  {
    title: { type: String, maxlength: 70 },
    description: { type: String, maxlength: 170 },
    canonicalUrl: { type: String, maxlength: 500 },
    robots: { index: { type: Boolean, default: true }, follow: { type: Boolean, default: true } },
    ogImage: { type: Types.ObjectId, ref: "Media" },
  },
  { _id: false },
);

export const workflowSubSchema = new Schema(
  {
    status: { type: String, enum: WORKFLOW_STATUSES, default: "draft" },
    publishAt: { type: Date },
    publishedAt: { type: Date },
    archivedAt: { type: Date },
    submittedAt: { type: Date },
    reviewedBy: { type: Types.ObjectId, ref: "Admin" },
    approvedBy: { type: Types.ObjectId, ref: "Admin" },
    note: { type: String, maxlength: 500 },
  },
  { _id: false },
);

export interface ContentOptions {
  slug?: boolean;
  workflow?: boolean;
  seo?: boolean;
  softDelete?: boolean;
}

/**
 * Adds the shared content fields + indexes used by every CMS collection:
 * slug (unique among live docs), workflow, seo, soft delete, createdBy/updatedBy.
 */
export function contentFields(schema: Schema, opts: ContentOptions = {}): Schema {
  const { slug = true, workflow = true, seo = true, softDelete = true } = opts;
  schema.add({
    createdBy: { type: Types.ObjectId, ref: "Admin" },
    updatedBy: { type: Types.ObjectId, ref: "Admin" },
  });
  if (slug) {
    schema.add({ slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 120, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ } });
    schema.index({ slug: 1 }, softDelete ? { unique: true, partialFilterExpression: { deleted: false } } : { unique: true });
  }
  if (workflow) {
    schema.add({ workflow: { type: workflowSubSchema, default: () => ({}) } });
    schema.index({ "workflow.status": 1, "workflow.publishedAt": -1 });
    schema.index({ "workflow.status": 1, "workflow.publishAt": 1 });
  }
  if (seo) schema.add({ seo: { type: seoSubSchema, default: () => ({}) } });
  if (softDelete) {
    // Boolean flag (partial unique indexes can't use $exists:false); deletedAt keeps the timestamp.
    schema.add({ deleted: { type: Boolean, default: false }, deletedAt: { type: Date } });
    schema.index({ deleted: 1 });
  }
  return schema;
}

/** Filter for content visible to the public. */
export function publicFilter(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    "workflow.status": "published",
    "workflow.publishedAt": { $lte: new Date() },
    deleted: false,
    ...extra,
  };
}

export const liveFilter = (extra: Record<string, unknown> = {}) => ({ deleted: false, ...extra });

/**
 * Content models get fields added dynamically (slug/workflow/seo/deleted/createdBy), which Mongoose's
 * schema inference can't see — content models are therefore typed loosely and validated by Zod at the API edge.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ContentModel = Model<any>;
