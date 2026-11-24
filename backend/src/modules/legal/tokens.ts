import type { getSettings } from "../settings/settings.model.js";

type Settings = Awaited<ReturnType<typeof getSettings>>;

/**
 * Legal drafts reference business facts as tokens (e.g. {{grievanceOfficer.address}}) so nothing is
 * hard-coded or invented. Values come from Settings; missing ones render as a visible placeholder.
 */
export const TOKENS: Record<string, { label: string; get: (s: Settings) => string | undefined }> = {
  "site.name": { label: "Site name", get: (s) => s.siteName },
  "site.url": { label: "Site URL", get: () => "https://shivanshigaming.com" },
  owner: { label: "Owner", get: (s) => s.owner },
  "company.legalName": { label: "Legal entity name", get: (s) => s.company?.legalName || undefined },
  "company.registeredAddress": { label: "Registered address", get: (s) => s.company?.registeredAddress || undefined },
  "legal.jurisdiction": { label: "Court jurisdiction (city)", get: (s) => s.company?.jurisdiction || undefined },
  "contact.email": { label: "Contact email", get: (s) => s.contact?.email || undefined },
  "grievanceOfficer.name": { label: "Grievance Officer name", get: (s) => s.grievanceOfficer?.name || undefined },
  "grievanceOfficer.email": { label: "Grievance Officer email", get: (s) => s.grievanceOfficer?.email || undefined },
  "grievanceOfficer.address": { label: "Grievance Officer postal address", get: (s) => s.grievanceOfficer?.address || undefined },
  "retention.contactEnquiries": { label: "Retention: contact enquiries", get: (s) => days(s.retentionDays?.contactEnquiries) },
  "retention.feedback": { label: "Retention: feedback", get: (s) => days(s.retentionDays?.feedback) },
  "retention.reports": { label: "Retention: reports", get: (s) => days(s.retentionDays?.reports) },
  "retention.ipHashes": { label: "Retention: hashed IPs", get: (s) => days(s.retentionDays?.ipHashes) },
};

function days(n: number | null | undefined): string | undefined {
  if (n === undefined || n === null) return undefined;
  return n === 0 ? undefined : `${n} days`;
}

const escape = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const PLACEHOLDER = "[To be provided]";

/** Replaces tokens; returns the rendered HTML and the labels of any values still missing. */
export function renderTokens(html: string, settings: Settings): { html: string; missing: string[] } {
  const missing = new Set<string>();
  const out = html.replace(/\{\{\s*([a-zA-Z.]+)\s*\}\}/g, (m, key: string) => {
    const t = TOKENS[key];
    if (!t) return m;
    const v = t.get(settings);
    if (!v) {
      missing.add(t.label);
      return `<mark data-placeholder="${escape(key)}">${PLACEHOLDER}</mark>`;
    }
    return escape(v).replace(/\n/g, "<br>");
  });
  return { html: out, missing: [...missing] };
}
