import { Suspense } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import type { TournamentSummary } from "@sgh/shared";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { PaginationLinks } from "@/components/ui/pagination-links";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ApiUnavailableError, apiGet } from "@/lib/api/server";
import { cn } from "@/lib/utils";
import { TournamentFilters } from "./filters";
import { TournamentCard } from "./tournament-card";

export type ListingStatus = "upcoming" | "ongoing" | "completed" | "cancelled" | "rumour";
export const STATUS_TABS: { status: ListingStatus; label: string; href: string; blurb: string }[] = [
  { status: "upcoming", label: "Upcoming", href: "/tournaments/upcoming", blurb: "Confirmed events that haven't started yet, verified against the organiser's official announcement." },
  { status: "ongoing", label: "Ongoing", href: "/tournaments/ongoing", blurb: "Confirmed events happening right now." },
  { status: "completed", label: "Completed", href: "/tournaments/completed", blurb: "Past events, kept for reference." },
  { status: "cancelled", label: "Cancelled", href: "/tournaments/cancelled", blurb: "Events the organiser has called off." },
  { status: "rumour", label: "Rumours", href: "/tournaments/rumours", blurb: "Unconfirmed reports. Treat these with caution until an official announcement appears." },
];

export interface ListingParams {
  page?: string;
  game?: string;
  q?: string;
}

export async function TournamentListing({ status, params, basePath, heading }: { status: ListingStatus; params: ListingParams; basePath: string; heading: string }) {
  const page = Math.max(1, Number(params.page) || 1);
  const game = params.game === "bgmi" || params.game === "pubg-mobile" ? params.game : undefined;
  const q = params.q?.slice(0, 80);
  let result: { data: TournamentSummary[]; meta?: { page: number; totalPages: number; total: number } } | null = null;
  let failed = false;
  try {
    result = await apiGet<TournamentSummary[]>("/tournaments", { tags: ["tournaments"], revalidate: 600, searchParams: { status, page, game, q, limit: 12 } });
  } catch (e) {
    if (!(e instanceof ApiUnavailableError)) throw e;
    failed = true;
  }
  const tab = STATUS_TABS.find((t) => t.status === status)!;
  const items = result?.data ?? [];
  const hrefFor = (p: number) => {
    const sp = new URLSearchParams();
    if (p > 1) sp.set("page", String(p));
    if (game) sp.set("game", game);
    if (q) sp.set("q", q);
    return `${basePath}${sp.size ? `?${sp}` : ""}`;
  };

  return (
    <Container className="py-10 md:py-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Tournaments", href: "/tournaments" }, ...(basePath !== "/tournaments" ? [{ label: tab.label }] : [])]} />
      <header className="mt-4 mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-display font-bold">{heading}</h1>
          <p className="mt-3 text-muted md:text-lg">{tab.blurb}</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/tournaments/calendar"><CalendarDays aria-hidden="true" /> Calendar view</Link>
        </Button>
      </header>

      <nav aria-label="Tournament status" className="mb-6 -mx-4 overflow-x-auto px-4">
        <ul className="flex w-max gap-1 rounded-lg border border-border bg-surface-1 p-1">
          {STATUS_TABS.map((t) => (
            <li key={t.status}>
              <Link href={t.href} aria-current={t.status === status ? "page" : undefined} className={cn("inline-flex min-h-10 items-center rounded-md px-4 text-sm font-medium", t.status === status ? "bg-surface-3 text-text" : "text-muted hover:text-text")}>
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mb-8">
        <Suspense>
          <TournamentFilters />
        </Suspense>
      </div>

      {failed ? (
        <ErrorState title="Tournaments are temporarily unavailable" description="Please try again in a few minutes." />
      ) : items.length === 0 ? (
        <EmptyState
          title={q || game ? "No tournaments match your filters" : `No ${tab.label.toLowerCase()} tournaments right now`}
          description={status === "upcoming" ? "We list an event only after its official announcement. Check the rumours tab for unconfirmed reports." : undefined}
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-muted">{result?.meta?.total ?? items.length} {(result?.meta?.total ?? items.length) === 1 ? "tournament" : "tournaments"}</p>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((t) => (
              <li key={t.id}><TournamentCard t={t} /></li>
            ))}
          </ul>
          {result?.meta && <PaginationLinks page={result.meta.page} totalPages={result.meta.totalPages} hrefFor={hrefFor} />}
        </>
      )}
    </Container>
  );
}
