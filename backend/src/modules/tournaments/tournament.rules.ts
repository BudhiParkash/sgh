import { VERIFIED_TOURNAMENT_STATUSES, type TournamentStatus } from "@sgh/shared";
import { htmlToText } from "../../lib/sanitize.js";

/** Reserved slugs used by public listing routes (/tournaments/upcoming etc.). */
export const RESERVED_TOURNAMENT_SLUGS = new Set(["upcoming", "ongoing", "completed", "cancelled", "rumours", "calendar", "page"]);

export type DisplayStatus = TournamentStatus | "upcoming";

interface Shape {
  status: TournamentStatus;
  startDate?: Date | null;
  endDate?: Date | null;
  sources?: { type: string }[];
  verification?: { lastVerifiedAt?: Date | null } | null;
}

/**
 * Status shown to visitors. A confirmed event becomes "ongoing"/"completed" from its dates —
 * but rumours never auto-advance (an unconfirmed event is never presented as happening).
 */
export function displayStatus(t: Shape, now = new Date()): TournamentStatus {
  if (t.status === "rumour" || t.status === "cancelled") return t.status;
  const start = t.startDate ? new Date(t.startDate) : null;
  const end = t.endDate ? new Date(t.endDate) : start;
  if (end && end.getTime() < now.getTime()) return "completed";
  if (start && start.getTime() <= now.getTime()) return "ongoing";
  return t.status === "completed" ? "completed" : "confirmed";
}

export function hasOfficialSource(t: Shape): boolean {
  return (t.sources ?? []).some((s) => s.type === "official");
}

/** Business rules (docs/architecture/03 §4). Returns human-readable violations. */
export function statusViolations(t: Shape): string[] {
  const v: string[] = [];
  if (VERIFIED_TOURNAMENT_STATUSES.includes(t.status)) {
    if (!hasOfficialSource(t)) v.push(`A "${t.status}" tournament needs at least one official source (the organiser's or KRAFTON's own announcement).`);
    if (!t.verification?.lastVerifiedAt) v.push(`Record a verification before marking it "${t.status}".`);
  }
  return v;
}

export function dateViolations(t: { startDate?: Date | null; endDate?: Date | null; registrationDeadline?: Date | null }): { path: string; message: string }[] {
  const out: { path: string; message: string }[] = [];
  if (t.startDate && t.endDate && new Date(t.endDate) < new Date(t.startDate)) out.push({ path: "endDate", message: "End date is before the start date" });
  if (t.registrationDeadline && t.endDate && new Date(t.registrationDeadline) > new Date(t.endDate)) out.push({ path: "registrationDeadline", message: "Registration closes after the event ends" });
  return out;
}

const PAYMENT_WORDS = /\b(entry fee|entry-fee|registration fee|paid slot|deposit|wallet|betting|bet on|wager|cash[- ]?out|win real money|recharge)\b/i;

/** Flags wording that suggests real-money gaming — this platform never facilitates it. */
export function paymentWarnings(html: string | undefined | null): string[] {
  const text = htmlToText(html ?? "");
  const m = text.match(PAYMENT_WORDS);
  return m ? [`Description mentions "${m[0]}". Shivanshi Gaming Hub lists free-to-enter information only — double-check this event isn't a paid or real-money competition.`] : [];
}
