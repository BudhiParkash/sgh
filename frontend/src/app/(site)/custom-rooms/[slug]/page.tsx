import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, Coins, Crown, Map as MapIcon, Radio, Users } from "lucide-react";
import { RoomActions } from "@/components/play/room-actions";
import { RoomStateBadge } from "@/components/play/room-card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { apiGet } from "@/lib/api/server";
import { formatDateTime } from "@/lib/format";
import { MAP_LABEL, MODE_LABEL, youtubeEmbed, type RoomDetail } from "@/lib/play/types";
import { JsonLd, breadcrumbLd } from "@/lib/seo/jsonld";
import { absoluteUrl, buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 120;

const load = async (slug: string) => (await apiGet<RoomDetail>(`/rooms/${encodeURIComponent(slug)}`, { tags: ["rooms", `room:${slug}`], revalidate: 120 }))?.data ?? null;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const room = await load(slug).catch(() => null);
  if (!room) return { title: "Custom room not found", robots: { index: false } };
  const maps = room.maps.map((m) => MAP_LABEL[m] ?? m).join(", ");
  return buildMetadata({
    title: `${room.title} — BGMI ${MODE_LABEL[room.mode]} custom room`,
    description: `Free BGMI (PUBG Mobile) ${MODE_LABEL[room.mode].toLowerCase()} custom room${maps ? ` on ${maps}` : ""}. ${room.slotsFilled}/${room.slotsTotal} slots filled. Register, watch live, and see standings and winners.`.slice(0, 160),
    path: `/custom-rooms/${room.slug}`,
    noindex: room.status === "cancelled",
  });
}

const matchStatus: Record<RoomDetail["matches"][number]["status"], { label: string; tone: "neutral" | "danger" | "success" | "warning" }> = {
  scheduled: { label: "Scheduled", tone: "neutral" },
  live: { label: "LIVE", tone: "danger" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "warning" },
};

export default async function RoomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const room = await load(slug);
  if (!room) notFound();

  const liveMatch = room.matches.find((m) => m.status === "live" && youtubeEmbed(m.streamUrl));
  const replay = !liveMatch ? [...room.matches].reverse().find((m) => m.status === "completed" && youtubeEmbed(m.streamUrl)) : undefined;
  const stream = liveMatch ?? replay;
  const hasResults = room.standings.some((s) => s.matchesPlayed > 0);
  const winners = room.status === "completed" ? room.standings.slice(0, 3) : [];
  const first = room.matches[0];
  const crumbs = [{ name: "Home", path: "/" }, { name: "Custom Rooms", path: "/custom-rooms" }, { name: room.title, path: `/custom-rooms/${room.slug}` }];
  const eventLd = first
    ? {
        "@context": "https://schema.org",
        "@type": "Event",
        name: room.title,
        description: room.summary || `Free BGMI ${MODE_LABEL[room.mode]} custom room by Shivanshi Gaming Hub.`,
        startDate: first.scheduledAt,
        eventStatus: room.status === "cancelled" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
        location: { "@type": "VirtualLocation", url: absoluteUrl(`/custom-rooms/${room.slug}`) },
        organizer: { "@type": "Organization", name: "Shivanshi Gaming Hub", url: absoluteUrl("/") },
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: 0, priceCurrency: "INR", availability: room.registration === "open" ? "https://schema.org/InStock" : "https://schema.org/SoldOut", url: absoluteUrl(`/custom-rooms/${room.slug}`) },
      }
    : null;

  return (
    <Container className="py-8 md:py-12">
      <JsonLd data={[breadcrumbLd(crumbs), ...(eventLd ? [eventLd] : [])]} />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Custom Rooms", href: "/custom-rooms" }, { label: room.title }]} />

      <header className="mt-4 mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <RoomStateBadge room={room} />
          <Badge tone="primary">{MODE_LABEL[room.mode]} · {room.perspective.toUpperCase()}</Badge>
          <Badge tone="neutral">BGMI</Badge>
        </div>
        <h1 className="text-display font-bold">{room.title}</h1>
        {room.summary && <p className="mt-3 max-w-3xl text-muted md:text-lg">{room.summary}</p>}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-8">
          {stream && (
            <section aria-labelledby="stream-h">
              <h2 id="stream-h" className="mb-3 flex items-center gap-2 text-xl font-bold">
                {liveMatch ? <><Radio className="size-5 animate-pulse text-danger" aria-hidden="true" /> Live now — Match {stream.no}</> : <>Replay — Match {stream.no}</>}
              </h2>
              <div className="aspect-video overflow-hidden rounded-xl border border-border bg-black">
                <iframe src={youtubeEmbed(stream.streamUrl)!} title={`${room.title} — match ${stream.no} stream`} className="size-full" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
              </div>
            </section>
          )}

          {winners.length > 0 && (
            <section aria-labelledby="winners-h">
              <h2 id="winners-h" className="mb-3 text-xl font-bold">Winners</h2>
              <ol className="grid gap-3 sm:grid-cols-3">
                {winners.map((w) => {
                  const prize = room.prizes.find((p) => p.rank === w.rank);
                  return (
                    <li key={w.entryId}>
                      <Card className={w.rank === 1 ? "border-accent/60 p-4" : "p-4"}>
                        <p className="flex items-center gap-2 text-sm font-semibold text-accent"><Crown className="size-4" aria-hidden="true" /> #{w.rank}</p>
                        <p className="mt-1 text-lg font-bold">{w.teamTag && <span className="text-muted">[{w.teamTag}] </span>}{w.teamName}</p>
                        <p className="text-sm text-muted">{w.total} pts · {w.kills} kills</p>
                        {prize && prize.coinsPerPlayer > 0 && <p className="mt-1 text-sm text-accent">{prize.coinsPerPlayer.toLocaleString("en-IN")} SGC per player</p>}
                      </Card>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          <section aria-labelledby="matches-h">
            <h2 id="matches-h" className="mb-3 text-xl font-bold">Matches</h2>
            <ul className="flex flex-col gap-2">
              {room.matches.map((m) => (
                <li key={m.no}>
                  <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 font-bold">{m.no}</span>
                      <div>
                        <p className="flex items-center gap-1.5 font-semibold"><MapIcon className="size-4 text-muted" aria-hidden="true" /> {MAP_LABEL[m.map] ?? m.map}</p>
                        <p className="flex items-center gap-1.5 text-sm text-muted"><CalendarDays className="size-4" aria-hidden="true" /> {formatDateTime(m.scheduledAt)} IST</p>
                      </div>
                    </div>
                    <Badge tone={matchStatus[m.status].tone}>{matchStatus[m.status].label}</Badge>
                  </Card>
                </li>
              ))}
            </ul>
          </section>

          {hasResults && (
            <section aria-labelledby="standings-h">
              <h2 id="standings-h" className="mb-3 text-xl font-bold">{room.status === "completed" ? "Final standings" : "Standings"}</h2>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[520px] text-sm">
                  <caption className="sr-only">Points table: placement points plus {room.points.perKill} per kill</caption>
                  <thead className="bg-surface-2 text-left text-xs text-muted uppercase">
                    <tr>
                      <th scope="col" className="px-3 py-2">#</th>
                      <th scope="col" className="px-3 py-2">Team</th>
                      <th scope="col" className="px-3 py-2 text-right">Matches</th>
                      <th scope="col" className="px-3 py-2 text-right">Place pts</th>
                      <th scope="col" className="px-3 py-2 text-right">Kills</th>
                      <th scope="col" className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {room.standings.map((s) => (
                      <tr key={s.entryId} className="border-t border-border">
                        <td className="px-3 py-2 font-bold">{s.rank}</td>
                        <th scope="row" className="px-3 py-2 text-left font-medium">{s.teamTag && <span className="text-muted">[{s.teamTag}] </span>}{s.teamName}</th>
                        <td className="px-3 py-2 text-right">{s.matchesPlayed}</td>
                        <td className="px-3 py-2 text-right">{s.placementPoints}</td>
                        <td className="px-3 py-2 text-right">{s.kills}</td>
                        <td className="px-3 py-2 text-right font-bold">{s.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section aria-labelledby="teams-h">
            <h2 id="teams-h" className="mb-3 flex items-center gap-2 text-xl font-bold"><Users className="size-5" aria-hidden="true" /> Teams ({room.slotsFilled}/{room.slotsTotal})</h2>
            {room.entries.length ? (
              <ol className="grid gap-2 sm:grid-cols-2">
                {room.entries.map((e) => (
                  <li key={e.slot} className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                    <span className="w-8 font-mono text-muted">#{e.slot}</span>
                    <span className="font-medium">{e.teamTag && <span className="text-muted">[{e.teamTag}] </span>}{e.teamName}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">No teams yet — be the first to register.</p>
            )}
            {room.waitlistCount > 0 && <p className="mt-2 text-sm text-muted">{room.waitlistCount} team(s) on the waitlist.</p>}
          </section>

          {room.rulesHtml && (
            <section aria-labelledby="rules-h">
              <h2 id="rules-h" className="mb-3 text-xl font-bold">Room rules</h2>
              <div className="prose-sgh" dangerouslySetInnerHTML={{ __html: room.rulesHtml }} />
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-[calc(var(--header-h)+1rem)] lg:self-start">
          <RoomActions slug={room.slug} mode={room.mode} registration={room.registration} />
          <Card className="flex flex-col gap-3 p-5 text-sm">
            <h2 className="text-lg font-bold">Details</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-muted">Registration</dt>
              <dd>{formatDateTime(room.registrationOpensAt)} – {formatDateTime(room.registrationClosesAt)} IST</dd>
              <dt className="text-muted">Slots</dt>
              <dd>{room.slotsTotal} {room.mode === "solo" ? "players" : "teams"}</dd>
              <dt className="text-muted">Points</dt>
              <dd>Placement {room.points.placement.join("-")} (then 0) + {room.points.perKill}/kill</dd>
              <dt className="text-muted">Entry</dt>
              <dd className="text-success">Free</dd>
            </dl>
            {room.prizes.length > 0 && (
              <>
                <h3 className="mt-2 flex items-center gap-2 font-semibold"><Coins className="size-4 text-accent" aria-hidden="true" /> Prizes</h3>
                <ul className="flex flex-col gap-1">
                  {room.prizes.map((p) => (
                    <li key={p.rank} className="flex justify-between gap-2">
                      <span>#{p.rank}{p.label && ` · ${p.label}`}</span>
                      {p.coinsPerPlayer > 0 && <span className="text-accent">{p.coinsPerPlayer.toLocaleString("en-IN")} SGC each</span>}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-subtle">SGC coins have no cash value and can be used in the rewards store.</p>
              </>
            )}
          </Card>
        </aside>
      </div>
    </Container>
  );
}
