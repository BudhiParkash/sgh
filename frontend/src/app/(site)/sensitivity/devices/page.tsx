import type { Metadata } from "next";
import Link from "next/link";
import type { BrandSummary, DeviceSummary } from "@sgh/shared";
import { DeviceCard } from "@/components/sensitivity/device-card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/states";
import { apiGetOr } from "@/lib/api/server";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: "BGMI sensitivity by phone model",
  description: "Phones with tested BGMI sensitivity setups, grouped by brand — iQOO, POCO, Samsung, OnePlus, Realme, Xiaomi, iPhone and more.",
  path: "/sensitivity/devices",
});

export default async function DevicesPage() {
  const [brands, devices] = await Promise.all([
    apiGetOr<BrandSummary[]>("/devices/brands", [], { tags: ["devices"] }),
    apiGetOr<DeviceSummary[]>("/devices", [], { tags: ["devices"], searchParams: { hasConfigs: "true", limit: 60 } }),
  ]);
  return (
    <Container className="py-10 md:py-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Sensitivity", href: "/sensitivity" }, { label: "Devices" }]} />
      <h1 className="mt-4 text-display font-bold">Sensitivity by phone</h1>
      <p className="mt-3 max-w-2xl text-muted">Only phones with at least one published setup are listed. Don&apos;t see yours? The finder offers a clearly-labelled baseline for your phone&apos;s class.</p>
      {brands.length === 0 ? (
        <EmptyState className="mt-10" title="No devices yet" description="Tested devices will appear here as setups are published." />
      ) : (
        <>
          <ul className="mt-8 flex flex-wrap gap-2" aria-label="Brands">
            {brands.map((b) => (
              <li key={b.brandSlug}><Link href={`/sensitivity/devices/${b.brandSlug}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border-strong px-4 text-sm hover:border-primary/60">{b.brand}<span className="text-xs text-subtle">{b.deviceCount}</span></Link></li>
            ))}
          </ul>
          <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">{devices.map((d) => <li key={d.id}><DeviceCard d={d} /></li>)}</ul>
        </>
      )}
    </Container>
  );
}
