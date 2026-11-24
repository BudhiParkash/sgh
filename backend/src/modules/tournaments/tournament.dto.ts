import type { TournamentDetail, TournamentSummary } from "@sgh/shared";
import { toGameRef } from "../games/game.model.js";
import { toMediaRef } from "../media/media.service.js";
import { displayStatus } from "./tournament.rules.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- mapping populated lean documents */
const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null);

export function toTournamentSummary(t: any, now = new Date()): TournamentSummary {
  return {
    id: String(t._id),
    slug: t.slug,
    name: t.name,
    game: toGameRef(t.game) ?? { key: "bgmi", name: "BGMI" },
    organiser: t.organiser,
    status: displayStatus(t, now),
    startDate: iso(t.startDate),
    endDate: iso(t.endDate),
    registrationDeadline: iso(t.registrationDeadline),
    // Prize pool is never shown unless verified against an official source.
    prizePool: t.prizePool?.verified && (t.prizePool.amount != null || t.prizePool.display) ? { amount: t.prizePool.amount ?? null, currency: "INR", display: t.prizePool.display ?? null } : null,
    eligibilitySummary: t.eligibility?.summary ?? null,
    registrationUrl: t.registrationUrl ?? null,
    officialSourceUrl: t.officialSourceUrl,
    lastVerifiedAt: iso(t.verification?.lastVerifiedAt),
    featuredImage: toMediaRef(t.featuredImage),
    isFeatured: Boolean(t.isFeatured),
  };
}

export function toTournamentDetail(t: any, related: any[] = [], now = new Date()): TournamentDetail {
  return {
    ...toTournamentSummary(t, now),
    descriptionHtml: t.description?.html ?? "",
    formatHtml: t.format?.html || null,
    eligibility: { minAge: t.eligibility?.minAge ?? null, region: t.eligibility?.region ?? null, notes: t.eligibility?.notes ?? null },
    verification: { lastVerifiedAt: iso(t.verification?.lastVerifiedAt), notes: t.verification?.notes ?? null, confidence: t.verification?.confidence ?? null },
    sources: (t.sources ?? []).map((s: any) => ({ id: String(s._id), url: s.url, type: s.type, title: s.title, publisher: s.publisher ?? "", accessedAt: iso(s.accessedAt)! })),
    related: related.map((r) => toTournamentSummary(r, now)),
    seo: {
      title: t.seo?.title ?? null,
      description: t.seo?.description ?? null,
      canonicalUrl: t.seo?.canonicalUrl ?? null,
      robots: { index: t.seo?.robots?.index ?? true, follow: t.seo?.robots?.follow ?? true },
      ogImage: toMediaRef(t.seo?.ogImage) ?? null,
    },
    updatedAt: iso(t.updatedAt)!,
  };
}
