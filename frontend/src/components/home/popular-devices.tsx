import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { BrandSummary, DeviceSummary } from "@sgh/shared";
import { DeviceCard } from "@/components/sensitivity/device-card";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/container";

export function PopularDevices({ devices, brands }: { devices: DeviceSummary[]; brands: BrandSummary[] }) {
  if (devices.length === 0) return null;
  return (
    <Section
      id="devices"
      eyebrow="Devices"
      title="Popular devices"
      action={<Button asChild variant="secondary"><Link href="/sensitivity/devices">All devices <ArrowRight aria-hidden="true" /></Link></Button>}
    >
      {brands.length > 0 && (
        <ul className="mb-6 flex flex-wrap gap-2" aria-label="Brands">
          {brands.map((b) => (
            <li key={b.brandSlug}>
              <Link href={`/sensitivity/devices/${b.brandSlug}`} className="inline-flex min-h-11 items-center rounded-full border border-border-strong px-4 text-sm text-muted hover:border-primary/60 hover:text-text">
                {b.brand} <span className="ml-2 text-xs text-subtle">{b.configCount}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <ul className="snap-row sm:[grid-auto-columns:minmax(44%,1fr)] lg:grid lg:grid-flow-row lg:grid-cols-4 lg:overflow-visible" aria-label="Popular devices">
        {devices.slice(0, 8).map((d, i) => (
          <li key={d.id} data-reveal style={{ "--reveal-i": i % 4 } as React.CSSProperties}>
            <DeviceCard d={d} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
