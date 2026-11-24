"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { PageHeader, formatAdminDate } from "@/components/admin/ui";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { adminFetch } from "@/lib/admin/api";
import { useAdmin } from "@/lib/admin/context";

interface Dashboard {
  content: { key: string; label: string; total: number; byStatus?: Record<string, number> }[];
  attention: { kind: string; label: string; count: number; href: string; severity: "info" | "warning" | "danger" }[];
  activity: { date: string; count: number }[];
  recent: { id: string; action: string; actorName?: string; summary?: string; at: string; entityType?: string }[];
}

function ActivityChart({ data }: { data: Dashboard["activity"] }) {
  // last 30 days, zero-filled; inline SVG (no chart library). "now" is fixed per mount (pure render).
  const [now] = useState(() => Date.now());
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now - (29 - i) * 86_400_000);
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
    return { key, count: data.find((x) => x.date === key)?.count ?? 0 };
  });
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((s, d) => s + d.count, 0);
  return (
    <figure>
      <svg viewBox="0 0 300 80" className="h-24 w-full" role="img" aria-label={`${total} items published in the last 30 days`}>
        {days.map((d, i) => {
          const h = (d.count / max) * 70;
          return <rect key={d.key} x={i * 10 + 1} y={78 - h} width={8} height={Math.max(h, 1)} rx={1.5} fill={d.count ? "var(--primary)" : "var(--surface-3)"}><title>{`${d.key}: ${d.count}`}</title></rect>;
        })}
      </svg>
      <figcaption className="mt-1 text-xs text-muted">{total} published in the last 30 days</figcaption>
    </figure>
  );
}

export default function DashboardPage() {
  const { me } = useAdmin();
  const q = useQuery({ queryKey: ["dashboard"], queryFn: async () => (await adminFetch<Dashboard>("/dashboard")).data });
  return (
    <div>
      <PageHeader title={`Welcome, ${me.name.split(" ")[0]}`} description="Live figures from the database." />
      {q.isError ? (
        <ErrorState title="Couldn't load the dashboard" description={(q.error as Error).message} />
      ) : q.isLoading || !q.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <div className="flex flex-col gap-6">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {q.data.content.map((c) => (
              <li key={c.key}>
                <Card className="flex h-full flex-col gap-1 p-5">
                  <p className="text-sm text-muted">{c.label}</p>
                  <p className="font-display text-3xl font-bold">{c.total}</p>
                  {c.byStatus && (
                    <p className="text-xs text-subtle">
                      {Object.entries(c.byStatus).map(([s, n]) => `${n} ${s}`).join(" · ") || "—"}
                    </p>
                  )}
                </Card>
              </li>
            ))}
          </ul>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-3 font-semibold">Needs attention</h2>
              {q.data.attention.length === 0 ? (
                <p className="text-sm text-muted">Nothing needs attention right now.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {q.data.attention.map((a) => (
                    <li key={a.kind}>
                      <Link href={a.href} className="flex items-center gap-2 rounded-md p-2 text-sm hover:bg-surface-2">
                        <AlertTriangle className={`size-4 ${a.severity === "danger" ? "text-danger" : a.severity === "warning" ? "text-warning" : "text-secondary"}`} aria-hidden="true" />
                        <span className="font-semibold">{a.count}</span> {a.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="p-5">
              <h2 className="mb-3 font-semibold">Publishing activity</h2>
              <ActivityChart data={q.data.activity} />
            </Card>
          </div>
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Recent activity</h2>
            {q.data.recent.length === 0 ? (
              <EmptyState className="border-0 py-6" title="No activity yet" />
            ) : (
              <ul className="divide-y divide-border text-sm">
                {q.data.recent.map((r) => (
                  <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span><span className="font-medium">{r.actorName ?? "System"}</span> <span className="text-muted">{r.action.replace(/[._]/g, " ")}</span>{r.summary ? ` — ${r.summary}` : ""}</span>
                    <time className="text-xs text-subtle" dateTime={r.at}>{formatAdminDate(r.at)}</time>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
