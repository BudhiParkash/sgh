import type { Metadata } from "next";
import Link from "next/link";
import { MediaImage } from "@/components/ui/media-image";
import { notFound } from "next/navigation";
import { AlertTriangle, CalendarDays, ExternalLink, Flag, ShieldCheck, Trophy, Users } from "lucide-react";
import type { TournamentDetail } from "@sgh/shared";
import { TrophyScene } from "@/components/home/trophy-scene";
import { CountdownBadge } from "@/components/retention/countdown-badge";
import { ReminderButtons } from "@/components/retention/reminder-buttons";
import { SaveButton } from "@/components/retention/save-button";
import { ShareButtons } from "@/components/retention/share-buttons";
import { TournamentCard, TournamentStatusBadge } from "@/components/tournaments/tournament-card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { getPreviewItem } from "@/lib/api/preview";
import { apiGet } from "@/lib/api/server";
import { formatDate, formatDateRange, formatDateTime, formatINR } from "@/lib/format";
import { JsonLd, breadcrumbLd, tournamentEventLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

const sourceLabel: Record<string, string> = { official: "Official", organiser_social: "Organiser post", news: "News", community: "Community" };

async function load(slug: string): Promise<{ t: TournamentDetail; preview: boolean } | null> {
  const preview = await getPreviewItem<TournamentDetail>("tournament");
  if (preview && preview.slug === slug) return { t: preview, preview: true };
  const r = await apiGet<TournamentDetail>(`/tournaments/${encodeURIComponent(slug)}`, { tags: ["tournaments", `tournament:${slug}`], revalidate: 3600 });
  return r ? { t: r.data, preview: false } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const res = await load(slug).catch(() => null);
  if (!res) return { title: "Tournament not found", robots: { index: false } };
  const { t } = res;
  const dates = formatDateRange(t.startDate, t.endDate);
  return buildMetadata({
    title: `${t.name} — ${t.game.name} tournament`,
    description: `${t.name} by ${t.organiser}${dates ? `, ${dates}` : ""}. Status: ${t.status}. Dates, eligibility, format and official links — verified against the organiser's announcement.`.slice(0, 160),
    path: `/tournaments/${t.slug}`,
    seo: t.seo,
    image: t.featuredImage,
    noindex: t.status === "rumour" || res.preview,
  });
}

export default async function TournamentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const res = await load(slug);
  if (!res) notFound();
  const { t, preview } = res;
  const prize = t.prizePool ? (t.prizePool.display ?? formatINR(t.prizePool.amount)) : null;
  const eventLd = tournamentEventLd(t);
  const crumbs = [{ name: "Home", path: "/" }, { name: "Tournaments", path: "/tournaments" }, { name: t.name, path: `/tournaments/${t.slug}` }];

  return (
    <article>
      <JsonLd data={[breadcrumbLd(crumbs), ...(eventLd ? [eventLd] : [])]} />
      {preview && <p className="bg-warning/15 py-2 text-center text-sm text-warning" role="status">Preview — this version is not published.</p>}
      <div className="relative overflow-hidden border-b border-border">
        <div className="bg-atmosphere pointer-events-none absolute inset-0" aria-hidden="true" />
        <Container className="relative grid gap-8 py-10 md:py-14 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Tournaments", href: "/tournaments" }, { label: t.name }]} />
            <div className="mt-5 flex flex-wrap gap-2">
              <TournamentStatusBadge status={t.status} />
              <Badge tone="neutral">{t.game.name}</Badge>
              <CountdownBadge startDate={t.startDate} endDate={t.endDate} registrationDeadline={t.registrationDeadline} status={t.status} />
            </div>
            <h1 className="mt-4 text-display font-bold">{t.name}</h1>
            <p className="mt-2 text-muted">Organised by <span className="text-text">{t.organiser}</span></p>
            {t.status === "rumour" && (
              <p role="note" className="mt-5 flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                Unconfirmed: this event hasn&apos;t been officially announced yet. Details may change or the event may not happen.
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              {t.registrationUrl && t.status !== "completed" && t.status !== "cancelled" && (
                <Button asChild><a href={t.registrationUrl} target="_blank" rel="noopener noreferrer">Official registration <ExternalLink aria-hidden="true" /></a></Button>
              )}
              <Button asChild variant="secondary"><a href={t.officialSourceUrl} target="_blank" rel="noopener noreferrer">Official announcement <ExternalLink aria-hidden="true" /></a></Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <SaveButton size="sm" label="Follow" savedLabel="Following" item={{ kind: "tournament", slug: t.slug, name: t.name, game: t.game.name, startDate: t.startDate, endDate: t.endDate, registrationDeadline: t.registrationDeadline }} />
              <ReminderButtons t={t} />
            </div>
            <div className="mt-3"><ShareButtons path={`/tournaments/${t.slug}`} title={t.name} text={`${t.name} — ${t.game.name} tournament details & official links`} /></div>
            <p className="mt-4 text-xs text-subtle">Registration happens on the organiser&apos;s site. Shivanshi Gaming Hub never charges fees or handles registrations.</p>
          </div>
          <div className="relative hidden aspect-square lg:block">
            {t.featuredImage ? (
              <MediaImage image={t.featuredImage} fill priority sizes="(min-width:1024px) 40vw, 100vw" className="rounded-xl object-cover" />
            ) : (
              <TrophyScene />
            )}
          </div>
        </Container>
      </div>

      <Container className="grid gap-10 py-10 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <section aria-labelledby="about">
            <h2 id="about" className="text-2xl font-semibold">About this tournament</h2>
            <div className="prose-sgh mt-4" dangerouslySetInnerHTML={{ __html: t.descriptionHtml }} />
          </section>
          {t.formatHtml && (
            <section aria-labelledby="format" className="mt-10">
              <h2 id="format" className="text-2xl font-semibold">Format</h2>
              <div className="prose-sgh mt-4" dangerouslySetInnerHTML={{ __html: t.formatHtml }} />
            </section>
          )}
          <section aria-labelledby="sources" className="mt-10">
            <h2 id="sources" className="text-2xl font-semibold">Sources</h2>
            <ul className="mt-4 flex flex-col gap-2">
              {t.sources.map((s) => (
                <li key={s.id}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm hover:border-border-strong">
                    <Badge tone={s.type === "official" ? "success" : "neutral"}>{sourceLabel[s.type]}</Badge>
                    <span className="font-medium">{s.title}</span>
                    {s.publisher && <span className="text-muted">— {s.publisher}</span>}
                    <span className="ml-auto text-xs text-subtle">accessed {formatDate(s.accessedAt)}</span>
                  </a>
                </li>
              ))}
              {t.sources.length === 0 && <li className="text-sm text-muted">Only the official announcement linked above.</li>}
            </ul>
          </section>
          <p className="mt-8 text-sm text-muted">
            Spotted an error? <Link href={`/report?url=${encodeURIComponent(`/tournaments/${t.slug}`)}`} className="inline-flex items-center gap-1 text-secondary hover:underline"><Flag className="size-3.5" aria-hidden="true" /> Report it</Link>
          </p>
        </div>

        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <h2 className="mb-4 font-semibold">Key facts</h2>
            <dl className="grid gap-4 text-sm">
              <div>
                <dt className="flex items-center gap-2 text-subtle"><CalendarDays className="size-4" aria-hidden="true" /> Dates (IST)</dt>
                <dd className="mt-0.5 pl-6">{formatDateRange(t.startDate, t.endDate) ?? "Not announced"}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-subtle"><CalendarDays className="size-4" aria-hidden="true" /> Registration closes</dt>
                <dd className="mt-0.5 pl-6">{formatDateTime(t.registrationDeadline) ?? "Not announced"}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-subtle"><Trophy className="size-4" aria-hidden="true" /> Prize pool</dt>
                <dd className="mt-0.5 pl-6">{prize ? <>{prize} <span className="text-xs text-subtle">(as announced by the organiser)</span></> : "Not announced / not verified"}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-subtle"><Users className="size-4" aria-hidden="true" /> Eligibility</dt>
                <dd className="mt-0.5 pl-6">
                  {t.eligibilitySummary ?? "See the official announcement"}
                  {t.eligibility.minAge != null && <> · {t.eligibility.minAge}+</>}
                  {t.eligibility.region && <> · {t.eligibility.region}</>}
                  {t.eligibility.notes && <span className="mt-1 block text-muted">{t.eligibility.notes}</span>}
                </dd>
              </div>
            </dl>
          </Card>
          <Card className="p-5 text-sm">
            <h2 className="mb-2 flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-success" aria-hidden="true" /> Verification</h2>
            {t.verification.lastVerifiedAt ? (
              <>
                <p>Checked against official sources on {formatDate(t.verification.lastVerifiedAt)}.</p>
                {t.verification.notes && <p className="mt-1 text-muted">{t.verification.notes}</p>}
              </>
            ) : (
              <p className="text-warning">Not yet verified against an official source.</p>
            )}
            <p className="mt-3 text-xs text-subtle">Last updated {formatDate(t.updatedAt)}</p>
          </Card>
        </aside>
      </Container>

      {t.related.length > 0 && (
        <Container className="pb-16">
          <h2 className="mb-5 text-2xl font-semibold">More {t.game.name} tournaments</h2>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {t.related.map((r) => <li key={r.id}><TournamentCard t={r} /></li>)}
          </ul>
        </Container>
      )}
    </article>
  );
}
