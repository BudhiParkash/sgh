import Link from "next/link";
import { CalendarDays, Coins, Map as MapIcon, Radio, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { MAP_LABEL, MODE_LABEL, type RoomCard as Room } from "@/lib/play/types";

export function RoomStateBadge({ room }: { room: Pick<Room, "live" | "status" | "registration"> }) {
  if (room.live) return <Badge tone="danger" className="border-danger bg-danger/10"><Radio className="size-3 animate-pulse" aria-hidden="true" /> LIVE</Badge>;
  if (room.status === "completed") return <Badge tone="neutral">Completed</Badge>;
  if (room.status === "cancelled") return <Badge tone="warning">Cancelled</Badge>;
  if (room.registration === "open") return <Badge tone="success">Registration open</Badge>;
  if (room.registration === "not_open") return <Badge tone="info">Opens soon</Badge>;
  return <Badge tone="warning">Registration closed</Badge>;
}

export function RoomCard({ room }: { room: Room }) {
  const pct = Math.min(100, Math.round((room.slotsFilled / room.slotsTotal) * 100));
  const topPrize = room.prizes.find((p) => p.rank === 1);
  return (
    <Card interactive className="flex h-full flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <RoomStateBadge room={room} />
        <Badge tone="primary">{MODE_LABEL[room.mode]} · {room.perspective.toUpperCase()}</Badge>
      </div>
      <h3 className="text-lg font-bold leading-snug">
        <Link href={`/custom-rooms/${room.slug}`} className="after:absolute after:inset-0">{room.title}</Link>
      </h3>
      {room.summary && <p className="line-clamp-2 text-sm text-muted">{room.summary}</p>}
      <ul className="mt-auto flex flex-col gap-2 text-sm text-muted">
        {room.firstMatchAt && (
          <li className="flex items-center gap-2"><CalendarDays className="size-4 shrink-0" aria-hidden="true" /> {formatDateTime(room.firstMatchAt)} IST</li>
        )}
        {room.maps.length > 0 && (
          <li className="flex items-center gap-2"><MapIcon className="size-4 shrink-0" aria-hidden="true" /> {room.maps.map((m) => MAP_LABEL[m] ?? m).join(" · ")}</li>
        )}
        {topPrize && topPrize.coinsPerPlayer > 0 && (
          <li className="flex items-center gap-2 text-accent"><Coins className="size-4 shrink-0" aria-hidden="true" /> Winner: {topPrize.coinsPerPlayer.toLocaleString("en-IN")} SGC per player</li>
        )}
      </ul>
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted">
          <span className="flex items-center gap-1"><Users className="size-3.5" aria-hidden="true" /> Slots</span>
          <span>{room.slotsFilled}/{room.slotsTotal}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={room.slotsFilled} aria-valuemin={0} aria-valuemax={room.slotsTotal} aria-label="Slots filled">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </Card>
  );
}
