import Link from "next/link";
import { Download } from "lucide-react";
import type { ResourceSummary } from "@sgh/shared";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/container";

export function Resources({ resources }: { resources: ResourceSummary[] }) {
  if (resources.length === 0) return null;
  return (
    <Section id="resources" eyebrow="Resources" title="Latest resources" description="Downloadable sensitivity cards and handy references.">
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resources.slice(0, 6).map((r, i) => (
          <li key={r.id} data-reveal style={{ "--reveal-i": i % 3 } as React.CSSProperties}>
            <Card interactive className="flex h-full items-start gap-4 p-5">
              <div className="grid size-11 shrink-0 place-items-center rounded-md bg-surface-2 text-accent" aria-hidden="true">
                <Download className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold">
                  <Link href={r.href} className="after:absolute after:inset-0 focus-visible:outline-none">{r.title}</Link>
                </h3>
                <p className="mt-1 text-sm text-muted">{r.description}</p>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  );
}
