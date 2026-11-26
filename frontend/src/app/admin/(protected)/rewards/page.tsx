"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmButton, PageHeader } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, adminFetch } from "@/lib/admin/api";
import { useAdmin } from "@/lib/admin/context";
import { useToast } from "@/lib/admin/toast";

interface Reward { id: string; title: string; description: string; kind: "uc_voucher" | "royal_pass_voucher" | "other_voucher"; costCoins: number; stock: number | null; perPlayerPer30Days: number; active: boolean; sort: number }
interface PlayConfig { spinOutcomes: { coins: number; weight: number }[]; streakBonuses: { day: number; coins: number }[]; redeemMinAccountAgeDays: number; redeemMonthlyCap: number }
const kindLabel = { uc_voucher: "UC voucher", royal_pass_voucher: "Royal Pass voucher", other_voucher: "Other voucher" };
const empty: Omit<Reward, "id"> = { title: "", description: "", kind: "uc_voucher", costCoins: 500, stock: null, perPlayerPer30Days: 1, active: false, sort: 0 };

function RewardDialog({ reward, onClose }: { reward: Reward | "new"; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState<Omit<Reward, "id">>(reward === "new" ? empty : reward);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={reward === "new" ? "New reward" : `Edit ${reward.title}`}>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            try {
              if (reward === "new") await adminFetch("/rewards", { method: "POST", body: f });
              else await adminFetch(`/rewards/${reward.id}`, { method: "PATCH", body: f });
              toast({ tone: "success", title: "Saved" });
              void qc.invalidateQueries({ queryKey: ["rewards"] });
              onClose();
            } catch (e2) {
              setErr(e2 instanceof ApiError ? (e2.details[0]?.message ?? e2.message) : "Failed");
            }
          }}
        >
          <Field id="r-title" label="Title" hint='e.g. "60 UC gift voucher"' required>{(a) => <Input {...a} value={f.title} onChange={(e) => set("title", e.target.value)} />}</Field>
          <Field id="r-desc" label="Description">{(a) => <Textarea {...a} rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="r-kind" label="Type">{(a) => <Select {...a} value={f.kind} onChange={(e) => set("kind", e.target.value as Reward["kind"])}>{Object.entries(kindLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}</Field>
            <Field id="r-cost" label="Cost (SGC)" required>{(a) => <Input {...a} type="number" min={1} value={f.costCoins} onChange={(e) => set("costCoins", Number(e.target.value))} />}</Field>
            <Field id="r-stock" label="Stock" hint="Empty = unlimited">{(a) => <Input {...a} type="number" min={0} value={f.stock ?? ""} onChange={(e) => set("stock", e.target.value === "" ? null : Number(e.target.value))} />}</Field>
            <Field id="r-limit" label="Per player / 30 days">{(a) => <Input {...a} type="number" min={1} value={f.perPlayerPer30Days} onChange={(e) => set("perPlayerPer30Days", Number(e.target.value))} />}</Field>
            <Field id="r-sort" label="Sort order">{(a) => <Input {...a} type="number" min={0} value={f.sort} onChange={(e) => set("sort", Number(e.target.value))} />}</Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} className="size-4" /> Visible in the store</label>
          <p className="text-xs text-muted">Only offer vouchers you have actually bought from authorised partners (or can buy right away). Keep stock equal to the codes you hold.</p>
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
          <Button type="submit">Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlaySettings() {
  const { can } = useAdmin();
  const toast = useToast();
  const q = useQuery({ queryKey: ["settings"], queryFn: async () => (await adminFetch<{ play: PlayConfig; version: number }>("/settings")).data, enabled: can("settings:read") });
  const [draft, setDraft] = useState<PlayConfig | null>(null);
  const cfg = draft ?? q.data?.play ?? null;
  if (!can("settings:read") || !cfg) return null;
  const totalWeight = cfg.spinOutcomes.reduce((s, o) => s + o.weight, 0);
  const avg = cfg.spinOutcomes.reduce((s, o) => s + o.coins * o.weight, 0) / Math.max(totalWeight, 1);
  const upd = (fn: (c: PlayConfig) => PlayConfig) => setDraft(fn(structuredClone(cfg)));
  return (
    <Card className="mt-8 flex flex-col gap-4 p-5">
      <h2 className="text-lg font-bold">Daily spin, streak and redemption rules</h2>
      <p className="text-sm text-muted">Average spin ≈ <strong>{avg.toFixed(1)} SGC</strong> per day per player (plus streak bonuses). Price rewards with this in mind.</p>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Wheel segments (coins · weight)</h3>
          <ul className="flex flex-col gap-2">
            {cfg.spinOutcomes.map((o, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <Input aria-label={`Segment ${i + 1} coins`} type="number" min={1} value={o.coins} onChange={(e) => upd((c) => ((c.spinOutcomes[i]!.coins = Number(e.target.value)), c))} className="w-24" />
                <Input aria-label={`Segment ${i + 1} weight`} type="number" min={1} value={o.weight} onChange={(e) => upd((c) => ((c.spinOutcomes[i]!.weight = Number(e.target.value)), c))} className="w-24" />
                <span className="text-muted">{((o.weight / totalWeight) * 100).toFixed(1)}%</span>
                <Button size="sm" variant="ghost" disabled={cfg.spinOutcomes.length <= 2} onClick={() => upd((c) => ((c.spinOutcomes = c.spinOutcomes.filter((_, j) => j !== i)), c))}>Remove</Button>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="secondary" className="mt-2" disabled={cfg.spinOutcomes.length >= 12} onClick={() => upd((c) => (c.spinOutcomes.push({ coins: 10, weight: 10 }), c))}>Add segment</Button>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Streak bonuses (day of the 7-day cycle · coins)</h3>
          {cfg.streakBonuses.map((b, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <Input aria-label="Day" type="number" min={2} max={7} value={b.day} onChange={(e) => upd((c) => ((c.streakBonuses[i]!.day = Number(e.target.value)), c))} className="w-20" />
              <Input aria-label="Bonus coins" type="number" min={1} value={b.coins} onChange={(e) => upd((c) => ((c.streakBonuses[i]!.coins = Number(e.target.value)), c))} className="w-24" />
              <Button size="sm" variant="ghost" onClick={() => upd((c) => ((c.streakBonuses = c.streakBonuses.filter((_, j) => j !== i)), c))}>Remove</Button>
            </div>
          ))}
          <Button size="sm" variant="secondary" className="self-start" disabled={cfg.streakBonuses.length >= 6} onClick={() => upd((c) => (c.streakBonuses.push({ day: 5, coins: 20 }), c))}>Add bonus</Button>
          <Field id="min-age" label="Minimum account age to redeem (days)">{(a) => <Input {...a} type="number" min={0} max={90} value={cfg.redeemMinAccountAgeDays} onChange={(e) => upd((c) => ((c.redeemMinAccountAgeDays = Number(e.target.value)), c))} />}</Field>
          <Field id="cap" label="Max redemptions per player per month">{(a) => <Input {...a} type="number" min={1} max={30} value={cfg.redeemMonthlyCap} onChange={(e) => upd((c) => ((c.redeemMonthlyCap = Number(e.target.value)), c))} />}</Field>
        </div>
      </div>
      {can("settings:update") && (
        <Button
          className="self-start"
          disabled={!draft}
          onClick={async () => {
            try {
              await adminFetch("/settings", { method: "PATCH", body: { play: draft }, ifMatch: q.data!.version });
              setDraft(null);
              await q.refetch();
              toast({ tone: "success", title: "Rules saved" });
            } catch (e) {
              toast({ tone: "error", title: "Not saved", description: e instanceof ApiError ? (e.details[0]?.message ?? e.message) : undefined });
            }
          }}
        >
          Save rules
        </Button>
      )}
    </Card>
  );
}

export default function RewardsAdminPage() {
  const { can } = useAdmin();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["rewards"], queryFn: async () => (await adminFetch<Reward[]>("/rewards")).data });
  const [edit, setEdit] = useState<Reward | "new" | null>(null);
  return (
    <div>
      <PageHeader title="Rewards store" description="What players can redeem with SGC coins. Requests land in Redemptions for review." actions={can("reward:create") && <Button size="sm" onClick={() => setEdit("new")}>New reward</Button>} />
      {q.isLoading ? (
        <Skeleton className="h-40" />
      ) : !q.data?.length ? (
        <Card className="p-6 text-sm text-muted">No rewards yet. Add your first voucher, e.g. “60 UC gift voucher”.</Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {q.data.map((r) => (
            <li key={r.id}>
              <Card className="flex flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{r.title}</span>
                  <Badge tone={r.active ? "success" : "neutral"}>{r.active ? "Visible" : "Hidden"}</Badge>
                </div>
                <p className="text-sm text-muted">{kindLabel[r.kind]} · {r.costCoins.toLocaleString("en-IN")} SGC · stock {r.stock ?? "∞"} · {r.perPlayerPer30Days}/player/30 days</p>
                <div className="flex gap-2">
                  {can("reward:update") && <Button size="sm" variant="secondary" onClick={() => setEdit(r)}>Edit</Button>}
                  {can("reward:delete") && (
                    <ConfirmButton title={`Delete ${r.title}?`} description="Only possible if nobody has redeemed it — otherwise hide it instead." onConfirm={async () => {
                      try {
                        await adminFetch(`/rewards/${r.id}`, { method: "DELETE" });
                        void qc.invalidateQueries({ queryKey: ["rewards"] });
                      } catch (e) {
                        toast({ tone: "error", title: "Can't delete", description: e instanceof ApiError ? e.message : undefined });
                      }
                    }}>Delete</ConfirmButton>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <PlaySettings />
      {edit && <RewardDialog reward={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
