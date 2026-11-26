"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { PageHeader, Pager, formatAdminDate } from "@/components/admin/ui";
import { PromptDialog } from "@/components/admin/play-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { adminFetch } from "@/lib/admin/api";
import { useAdmin } from "@/lib/admin/context";
import { useToast } from "@/lib/admin/toast";

interface Row {
  id: string;
  rewardTitle: string;
  cost: number;
  status: "pending" | "fulfilled" | "rejected";
  playerNote: string;
  adminNote: string;
  createdAt: string;
  handledAt?: string;
  player?: { id: string; email: string; ign: string; characterId: string; status: string; accountAgeDays: number };
  relatedAccounts: number;
}

export default function RedemptionsPage() {
  const { can } = useAdmin();
  const toast = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState<Row["status"]>("pending");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<null | { kind: "fulfil" | "reject"; row: Row }>(null);
  const q = useQuery({ queryKey: ["redemptions", status, page], queryFn: () => adminFetch<Row[]>("/redemptions", { query: { status, page } }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["redemptions"] });

  return (
    <div>
      <PageHeader title="Redemptions" description="Players' reward requests. Check the risk signals, then send the official voucher code (the player sees it in their account) or reject (coins are refunded)." />
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Status">
        {(["pending", "fulfilled", "rejected"] as const).map((s) => (
          <Button key={s} role="tab" aria-selected={status === s} size="sm" variant={status === s ? "primary" : "secondary"} onClick={() => { setStatus(s); setPage(1); }}>
            {s === "pending" ? "Pending" : s === "fulfilled" ? "Delivered" : "Rejected"}
          </Button>
        ))}
      </div>
      {q.isLoading ? (
        <Skeleton className="h-40" />
      ) : !q.data?.data.length ? (
        <Card className="p-6 text-sm text-muted">Nothing here.</Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {q.data.data.map((r) => {
            const risky = r.relatedAccounts > 0 || (r.player?.accountAgeDays ?? 0) < 14;
            return (
              <li key={r.id}>
                <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-col gap-1">
                    <p className="font-semibold">{r.rewardTitle} <span className="text-sm font-normal text-muted">· {r.cost.toLocaleString("en-IN")} SGC · {formatAdminDate(r.createdAt)}</span></p>
                    {r.player && (
                      <p className="text-sm">
                        <Link href={`/admin/players?id=${r.player.id}`} className="text-secondary underline">{r.player.ign || r.player.email}</Link>
                        <span className="text-muted"> · {r.player.email} · Character ID <span className="font-mono text-text">{r.player.characterId || "—"}</span> · account {r.player.accountAgeDays} days old</span>
                      </p>
                    )}
                    {risky && (
                      <p className="flex items-center gap-1.5 text-sm text-warning">
                        <AlertTriangle className="size-4" aria-hidden="true" />
                        {r.relatedAccounts > 0 ? `${r.relatedAccounts} other account(s) from the same network` : "New account"} — check before sending.
                      </p>
                    )}
                    {r.playerNote && <p className="text-sm text-muted">Player note: {r.playerNote}</p>}
                    {r.adminNote && <p className="text-sm text-muted">Note: {r.adminNote}</p>}
                  </div>
                  {r.status === "pending" && can("redemption:update") ? (
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" onClick={() => setDialog({ kind: "fulfil", row: r })}>Send code</Button>
                      <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDialog({ kind: "reject", row: r })}>Reject</Button>
                    </div>
                  ) : (
                    <Badge tone={r.status === "fulfilled" ? "success" : r.status === "rejected" ? "warning" : "info"}>{r.status}</Badge>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <Pager page={page} totalPages={q.data?.meta?.totalPages ?? 1} onPage={setPage} />

      <PromptDialog
        open={dialog?.kind === "fulfil"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`Send ${dialog?.row.rewardTitle ?? ""}`}
        description="Paste the official voucher code you bought from an authorised partner. It's stored encrypted and shown only to this player."
        label="Voucher code"
        minLength={4}
        confirmLabel="Send code"
        onSubmit={async (code) => {
          await adminFetch(`/redemptions/${dialog!.row.id}/fulfil`, { method: "POST", body: { code } });
          toast({ tone: "success", title: "Code sent to the player" });
          refresh();
        }}
      />
      <PromptDialog
        open={dialog?.kind === "reject"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Reject this request?"
        description={`The player gets ${dialog?.row.cost.toLocaleString("en-IN") ?? ""} SGC back. They'll see your reason.`}
        label="Reason (shown to the player)"
        multiline
        danger
        confirmLabel="Reject and refund"
        onSubmit={async (reason) => {
          await adminFetch(`/redemptions/${dialog!.row.id}/reject`, { method: "POST", body: { reason } });
          toast({ tone: "success", title: "Rejected — coins refunded" });
          refresh();
        }}
      />
    </div>
  );
}
