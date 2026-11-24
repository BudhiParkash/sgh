import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { BrandSummary, DeviceSummary } from "@sgh/shared";
import { DeviceCard } from "@/components/sensitivity/device-card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { apiGetOr } from "@/lib/api/server";
import { JsonLd, breadcrumbLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

async function load(brand: string) {
  if (!/^[a-z0-9-]{1,40}$/.test(brand)) return null;
  const [brands, devices] = await Promise.all([
    apiGetOr<BrandSummary[]>("/devices/brands", [], { tags: ["devices"] }),
    apiGetOr<DeviceSummary[]>("/devices", [], { tags: ["devices", `brand:${brand}`], searchParams: { brand, hasConfigs: "true", limit: 60 } }),
  ]);
  const b = brands.find((x) => x.brandSlug === brand);
  return b ? { b, devices } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ brand: string }> }): Promise<Metadata> {
  const { brand } = await params;
  const d = await load(brand);
  if (!d) return { title: "Brand not found", robots: { index: false } };
  return buildMetadata({ title: `BGMI sensitivity for ${d.b.brand} phones`, description: `Tested BGMI sensitivity setups for ${d.devices.length} ${d.b.brand} phone${d.devices.length === 1 ? "" : "s"}: camera, ADS and gyro values per scope.`, path: `/sensitivity/devices/${brand}` });
}

export default async function BrandPage({ params }: { params: Promise<{ brand: string }> }) {
  const { brand } = await params;
  const d = await load(brand);
  if (!d) notFound();
  return (
    <Container className="py-10 md:py-16">
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Sensitivity", path: "/sensitivity" }, { name: "Devices", path: "/sensitivity/devices" }, { name: d.b.brand, path: `/sensitivity/devices/${brand}` }])} />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Sensitivity", href: "/sensitivity" }, { label: "Devices", href: "/sensitivity/devices" }, { label: d.b.brand }]} />
      <h1 className="mt-4 text-display font-bold">{d.b.brand} sensitivity settings</h1>
      <p className="mt-3 text-muted">{d.b.configCount} published setup{d.b.configCount === 1 ? "" : "s"} across {d.devices.length} phone{d.devices.length === 1 ? "" : "s"}.</p>
      <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">{d.devices.map((x) => <li key={x.id}><DeviceCard d={x} /></li>)}</ul>
    </Container>
  );
}
