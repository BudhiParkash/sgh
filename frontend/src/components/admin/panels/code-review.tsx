"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { ApiError, adminFetch } from "@/lib/admin/api";
import { useAdmin } from "@/lib/admin/context";
import { useToast } from "@/lib/admin/toast";

/* eslint-disable @typescript-eslint/no-explicit-any -- admin document */
export function CodeReviewPanel({ doc, onChanged }: { doc: any; onChanged: (d: any) => void }) {
  const { can } = useAdmin();
  const toast = useToast();
  const [note, setNote] = useState("");
  const tone = { pending: "warning", verified: "success", rejected: "danger", expired: "neutral" } as const;
  const act = async (action: "verify" | "reject" | "expire") => {
    try {
      const d = (await adminFetch<any>(`/sensitivity-codes/${doc.id}/${action}`, { method: "POST", body: { note: note || undefined } })).data;
      toast({ tone: "success", title: `Code ${d.status}` });
      onChanged(d);
    } catch (e) {
      toast({ tone: "error", title: "Action failed", description: e instanceof ApiError ? e.message : undefined });
    }
  };
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between"><h2 className="font-semibold">Review</h2><Badge tone={tone[doc.status as keyof typeof tone] ?? "neutral"} className="capitalize">{doc.status}</Badge></div>
      <p className="text-sm text-muted">Only verify a code after importing it in-game and checking it loads the described settings.</p>
      {can("sensitivity_code:verify") && (
        <>
          <Input aria-label="Review note (optional)" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          <div className="flex flex-wrap gap-2">
            {doc.status !== "verified" && <Button type="button" size="sm" onClick={() => act("verify")}>Verify &amp; publish</Button>}
            {doc.status !== "rejected" && <Button type="button" size="sm" variant="ghost" onClick={() => act("reject")}>Reject</Button>}
            {doc.status === "verified" && <Button type="button" size="sm" variant="secondary" onClick={() => act("expire")}>Mark expired</Button>}
          </div>
        </>
      )}
    </Card>
  );
}
