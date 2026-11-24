import Link from "next/link";
import type { SensitivitySummary } from "@sgh/shared";
import { Card } from "@/components/ui/card";
import { gyroLabel, playstyleLabel } from "@/lib/format";
import { ProvenanceBadge } from "./provenance";

export function ConfigCard({ c }: { c: SensitivitySummary }) {
  return (
    <Card interactive className="flex h-full flex-col gap-3 p-5">
      <div className="flex flex-wrap gap-2"><ProvenanceBadge provenance={c.provenance} /><span className="font-mono text-xs text-subtle">{c.fps} FPS</span></div>
      <h3 className="font-semibold">
        <Link href={`/sensitivity/${c.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none">{c.title}</Link>
      </h3>
      <p className="mt-auto text-sm text-muted">{gyroLabel[c.gyroscope]} · {playstyleLabel[c.playstyle]}{c.gameVersion && ` · v${c.gameVersion}`}</p>
    </Card>
  );
}
