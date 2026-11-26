"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { PageHeader, Pager, formatAdminDate } from "@/components/admin/ui";
import { PromptDialog } from "@/components/admin/play-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { adminFetch } from "@/lib/admin/api";
import { useAdmin } from "@/lib/admin/context";
import { useToast } from "@/lib/admin/toast";

interface PlayerRow { id: string; email: string; displayName: string; ign: string; characterId: string; coins: number; status: "active" | "banned" | "deleted"; createdAt: string; lastLoginAt?: string }
interface PlayerDetail extends PlayerRow {
  name: string;
  characterIdLocked: boolean;
  banReason?: string;
  streak: { count: number; lastDay: string };
  ledger: { amount: number; reason: string; note: string; balanceAfter?: number; at: string }[];
  rooms: { room: { _id: string; title: string; slug: string } | null; entry: { status: string; slot?: number; teamName: string } | null }[];
  redemptions: { id: string; rewardTitle: string; cost: number; status: string; createdAt: string }[];
  relatedAccounts: { id: string; email: string; ign: string; status: string; createdAt: string }[];
}

function PlayerPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { can } = useAdmin();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["player", id], queryFn: async () => (await adminFetch<PlayerDetail>(`/players/${id}`)).data });
  const [dialog, setDialog] = useState<null | "ban" | "coins">(null);
  const [amount, setAmount] = useState("");
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["player", id] });
    void qc.invalidateQueries({ queryKey: ["players"] });
  };
  const p = q.data;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={p ? p.ign || p.displayName || p.email : "Player"} className="max-w-2xl">
        {!p ? (
          <Skeleton className="h-60" />
        ) : (
          <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted">Email</dt><dd>{p.email || "—"}</dd>
              <dt className="text-muted">Google name</dt><dd>{p.name || "—"}</dd>
              <dt className="text-muted">BGMI name</dt><dd>{p.ign || "—"}</dd>
              <dt className="text-muted">Character ID</dt><dd className="font-mono">{p.characterId || "—"} {p.characterIdLocked && <Badge tone="info">locked</Badge>}</dd>
              <dt className="text-muted">Coins</dt><dd className="font-semibold">{p.coins.toLocaleString("en-IN")} SGC</dd>
              <dt className="text-muted">Streak</dt><dd>{p.streak?.count ?? 0} (last {p.streak?.lastDay || "—"})</dd>
              <dt className="text-muted">Status</dt><dd><Badge tone={p.status === "active" ? "success" : "danger"}>{p.status}</Badge> {p.banReason}</dd>
              <dt className="text-muted">Joined</dt><dd>{formatAdminDate(p.createdAt)} · last sign-in {formatAdminDate(p.lastLoginAt)}</dd>
            </dl>
            {p.relatedAccounts.length > 0 && (
              <div className="rounded-md border border-warning/50 p-3">
                <p className="mb-1 flex items-center gap-1.5 font-semibold text-warning"><AlertTriangle className="size-4" aria-hidden="true" /> Other accounts from the same network</p>
                <ul>{p.relatedAccounts.map((r) => <li key={r.id}>{r.ign || "—"} · {r.email} · {r.status} · {formatAdminDate(r.createdAt)}</li>)}</ul>
                <p className="mt-1 text-xs text-muted">Shared networks (families, colleges, mobile carriers) are common — treat this as a signal, not proof.</p>
              </div>
            )}
            {can("player:update") && p.status !== "deleted" && (
              <div className="flex flex-wrap gap-2">
                {p.status === "active" ? (
                  <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDialog("ban")}>Ban player</Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={async () => { await adminFetch(`/players/${id}/unban`, { method: "POST" }); toast({ tone: "success", title: "Unbanned" }); refresh(); }}>Unban</Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => setDialog("coins")}>Adjust coins</Button>
                {p.characterIdLocked && <Button size="sm" variant="ghost" onClick={async () => { await adminFetch(`/players/${id}/unlock-character-id`, { method: "POST" }); toast({ tone: "success", title: "Character ID unlocked" }); refresh(); }}>Unlock Character ID</Button>}
              </div>
            )}
            <section>
              <h3 className="mb-1 font-semibold">Coin history</h3>
              <ul className="divide-y divide-border rounded-md border border-border">
                {p.ledger.length === 0 && <li className="p-2 text-muted">No coins yet.</li>}
                {p.ledger.map((t, i) => (
                  <li key={i} className="flex justify-between gap-2 px-3 py-1.5"><span>{t.reason} {t.note && <span className="text-muted">· {t.note}</span>}<span className="block text-xs text-muted">{formatAdminDate(t.at)}</span></span><span className={t.amount > 0 ? "text-success" : "text-danger"}>{t.amount > 0 ? "+" : ""}{t.amount}</span></li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="mb-1 font-semibold">Rooms</h3>
              {p.rooms.length === 0 ? <p className="text-muted">None.</p> : <ul>{p.rooms.map((r, i) => <li key={i}>{r.room?.title ?? "—"} · {r.entry?.teamName} · {r.entry?.status}{r.entry?.slot ? ` #${r.entry.slot}` : ""}</li>)}</ul>}
            </section>
            <section>
              <h3 className="mb-1 font-semibold">Redemptions</h3>
              {p.redemptions.length === 0 ? <p className="text-muted">None.</p> : <ul>{p.redemptions.map((r) => <li key={r.id}>{r.rewardTitle} · {r.cost} SGC · {r.status} · {formatAdminDate(r.createdAt)}</li>)}</ul>}
            </section>
          </div>
        )}
      </DialogContent>
      <PromptDialog
        open={dialog === "ban"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Ban this player?"
        description="They're signed out everywhere and can't sign in, spin, join rooms or redeem until unbanned."
        label="Reason (kept in the audit log)"
        multiline
        danger
        confirmLabel="Ban"
        onSubmit={async (reason) => {
          await adminFetch(`/players/${id}/ban`, { method: "POST", body: { reason } });
          toast({ tone: "success", title: "Player banned" });
          refresh();
        }}
      />
      <PromptDialog
        open={dialog === "coins"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Adjust SGC coins"
        description="Positive adds coins, negative removes them (never below zero). Recorded in the player's history and the audit log."
        label="Reason"
        extra={
          <Field id="coin-amount" label="Amount (e.g. 50 or -50)" required>
            {(a) => <Input {...a} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />}
          </Field>
        }
        onSubmit={async (reason) => {
          await adminFetch(`/players/${id}/coins`, { method: "POST", body: { amount: Number(amount), reason } });
          setAmount("");
          toast({ tone: "success", title: "Coins adjusted" });
          refresh();
        }}
      />
    </Dialog>
  );
}

export default function PlayersPage() {
  const params = useSearchParams();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(params.get("id"));
  const list = useQuery({ queryKey: ["players", q, status, page], queryFn: () => adminFetch<PlayerRow[]>("/players", { query: { q, status, page } }) });

  return (
    <div>
      <PageHeader title="Players" description="Public player accounts (Google sign-in, 18+). Search by email, BGMI name or Character ID." />
      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(search);
          setPage(1);
        }}
      >
        <Input aria-label="Search players" placeholder="Email, BGMI name or Character ID" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-40">
          <option value="">Active + banned</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
          <option value="deleted">Deleted</option>
        </Select>
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      {list.isLoading ? (
        <Skeleton className="h-48" />
      ) : !list.data?.data.length ? (
        <Card className="p-6 text-sm text-muted">No players found.</Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface-2 text-left text-xs text-muted uppercase">
              <tr><th className="px-3 py-2">Player</th><th className="px-3 py-2">Character ID</th><th className="px-3 py-2 text-right">Coins</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Joined</th><th className="px-3 py-2"><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {list.data.data.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2"><span className="font-medium">{p.ign || p.displayName || "—"}</span><span className="block text-xs text-muted">{p.email}</span></td>
                  <td className="px-3 py-2 font-mono">{p.characterId || "—"}</td>
                  <td className="px-3 py-2 text-right">{p.coins.toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2"><Badge tone={p.status === "active" ? "success" : p.status === "banned" ? "danger" : "neutral"}>{p.status}</Badge></td>
                  <td className="px-3 py-2">{formatAdminDate(p.createdAt)}</td>
                  <td className="px-3 py-2 text-right"><Button size="sm" variant="ghost" onClick={() => setOpen(p.id)}>Open</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} totalPages={list.data?.meta?.totalPages ?? 1} onPage={setPage} />
      {open && <PlayerPanel id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
