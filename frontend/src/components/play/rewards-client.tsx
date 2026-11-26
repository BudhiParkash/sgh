"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Coins, Copy, Flame, Gift, History, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";
import { errorText, playerFetch, publicFetch } from "@/lib/play/client";
import { usePlayer } from "@/lib/play/context";
import type { DailyStatus, Reward } from "@/lib/play/types";
import { SpinWheel, useWheel } from "./spin-wheel";

interface Redemption { id: string; rewardTitle: string; cost: number; status: "pending" | "fulfilled" | "rejected"; code?: string; note?: string; createdAt: string }
interface Tx { amount: number; reason: string; note: string; balanceAfter?: number; at: string }
const reasonLabel: Record<string, string> = { spin: "Daily spin", streak_bonus: "Streak bonus", room_prize: "Custom room prize", redeem: "Redeemed", redeem_refund: "Refund", admin_adjust: "Adjustment" };

function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = Math.max(0, Date.parse(to) - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return <span className="font-mono">{String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</span>;
}

export function RewardsClient() {
  const { me, ready, openSignIn, setCoins } = usePlayer();
  const [outcomes, setOutcomes] = useState<number[]>([]);
  const [bonuses, setBonuses] = useState<{ day: number; coins: number }[]>([]);
  const [daily, setDaily] = useState<DailyStatus | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [history, setHistory] = useState<Tx[]>([]);
  const [result, setResult] = useState<{ coins: number; bonus: number; streak: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [redeemFor, setRedeemFor] = useState<Reward | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const wheel = useWheel(outcomes.length);

  useEffect(() => {
    publicFetch<{ spinOutcomes: number[]; streakBonuses: { day: number; coins: number }[] }>("/play/config")
      .then((c) => {
        setOutcomes(c.spinOutcomes);
        setBonuses(c.streakBonuses);
      })
      .catch(() => undefined);
    publicFetch<Reward[]>("/rewards").then(setRewards).catch(() => undefined);
  }, []);

  const loadMine = useCallback(async () => {
    if (!me) return;
    const [d, r, h] = await Promise.all([playerFetch<DailyStatus>("/daily"), playerFetch<Redemption[]>("/redemptions"), playerFetch<Tx[]>("/coins?limit=15")]);
    setDaily(d);
    setOutcomes(d.outcomes);
    setBonuses(d.streakBonuses);
    setRedemptions(r);
    setHistory(h);
    setCoins(d.coins);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setCoins is stable
  }, [me?.id]);

  useEffect(() => {
    const id = setTimeout(() => void loadMine().catch(() => undefined), 0);
    return () => clearTimeout(id);
  }, [loadMine]);

  const spin = async () => {
    if (!me) return openSignIn("Sign in to spin the wheel and collect free SGC coins every day.");
    setErr(null);
    setResult(null);
    try {
      const r = await playerFetch<{ coins: number; outcomeIndex: number; bonus: number; streak: number; balance: number }>("/daily/spin", { method: "POST" });
      await wheel.spinTo(r.outcomeIndex);
      setResult({ coins: r.coins, bonus: r.bonus, streak: r.streak });
      setCoins(r.balance);
      await loadMine();
    } catch (e) {
      setErr(errorText(e));
    }
  };

  const redeem = async () => {
    if (!redeemFor) return;
    setBusy(true);
    setErr(null);
    try {
      await playerFetch(`/rewards/${redeemFor.id}/redeem`, { method: "POST", body: {} });
      setRedeemFor(null);
      await loadMine();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const cycleDay = daily ? (daily.canSpin ? daily.nextCycleDay : ((daily.streak - 1) % 7) + 1) : 0;

  return (
    <div className="flex flex-col gap-12">
      {/* Daily spin */}
      <section aria-labelledby="spin-h" className="grid items-center gap-8 md:grid-cols-2">
        <div className="flex justify-center">
          {outcomes.length > 0 && <SpinWheel outcomes={outcomes} rotation={wheel.rotation} />}
        </div>
        <div className="flex flex-col gap-4">
          <h2 id="spin-h" className="text-2xl font-bold">Daily spin</h2>
          <p className="text-muted">One free spin every day (resets at midnight IST). Every spin wins SGC coins — spin on consecutive days to build your streak and earn bonus coins.</p>
          {!ready ? null : !me ? (
            <Button size="lg" onClick={spin}>Sign in to spin</Button>
          ) : daily?.canSpin ? (
            <Button size="lg" onClick={spin} loading={wheel.spinning} disabled={wheel.spinning}>Spin now</Button>
          ) : daily ? (
            <p className="rounded-md bg-surface-2 p-3 text-sm">Next spin in <Countdown to={daily.nextResetAt} /></p>
          ) : null}
          {result && (
            <p role="status" className="rounded-md border border-accent/50 bg-accent/10 p-3 font-semibold text-accent">
              +{result.coins} SGC{result.bonus > 0 && ` + ${result.bonus} streak bonus`}! Day {result.streak} streak.
            </p>
          )}
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
          {/* Streak */}
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Flame className="size-4 text-warning" aria-hidden="true" /> Streak: {daily?.streak ?? 0} day{daily?.streak === 1 ? "" : "s"}</p>
            <ol className="grid grid-cols-7 gap-1.5" aria-label="7-day streak">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                const bonus = bonuses.find((b) => b.day === d);
                const done = daily ? (daily.canSpin ? d < cycleDay : d <= cycleDay) : false;
                return (
                  <li key={d} className={`flex flex-col items-center rounded-md border p-1.5 text-xs ${done ? "border-success/60 bg-success/10" : "border-border"}`}>
                    <span className="text-muted">Day {d}</span>
                    {done ? <CheckCircle2 className="size-4 text-success" aria-label="done" /> : bonus ? <span className="font-bold text-accent">+{bonus.coins}</span> : <span className="text-subtle">·</span>}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      {/* Store */}
      <section aria-labelledby="store-h">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 id="store-h" className="flex items-center gap-2 text-2xl font-bold"><Gift className="size-6 text-primary" aria-hidden="true" /> Rewards store</h2>
          {me && <p className="flex items-center gap-1.5 font-semibold text-accent"><Coins className="size-5" aria-hidden="true" /> {me.coins.toLocaleString("en-IN")} SGC</p>}
        </div>
        {rewards.length === 0 ? (
          <Card className="p-6 text-sm text-muted">Rewards are coming soon. Keep spinning — your coins stay in your account.</Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rewards.map((r) => {
              const affordable = (me?.coins ?? 0) >= r.costCoins;
              return (
                <li key={r.id}>
                  <Card className="flex h-full flex-col gap-3 p-5">
                    {r.image && (
                      // eslint-disable-next-line @next/next/no-img-element -- media library variant
                      <img src={r.image.url} alt={r.image.alt} width={r.image.width} height={r.image.height} className="aspect-video w-full rounded-md object-cover" loading="lazy" />
                    )}
                    <h3 className="font-bold">{r.title}</h3>
                    {r.description && <p className="text-sm text-muted">{r.description}</p>}
                    <p className="mt-auto flex items-center gap-1.5 text-lg font-bold text-accent"><Coins className="size-5" aria-hidden="true" /> {r.costCoins.toLocaleString("en-IN")} SGC</p>
                    {!r.inStock ? (
                      <Badge tone="warning" className="self-start">Out of stock</Badge>
                    ) : !me ? (
                      <Button variant="secondary" onClick={() => openSignIn("Sign in to collect SGC coins and redeem rewards.")}>Sign in to redeem</Button>
                    ) : (
                      <Button variant={affordable ? "primary" : "secondary"} disabled={!affordable} onClick={() => { setErr(null); setRedeemFor(r); }}>
                        {affordable ? "Redeem" : `Need ${(r.costCoins - me.coins).toLocaleString("en-IN")} more`}
                      </Button>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 flex items-start gap-2 text-xs text-subtle">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Vouchers are official codes bought from authorised partners and sent after a quick review. SGC coins are free, can&apos;t be bought, sold, transferred or exchanged for money. See the <Link href="/legal/sgc-rewards-terms" className="underline">SGC Rewards Terms</Link>.
        </p>
      </section>

      {me && (
        <div className="grid gap-8 lg:grid-cols-2">
          <section aria-labelledby="mine-h">
            <h2 id="mine-h" className="mb-3 text-xl font-bold">My rewards</h2>
            {redemptions.length === 0 ? (
              <p className="text-sm text-muted">No redemptions yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {redemptions.map((x) => (
                  <li key={x.id}>
                    <Card className="flex flex-col gap-2 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">{x.rewardTitle}</span>
                        <Badge tone={x.status === "fulfilled" ? "success" : x.status === "pending" ? "info" : "warning"}>{x.status === "pending" ? "In review" : x.status === "fulfilled" ? "Delivered" : "Rejected — refunded"}</Badge>
                      </div>
                      <p className="text-xs text-muted">{x.cost.toLocaleString("en-IN")} SGC · {formatDateTime(x.createdAt)}</p>
                      {x.code && (
                        <div className="flex items-center justify-between gap-2 rounded-md bg-surface-2 px-3 py-2">
                          <code className="font-mono text-sm break-all">{x.code}</code>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label="Copy voucher code"
                            onClick={async () => {
                              await navigator.clipboard.writeText(x.code!);
                              setCopied(x.id);
                              setTimeout(() => setCopied(null), 1500);
                            }}
                          >
                            {copied === x.id ? <CheckCircle2 aria-hidden="true" /> : <Copy aria-hidden="true" />}
                          </Button>
                        </div>
                      )}
                      {x.note && <p className="text-xs text-muted">{x.note}</p>}
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="hist-h">
            <h2 id="hist-h" className="mb-3 flex items-center gap-2 text-xl font-bold"><History className="size-5" aria-hidden="true" /> Coin history</h2>
            {history.length === 0 ? (
              <p className="text-sm text-muted">Spin the wheel to earn your first coins.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {history.map((t, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div>
                      <p className="font-medium">{reasonLabel[t.reason] ?? t.reason}</p>
                      <p className="text-xs text-muted">{t.note || formatDateTime(t.at)}</p>
                    </div>
                    <span className={t.amount > 0 ? "font-semibold text-success" : "font-semibold text-danger"}>{t.amount > 0 ? "+" : ""}{t.amount}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <Dialog open={Boolean(redeemFor)} onOpenChange={(o) => !o && setRedeemFor(null)}>
        <DialogContent title={`Redeem ${redeemFor?.title ?? ""}?`} description={`${redeemFor?.costCoins.toLocaleString("en-IN")} SGC will be deducted now. Our team reviews every request; you'll see the code here once it's delivered. If it's rejected, your coins come back.`}>
          <p className="text-sm text-muted">Make sure your BGMI Character ID on your <Link href="/account" className="underline">profile</Link> is correct — it can&apos;t be changed after redeeming.</p>
          {err && <p role="alert" className="mt-2 text-sm text-danger">{err}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRedeemFor(null)}>Cancel</Button>
            <Button onClick={redeem} loading={busy}>Confirm redeem</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
