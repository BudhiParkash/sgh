import { ContactEnquiryModel, FeedbackModel, PrivacyRequestModel, ReportModel } from "../modules/inbox/inbox.models.js";
import { getSettings } from "../modules/settings/settings.model.js";
import { registerRetentionRule } from "./retention.js";

const ago = (days: number) => new Date(Date.now() - days * 86_400_000);

/** Retention periods come from Settings (set with legal counsel). 0 = keep until manually deleted. */
export function registerInboxRetention() {
  registerRetentionRule(async () => {
    const s = (await getSettings()).retentionDays ?? ({} as Record<string, number>);
    let n = 0;
    if (s.contactEnquiries) n += (await ContactEnquiryModel.deleteMany({ status: "closed", updatedAt: { $lt: ago(s.contactEnquiries) } })).deletedCount;
    if (s.feedback) n += (await FeedbackModel.deleteMany({ createdAt: { $lt: ago(s.feedback) } })).deletedCount;
    if (s.reports) n += (await ReportModel.deleteMany({ status: { $in: ["resolved", "rejected"] }, updatedAt: { $lt: ago(s.reports) } })).deletedCount;
    if (s.privacyRequests) n += (await PrivacyRequestModel.deleteMany({ status: { $in: ["completed", "rejected"] }, updatedAt: { $lt: ago(s.privacyRequests) } })).deletedCount;
    // Unverified privacy requests expire after 7 days.
    n += (await PrivacyRequestModel.deleteMany({ status: "unverified", createdAt: { $lt: ago(7) } })).deletedCount;
    // Hashed IPs are kept only for the configured window.
    const ipDays = s.ipHashes || 30;
    for (const m of [ContactEnquiryModel, FeedbackModel, ReportModel, PrivacyRequestModel]) await (m as typeof FeedbackModel).updateMany({ createdAt: { $lt: ago(ipDays) }, ipHash: { $exists: true } }, { $unset: { ipHash: 1 } });
    return n;
  });
}
