"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ApiError } from "@/lib/admin/api";

/** Small dialog that collects one text value (reason, voucher code…) and runs an action. */
export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  multiline,
  confirmLabel = "Confirm",
  danger,
  minLength = 3,
  extra,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  label: string;
  multiline?: boolean;
  confirmLabel?: string;
  danger?: boolean;
  minLength?: number;
  extra?: React.ReactNode;
  onSubmit: (value: string) => Promise<unknown>;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setValue("");
          setErr(null);
        }
      }}
    >
      <DialogContent title={title} description={description}>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErr(null);
            try {
              await onSubmit(value.trim());
              setValue("");
              onOpenChange(false);
            } catch (e2) {
              setErr(e2 instanceof ApiError ? (e2.details[0]?.message ?? e2.message) : "Failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          {extra}
          <Field id="prompt-value" label={label} required>
            {(a) => (multiline ? <Textarea {...a} rows={3} value={value} onChange={(e) => setValue(e.target.value)} /> : <Input {...a} value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" />)}
          </Field>
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
          <Button type="submit" variant={danger ? "danger" : "primary"} loading={busy} disabled={value.trim().length < minLength}>{confirmLabel}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** datetime-local value (IST) ⇄ ISO helpers — admin enters times in India time. */
const IST = 5.5 * 3_600_000;
export const toIstInput = (iso: string | null | undefined) => (iso ? new Date(Date.parse(iso) + IST).toISOString().slice(0, 16) : "");
export const fromIstInput = (v: string) => (v ? new Date(Date.parse(`${v}:00Z`) - IST).toISOString() : "");
