"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Honeypot } from "./honeypot";
import { postPublic } from "./public-form";
import { Turnstile } from "./turnstile";

export function ReportForm({ initialUrl }: { initialUrl?: string }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [ticket, setTicket] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState("inaccurate");
  const [token, setToken] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const evidence = String(fd.get("evidence") ?? "").split(/\s+/).filter(Boolean).slice(0, 5);
    setBusy(true);
    const r = await postPublic<{ ticketNo: string; message: string }>("/reports", {
      type,
      targetUrl: fd.get("targetUrl"),
      description: fd.get("description"),
      reporterName: fd.get("reporterName"),
      reporterEmail: fd.get("reporterEmail"),
      isRightsHolder: type === "copyright" ? fd.get("isRightsHolder") === "on" : undefined,
      evidenceUrls: evidence,
      consent: fd.get("consent") === "on",
      website: fd.get("website") || undefined,
      ...(token && { turnstileToken: token }),
    });
    setBusy(false);
    setErrors(r.fieldErrors);
    if (r.ok) setTicket(r.data!.ticketNo);
    else setMessage(r.message ?? null);
  };

  if (ticket) {
    return (
      <div role="status" className="rounded-lg border border-success/40 bg-success/10 p-5">
        <p className="font-semibold text-success">Report received</p>
        <p className="mt-1 text-sm">Your ticket number is <strong className="font-mono">{ticket}</strong>. We acknowledge reports within 24 hours and will email you the outcome.</p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="relative flex flex-col gap-4" noValidate>
      <Field id="r-type" label="What's the problem?" required>
        {(a) => (
          <Select {...a} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="inaccurate">Inaccurate or outdated information</option>
            <option value="copyright">Copyright / intellectual property</option>
            <option value="privacy">Privacy — my personal information</option>
            <option value="impersonation">Impersonation</option>
            <option value="offensive">Offensive or harmful content</option>
            <option value="other">Something else</option>
          </Select>
        )}
      </Field>
      <Field id="r-url" label="Page on this website" required error={errors.targetUrl} hint="e.g. /tournaments/some-cup">{(a) => <Input {...a} name="targetUrl" defaultValue={initialUrl} maxLength={500} />}</Field>
      <Field id="r-desc" label="Describe the problem" required error={errors.description}>{(a) => <Textarea {...a} name="description" rows={5} maxLength={3000} />}</Field>
      <Field id="r-evidence" label="Evidence links (optional)" hint="Up to 5 https:// links, separated by spaces." error={errors.evidenceUrls}>{(a) => <Input {...a} name="evidence" />}</Field>
      {type === "copyright" && (
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="isRightsHolder" className="mt-1 size-5 accent-[var(--primary)]" /> I own the rights to this work or am authorised to act for the owner.</label>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="r-name" label="Your name" required error={errors.reporterName}>{(a) => <Input {...a} name="reporterName" autoComplete="name" maxLength={100} />}</Field>
        <Field id="r-email" label="Email" required error={errors.reporterEmail}>{(a) => <Input {...a} name="reporterEmail" type="email" autoComplete="email" maxLength={254} />}</Field>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="consent" className="mt-1 size-5 accent-[var(--primary)]" />
        <span>I agree that my details may be used to handle this report, as described in the <Link href="/legal/privacy-policy" className="text-secondary underline">Privacy Policy</Link>.</span>
      </label>
      {errors.consent && <p role="alert" className="text-xs text-danger">{errors.consent}</p>}
      <Honeypot />
      <Turnstile onToken={setToken} />
      {message && <p role="alert" className="text-sm text-danger">{message}</p>}
      <Button type="submit" loading={busy} className="w-fit">Submit report</Button>
    </form>
  );
}
