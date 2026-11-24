import { FlaskConical, Info, Users } from "lucide-react";
import type { Provenance } from "@sgh/shared";
import { Badge } from "@/components/ui/badge";
import { formatDate, provenanceLabel, provenanceTone } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  return <Badge tone={provenanceTone[provenance]}>{provenanceLabel[provenance]}</Badge>;
}

/** Honest label of where a setup comes from — shown on every setup. */
export function ProvenanceBanner({ provenance, testedBy, testedAt, deviceUsed, gameVersion, className }: { provenance: Provenance; testedBy?: string | null; testedAt?: string | null; deviceUsed?: string | null; gameVersion?: string | null; className?: string }) {
  const content = {
    tested: { icon: FlaskConical, tone: "border-primary/40 bg-primary/10", text: <>Tested by <strong>{testedBy}</strong>{deviceUsed && <> on {deviceUsed}</>}{testedAt && <>, {formatDate(testedAt)}</>}{gameVersion && <> (game version {gameVersion})</>}.</> },
    community_submitted: { icon: Users, tone: "border-secondary/40 bg-secondary/10", text: <>Submitted by the community and reviewed by our team, but not tested by us on this exact device{gameVersion && <> (game version {gameVersion})</>}.</> },
    baseline: { icon: Info, tone: "border-border-strong bg-surface-2", text: <>Baseline for this class of device — <strong>not tested on your exact phone</strong>. Use it as a starting point and fine-tune.</> },
  }[provenance];
  const Icon = content.icon;
  return (
    <p role="note" className={cn("flex gap-3 rounded-lg border p-4 text-sm", content.tone, className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <span>{content.text}</span>
    </p>
  );
}
