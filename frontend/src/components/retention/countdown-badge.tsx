"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { countdown } from "@/lib/countdown";

/** Live countdown (client-only, so cached pages never show stale "in 2 days" text). */
export function CountdownBadge({ startDate, endDate, registrationDeadline, status }: { startDate: string | null; endDate: string | null; registrationDeadline: string | null; status?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- time is only known on the client
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  if (now === null) return null;
  const c = countdown({ startDate, endDate, registrationDeadline, status }, now);
  if (!c) return null;
  return <Badge tone={c.tone} className="tabular-nums">{c.text}</Badge>;
}
