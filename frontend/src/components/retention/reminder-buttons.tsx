"use client";

import { useState } from "react";
import { BellRing, CalendarPlus } from "lucide-react";
import type { TournamentDetail } from "@sgh/shared";
import { Button } from "@/components/ui/button";
import { googleCalendarUrl } from "@/lib/ics";

/** "Remind me": phone calendar (.ics, includes a reminder before registration closes) or Google Calendar. */
export function ReminderButtons({ t }: { t: TournamentDetail }) {
  const [now] = useState(() => Date.now());
  if (!t.startDate && !t.registrationDeadline) return null;
  if (t.status === "completed" || t.status === "cancelled" || t.status === "rumour") return null;
  const target = t.registrationDeadline && Date.parse(t.registrationDeadline) > now ? { title: `Registration closes: ${t.name}`, at: new Date(t.registrationDeadline) } : t.startDate ? { title: t.name, at: new Date(t.startDate) } : null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="secondary" size="sm">
        <a href={`/tournaments/${t.slug}/calendar.ics`} download><BellRing aria-hidden="true" /> Remind me (calendar)</a>
      </Button>
      {target && (
        <Button asChild variant="ghost" size="sm">
          <a href={googleCalendarUrl({ title: target.title, start: new Date(target.at.getTime() - 30 * 60_000), end: target.at, details: `https://shivanshigaming.com/tournaments/${t.slug}` })} target="_blank" rel="noopener noreferrer"><CalendarPlus aria-hidden="true" /> Google Calendar</a>
        </Button>
      )}
    </div>
  );
}
