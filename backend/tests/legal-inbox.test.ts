import request from "supertest";
import { describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { runRetentionSweep } from "../src/jobs/retention.js";
import { registerInboxRetention } from "../src/jobs/retention-rules.js";
import { sentMail } from "../src/lib/mail/mailer.js";
import { ContactEnquiryModel, FeedbackModel, ReportModel } from "../src/modules/inbox/inbox.models.js";
import { LegalPageModel, LegalVersionModel } from "../src/modules/legal/legal.model.js";
import { renderTokens } from "../src/modules/legal/tokens.js";
import { seedReferenceData } from "../src/modules/seed.js";
import { getSettings } from "../src/modules/settings/settings.model.js";
import { createAdmin, makeApp, signInWith2fa, type Agent } from "./helpers.js";

const app = makeApp();
const A = "/api/v1/admin";
const send = (a: Agent, m: "post" | "patch", p: string) => a.agent[m](A + p).set("X-Forwarded-For", a.ip).set("X-CSRF-Token", a.csrf);
let ipN = 0;
const pub = (path: string) => request(app).post(`/api/v1${path}`).set("X-Forwarded-For", `10.77.0.${++ipN % 250}`);

async function admin() {
  await seedReferenceData();
  await createAdmin("admin", "adm@test.local");
  return signInWith2fa(app, "adm@test.local");
}

describe("legal pages", () => {
  it("tokens render from settings; missing values become visible placeholders", async () => {
    await seedReferenceData();
    const s = await getSettings();
    const r = renderTokens("<p>{{grievanceOfficer.name}} · {{grievanceOfficer.address}} · {{unknown.token}}</p>", s);
    expect(r.html).toContain("Budhi Parkash");
    expect(r.html).toContain("[To be provided]");
    expect(r.html).toContain("{{unknown.token}}");
    expect(r.missing).toEqual(["Grievance Officer postal address"]);
  });

  it("seeded drafts are unpublished; staging warns, production blocks; publishing versions the page", async () => {
    const a = await admin();
    expect(await LegalPageModel.countDocuments({ "workflow.status": "draft" })).toBe(10);
    expect((await request(app).get("/api/v1/legal/privacy-policy")).status).toBe(404);
    const doc = await LegalPageModel.findOne({ slug: "privacy-policy" });
    const checks = await a.agent.get(`${A}/legal/${doc!.id}/checks`).set("X-Forwarded-For", a.ip);
    expect(checks.body.data.blocking).toEqual([]);
    expect(checks.body.data.warnings.join(" ")).toMatch(/legal counsel/);

    const prev = env.SITE_ENV;
    (env as { SITE_ENV: string }).SITE_ENV = "production";
    try {
      expect((await send(a, "post", `/legal/${doc!.id}/workflow`).send({ action: "publish" })).status).toBe(400);
      await send(a, "patch", "/settings").send({ grievanceOfficer: { address: "Postal address, India" }, retentionDays: { contactEnquiries: 180, feedback: 365, reports: 730, ipHashes: 30 } });
      await send(a, "patch", `/legal/${doc!.id}`).send({ reviewedByCounsel: true, effectiveDate: "2026-12-01" });
      const checks2 = await a.agent.get(`${A}/legal/${doc!.id}/checks`).set("X-Forwarded-For", a.ip);
      expect(checks2.body.data.blocking.join(" ")).toMatch(/Legal entity name|Registered address/);
    } finally {
      (env as { SITE_ENV: string }).SITE_ENV = prev;
    }
    expect((await send(a, "post", `/legal/${doc!.id}/workflow`).send({ action: "publish" })).status).toBe(200);
    const page = await request(app).get("/api/v1/legal/privacy-policy");
    expect(page.status).toBe(200);
    expect(page.body.data.contentHtml).toContain("Budhi Parkash");
    expect(page.body.data.version).toBe(1);
    expect(await LegalVersionModel.countDocuments({ slug: "privacy-policy" })).toBe(1);
    // editing content resets the counsel-reviewed flag
    const edited = await send(a, "patch", `/legal/${doc!.id}`).send({ content: "<p>Changed</p>" });
    expect(edited.body.data.reviewedByCounsel).toBe(false);
  });
});

describe("inbox", () => {
  it("feedback: stored; helpful share hidden below the minimum sample", async () => {
    expect((await pub("/feedback").send({ targetType: "sensitivity_config", targetSlug: "x-setup", helpful: true })).status).toBe(201);
    expect((await pub("/feedback").send({ targetType: "article" })).status).toBe(400);
    expect((await pub("/feedback").send({ targetType: "site", message: "hi", contactEmail: "a@b.co" })).status).toBe(400); // email needs consent
    const s1 = await request(app).get("/api/v1/feedback/summary?targetType=sensitivity_config&targetSlug=x-setup");
    expect(s1.body.data).toEqual({ total: 1, helpfulShare: null });
    await FeedbackModel.insertMany(Array.from({ length: 19 }, (_, i) => ({ targetType: "sensitivity_config", targetSlug: "x-setup", helpful: i % 4 !== 0 })));
    const s2 = await request(app).get("/api/v1/feedback/summary?targetType=sensitivity_config&targetSlug=x-setup");
    expect(s2.body.data.total).toBe(20);
    expect(s2.body.data.helpfulShare).toBe(75);
  });

  it("contact needs consent; honeypot blocks bots", async () => {
    const base = { name: "Asha", email: "asha@example.com", subject: "general", message: "Hello, I have a question about tournaments." };
    expect((await pub("/contact").send(base)).status).toBe(400);
    expect((await pub("/contact").send({ ...base, consent: true, website: "spam" })).status).toBe(400);
    expect((await pub("/contact").send({ ...base, consent: true })).status).toBe(201);
    expect(await ContactEnquiryModel.countDocuments()).toBe(1);
  });

  it("reports: ticket number, acknowledgement email, SLA dates, resolution requires a note", async () => {
    const a = await admin();
    sentMail.length = 0;
    const r = await pub("/reports").send({ type: "inaccurate", targetUrl: "/tournaments/some-cup", description: "The dates on this page do not match the official post.", reporterName: "Ravi", reporterEmail: "ravi@example.com", consent: true });
    expect(r.status).toBe(201);
    expect(r.body.data.ticketNo).toMatch(/^SGH-\d{4}-000001$/);
    expect(sentMail[0]!.to).toBe("ravi@example.com");
    const doc = await ReportModel.findOne({ ticketNo: r.body.data.ticketNo });
    expect(doc!.slaDueAt.getTime() - doc!.createdAt.getTime()).toBeGreaterThan(14 * 86_400_000);
    expect((await pub("/reports").send({ type: "other", targetUrl: "https://evil.example/x", description: "x".repeat(30), reporterName: "Z", reporterEmail: "z@z.co", consent: true })).status).toBe(400);
    expect((await send(a, "patch", `/reports/${doc!.id}`).send({ status: "resolved" })).status).toBe(400);
    const done = await send(a, "patch", `/reports/${doc!.id}`).send({ status: "resolved", resolutionNote: "Dates corrected against the organiser's post." });
    expect(done.status).toBe(200);
    expect(done.body.data.resolvedAt).toBeTruthy();
    expect(sentMail.at(-1)!.subject).toMatch(/Update on your report/);
  });

  it("privacy request: email verification → export → erasure", async () => {
    const a = await admin();
    await pub("/contact").send({ name: "Meera", email: "meera@example.com", subject: "general", message: "Please tell me about sensitivity.", consent: true });
    await pub("/reports").send({ type: "privacy", targetUrl: "/news/x/y", description: "My name appears in this article comments.", reporterName: "Meera", reporterEmail: "meera@example.com", consent: true });
    sentMail.length = 0;
    const pr = await pub("/privacy-requests").send({ type: "erasure", email: "Meera@Example.com" });
    expect(pr.status).toBe(201);
    const token = /token=([\w-]+)/.exec(sentMail[0]!.text)![1]!;
    expect((await pub("/privacy-requests/verify").send({ token: "x".repeat(30) })).status).toBe(400);
    expect((await pub("/privacy-requests/verify").send({ token })).status).toBe(200);
    expect((await pub("/privacy-requests/verify").send({ token })).status).toBe(400); // single use
    const list = await a.agent.get(`${A}/privacy-requests?status=open`).set("X-Forwarded-For", a.ip);
    const id = list.body.data[0].id;
    expect(JSON.stringify(list.body.data)).not.toMatch(/verifyTokenHash/);
    const exp = await a.agent.get(`${A}/privacy-requests/${id}/export`).set("X-Forwarded-For", a.ip);
    expect(exp.body.data.data.contactEnquiries).toHaveLength(1);
    expect(exp.body.data.data.reports).toHaveLength(1);
    const er = await send(a, "post", `/privacy-requests/${id}/erase`);
    expect(er.body.data).toEqual({ contactEnquiriesDeleted: 1, feedbackAnonymised: 0, reportsAnonymised: 1 });
    expect(await ContactEnquiryModel.countDocuments({ email: "meera@example.com" })).toBe(0);
    expect((await ReportModel.findOne({}))!.reporterEmail).toBe("erased@invalid.local");
  });

  it("retention sweep honours settings and drops old IP hashes", async () => {
    await seedReferenceData();
    const s = await getSettings();
    s.set("retentionDays.contactEnquiries", 30);
    await s.save();
    const old = new Date(Date.now() - 60 * 86_400_000);
    await ContactEnquiryModel.collection.insertMany([
      { name: "Old", email: "o@x.co", subject: "general", message: "old closed message", consentAt: old, status: "closed", createdAt: old, updatedAt: old, ipHash: "h" },
      { name: "Open", email: "p@x.co", subject: "general", message: "old open message", consentAt: old, status: "new", createdAt: old, updatedAt: old, ipHash: "h" },
    ]);
    registerInboxRetention();
    expect(await runRetentionSweep()).toBeGreaterThanOrEqual(1);
    const left = await ContactEnquiryModel.find().select("+ipHash").lean();
    expect(left.map((x) => x.name)).toEqual(["Open"]);
    expect(left[0]!.ipHash).toBeUndefined();
  });
});
