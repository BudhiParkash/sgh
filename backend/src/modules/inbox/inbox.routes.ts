import { createHash, randomBytes } from "node:crypto";
import { Router, type Request } from "express";
import type { Redis } from "ioredis";
import type { Model } from "mongoose";
import { z } from "zod";
import { CONTACT_SUBJECTS, REPORT_TYPES, httpsUrlSchema } from "@sgh/shared";
import { env } from "../../config/env.js";
import { badRequest, notFound } from "../../lib/errors.js";
import { sendMail } from "../../lib/mail/mailer.js";
import { buildMeta, toSkip } from "../../lib/pagination.js";
import { created, ok } from "../../lib/respond.js";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { verifyTurnstile } from "../../middleware/turnstile.js";
import { v, validate } from "../../middleware/validate.js";
import type { Permission } from "../admins/permissions.js";
import { audit } from "../audit/audit.service.js";
import { ContactEnquiryModel, FeedbackModel, PrivacyRequestModel, ReportModel, nextTicket } from "./inbox.models.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- documents */
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Minimum number of responses before a "found this helpful" share is shown (no misleading tiny samples). */
export const MIN_FEEDBACK_SAMPLE = 20;
const honeypot = { website: z.string().max(0).optional() };
const email = z.string().trim().toLowerCase().email().max(254);
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

function publicLimits(redis: Redis, name: string) {
  return [rateLimit(redis, { name: `${name}-10m`, points: 5, durationSec: 600 }), rateLimit(redis, { name: `${name}-day`, points: 20, durationSec: 86_400 })];
}
const strip = <T extends Record<string, unknown>>(o: T) => {
  const { website: _w, ...rest } = o;
  return rest;
};

export function inboxPublicRoutes(redis: Redis): Router {
  const r = Router();

  const feedbackSchema = z.object({
    targetType: z.enum(["sensitivity_config", "tournament", "article", "site"]),
    targetSlug: z.string().regex(/^[a-z0-9-]{1,120}$/).optional(),
    helpful: z.boolean().optional(),
    rating: z.number().int().min(1).max(5).optional(),
    message: z.string().trim().max(1000).optional(),
    contactEmail: email.optional(),
    consent: z.boolean().optional(),
    ...honeypot,
  }).refine((d) => d.helpful !== undefined || d.rating !== undefined || d.message, { message: "Empty feedback" })
    .refine((d) => !d.contactEmail || d.consent === true, { message: "Please agree to us using your email to reply", path: ["consent"] });

  r.post("/feedback", ...publicLimits(redis, "feedback"), validate({ body: feedbackSchema }), async (req, res) => {
    const { consent, ...b } = strip(v<z.infer<typeof feedbackSchema>>(req.valid.body)) as z.infer<typeof feedbackSchema>;
    await FeedbackModel.create({ ...b, consentAt: consent ? new Date() : undefined, ipHash: req.ipHash });
    created(res, { received: true });
  });

  const summarySchema = z.object({ targetType: z.enum(["sensitivity_config", "tournament", "article"]), targetSlug: z.string().regex(/^[a-z0-9-]{1,120}$/) });
  r.get("/feedback/summary", validate({ query: summarySchema }), async (req, res) => {
    const q = v<z.infer<typeof summarySchema>>(req.valid.query);
    const [row] = await FeedbackModel.aggregate([
      { $match: { ...q, helpful: { $ne: null }, status: { $ne: "spam" } } },
      { $group: { _id: null, total: { $sum: 1 }, yes: { $sum: { $cond: ["$helpful", 1, 0] } } } },
    ]);
    const total = row?.total ?? 0;
    // Never publish a percentage from a tiny sample.
    ok(res, total >= MIN_FEEDBACK_SAMPLE ? { total, helpfulShare: Math.round((row.yes / total) * 100) } : { total, helpfulShare: null });
  });

  const contactSchema = z.object({ name: z.string().trim().min(2).max(100), email, subject: z.enum(CONTACT_SUBJECTS), message: z.string().trim().min(10).max(3000), consent: z.literal(true, { message: "Please agree so we can reply to you" }), ...honeypot });
  r.post("/contact", ...publicLimits(redis, "contact"), verifyTurnstile, validate({ body: contactSchema }), async (req, res) => {
    const { consent: _c, ...b } = strip(v<z.infer<typeof contactSchema>>(req.valid.body)) as z.infer<typeof contactSchema>;
    await ContactEnquiryModel.create({ ...b, consentAt: new Date(), ipHash: req.ipHash });
    created(res, { received: true, message: "Thanks — we'll reply by email." });
  });

  const reportSchema = z.object({
    type: z.enum(REPORT_TYPES),
    targetUrl: z.string().trim().min(1).max(500).refine((u) => u.startsWith("/") || /^https:\/\/(www\.)?shivanshigaming\.com\//.test(u), "Use a link to a page on this website"),
    description: z.string().trim().min(20, "Describe the problem (20+ characters)").max(3000),
    reporterName: z.string().trim().min(2).max(100),
    reporterEmail: email,
    isRightsHolder: z.boolean().optional(),
    evidenceUrls: z.array(httpsUrlSchema).max(5).default([]),
    consent: z.literal(true, { message: "Please agree so we can process your report" }),
    ...honeypot,
  });
  r.post("/reports", ...publicLimits(redis, "report"), verifyTurnstile, validate({ body: reportSchema }), async (req, res) => {
    const { consent: _c, ...b } = strip(v<z.infer<typeof reportSchema>>(req.valid.body)) as z.infer<typeof reportSchema>;
    const now = Date.now();
    const ticketNo = await nextTicket("SGH");
    await ReportModel.create({ ...b, ticketNo, consentAt: new Date(now), ackDueAt: new Date(now + DAY), slaDueAt: new Date(now + 15 * DAY), ipHash: req.ipHash });
    await sendMail({ to: b.reporterEmail, subject: `We received your report ${ticketNo}`, text: `Hello ${b.reporterName},\n\nWe received your report (${ticketNo}) about ${b.targetUrl}. We'll review it and reply to this address.\n\n— Shivanshi Gaming Hub` });
    created(res, { ticketNo, message: `Report received. Your ticket number is ${ticketNo}.` });
  });

  const privacySchema = z.object({ type: z.enum(["access", "correction", "erasure", "withdraw_consent", "grievance", "nominate"]), email, details: z.string().trim().max(2000).optional(), ...honeypot });
  r.post("/privacy-requests", ...publicLimits(redis, "privacy"), verifyTurnstile, validate({ body: privacySchema }), async (req, res) => {
    const b = strip(v<z.infer<typeof privacySchema>>(req.valid.body)) as z.infer<typeof privacySchema>;
    const token = randomBytes(24).toString("base64url");
    const ticketNo = await nextTicket("PRV");
    await PrivacyRequestModel.create({ ...b, ticketNo, verifyTokenHash: hashToken(token), verifyExpiresAt: new Date(Date.now() + DAY), ipHash: req.ipHash });
    await sendMail({ to: b.email, subject: `Confirm your privacy request ${ticketNo}`, text: `Please confirm this request by opening:\n${env.SITE_URL}/privacy-request/verify?token=${token}\n\nThe link expires in 24 hours. If you didn't make this request, ignore this email.` });
    created(res, { ticketNo, message: "Check your email to confirm the request." });
  });

  r.post("/privacy-requests/verify", rateLimit(redis, { name: "privacy-verify", points: 10, durationSec: 600 }), validate({ body: z.object({ token: z.string().min(20).max(100) }) }), async (req, res) => {
    const { token } = v<{ token: string }>(req.valid.body);
    const pr = await PrivacyRequestModel.findOne({ verifyTokenHash: hashToken(token), status: "unverified" }).select("+verifyExpiresAt");
    if (!pr || !pr.verifyExpiresAt || pr.verifyExpiresAt < new Date()) throw badRequest("This confirmation link is invalid or has expired.");
    pr.set({ verifiedAt: new Date(), status: "open", dueAt: new Date(Date.now() + 30 * DAY), verifyTokenHash: undefined, verifyExpiresAt: undefined });
    await pr.save();
    ok(res, { ticketNo: pr.ticketNo, message: "Thanks — your request is confirmed and our team will respond by email." });
  });
  return r;
}

/** Generic admin inbox list + update for one collection. */
function inboxAdmin(cfg: { model: Model<any>; perm: string; entity: string; statuses: readonly string[]; patch: z.ZodObject; onStatus?: (doc: any, status: string, req: Request) => Promise<void> | void }): Router {
  const r = Router();
  const P = (a: string) => `${cfg.perm}:${a}` as Permission;
  const list = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(30), status: z.enum(cfg.statuses as [string, ...string[]]).optional(), q: z.string().trim().max(80).optional() });
  const dto = (d: any) => {
    const { _id, __v, verifyTokenHash: _t, ipHash: _i, ...x } = typeof d.toObject === "function" ? d.toObject() : d;
    return { id: String(_id), version: __v, ...x };
  };
  r.get("/", requireAuth(), requirePermission(P("read")), validate({ query: list }), async (req, res) => {
    const q = v<z.infer<typeof list>>(req.valid.query);
    const filter: Record<string, unknown> = { ...(q.status && { status: q.status }) };
    if (q.q) filter.$or = ["email", "reporterEmail", "contactEmail", "ticketNo", "name", "targetSlug"].map((f) => ({ [f]: new RegExp(q.q!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }));
    const [items, total] = await Promise.all([cfg.model.find(filter).sort({ createdAt: -1 }).skip(toSkip(q)).limit(q.limit), cfg.model.countDocuments(filter)]);
    ok(res, items.map(dto), buildMeta(q, total));
  });
  r.get("/:id", requireAuth(), requirePermission(P("read")), async (req, res) => {
    const d = await cfg.model.findById(req.params.id);
    if (!d) throw notFound();
    ok(res, dto(d));
  });
  r.patch("/:id", requireAuth(), requirePermission(P("update")), validate({ body: cfg.patch }), async (req, res) => {
    const d = await cfg.model.findById(req.params.id);
    if (!d) throw notFound();
    const body = req.valid.body as Record<string, any>;
    const prev = d.status;
    if (body.note) d.notes.push({ text: body.note, by: req.session!.adminId, byName: req.session!.name });
    const { note: _n, ...rest } = body;
    d.set(rest);
    if (rest.status && rest.status !== prev) await cfg.onStatus?.(d, rest.status, req);
    await d.save();
    await audit(req, { action: `${cfg.entity}.update`, entityType: cfg.entity, entityId: d.id, summary: rest.status && rest.status !== prev ? `${prev} → ${rest.status}` : undefined });
    ok(res, dto(d));
  });
  return r;
}

export function inboxAdminRoutes(): Record<string, Router> {
  return {
    feedback: inboxAdmin({ model: FeedbackModel, perm: "feedback", entity: "feedback", statuses: ["new", "reviewed", "actioned", "spam"], patch: z.object({ status: z.enum(["new", "reviewed", "actioned", "spam"]) }) }),
    enquiries: inboxAdmin({
      model: ContactEnquiryModel,
      perm: "enquiry",
      entity: "enquiry",
      statuses: ["new", "in_progress", "closed"],
      patch: z.object({ status: z.enum(["new", "in_progress", "closed"]).optional(), note: z.string().trim().min(1).max(1000).optional() }),
    }),
    reports: inboxAdmin({
      model: ReportModel,
      perm: "report",
      entity: "report",
      statuses: ["received", "acknowledged", "under_review", "resolved", "rejected"],
      patch: z.object({ status: z.enum(["received", "acknowledged", "under_review", "resolved", "rejected"]).optional(), resolutionNote: z.string().trim().max(2000).optional(), note: z.string().trim().min(1).max(1000).optional() }),
      onStatus: async (d, status, req) => {
        if (status === "acknowledged" && !d.acknowledgedAt) d.acknowledgedAt = new Date();
        if (status === "resolved" || status === "rejected") {
          if (!d.resolutionNote) throw badRequest("Add a resolution note explaining the decision.", [{ path: "resolutionNote", message: "Required" }]);
          d.resolvedAt = new Date();
          d.handledBy = req.session!.adminId;
          await sendMail({ to: d.reporterEmail, subject: `Update on your report ${d.ticketNo}`, text: `Hello ${d.reporterName},\n\nYour report ${d.ticketNo} has been ${status}.\n\n${d.resolutionNote}\n\nReply to this email if you disagree and we will review the decision.\n\n— Shivanshi Gaming Hub` });
        }
      },
    }),
    privacy: inboxAdmin({
      model: PrivacyRequestModel,
      perm: "privacy_request",
      entity: "privacy_request",
      statuses: ["unverified", "open", "completed", "rejected"],
      patch: z.object({ status: z.enum(["open", "completed", "rejected"]).optional(), resolutionNote: z.string().trim().max(2000).optional(), note: z.string().trim().min(1).max(1000).optional() }),
      onStatus: async (d, status) => {
        if (status === "completed" || status === "rejected") {
          d.completedAt = new Date();
          await sendMail({ to: d.email, subject: `Your privacy request ${d.ticketNo}`, text: `Your request ${d.ticketNo} has been ${status}.\n\n${d.resolutionNote ?? ""}\n\n— Shivanshi Gaming Hub` });
        }
      },
    }),
  };
}

/** Personal data held for an email address (data-principal access / erasure). */
export async function findPersonalData(emailAddr: string) {
  const e = emailAddr.toLowerCase();
  const [contact, feedback, reports, privacy] = await Promise.all([
    ContactEnquiryModel.find({ email: e }).select("-ipHash -notes").lean(),
    FeedbackModel.find({ contactEmail: e }).select("-ipHash").lean(),
    ReportModel.find({ reporterEmail: e }).select("-ipHash -notes").lean(),
    PrivacyRequestModel.find({ email: e }).select("ticketNo type status createdAt").lean(),
  ]);
  return { contactEnquiries: contact, feedback, reports, privacyRequests: privacy };
}

/**
 * Erasure: deletes enquiries and feedback; anonymises reports (kept for legal record-keeping without
 * personal details). Privacy-request records keep only a hash of the email as proof of handling.
 */
export async function erasePersonalData(emailAddr: string): Promise<Record<string, number>> {
  const e = emailAddr.toLowerCase();
  const [c, f, r] = await Promise.all([
    ContactEnquiryModel.deleteMany({ email: e }),
    FeedbackModel.updateMany({ contactEmail: e }, { $unset: { contactEmail: 1, consentAt: 1 } }),
    ReportModel.updateMany({ reporterEmail: e }, { $set: { reporterName: "[erased]", reporterEmail: "erased@invalid.local" } }),
  ]);
  return { contactEnquiriesDeleted: c.deletedCount, feedbackAnonymised: f.modifiedCount, reportsAnonymised: r.modifiedCount };
}

export function privacyActionRoutes(): Router {
  const r = Router();
  r.get("/:id/export", requireAuth(), requirePermission("privacy_request:read"), async (req, res) => {
    const pr = await PrivacyRequestModel.findById(req.params.id);
    if (!pr || !pr.verifiedAt) throw badRequest("Only verified requests can be exported.");
    await audit(req, { action: "privacy_request.export", entityType: "privacy_request", entityId: pr.id });
    ok(res, { ticketNo: pr.ticketNo, generatedAt: new Date().toISOString(), data: await findPersonalData(pr.email) });
  });
  r.post("/:id/erase", requireAuth(), requirePermission("privacy_request:update"), async (req, res) => {
    const pr = await PrivacyRequestModel.findById(req.params.id);
    if (!pr || !pr.verifiedAt || pr.type !== "erasure") throw badRequest("Only verified erasure requests can be executed.");
    const result = await erasePersonalData(pr.email);
    pr.notes.push({ text: `Erasure executed: ${JSON.stringify(result)}`, by: req.session!.adminId as never, byName: req.session!.name });
    await pr.save();
    await audit(req, { action: "privacy_request.erase", entityType: "privacy_request", entityId: pr.id, summary: JSON.stringify(result) });
    ok(res, result);
  });
  return r;
}
