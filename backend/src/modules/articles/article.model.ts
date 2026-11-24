import { Schema, model, Types } from "mongoose";
import { ARTICLE_TYPES } from "@sgh/shared";
import { contentFields, type ContentModel } from "../../lib/content/fields.js";

const articleSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    excerpt: { type: String, required: true, trim: true, maxlength: 300 },
    type: { type: String, enum: ARTICLE_TYPES, required: true },
    content: {
      json: { type: Schema.Types.Mixed },
      html: { type: String, default: "" },
      headings: { type: [{ id: String, text: String, level: Number, _id: false }], default: [] },
      wordCount: { type: Number, default: 0 },
      readingMinutes: { type: Number, default: 1 },
      internalLinks: { type: [String], default: [] },
    },
    featuredImage: { type: Types.ObjectId, ref: "Media" },
    author: { type: Types.ObjectId, ref: "Admin", required: true },
    category: { type: Types.ObjectId, ref: "Category", required: true },
    tags: { type: [{ type: Types.ObjectId, ref: "Tag" }], default: [] },
    sources: { type: [{ title: { type: String, maxlength: 200 }, url: { type: String, maxlength: 500 }, _id: false }], default: [] },
    faq: { type: [{ question: { type: String, maxlength: 200 }, answer: { type: String, maxlength: 1500 }, _id: false }], default: [] },
    sponsored: {
      isSponsored: { type: Boolean, default: false },
      sponsorName: { type: String, maxlength: 120 },
      disclosureText: { type: String, maxlength: 300 },
    },
    hasAffiliateLinks: { type: Boolean, default: false },
  },
  { timestamps: true, optimisticConcurrency: true },
);
contentFields(articleSchema);
articleSchema.index({ category: 1, "workflow.publishedAt": -1 });
articleSchema.index({ tags: 1, "workflow.publishedAt": -1 });
articleSchema.index({ author: 1, "workflow.publishedAt": -1 });
articleSchema.index({ title: "text", excerpt: "text", "content.html": "text" }, { weights: { title: 10, excerpt: 4, "content.html": 1 }, name: "article_text" });

export const ArticleModel: ContentModel = model("GamingArticle", articleSchema, "articles");
