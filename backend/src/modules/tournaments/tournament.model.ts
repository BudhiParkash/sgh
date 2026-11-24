import { Schema, model, Types } from "mongoose";
import { SOURCE_TYPES, TOURNAMENT_STATUSES } from "@sgh/shared";
import { contentFields, type ContentModel } from "../../lib/content/fields.js";

/** Embedded "TournamentSource" (one tournament owns its sources; no cross-document reuse needed). */
const sourceSchema = new Schema({
  url: { type: String, required: true, maxlength: 500 },
  type: { type: String, enum: SOURCE_TYPES, required: true },
  title: { type: String, required: true, maxlength: 200 },
  publisher: { type: String, maxlength: 120 },
  accessedAt: { type: Date, default: () => new Date() },
  archivedUrl: { type: String, maxlength: 500 },
  notes: { type: String, maxlength: 300 },
});

const richText = { json: { type: Schema.Types.Mixed }, html: { type: String, default: "" } };

const tournamentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    game: { type: Types.ObjectId, ref: "Game", required: true },
    organiser: { type: String, required: true, trim: true, maxlength: 120 },
    organiserUrl: { type: String, maxlength: 500 },
    description: richText,
    format: richText,
    startDate: { type: Date },
    endDate: { type: Date },
    registrationDeadline: { type: Date },
    prizePool: {
      amount: { type: Number, min: 0 },
      currency: { type: String, enum: ["INR"], default: "INR" },
      display: { type: String, maxlength: 80 },
      verified: { type: Boolean, default: false },
    },
    eligibility: {
      summary: { type: String, maxlength: 160 },
      minAge: { type: Number, min: 0, max: 99 },
      region: { type: String, maxlength: 120 },
      notes: { type: String, maxlength: 600 },
    },
    registrationUrl: { type: String, maxlength: 500 },
    officialSourceUrl: { type: String, required: true, maxlength: 500 },
    featuredImage: { type: Types.ObjectId, ref: "Media" },
    status: { type: String, enum: TOURNAMENT_STATUSES, default: "rumour" },
    verification: {
      lastVerifiedAt: { type: Date },
      verifiedBy: { type: Types.ObjectId, ref: "Admin" },
      notes: { type: String, maxlength: 600 },
      confidence: { type: String, enum: ["low", "medium", "high"] },
    },
    sources: { type: [sourceSchema], default: [] },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true, optimisticConcurrency: true },
);
contentFields(tournamentSchema);
tournamentSchema.index({ status: 1, startDate: 1 });
tournamentSchema.index({ game: 1, status: 1, startDate: -1 });
tournamentSchema.index({ isFeatured: 1, "workflow.status": 1 });
tournamentSchema.index({ name: "text", organiser: "text", "description.html": "text" }, { weights: { name: 10, organiser: 5, "description.html": 1 }, name: "tournament_text" });

export const TournamentModel: ContentModel = model("Tournament", tournamentSchema, "tournaments");
