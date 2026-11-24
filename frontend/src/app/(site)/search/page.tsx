import type { Metadata } from "next";
import type { SearchResults } from "@sgh/shared";
import { ArticleCard } from "@/components/articles/article-card";
import { ConfigCard } from "@/components/sensitivity/config-card";
import { DeviceCard } from "@/components/sensitivity/device-card";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { apiGet } from "@/lib/api/server";

export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const res = q.length >= 2 ? await apiGet<SearchResults>("/search", { tags: ["search"], revalidate: 120, searchParams: { q } }).catch(() => null) : null;
  const r = res?.data;
  const total = r ? r.articles.length + r.tournaments.length + r.devices.length + r.sensitivity.length : 0;
  return (
    <Container className="py-10 md:py-16">
      <h1 className="text-display font-bold">Search</h1>
      <form role="search" method="get" className="mt-6 flex max-w-xl gap-2">
        <Input type="search" name="q" defaultValue={q} aria-label="Search the site" placeholder="Search guides, tournaments, phones…" minLength={2} maxLength={80} required />
        <Button type="submit">Search</Button>
      </form>
      {q.length >= 2 && (
        <div className="mt-10 flex flex-col gap-12" aria-live="polite">
          {!r || total === 0 ? (
            <EmptyState title={`No results for “${q}”`} description="Try a shorter or different word." />
          ) : (
            <>
              {r.sensitivity.length > 0 && <section aria-labelledby="r-sens"><h2 id="r-sens" className="mb-4 text-xl font-semibold">Sensitivity setups</h2><ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{r.sensitivity.map((c) => <li key={c.id}><ConfigCard c={c} /></li>)}</ul></section>}
              {r.devices.length > 0 && <section aria-labelledby="r-dev"><h2 id="r-dev" className="mb-4 text-xl font-semibold">Phones</h2><ul className="grid grid-cols-2 gap-4 md:grid-cols-4">{r.devices.map((d) => <li key={d.id}><DeviceCard d={d} /></li>)}</ul></section>}
              {r.tournaments.length > 0 && <section aria-labelledby="r-tour"><h2 id="r-tour" className="mb-4 text-xl font-semibold">Tournaments</h2><ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{r.tournaments.map((t) => <li key={t.id}><TournamentCard t={t} /></li>)}</ul></section>}
              {r.articles.length > 0 && <section aria-labelledby="r-art"><h2 id="r-art" className="mb-4 text-xl font-semibold">Articles</h2><ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{r.articles.map((a) => <li key={a.id}><ArticleCard a={a} /></li>)}</ul></section>}
            </>
          )}
        </div>
      )}
    </Container>
  );
}
