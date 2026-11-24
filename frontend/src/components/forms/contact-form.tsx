"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Honeypot } from "./honeypot";
import { postPublic } from "./public-form";
import { Turnstile } from "./turnstile";

export function ContactForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const r = await postPublic<{ message: string }>("/contact", { name: fd.get("name"), email: fd.get("email"), subject: fd.get("subject"), message: fd.get("message"), consent: fd.get("consent") === "on", website: fd.get("website") || undefined, ...(token && { turnstileToken: token }) });
    setBusy(false);
    setErrors(r.fieldErrors);
    setMessage(r.ok ? (r.data?.message ?? "Sent") : (r.message ?? null));
    setDone(r.ok);
  };
  if (done) return <p role="status" className="rounded-lg border border-success/40 bg-success/10 p-4 text-success">{message}</p>;
  return (
    <form onSubmit={submit} className="relative flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="c-name" label="Your name" required error={errors.name}>{(a) => <Input {...a} name="name" autoComplete="name" maxLength={100} />}</Field>
        <Field id="c-email" label="Email" required error={errors.email}>{(a) => <Input {...a} name="email" type="email" autoComplete="email" maxLength={254} />}</Field>
      </div>
      <Field id="c-subject" label="Topic" required error={errors.subject}>
        {(a) => (
          <Select {...a} name="subject" defaultValue="general">
            <option value="general">General question</option>
            <option value="correction">Correction to a page</option>
            <option value="advertising">Advertising</option>
            <option value="partnership">Partnership / sponsorship</option>
            <option value="privacy">Privacy</option>
            <option value="other">Something else</option>
          </Select>
        )}
      </Field>
      <Field id="c-message" label="Message" required error={errors.message}>{(a) => <Textarea {...a} name="message" rows={6} maxLength={3000} />}</Field>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="consent" className="mt-1 size-5 accent-[var(--primary)]" aria-describedby="c-consent-err" />
        <span>I agree that Shivanshi Gaming Hub may use my name and email to reply to this message, as described in the <Link href="/legal/privacy-policy" className="text-secondary underline">Privacy Policy</Link>.</span>
      </label>
      {errors.consent && <p id="c-consent-err" role="alert" className="text-xs text-danger">{errors.consent}</p>}
      <Honeypot />
      <Turnstile onToken={setToken} />
      {message && <p role="alert" className="text-sm text-danger">{message}</p>}
      <Button type="submit" loading={busy} className="w-fit">Send message</Button>
    </form>
  );
}
