"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

interface ApiErr {
  error?: { message?: string; details?: { path: string; message: string }[] };
}

/** Public submission → moderation queue. No account needed; no personal data beyond a display name. */
export function CodeSubmitForm() {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries([...fd.entries()].filter(([, v]) => v !== ""));
    if (body.fps) body.fps = Number(body.fps);
    setState("sending");
    setErrors({});
    setMessage(null);
    try {
      const res = await fetch("/api/v1/sensitivity/codes/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ApiErr & { data?: { message: string } };
      if (!res.ok) {
        setErrors(Object.fromEntries((json.error?.details ?? []).map((d) => [d.path, d.message])));
        setMessage(json.error?.message ?? "Something went wrong.");
        setState("idle");
        return;
      }
      setMessage(json.data?.message ?? "Thanks!");
      setState("done");
    } catch {
      setMessage("Network error — please try again.");
      setState("idle");
    }
  };

  if (state === "done") {
    return (
      <p role="status" className="text-sm text-success">
        {message}
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field id="sc-code" label="Share code" required error={errors.code} hint="Exactly as shown in the game.">
        {(a) => <Input {...a} name="code" maxLength={40} autoComplete="off" className="font-mono" />}
      </Field>
      <Field id="sc-device" label="Phone model" required error={errors.deviceText}>
        {(a) => <Input {...a} name="deviceText" maxLength={80} placeholder="e.g. POCO X6 Pro" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="sc-fps" label="FPS">
          {(a) => (
            <Select {...a} name="fps" defaultValue="">
              <option value="">Not sure</option>
              {[30, 40, 60, 90, 120].map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field id="sc-gyro" label="Gyroscope">
          {(a) => (
            <Select {...a} name="gyroscope" defaultValue="">
              <option value="">Not sure</option>
              <option value="always_on">Always on</option>
              <option value="scope_on">Scope on</option>
              <option value="off">Off</option>
            </Select>
          )}
        </Field>
      </div>
      <Field id="sc-author" label="Your display name" required error={errors.author} hint="Shown publicly. Don't use your real name if you'd rather not.">
        {(a) => <Input {...a} name="author" maxLength={60} autoComplete="nickname" />}
      </Field>
      <Field id="sc-desc" label="Notes (optional)" error={errors.description}>
        {(a) => <Textarea {...a} name="description" maxLength={500} rows={3} />}
      </Field>
      {/* Honeypot: hidden from people; bots tend to fill it */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {message && (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      )}
      <Button type="submit" loading={state === "sending"}>
        Submit for review
      </Button>
      <p className="text-xs text-subtle">By submitting you confirm this is your own code. We review every code before publishing.</p>
    </form>
  );
}
