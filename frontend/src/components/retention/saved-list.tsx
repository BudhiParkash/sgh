"use client";

import Link from "next/link";
import { Bookmark, Trash2, Trophy, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { formatDateRange, gyroLabel } from "@/lib/format";
import { removeSaved, useSaved, type SavedSetup, type SavedTournament } from "@/lib/saved";
import { CountdownBadge } from "./countdown-badge";
import { InstallAppButton } from "./install-app";

export function SavedList() {
  const items = useSaved();
  const setups = items.filter((i): i is SavedSetup => i.kind === "setup");
  // Upcoming first, then by start date
  const tournaments = items
    .filter((i): i is SavedTournament => i.kind === "tournament")
    .sort((a, b) => (Date.parse(a.registrationDeadline ?? a.startDate ?? "9999") || Infinity) - (Date.parse(b.registrationDeadline ?? b.startDate ?? "9999") || Infinity));

  if (items.length === 0) {
    return (
      <EmptyState
        className="mt-10"
        icon={<Bookmark className="size-6" />}
        title="Nothing saved yet"
        description="Tap “Save” on a sensitivity setup or “Follow” on a tournament to keep it here for quick access."
        action={<div className="flex flex-wrap justify-center gap-2"><Button asChild size="sm"><Link href="/sensitivity">Find your sensitivity</Link></Button><Button asChild variant="secondary" size="sm"><Link href="/tournaments">Browse tournaments</Link></Button></div>}
      />
    );
  }
  return (
    <div className="mt-10 flex flex-col gap-12">
      <InstallAppButton variant="card" />
      {tournaments.length > 0 && (
        <section aria-labelledby="saved-t">
          <h2 id="saved-t" className="mb-4 flex items-center gap-2 text-xl font-semibold"><Trophy className="size-5 text-primary-hover" aria-hidden="true" /> Followed tournaments</h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {tournaments.map((t) => (
              <li key={t.slug}>
                <Card className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <Link href={`/tournaments/${t.slug}`} className="font-semibold hover:underline">{t.name}</Link>
                    <p className="mt-1 text-sm text-muted">{t.game} · {formatDateRange(t.startDate, t.endDate) ?? "Dates not announced"}</p>
                    <div className="mt-2"><CountdownBadge startDate={t.startDate} endDate={t.endDate} registrationDeadline={t.registrationDeadline} /></div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeSaved("tournament", t.slug)} aria-label={`Unfollow ${t.name}`}><Trash2 aria-hidden="true" /></Button>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
      {setups.length > 0 && (
        <section aria-labelledby="saved-s">
          <h2 id="saved-s" className="mb-4 flex items-center gap-2 text-xl font-semibold"><Gauge className="size-5 text-primary-hover" aria-hidden="true" /> Saved setups</h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {setups.map((s) => (
              <li key={s.slug}>
                <Card className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <Link href={`/sensitivity/${s.slug}`} className="font-semibold hover:underline">{s.title}</Link>
                    <p className="mt-1 text-sm text-muted">{s.device ?? "Baseline"} · {s.fps} FPS · {gyroLabel[s.gyroscope as keyof typeof gyroLabel] ?? s.gyroscope}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeSaved("setup", s.slug)} aria-label={`Remove ${s.title}`}><Trash2 aria-hidden="true" /></Button>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
