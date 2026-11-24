import type { TournamentDetail } from "@sgh/shared";
import { apiGet } from "@/lib/api/server";
import { buildIcs, type IcsEvent } from "@/lib/ics";
import { siteConfig } from "@/lib/site";

export const revalidate = 3600;

/** Calendar file: the tournament itself + a "registration closes" reminder (1 day before). */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return new Response("Not found", { status: 404 });
  const r = await apiGet<TournamentDetail>(`/tournaments/${slug}`, { tags: ["tournaments", `tournament:${slug}`], revalidate: 3600 }).catch(() => null);
  if (!r) return new Response("Not found", { status: 404 });
  const t = r.data;
  const url = `${siteConfig.url}/tournaments/${t.slug}`;
  const events: IcsEvent[] = [];
  if (t.registrationDeadline) {
    const d = new Date(t.registrationDeadline);
    events.push({ uid: `reg-${t.id}@shivanshigaming.com`, title: `Registration closes: ${t.name}`, start: new Date(d.getTime() - 30 * 60_000), end: d, description: `Register on the organiser's official page before the deadline. Details: ${url}`, url, alarmMinutes: 24 * 60 });
  }
  if (t.startDate) {
    const s = new Date(t.startDate);
    events.push({ uid: `event-${t.id}@shivanshigaming.com`, title: `${t.name} (${t.game.name})`, start: s, end: t.endDate ? new Date(t.endDate) : new Date(s.getTime() + 3 * 3_600_000), description: `Organised by ${t.organiser}. Official announcement: ${t.officialSourceUrl} — Details: ${url}`, url, alarmMinutes: 60 });
  }
  if (!events.length) return new Response("No dates announced yet", { status: 404 });
  return new Response(buildIcs(events), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${t.slug}.ics"`, "Cache-Control": "public, max-age=900, s-maxage=3600" },
  });
}
