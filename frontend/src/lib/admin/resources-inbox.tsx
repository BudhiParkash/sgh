import { LegalTokensPanel, SubmissionPanel } from "@/components/admin/panels/inbox-panels";
import { Badge } from "@/components/ui/badge";
import { isoToDateInput, type ResourceDef } from "./resource";

/* eslint-disable @typescript-eslint/no-explicit-any -- admin documents */
type Row = Record<string, any>;
const date = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "—");
const opts = (xs: string[]) => xs.map((x) => ({ value: x, label: x.replace(/_/g, " ") }));
const LEGAL_SLUGS = ["privacy-policy", "terms", "cookie-policy", "disclaimer", "copyright", "grievance", "community-guidelines", "advertising-disclosure", "affiliate-disclosure", "content-reporting"];

export const legal: ResourceDef<Row> = {
  key: "legal",
  title: "Legal pages",
  singular: "Legal page",
  endpoint: "/legal",
  perm: "legal",
  workflow: true,
  revisions: true,
  description: "Drafts describe how the site actually works. Each page must be reviewed by qualified Indian legal counsel (tick the box) before it can be published in production.",
  columns: [
    { key: "title", label: "Page" },
    { key: "slug", label: "URL", render: (r) => <code className="text-xs text-muted">/legal/{r.slug}</code> },
    { key: "reviewedByCounsel", label: "Counsel review", render: (r) => <Badge tone={r.reviewedByCounsel ? "success" : "warning"}>{r.reviewedByCounsel ? "Reviewed" : "Pending"}</Badge> },
    { key: "version", label: "Version" },
  ],
  sections: [
    {
      title: "Page",
      fields: [
        { name: "title", label: "Title", type: "text", required: true, max: 120 },
        { name: "slug", label: "Page", type: "select", required: true, options: LEGAL_SLUGS.map((s) => ({ value: s, label: s })) },
        { name: "effectiveDate", label: "Effective date", type: "date" },
        { name: "reviewedByCounsel", label: "Reviewed and approved by qualified legal counsel", type: "checkbox", hint: "Resets automatically when the text changes." },
        { name: "changeSummary", label: "Summary of changes (for this version)", type: "textarea", max: 500, wide: true },
        { name: "content", label: "Text", type: "richtext", required: true },
      ],
    },
  ],
  toForm: (d) => ({ ...d, effectiveDate: isoToDateInput(d.effectiveDate) }),
  titleOf: (r) => r.title,
  publicUrl: (r) => `/legal/${r.slug}`,
  sidePanel: () => <LegalTokensPanel />,
};

const inbox = (cfg: { key: string; title: string; singular: string; endpoint: string; perm: string; kind: "feedback" | "enquiry" | "report" | "privacy"; statuses: string[]; columns: ResourceDef<Row>["columns"]; extraFields?: ResourceDef<Row>["sections"][number]["fields"]; description: string }): ResourceDef<Row> => ({
  key: cfg.key,
  title: cfg.title,
  singular: cfg.singular,
  endpoint: cfg.endpoint,
  perm: cfg.perm,
  canCreate: false,
  softDelete: false,
  description: cfg.description,
  filters: [{ name: "status", label: "Status", options: opts(cfg.statuses) }],
  columns: [...cfg.columns, { key: "status", label: "Status", render: (r) => <Badge tone={["new", "received", "unverified"].includes(r.status) ? "warning" : ["closed", "resolved", "completed", "actioned"].includes(r.status) ? "success" : "neutral"} className="capitalize">{String(r.status).replace(/_/g, " ")}</Badge> }],
  sections: [{ title: "Handling", fields: [{ name: "status", label: "Status", type: "select", required: true, options: opts(cfg.statuses) }, ...(cfg.extraFields ?? [])] }],
  toForm: (d) => ({ status: d.status, resolutionNote: d.resolutionNote ?? "", note: "" }),
  titleOf: (r) => r.ticketNo ?? r.name ?? `${r.targetType} feedback`,
  sidePanel: (doc) => <SubmissionPanel doc={doc} kind={cfg.kind} />,
});

const note = { name: "note", label: "Add internal note", type: "textarea" as const, max: 1000, wide: true };
const resolution = { name: "resolutionNote", label: "Resolution (sent to the person when resolved/rejected/completed)", type: "textarea" as const, max: 2000, wide: true };

export const feedback = inbox({ key: "feedback", title: "Feedback", singular: "Feedback", endpoint: "/feedback", perm: "feedback", kind: "feedback", statuses: ["new", "reviewed", "actioned", "spam"], description: "“Was this helpful?” answers and comments. Shares are shown publicly only after 20+ answers.", columns: [{ key: "createdAt", label: "Received", render: (r) => date(r.createdAt) }, { key: "targetSlug", label: "Page", render: (r) => r.targetSlug ?? r.targetType }, { key: "helpful", label: "Helpful", render: (r) => (r.helpful === undefined ? "—" : r.helpful ? "👍" : "👎") }, { key: "message", label: "Comment", render: (r) => <span className="line-clamp-1">{r.message ?? "—"}</span> }] });
export const enquiries = inbox({ key: "enquiries", title: "Contact enquiries", singular: "Enquiry", endpoint: "/enquiries", perm: "enquiry", kind: "enquiry", statuses: ["new", "in_progress", "closed"], description: "Messages from the contact form. Reply by email, then close.", columns: [{ key: "name", label: "From" }, { key: "subject", label: "Topic" }, { key: "createdAt", label: "Received", render: (r) => date(r.createdAt) }], extraFields: [note] });
export const reports = inbox({ key: "reports", title: "Content reports", singular: "Report", endpoint: "/reports", perm: "report", kind: "report", statuses: ["received", "acknowledged", "under_review", "resolved", "rejected"], description: "Acknowledge within 24 hours; resolve within 15 days (IT Rules). The reporter is emailed on resolution.", columns: [{ key: "ticketNo", label: "Ticket", render: (r) => <code>{r.ticketNo}</code> }, { key: "type", label: "Type" }, { key: "slaDueAt", label: "Resolve by", render: (r) => date(r.slaDueAt) }], extraFields: [resolution, note] });
export const privacyRequests = inbox({ key: "privacy-requests", title: "Privacy requests", singular: "Privacy request", endpoint: "/privacy-requests", perm: "privacy_request", kind: "privacy", statuses: ["unverified", "open", "completed", "rejected"], description: "Data-principal requests (DPDP Act). Act only on verified requests.", columns: [{ key: "ticketNo", label: "Ticket", render: (r) => <code>{r.ticketNo}</code> }, { key: "type", label: "Request" }, { key: "dueAt", label: "Respond by", render: (r) => date(r.dueAt) }], extraFields: [resolution, note] });
