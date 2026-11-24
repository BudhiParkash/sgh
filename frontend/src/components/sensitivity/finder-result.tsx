import Link from "next/link";
import { ArrowRight, Download } from "lucide-react";
import type { SensitivityFindResult } from "@sgh/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { gyroLabel, playstyleLabel } from "@/lib/format";
import { ConfigCard } from "./config-card";
import { SaveButton } from "@/components/retention/save-button";
import { ProvenanceBanner } from "./provenance";
import { ValuesTable } from "./values-table";

const MATCH_TEXT = {
  exact: "Exact match for your phone, FPS, gyroscope mode and playstyle.",
  nearest: "Closest setup for your phone — it differs in FPS, gyroscope mode or playstyle (shown below). Adjust as described.",
  baseline: "We haven't tested your phone yet. This is a baseline for phones in the same class.",
};

export function FinderResult({ result, requested }: { result: SensitivityFindResult; requested: { fps: number; gyro: string; style: string } }) {
  if (result.match === "none" || !result.config) {
    return (
      <EmptyState
        title="No setup for this phone yet"
        description="We only publish settings after testing. Try a different FPS or check back soon — or submit your own share code."
        action={<Button asChild variant="secondary" size="sm"><Link href="/sensitivity/codes">Share your code</Link></Button>}
      />
    );
  }
  const c = result.config;
  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4 p-5 md:p-6">
        <p className="text-sm font-medium text-primary-hover">{MATCH_TEXT[result.match]}</p>
        <h2 className="text-2xl font-bold">{c.title}</h2>
        <p className="text-sm text-muted">
          {c.fps} FPS · {gyroLabel[c.gyroscope]} · {playstyleLabel[c.playstyle]}
          {result.match === "nearest" && ` (you asked for ${requested.fps} FPS, ${gyroLabel[requested.gyro as keyof typeof gyroLabel] ?? requested.gyro}, ${requested.style})`}
        </p>
        <ProvenanceBanner provenance={c.provenance} testedBy={c.testing?.testedBy} testedAt={c.testing?.testedAt} deviceUsed={c.testing?.deviceUsed} gameVersion={c.gameVersion} />
        <ValuesTable values={c.values} caption={`Sensitivity values for ${c.title}`} />
        <div className="flex flex-wrap gap-3">
          <Button asChild><Link href={`/sensitivity/${c.slug}`}>Full guide & explanation <ArrowRight aria-hidden="true" /></Link></Button>
          <Button asChild variant="secondary"><a href={`/sensitivity/${c.slug}/card.png?v=${c.version}`} download={`${c.slug}.png`}><Download aria-hidden="true" /> Download card</a></Button>
          <SaveButton item={{ kind: "setup", slug: c.slug, title: c.title, fps: c.fps, gyroscope: c.gyroscope, device: c.device ? `${c.device.brand} ${c.device.model}` : null }} />
        </div>
      </Card>
      {result.alternatives.length > 0 && (
        <div>
          <h3 className="mb-3 font-semibold">Other setups</h3>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{result.alternatives.map((a) => <li key={a.id}><ConfigCard c={a} /></li>)}</ul>
        </div>
      )}
    </div>
  );
}
