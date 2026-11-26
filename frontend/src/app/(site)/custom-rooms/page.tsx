import type { Metadata } from "next";
import Link from "next/link";
import { Coins, ShieldCheck, Trophy, Users } from "lucide-react";
import { RoomCard } from "@/components/play/room-card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/states";
import { apiGetOr } from "@/lib/api/server";
import type { RoomCard as Room } from "@/lib/play/types";
import { JsonLd, breadcrumbLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 300;

export const metadata: Metadata = buildMetadata({
  title: "BGMI Custom Rooms — free daily matches (PUBG Mobile)",
  description:
    "Join free Shivanshi Custom Rooms for BGMI (PUBG Mobile India): solo, duo and squad matches on Erangel, Livik and more. Register your squad, get your slot, watch live and see the winners.",
  path: "/custom-rooms",
});

export default async function CustomRoomsPage() {
  const [upcoming, completed] = await Promise.all([
    apiGetOr<Room[]>("/rooms", [], { tags: ["rooms"], revalidate: 300, searchParams: { status: "upcoming", limit: 24 } }),
    apiGetOr<Room[]>("/rooms", [], { tags: ["rooms"], revalidate: 300, searchParams: { status: "completed", limit: 9 } }),
  ]);
  const crumbs = [{ label: "Home", href: "/" }, { label: "Custom Rooms" }];
  return (
    <Container className="py-8 md:py-12">
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Custom Rooms", path: "/custom-rooms" }])} />
      <Breadcrumbs items={crumbs} />
      <header className="mt-4 mb-8 max-w-3xl">
        <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-primary-hover uppercase">Shivanshi Custom Rooms</p>
        <h1 className="text-display font-bold">BGMI custom rooms — free to play</h1>
        <p className="mt-3 text-muted md:text-lg">
          Solo, duo and squad custom matches for BGMI (Battlegrounds Mobile India, the Indian version of PUBG Mobile). Build your squad, register, get your slot and play — results and winners appear here, and big matches stream live.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild><Link href="/account">Create or join a squad</Link></Button>
          <Button asChild variant="secondary"><Link href="/legal/custom-room-rules">Read the rules</Link></Button>
        </div>
      </header>

      <ul className="mb-12 grid gap-3 sm:grid-cols-3" aria-label="How it works">
        {[
          { icon: Users, t: "1. Squad up", d: "Sign in with Google, add your BGMI name and Character ID, and invite your teammates with a code." },
          { icon: Trophy, t: "2. Register & play", d: "The captain registers the team. Room ID and password appear on the room page shortly before the match." },
          { icon: Coins, t: "3. Win SGC coins", d: "Winners get SGC coins to spend in the rewards store. Always free — no entry fees, ever." },
        ].map((s) => (
          <li key={s.t}>
            <Card className="h-full p-4">
              <s.icon className="mb-2 size-6 text-primary" aria-hidden="true" />
              <h2 className="font-semibold">{s.t}</h2>
              <p className="mt-1 text-sm text-muted">{s.d}</p>
            </Card>
          </li>
        ))}
      </ul>

      <section aria-labelledby="upcoming-h" className="mb-14">
        <h2 id="upcoming-h" className="mb-5 text-2xl font-bold">Upcoming &amp; live rooms</h2>
        {upcoming.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((r) => (
              <li key={r.slug} className="relative"><RoomCard room={r} /></li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No rooms scheduled right now" description="New custom rooms are announced on our YouTube and Instagram. Sign in and build your squad so you're ready." />
        )}
      </section>

      {completed.length > 0 && (
        <section aria-labelledby="results-h" className="mb-10">
          <h2 id="results-h" className="mb-5 text-2xl font-bold">Recent results</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {completed.map((r) => (
              <li key={r.slug} className="relative"><RoomCard room={r} /></li>
            ))}
          </ul>
        </section>
      )}

      <p className="flex items-start gap-2 text-sm text-subtle">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Free to play, 18+ only. No entry fees, betting or real money. Shivanshi Gaming Hub is not affiliated with KRAFTON; follow BGMI&apos;s terms of service.
      </p>
    </Container>
  );
}
