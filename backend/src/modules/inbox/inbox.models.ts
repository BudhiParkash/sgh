import { Schema, model, Types } from "mongoose";
import { CONTACT_SUBJECTS, REPORT_TYPES } from "@sgh/shared";

const note = new Schema({ text: { type: String, maxlength: 1000 }, by: { type: Types.ObjectId, ref: "Admin" }, byName: String, at: { type: Date, default: () => new Date() } }, { _id: false });

const feedbackSchema = new Schema(
  {
    targetType: { type: String, enum: ["sensitivity_config", "tournament", "article", "site"], required: true },
    targetSlug: { type: String, maxlength: 120 },
    helpful: { type: Boolean },
    rating: { type: Number, min: 1, max: 5 },
    message: { type: String, maxlength: 1000 },
    contactEmail: { type: String, maxlength: 254 },
    consentAt: { type: Date },
    status: { type: String, enum: ["new", "reviewed", "actioned", "spam"], default: "new" },
    ipHash: { type: String, select: false },
  },
  { timestamps: true },
);
feedbackSchema.index({ targetType: 1, targetSlug: 1, createdAt: -1 });
feedbackSchema.index({ status: 1, createdAt: -1 });
feedbackSchema.index({ contactEmail: 1 }, { sparse: true });
export const FeedbackModel = model("Feedback", feedbackSchema, "feedback");

const contactSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 100 },
    email: { type: String, required: true, maxlength: 254 },
    subject: { type: String, enum: CONTACT_SUBJECTS, required: true },
    message: { type: String, required: true, maxlength: 3000 },
    consentAt: { type: Date, required: true },
    status: { type: String, enum: ["new", "in_progress", "closed"], default: "new" },
    assignedTo: { type: Types.ObjectId, ref: "Admin" },
    notes: { type: [note], default: [] },
    ipHash: { type: String, select: false },
  },
  { timestamps: true },
);
contactSchema.index({ status: 1, createdAt: -1 });
contactSchema.index({ email: 1 });
export const ContactEnquiryModel = model("ContactEnquiry", contactSchema, "contact_enquiries");

const reportSchema = new Schema(
  {
    ticketNo: { type: String, required: true },
    type: { type: String, enum: REPORT_TYPES, required: true },
    targetUrl: { type: String, required: true, maxlength: 500 },
    description: { type: String, required: true, maxlength: 3000 },
    reporterName: { type: String, required: true, maxlength: 100 },
    reporterEmail: { type: String, required: true, maxlength: 254 },
    isRightsHolder: { type: Boolean },
    evidenceUrls: { type: [String], default: [] },
    status: { type: String, enum: ["received", "acknowledged", "under_review", "resolved", "rejected"], default: "received" },
    ackDueAt: { type: Date, required: true },
    slaDueAt: { type: Date, required: true },
    acknowledgedAt: { type: Date },
    resolvedAt: { type: Date },
    resolutionNote: { type: String, maxlength: 2000 },
    handledBy: { type: Types.ObjectId, ref: "Admin" },
    notes: { type: [note], default: [] },
    consentAt: { type: Date, required: true },
    ipHash: { type: String, select: false },
  },
  { timestamps: true },
);
reportSchema.index({ ticketNo: 1 }, { unique: true });
reportSchema.index({ status: 1, slaDueAt: 1 });
reportSchema.index({ reporterEmail: 1 });
export const ReportModel = model("Report", reportSchema, "reports");

const privacySchema = new Schema(
  {
    ticketNo: { type: String, required: true },
    type: { type: String, enum: ["access", "correction", "erasure", "withdraw_consent", "grievance", "nominate"], required: true },
    email: { type: String, required: true, maxlength: 254 },
    details: { type: String, maxlength: 2000 },
    verifyTokenHash: { type: String, select: false },
    verifyExpiresAt: { type: Date, select: false },
    verifiedAt: { type: Date },
    status: { type: String, enum: ["unverified", "open", "completed", "rejected"], default: "unverified" },
    dueAt: { type: Date },
    completedAt: { type: Date },
    resolutionNote: { type: String, maxlength: 2000 },
    notes: { type: [note], default: [] },
    ipHash: { type: String, select: false },
  },
  { timestamps: true },
);
privacySchema.index({ ticketNo: 1 }, { unique: true });
privacySchema.index({ status: 1, dueAt: 1 });
export const PrivacyRequestModel = model("PrivacyRequest", privacySchema, "privacy_requests");

const counterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false });
const CounterModel = model("Counter", counterSchema, "counters");

/** Human-readable, sequential ticket numbers per year: SGH-2026-000123 / PRV-2026-000007. */
export async function nextTicket(prefix: "SGH" | "PRV"): Promise<string> {
  const year = new Date().getUTCFullYear();
  const c = await CounterModel.findOneAndUpdate({ _id: `${prefix}-${year}` }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return `${prefix}-${year}-${String(c!.seq).padStart(6, "0")}`;
}
