import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { RoomCard } from "@/components/play/room-card";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/states";
import type { RoomCard as Room } from "@/lib/play/types";

/**
 * Home-page block for Shivanshi Custom Rooms. Shows live/upcoming rooms first; when nothing is scheduled it falls
 * back to the latest results so the section never looks dead.
 */
export function CustomRoomsSection({ upcoming, completed }: { upcoming: Room[]; completed: Room[] }) {
  const showingResults = upcoming.length === 0 && completed.length > 0;
  const rooms = (upcoming.length ? upcoming : completed).slice(0, 3);
  return (
    <Section
      id="custom-rooms"
      eyebrow="Shivanshi Custom Rooms"
      title={showingResults ? "Recent custom room results" : "Upcoming BGMI custom rooms"}
      description="Free solo, duo and squad matches on Erangel, Livik and more. Register your squad, get your slot and win SGC coins."
      className="pb-0 lg:pb-0"
      action={
        <Button asChild variant="secondary">
          <Link href="/custom-rooms">View all rooms <ArrowRight aria-hidden="true" /></Link>
        </Button>
      }
    >
      {rooms.length === 0 ? (
        <EmptyState
          level={3}
          title="No custom rooms scheduled right now"
          description="New rooms are announced on our YouTube and Instagram. Sign in and build your squad so you're ready."
          action={<Button asChild size="sm"><Link href="/account">Create or join a squad</Link></Button>}
        />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((r, i) => (
            <li key={r.slug} className="relative" data-reveal style={{ "--reveal-i": i } as React.CSSProperties}>
              <RoomCard room={r} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-5 flex items-start gap-2 text-sm text-subtle">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Always free, 18+ only. No entry fees, betting or real money.
      </p>
    </Section>
  );
}
