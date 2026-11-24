/** Pure: human countdown text for tournament milestones (unit-tested). */
export function countdown(t: { startDate: string | null; endDate: string | null; registrationDeadline: string | null; status?: string }, now = Date.now()): { text: string; tone: "accent" | "warning" | "neutral" | "success" } | null {
  if (t.status === "cancelled") return { text: "Cancelled", tone: "neutral" };
  if (t.status === "rumour") return null;
  const start = t.startDate ? Date.parse(t.startDate) : null;
  const end = t.endDate ? Date.parse(t.endDate) : start;
  const reg = t.registrationDeadline ? Date.parse(t.registrationDeadline) : null;
  const span = (ms: number) => {
    const m = Math.round(ms / 60_000);
    if (m < 60) return `${Math.max(1, m)} min`;
    const h = Math.round(m / 60);
    if (h < 48) return `${h} hour${h === 1 ? "" : "s"}`;
    const d = Math.round(h / 24);
    return `${d} day${d === 1 ? "" : "s"}`;
  };
  if (reg && reg > now && (!start || reg <= start)) return { text: `Registration closes in ${span(reg - now)}`, tone: reg - now < 3 * 86_400_000 ? "warning" : "accent" };
  if (start && start > now) return { text: `Starts in ${span(start - now)}`, tone: "accent" };
  if (start && end && start <= now && end >= now) return { text: "Live now", tone: "success" };
  if (end && end < now) return { text: "Finished", tone: "neutral" };
  return null;
}
