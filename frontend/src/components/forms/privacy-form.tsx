"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Honeypot } from "./honeypot";
import { postPublic } from "./public-form";
import { Turnstile } from "./turnstile";

export function PrivacyRequestForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const r = await postPublic<{ ticketNo: string; message: string }>("/privacy-requests", { type: fd.get("type"), email: fd.get("email"), details: fd.get("details") || undefined, website: fd.get("website") || undefined, ...(token && { turnstileToken: token }) });
    setBusy(false);
    setErrors(r.fieldErrors);
    if (r.ok) setDone(`${r.data!.message} Reference: ${r.data!.ticketNo}`);
    else setMessage(r.message ?? null);
  };
  if (done) return <p role="status" className="rounded-lg border border-success/40 bg-success/10 p-4 text-success">{done}</p>;
  return (
    <form onSubmit={submit} className="relative flex flex-col gap-4" noValidate>
      <Field id="p-type" label="Request" required>
        {(a) => (
          <Select {...a} name="type" defaultValue="access">
            <option value="access">Get a copy of my data</option>
            <option value="correction">Correct my data</option>
            <option value="erasure">Delete my data</option>
            <option value="withdraw_consent">Withdraw consent</option>
            <option value="nominate">Nominate someone to act for me</option>
            <option value="grievance">Raise a privacy grievance</option>
          </Select>
        )}
      </Field>
      <Field id="p-email" label="Email address you used with us" required error={errors.email} hint="We'll send a confirmation link to this address.">{(a) => <Input {...a} name="email" type="email" autoComplete="email" maxLength={254} />}</Field>
      <Field id="p-details" label="Details (optional)" error={errors.details}>{(a) => <Textarea {...a} name="details" rows={4} maxLength={2000} />}</Field>
      <Honeypot />
      <Turnstile onToken={setToken} />
      {message && <p role="alert" className="text-sm text-danger">{message}</p>}
      <Button type="submit" loading={busy} className="w-fit">Send request</Button>
    </form>
  );
}

export function PrivacyVerify({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "busy" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const confirm = async () => {
    setState("busy");
    const r = await postPublic<{ message: string }>("/privacy-requests/verify", { token });
    setState(r.ok ? "ok" : "error");
    setMessage(r.ok ? r.data!.message : (r.message ?? "Failed"));
  };
  if (state === "ok" || state === "error") return <p role="status" className={state === "ok" ? "text-success" : "text-danger"}>{message}</p>;
  return <Button onClick={confirm} loading={state === "busy"}>Confirm my request</Button>;
}
