import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import type { DeviceDetail } from "@sgh/shared";
import { DeviceScene } from "@/components/sensitivity/device-showcase";
import { ConfigCard } from "@/components/sensitivity/config-card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/states";
import { apiGet } from "@/lib/api/server";
import { formatDate } from "@/lib/format";
import { JsonLd, breadcrumbLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

async function load(slug: string) {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  return (await apiGet<DeviceDetail>(`/devices/${slug}`, { tags: ["devices", `device:${slug}`], revalidate: 3600 }))?.data ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ brand: string; slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await load(slug).catch(() => null);
  if (!d) return { title: "Device not found", robots: { index: false } };
  const name = `${d.brand} ${d.model}`;
  return buildMetadata({
    title: `BGMI sensitivity for ${name}`,
    description: `${d.configs.length} BGMI sensitivity setup${d.configs.length === 1 ? "" : "s"} for the ${name}${d.supportedFps.length ? ` (up to ${Math.max(...d.supportedFps)} FPS)` : ""}: camera, ADS and gyro values per scope, with who tested them and when.`,
    path: `/sensitivity/devices/${d.brandSlug}/${d.slug}`,
    seo: d.seo,
    image: d.image,
  });
}

export default async function DevicePage({ params }: { params: Promise<{ brand: string; slug: string }> }) {
  const { brand, slug } = await params;
  const d = await load(slug);
  if (!d) notFound();
  if (d.brandSlug !== brand) permanentRedirect(`/sensitivity/devices/${d.brandSlug}/${d.slug}`);
  const name = `${d.brand} ${d.model}`;
  const specs: [string, string | null][] = [
    ["Chipset", d.chipset],
    ["Display refresh rate", d.displayRefreshRateHz ? `${d.displayRefreshRateHz} Hz` : null],
    ["Screen size", d.screenSizeInches ? `${d.screenSizeInches}″` : null],
    ["In-game FPS options", d.supportedFps.length ? d.supportedFps.join(" / ") : null],
    ["Gyroscope", d.gyroscope ? "Yes" : "No"],
    ["Released", d.releaseYear ? String(d.releaseYear) : null],
  ];
  return (
    <Container className="py-10 md:py-16">
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Sensitivity", path: "/sensitivity" }, { name: "Devices", path: "/sensitivity/devices" }, { name: d.brand, path: `/sensitivity/devices/${d.brandSlug}` }, { name: d.model, path: `/sensitivity/devices/${d.brandSlug}/${d.slug}` }])} />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Sensitivity", href: "/sensitivity" }, { label: "Devices", href: "/sensitivity/devices" }, { label: d.brand, href: `/sensitivity/devices/${d.brandSlug}` }, { label: d.model }]} />
      <div className="mt-6 grid gap-10 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <h1 className="text-display font-bold">{name} BGMI sensitivity</h1>
          <p className="mt-3 text-muted md:text-lg">{d.configs.length ? `${d.configs.length} setup${d.configs.length === 1 ? "" : "s"} for this phone. Each shows who tested it and on which game version.` : "No setups for this phone yet."}</p>
          <h2 className="mt-10 mb-4 text-2xl font-semibold">Setups</h2>
          {d.configs.length ? <ul className="grid gap-4 sm:grid-cols-2">{d.configs.map((c) => <li key={c.id}><ConfigCard c={c} /></li>)}</ul> : <EmptyState level={3} title="No setups yet" />}
        </div>
        <aside className="flex flex-col gap-4">
          <div className="relative hidden aspect-[4/3] lg:block" aria-hidden="true">
            <DeviceScene />
          </div>
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Specs</h2>
            <dl className="grid gap-2 text-sm">
              {specs.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="text-right">{v}</dd></div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-subtle">
              {d.specSourceUrl && <a href={d.specSourceUrl} target="_blank" rel="noopener noreferrer" className="underline">Spec source</a>}
              {d.fpsSourceUrl && <> · <a href={d.fpsSourceUrl} target="_blank" rel="noopener noreferrer" className="underline">FPS source</a></>}
              {" "}· Updated {formatDate(d.updatedAt)}
            </p>
          </Card>
        </aside>
      </div>
    </Container>
  );
}
