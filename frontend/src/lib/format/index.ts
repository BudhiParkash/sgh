import { DISPLAY_TIMEZONE, type GyroMode, type Playstyle, type Provenance, type TournamentStatus } from "@sgh/shared";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: DISPLAY_TIMEZONE });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: DISPLAY_TIMEZONE,
  timeZoneName: "short",
});
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** "12 Dec 2026" in IST. Returns null for missing dates — callers show "Not announced". */
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : dateFmt.format(d);
}

export function formatDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : dateTimeFmt.format(d);
}

export function formatDateRange(start: string | null, end: string | null): string | null {
  const s = formatDate(start);
  const e = formatDate(end);
  if (s && e) return s === e ? s : `${s} – ${e}`;
  return s ?? e;
}

export function formatINR(amount: number | null | undefined): string | null {
  return typeof amount === "number" ? inr.format(amount) : null;
}

/** "3 days ago" style relative time for verification stamps. */
export function formatRelative(iso: string | null | undefined, now = Date.now()): string | null {
  if (!iso) return null;
  const diff = now - new Date(iso).getTime();
  const day = 86_400_000;
  if (diff < 0) return formatDate(iso);
  if (diff < day) return "today";
  const days = Math.floor(diff / day);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return formatDate(iso);
}

export const tournamentStatusLabel: Record<TournamentStatus, string> = {
  rumour: "Rumour",
  confirmed: "Confirmed",
  ongoing: "Ongoing",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const tournamentStatusTone = {
  rumour: "warning",
  confirmed: "success",
  ongoing: "accent",
  completed: "neutral",
  cancelled: "danger",
} as const satisfies Record<TournamentStatus, string>;

export const provenanceLabel: Record<Provenance, string> = {
  tested: "Tested",
  community_submitted: "Community",
  baseline: "Baseline",
};

export const provenanceTone = { tested: "primary", community_submitted: "info", baseline: "neutral" } as const satisfies Record<
  Provenance,
  string
>;

export const gyroLabel: Record<GyroMode, string> = { off: "Gyro off", scope_on: "Gyro (scope on)", always_on: "Gyro always on" };
export const playstyleLabel: Record<Playstyle, string> = { rush: "Rush", balanced: "Balanced", sniper: "Sniper" };
