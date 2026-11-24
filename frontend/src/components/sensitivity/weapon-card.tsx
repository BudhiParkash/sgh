import Link from "next/link";
import type { WeaponSummary } from "@sgh/shared";
import { Card } from "@/components/ui/card";

export function WeaponCard({ w }: { w: WeaponSummary }) {
  return (
    <Card interactive className="flex h-full flex-col justify-between gap-6 p-5">
      <span className="font-mono text-xs text-subtle">{w.type}</span>
      <h3 className="font-display text-2xl font-bold tracking-wide">
        <Link href={`/sensitivity/guns/${w.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">
          {w.name}
        </Link>
      </h3>
      <span className="text-xs text-muted">{w.game.name} guide →</span>
    </Card>
  );
}
