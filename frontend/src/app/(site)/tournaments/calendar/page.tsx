import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TournamentSummary } from "@sgh/shared";
import { TournamentStatusBadge } from "@/components/tournaments/tournament-card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/states";
import { apiGetOr } from "@/lib/api/server";
import { buildMetadata } from "@/lib/seo/metadata";
import { cn } from "@/lib/utils";

export const metadata: Metadata = buildMetadata({
  title: "Tournament calendar",
  description: "Month view of verified BGMI and PUBG Mobile tournaments (IST).",
  path: "/tournaments/calendar",
  noindex: true, // duplicate of the listings
});

const IST = "Asia/Kolkata";
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(d);

function currentMonth(): string {
  return ymd(new Date()).slice(0, 7);
}

function shift(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const month = sp.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month) ? sp.month : currentMonth();
  const items = await apiGetOr<TournamentSummary[]>("/tournaments/calendar", [], { tags: ["tournaments"], revalidate: 600, searchParams: { month } });
  const [y, m] = month.split("-").map(Number) as [number, number];
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday = 0
  const label = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
  const today = ymd(new Date());

  const byDay = new Map<number, TournamentSummary[]>();
  for (const t of items) {
    if (!t.startDate) continue;
    const s = ymd(new Date(t.startDate));
    const e = ymd(new Date(t.endDate ?? t.startDate));
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${month}-${String(d).padStart(2, "0")}`;
      if (key >= s && key <= e) byDay.set(d, [...(byDay.get(d) ?? []), t]);
    }
  }

  return (
    <Container className="py-10 md:py-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Tournaments", href: "/tournaments" }, { label: "Calendar" }]} />
      <header className="mt-4 mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-display font-bold">{label}</h1>
        <nav aria-label="Month" className="flex gap-2">
          <Link href={`/tournaments/calendar?month=${shift(month, -1)}`} className="inline-flex min-h-11 items-center gap-1 rounded-md border border-border px-3 text-sm hover:border-border-strong"><ChevronLeft className="size-4" aria-hidden="true" /> Previous</Link>
          <Link href={`/tournaments/calendar?month=${shift(month, 1)}`} className="inline-flex min-h-11 items-center gap-1 rounded-md border border-border px-3 text-sm hover:border-border-strong">Next <ChevronRight className="size-4" aria-hidden="true" /></Link>
        </nav>
      </header>
      <p className="mb-4 text-sm text-muted">All times in IST. Only events with an official announcement are shown.</p>

      {/* Desktop grid */}
      <div className="hidden overflow-hidden rounded-lg border border-border md:block">
        <div className="grid grid-cols-7 bg-surface-1 text-center text-xs font-semibold tracking-wider text-subtle uppercase" aria-hidden="true">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <ol className="grid grid-cols-7">
          {Array.from({ length: firstWeekday }, (_, i) => <li key={`pad-${i}`} className="min-h-28 border-t border-r border-border bg-surface-1/30" aria-hidden="true" />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = i + 1;
            const key = `${month}-${String(d).padStart(2, "0")}`;
            const events = byDay.get(d) ?? [];
            return (
              <li key={d} className={cn("min-h-28 border-t border-r border-border p-2", key === today && "bg-primary/5")}>
                <span className={cn("text-xs", key === today ? "font-bold text-primary-hover" : "text-subtle")}>{d}</span>
                <ul className="mt-1 flex flex-col gap-1">
                  {events.slice(0, 3).map((t) => (
                    <li key={t.id}><Link href={`/tournaments/${t.slug}`} className="block truncate rounded bg-surface-2 px-1.5 py-1 text-xs hover:bg-surface-3">{t.name}</Link></li>
                  ))}
                  {events.length > 3 && <li className="text-xs text-subtle">+{events.length - 3} more</li>}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Mobile agenda */}
      <div className="md:hidden">
        {items.length === 0 ? (
          <EmptyState title="No tournaments this month" />
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((t) => (
              <li key={t.id} className="rounded-lg border border-border bg-surface-1 p-4">
                <div className="mb-1 flex items-center gap-2"><TournamentStatusBadge status={t.status} /></div>
                <Link href={`/tournaments/${t.slug}`} className="font-semibold">{t.name}</Link>
                <p className="text-sm text-muted">{t.startDate && new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: IST }).format(new Date(t.startDate))}{t.endDate && ` – ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: IST }).format(new Date(t.endDate))}`}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
      {items.length === 0 && <p className="mt-6 hidden text-center text-sm text-muted md:block">No tournaments with confirmed dates this month.</p>}
    </Container>
  );
}
