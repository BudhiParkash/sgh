"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { FieldRenderer } from "@/components/admin/form-fields";
import { cleanPayload } from "@/components/admin/resource-editor";
import { PageHeader } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, adminFetch, applyFieldErrors } from "@/lib/admin/api";
import { useAdmin } from "@/lib/admin/context";
import type { FieldDef } from "@/lib/admin/resource";
import { useToast } from "@/lib/admin/toast";

const SECTIONS: { title: string; note?: string; fields: FieldDef[] }[] = [
  { title: "Identity", fields: [
    { name: "siteName", label: "Site name", type: "text", max: 80 },
    { name: "owner", label: "Owner (shown on About page)", type: "text", max: 120 },
    { name: "tagline", label: "Tagline", type: "textarea", max: 200, rows: 2 },
  ] },
  { title: "Public contact", fields: [
    { name: "contact.name", label: "Contact person", type: "text", max: 120 },
    { name: "contact.email", label: "Contact email", type: "email" },
    { name: "contact.phone", label: "Phone (optional)", type: "text", max: 30 },
  ] },
  { title: "Grievance Officer", note: "Required by the IT Rules before launch. The Grievance Redressal page can't be published to production until name, email and postal address are filled.", fields: [
    { name: "grievanceOfficer.name", label: "Name", type: "text", max: 120 },
    { name: "grievanceOfficer.email", label: "Email", type: "email" },
    { name: "grievanceOfficer.address", label: "Postal address", type: "textarea", max: 400, rows: 3 },
  ] },
  { title: "Legal entity (if any)", note: "Leave empty if not applicable. Never enter values you don't have.", fields: [
    { name: "company.legalName", label: "Legal name", type: "text", max: 200 },
    { name: "company.entityType", label: "Entity type", type: "text", max: 60, placeholder: "e.g. Individual / Proprietorship / LLP / Pvt Ltd" },
    { name: "company.cin", label: "CIN / LLPIN", type: "text", max: 30 },
    { name: "company.gstin", label: "GSTIN", type: "text", max: 15 },
    { name: "company.registeredAddress", label: "Registered address", type: "textarea", max: 400, rows: 3 },
    { name: "company.jurisdiction", label: "Court jurisdiction city (for Terms)", type: "text", max: 120, hint: "Confirm with legal counsel." },
  ] },
  { title: "Official social channels", fields: [
    { name: "socials.youtube", label: "YouTube", type: "url" },
    { name: "socials.instagram", label: "Instagram", type: "url" },
    { name: "socials.instagramChannel", label: "Instagram channel", type: "url" },
    { name: "socials.facebook", label: "Facebook", type: "url" },
    { name: "socials.discord", label: "Discord", type: "url" },
    { name: "socials.telegram", label: "Telegram", type: "url" },
    { name: "socials.x", label: "X (Twitter)", type: "url" },
  ] },
  { title: "Analytics & verification", note: "Analytics load only after visitor consent.", fields: [
    { name: "analytics.ga4Id", label: "GA4 measurement ID", type: "text", placeholder: "G-XXXXXXXXXX" },
    { name: "analytics.gscVerification", label: "Google Search Console verification token", type: "text" },
    { name: "analytics.bingVerification", label: "Bing Webmaster verification token", type: "text" },
  ] },
  { title: "Advertising", note: "Personalised ads stay off by default (audience may include minors — DPDP Act). Change only on legal advice.", fields: [
    { name: "ads.enabled", label: "Enable advertising slots", type: "checkbox" },
    { name: "ads.gamNetworkCode", label: "Google Ad Manager network code", type: "text" },
    { name: "ads.personalizedAds", label: "Allow personalised ads (requires consent)", type: "checkbox" },
  ] },
  { title: "Site", fields: [
    { name: "disclaimerText", label: "Independence disclaimer", type: "textarea", max: 600, rows: 3 },
    { name: "maintenanceMode", label: "Maintenance mode (shows a notice to visitors)", type: "checkbox" },
  ] },
  { title: "Data retention (days, 0 = keep until deleted)", note: "Set together with legal counsel; the nightly job deletes older records.", fields: [
    { name: "retentionDays.contactEnquiries", label: "Contact enquiries", type: "number", min: 0, max: 3650 },
    { name: "retentionDays.feedback", label: "Feedback", type: "number", min: 0, max: 3650 },
    { name: "retentionDays.reports", label: "Content reports", type: "number", min: 0, max: 3650 },
    { name: "retentionDays.privacyRequests", label: "Privacy requests", type: "number", min: 0, max: 3650 },
    { name: "retentionDays.ipHashes", label: "Hashed IP addresses", type: "number", min: 1, max: 365 },
  ] },
];

const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);

export default function SettingsPage() {
  const { can } = useAdmin();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["settings"], queryFn: async () => (await adminFetch<Record<string, unknown> & { version: number }>("/settings")).data });
  const form = useForm<Record<string, unknown>>({ defaultValues: {} });
  useEffect(() => {
    if (q.data) form.reset(q.data);
  }, [q.data, form]);
  const save = useMutation({
    mutationFn: async (v: Record<string, unknown>) => {
      const payload = cleanPayload(ALL_FIELDS, v);
      // empty strings are meaningful here (clearing a value) — send them back as ""
      for (const f of ALL_FIELDS) {
        const [a, b] = f.name.split(".");
        const val = b ? (v[a!] as Record<string, unknown> | undefined)?.[b] : v[a!];
        if (val === "" && f.type !== "number") {
          if (b) ((payload[a!] ??= {}) as Record<string, unknown>)[b] = "";
          else payload[a!] = "";
        }
      }
      return (await adminFetch<Record<string, unknown> & { version: number }>("/settings", { method: "PATCH", body: payload, ifMatch: q.data?.version })).data;
    },
    onSuccess: (d) => {
      qc.setQueryData(["settings"], d);
      form.reset(d);
      toast({ tone: "success", title: "Settings saved" });
    },
    onError: (e) => {
      applyFieldErrors(e, form.setError as never);
      toast({ tone: "error", title: "Couldn't save settings", description: e instanceof ApiError ? e.message : undefined });
    },
  });
  if (q.isLoading) return <Skeleton className="h-96" />;
  const readOnly = !can("settings:update");
  return (
    <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
      <PageHeader title="Website settings" actions={!readOnly && <Button type="submit" loading={save.isPending} disabled={!form.formState.isDirty}><Save aria-hidden="true" /> Save</Button>} />
      <fieldset disabled={readOnly} className="flex flex-col gap-6">
        {SECTIONS.map((s) => (
          <Card key={s.title} className="p-5">
            <h2 className="font-semibold">{s.title}</h2>
            {s.note && <p className="mt-1 text-sm text-muted">{s.note}</p>}
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              {s.fields.map((f) => <FieldRenderer key={f.name} f={f} control={form.control} register={form.register} errors={form.formState.errors} />)}
            </div>
          </Card>
        ))}
      </fieldset>
    </form>
  );
}
