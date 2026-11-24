import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { TournamentSummary } from "@sgh/shared";
import { TournamentCard, TournamentStatusBadge, VerificationStamp } from "@/components/tournaments/tournament-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/states";
import { formatDateRange, formatINR } from "@/lib/format";
import { TrophyScene } from "./trophy-scene";

export function FeaturedTournaments({ tournaments }: { tournaments: TournamentSummary[] }) {
  const [lead, ...rest] = tournaments;
  return (
    <Section
      id="tournaments"
      eyebrow="Tournament Hub"
      title="Featured tournaments"
      description="Every event links its official announcement. Rumours are clearly labelled until confirmed."
      action={
        <Button asChild variant="secondary">
          <Link href="/tournaments">View all <ArrowRight aria-hidden="true" /></Link>
        </Button>
      }
    >
      {!lead ? (
        <EmptyState level={3}
          title="No featured tournaments right now"
          description="We only list events with an official announcement. Check the full list for upcoming and rumoured events."
          action={<Button asChild variant="secondary" size="sm"><Link href="/tournaments">Browse tournaments</Link></Button>}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <Card data-reveal className="relative grid overflow-hidden lg:col-span-2 lg:grid-cols-[1.1fr_1fr]">
            <div className="flex flex-col gap-4 p-6 md:p-8">
              <div className="flex flex-wrap gap-2">
                <TournamentStatusBadge status={lead.status} />
              </div>
              <h3 className="text-2xl font-bold md:text-3xl">
                <Link href={`/tournaments/${lead.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">{lead.name}</Link>
              </h3>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div><dt className="text-subtle">Game</dt><dd className="font-medium">{lead.game.name}</dd></div>
                <div><dt className="text-subtle">Dates</dt><dd className="font-medium">{formatDateRange(lead.startDate, lead.endDate) ?? "Not announced"}</dd></div>
                <div><dt className="text-subtle">Prize pool</dt><dd className="font-medium">{lead.prizePool ? (lead.prizePool.display ?? formatINR(lead.prizePool.amount)) : "Not announced"}</dd></div>
                <div><dt className="text-subtle">Eligibility</dt><dd className="font-medium">{lead.eligibilitySummary ?? "See official page"}</dd></div>
              </dl>
              <VerificationStamp lastVerifiedAt={lead.lastVerifiedAt} />
              <div className="relative z-10 mt-auto flex flex-wrap gap-3 pt-2">
                {lead.registrationUrl && (
                  <Button asChild size="sm">
                    <a href={lead.registrationUrl} target="_blank" rel="noopener noreferrer">Official registration ↗</a>
                  </Button>
                )}
                <Button asChild size="sm" variant="secondary">
                  <a href={lead.officialSourceUrl} target="_blank" rel="noopener noreferrer">Official announcement ↗</a>
                </Button>
              </div>
            </div>
            <div className="relative hidden min-h-[320px] md:block">
              <TrophyScene />
            </div>
          </Card>
          {rest.slice(0, 2).map((t, i) => (
            <div key={t.id} data-reveal style={{ "--reveal-i": i + 1 } as React.CSSProperties}>
              <TournamentCard t={t} />
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

