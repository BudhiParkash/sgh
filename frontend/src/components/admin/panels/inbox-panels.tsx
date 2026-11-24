"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { adminFetch } from "@/lib/admin/api";
import { useAdmin } from "@/lib/admin/context";
import { useToast } from "@/lib/admin/toast";
import { ConfirmButton, formatAdminDate } from "../ui";

/* eslint-disable @typescript-eslint/no-explicit-any -- admin documents */
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex flex-col gap-0.5"><dt className="text-xs text-subtle">{k}</dt><dd className="text-sm break-words whitespace-pre-line">{v || "—"}</dd></div>;
}
function Notes({ notes }: { notes?: any[] }) {
  if (!notes?.length) return null;
  return (
    <div className="mt-3 border-t border-border pt-3">
      <h3 className="mb-2 text-xs font-semibold tracking-wider text-subtle uppercase">Internal notes</h3>
      <ul className="flex flex-col gap-2 text-sm">{notes.map((n, i) => <li key={i}><span className="text-xs text-subtle">{n.byName} · {formatAdminDate(n.at)}</span><p>{n.text}</p></li>)}</ul>
    </div>
  );
}

export function SubmissionPanel({ doc, kind }: { doc: any; kind: "feedback" | "enquiry" | "report" | "privacy" }) {
  const [now] = useState(() => Date.now());
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="font-semibold">Submission</h2>
      <dl className="flex flex-col gap-3">
        {kind === "feedback" && <>
          <Row k="Page" v={`${doc.targetType} / ${doc.targetSlug ?? "—"}`} />
          <Row k="Helpful" v={doc.helpful === undefined ? "—" : doc.helpful ? "Yes" : "No"} />
          <Row k="Message" v={doc.message} />
          <Row k="Reply email (consented)" v={doc.contactEmail} />
        </>}
        {kind === "enquiry" && <>
          <Row k="From" v={`${doc.name} <${doc.email}>`} />
          <Row k="Topic" v={doc.subject} />
          <Row k="Message" v={doc.message} />
          <a className="text-sm text-secondary underline" href={`mailto:${doc.email}?subject=${encodeURIComponent("Re: your message to Shivanshi Gaming Hub")}`}>Reply by email</a>
        </>}
        {kind === "report" && <>
          <Row k="Ticket" v={<code>{doc.ticketNo}</code>} />
          <Row k="Type" v={doc.type} />
          <Row k="Page" v={<a href={doc.targetUrl} target="_blank" rel="noopener noreferrer" className="text-secondary underline">{doc.targetUrl}</a>} />
          <Row k="Description" v={doc.description} />
          <Row k="Reporter" v={`${doc.reporterName} <${doc.reporterEmail}>`} />
          {doc.isRightsHolder !== undefined && <Row k="Rights holder" v={doc.isRightsHolder ? "Yes" : "No"} />}
          {doc.evidenceUrls?.length > 0 && <Row k="Evidence" v={doc.evidenceUrls.join("\n")} />}
          <Row k="Acknowledge by" v={<span className={!doc.acknowledgedAt && new Date(doc.ackDueAt).getTime() < now ? "text-danger" : undefined}>{formatAdminDate(doc.ackDueAt)}{doc.acknowledgedAt && " ✓"}</span>} />
          <Row k="Resolve by" v={<span className={!doc.resolvedAt && new Date(doc.slaDueAt).getTime() < now ? "text-danger" : undefined}>{formatAdminDate(doc.slaDueAt)}{doc.resolvedAt && " ✓"}</span>} />
        </>}
        {kind === "privacy" && <>
          <Row k="Ticket" v={<code>{doc.ticketNo}</code>} />
          <Row k="Request" v={doc.type} />
          <Row k="Email" v={doc.email} />
          <Row k="Verified" v={doc.verifiedAt ? formatAdminDate(doc.verifiedAt) : <Badge tone="warning">Not verified</Badge>} />
          <Row k="Respond by" v={formatAdminDate(doc.dueAt)} />
          <Row k="Details" v={doc.details} />
        </>}
        <Row k="Received" v={formatAdminDate(doc.createdAt)} />
      </dl>
      <Notes notes={doc.notes} />
      {kind === "privacy" && <PrivacyActions doc={doc} />}
    </Card>
  );
}

function PrivacyActions({ doc }: { doc: any }) {
  const { can } = useAdmin();
  const toast = useToast();
  if (!doc.verifiedAt) return <p className="text-xs text-warning">Actions become available after the requester confirms by email.</p>;
  const exportData = async () => {
    const r = await adminFetch<unknown>(`/privacy-requests/${doc.id}/export`);
    const url = URL.createObjectURL(new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.ticketNo}-data.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="flex flex-wrap gap-2 border-t border-border pt-3">
      <Button type="button" size="sm" variant="secondary" onClick={exportData}><Download aria-hidden="true" /> Export data (JSON)</Button>
      {doc.type === "erasure" && can("privacy_request:update") && (
        <ConfirmButton title="Erase this person's data?" description="Deletes their contact enquiries and anonymises feedback and reports. This can't be undone." confirmLabel="Erase" onConfirm={async () => {
          const r = await adminFetch<Record<string, number>>(`/privacy-requests/${doc.id}/erase`, { method: "POST" });
          toast({ tone: "success", title: "Data erased", description: Object.entries(r.data).map(([k, v]) => `${k}: ${v}`).join(", ") });
        }}><Trash2 aria-hidden="true" /> Erase data</ConfirmButton>
      )}
    </div>
  );
}

export function LegalTokensPanel() {
  const q = useQuery({ queryKey: ["legal-tokens"], queryFn: async () => (await adminFetch<{ key: string; label: string; value: string | null }[]>("/legal/tokens")).data });
  return (
    <Card className="p-4 text-sm">
      <h2 className="mb-1 font-semibold">Placeholders</h2>
      <p className="mb-3 text-xs text-muted">Type a token like <code>{"{{contact.email}}"}</code> in the text. Values come from Settings; missing ones show “[To be provided]” and block production publishing.</p>
      <ul className="flex flex-col gap-1.5">
        {q.data?.map((t) => (
          <li key={t.key} className="flex flex-col">
            <code className="text-xs">{`{{${t.key}}}`}</code>
            <span className={t.value ? "text-xs text-muted" : "text-xs text-warning"}>{t.value ?? "missing — set in Settings"}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
