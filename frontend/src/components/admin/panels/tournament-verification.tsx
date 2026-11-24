"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/field";
import { ApiError, adminFetch } from "@/lib/admin/api";
import { useAdmin } from "@/lib/admin/context";
import { useToast } from "@/lib/admin/toast";
import { formatAdminDate } from "../ui";

/* eslint-disable @typescript-eslint/no-explicit-any -- admin document */
export function TournamentVerificationPanel({ doc, onChanged }: { doc: any; onChanged: (d: any) => void }) {
  const { can } = useAdmin();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [confidence, setConfidence] = useState("high");
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());
  const v = doc.verification ?? {};
  const official = (doc.sources ?? []).filter((s: any) => s.type === "official").length;
  const ageDays = v.lastVerifiedAt ? Math.floor((now - new Date(v.lastVerifiedAt).getTime()) / 86_400_000) : null;

  const submit = async () => {
    setBusy(true);
    try {
      const d = (await adminFetch<any>(`/tournaments/${doc.id}/verify`, { method: "POST", body: { notes, confidence } })).data;
      toast({ tone: "success", title: "Verification recorded" });
      onChanged(d);
      setOpen(false);
      setNotes("");
    } catch (e) {
      toast({ tone: "error", title: "Couldn't record verification", description: e instanceof ApiError ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4" aria-hidden="true" /> Verification</h2>
      <p className="text-sm">
        Official sources: <Badge tone={official ? "success" : "danger"}>{official}</Badge>
      </p>
      {v.lastVerifiedAt ? (
        <div className="text-sm">
          <p>Last verified {formatAdminDate(v.lastVerifiedAt)} {ageDays !== null && ageDays > 7 && <Badge tone="warning">{ageDays} days ago</Badge>}</p>
          <p className="text-muted">Confidence: {v.confidence ?? "—"}</p>
          {v.notes && <p className="mt-1 text-muted">“{v.notes}”</p>}
        </div>
      ) : (
        <p className="text-sm text-warning">Not verified yet. Only rumours can be published without verification.</p>
      )}
      <p className="text-xs text-subtle">A Google search result is not a source — link the organiser&apos;s or KRAFTON&apos;s own post, reel or page.</p>
      {can("tournament:verify") && (
        <Button type="button" size="sm" variant="secondary" disabled={!official} onClick={() => setOpen(true)}>Record verification</Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Record verification" description="Confirm you checked the official sources today.">
          <div className="flex flex-col gap-4">
            <Field id="ver-notes" label="What did you check?" required hint="e.g. Dates and format match the organiser's Instagram post of 20 Nov.">
              {(a) => <Textarea {...a} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={600} />}
            </Field>
            <Field id="ver-conf" label="Confidence">
              {(a) => (
                <Select {...a} value={confidence} onChange={(e) => setConfidence(e.target.value)}>
                  <option value="high">High — official post states all details</option>
                  <option value="medium">Medium — some details pending</option>
                  <option value="low">Low — limited information</option>
                </Select>
              )}
            </Field>
            <Button onClick={submit} loading={busy} disabled={notes.trim().length < 5}>Save verification</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
