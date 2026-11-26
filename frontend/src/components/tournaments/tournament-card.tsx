import Link from "next/link";
import { MediaImage } from "@/components/ui/media-image";
import { CalendarDays, ShieldCheck, Trophy, Users } from "lucide-react";
import type { TournamentSummary } from "@sgh/shared";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDateRange, formatINR, formatRelative, tournamentStatusLabel, tournamentStatusTone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CountdownBadge } from "@/components/retention/countdown-badge";

export function TournamentStatusBadge({ status }: { status: TournamentSummary["status"] }) {
  return (
    <Badge tone={tournamentStatusTone[status]}>
      {status === "ongoing" && <span className="size-1.5 rounded-full bg-accent motion-safe:animate-pulse" aria-hidden="true" />}
      {tournamentStatusLabel[status]}
    </Badge>
  );
}

export function VerificationStamp({ lastVerifiedAt, className }: { lastVerifiedAt: string | null; className?: string }) {
  const rel = formatRelative(lastVerifiedAt);
  return (
    <p className={cn("inline-flex items-center gap-1.5 text-xs", rel ? "text-success" : "text-warning", className)}>
      <ShieldCheck className="size-3.5" aria-hidden="true" />
      {rel ? `Verified ${rel}` : "Not yet verified"}
    </p>
  );
}

/** Depth card: tilts subtly on pointer devices via CSS 3D transforms; flat on touch. */
export function TournamentCard({ t, className }: { t: TournamentSummary; className?: string }) {
  const dates = formatDateRange(t.startDate, t.endDate);
  const prize = t.prizePool ? (t.prizePool.display ?? formatINR(t.prizePool.amount)) : null;
  return (
    <Card
      interactive
      className={cn(
        "group flex h-full flex-col overflow-hidden [transform-style:preserve-3d] [@media(hover:hover)]:hover:[transform:perspective(900px)_rotateX(2deg)_rotateY(-3deg)_translateY(-2px)]",
        className,
      )}
    >
      <div className="relative aspect-[16/9] bg-surface-2">
        {t.featuredImage ? (
          <MediaImage image={t.featuredImage} fill sizes="(min-width:1024px) 33vw, 90vw" className="object-cover" />
        ) : (
          <div className="bg-atmosphere absolute inset-0 grid place-items-center" aria-hidden="true">
            <Trophy className="size-10 text-primary-hover/60" />
          </div>
        )}
        <div className="absolute top-3 left-3 flex gap-2">
          <TournamentStatusBadge status={t.status} />
          <Badge tone="neutral" className="bg-bg/70 backdrop-blur">{t.game.name}</Badge>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="text-lg font-semibold">
          <Link href={`/tournaments/${t.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
            {t.name}
          </Link>
        </h3>
        <p className="text-sm text-muted">by {t.organiser}</p>
        <dl className="grid gap-1.5 text-sm">
          <div className="flex items-center gap-2">
            <dt><CalendarDays className="size-4 text-subtle" aria-hidden="true" /><span className="sr-only">Dates</span></dt>
            <dd>{dates ?? "Dates not announced"}</dd>
          </div>
          {prize && (
            <div className="flex items-center gap-2">
              <dt><Trophy className="size-4 text-subtle" aria-hidden="true" /><span className="sr-only">Prize pool</span></dt>
              <dd>{prize} <span className="text-xs text-subtle">(as announced)</span></dd>
            </div>
          )}
          {t.eligibilitySummary && (
            <div className="flex items-center gap-2">
              <dt><Users className="size-4 text-subtle" aria-hidden="true" /><span className="sr-only">Eligibility</span></dt>
              <dd className="line-clamp-1">{t.eligibilitySummary}</dd>
            </div>
          )}
        </dl>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
          <VerificationStamp lastVerifiedAt={t.lastVerifiedAt} />
          <CountdownBadge startDate={t.startDate} endDate={t.endDate} registrationDeadline={t.registrationDeadline} status={t.status} />
        </div>
      </div>
    </Card>
  );
}
