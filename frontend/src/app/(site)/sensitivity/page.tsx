import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FPS_OPTIONS, GYRO_MODES, PLAYSTYLES, type BrandSummary, type DeviceDetail, type DeviceSummary, type GyroMode, type Playstyle, type SensitivityFindResult, type WeaponSummary } from "@sgh/shared";
import { SensitivityScene } from "@/components/home/sensitivity-scene";
import { DeviceCard } from "@/components/sensitivity/device-card";
import { SensitivityExplainer } from "@/components/sensitivity/explainer";
import { FinderForm } from "@/components/sensitivity/finder-form";
import { FinderResult } from "@/components/sensitivity/finder-result";
import { WeaponCard } from "@/components/sensitivity/weapon-card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/states";
import { apiGet, apiGetOr } from "@/lib/api/server";
import { buildMetadata } from "@/lib/seo/metadata";

interface Search {
  device?: string;
  fps?: string;
  gyro?: string;
  style?: string;
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const sp = await searchParams;
  return buildMetadata({
    title: "BGMI sensitivity settings — finder, tested setups & gyro guide",
    description: "Find BGMI sensitivity settings for your phone, FPS and gyroscope mode. Every setup shows who tested it, on which device and game version. Camera, ADS and gyro explained.",
    path: "/sensitivity",
    noindex: Boolean(sp.device), // finder results are personalised duplicates
  });
}

export default async function SensitivityHub({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const fps = Number(sp.fps);
  const valid =
    sp.device && /^[a-z0-9-]{1,120}$/.test(sp.device) && (FPS_OPTIONS as readonly number[]).includes(fps) && (GYRO_MODES as readonly string[]).includes(sp.gyro ?? "") && (PLAYSTYLES as readonly string[]).includes(sp.style ?? "");

  const [brands, devices, weapons, result, selected] = await Promise.all([
    apiGetOr<BrandSummary[]>("/devices/brands", [], { tags: ["devices"] }),
    apiGetOr<DeviceSummary[]>("/devices", [], { tags: ["devices"], searchParams: { hasConfigs: "true", limit: 8 } }),
    apiGetOr<WeaponSummary[]>("/weapons", [], { tags: ["weapons"] }),
    valid ? apiGet<SensitivityFindResult>("/sensitivity/find", { tags: ["sensitivity"], searchParams: { device: sp.device, fps, gyroscope: sp.gyro, playstyle: sp.style } }).then((r) => r?.data ?? null).catch(() => null) : Promise.resolve(null),
    valid ? apiGetOr<DeviceDetail | null>(`/devices/${sp.device}`, null, { tags: ["devices"] }) : Promise.resolve(null),
  ]);

  return (
    <>
      <div className="relative overflow-hidden border-b border-border">
        <div className="bg-atmosphere pointer-events-none absolute inset-0" aria-hidden="true" />
        <Container className="relative grid gap-10 py-10 md:py-16 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Sensitivity" }]} />
            <h1 className="mt-4 text-display font-bold">BGMI sensitivity finder</h1>
            <p className="mt-3 max-w-xl text-muted md:text-lg">Pick your phone, frame rate, gyroscope mode and playstyle. Every setup shows who tested it, on which device and game version — or that it&apos;s a baseline.</p>
            <Card className="mt-8 p-5 md:p-6">
              {brands.length ? (
                <FinderForm brands={brands} initial={{ brand: selected?.brandSlug, device: sp.device, fps: valid ? fps : undefined, gyro: sp.gyro as GyroMode, style: sp.style as Playstyle }} />
              ) : (
                <EmptyState className="border-0 bg-transparent" title="Device setups are being tested" description="We publish a setup only after testing it on a real device. The first tested phones will appear here soon." />
              )}
            </Card>
          </div>
          <div className="relative hidden aspect-square lg:block" aria-hidden="true"><SensitivityScene /></div>
        </Container>
      </div>

      {valid && (
        <Container id="result" className="scroll-mt-24 py-10">
          {result ? <FinderResult result={result} requested={{ fps, gyro: sp.gyro!, style: sp.style! }} /> : <EmptyState title="Couldn't load a result" description="Please try again in a moment." />}
        </Container>
      )}

      <Container className="py-16"><SensitivityExplainer /></Container>

      {devices.length > 0 && (
        <Container className="pb-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="text-2xl font-bold">Devices with tested setups</h2>
            <Button asChild variant="secondary" size="sm"><Link href="/sensitivity/devices">All devices <ArrowRight aria-hidden="true" /></Link></Button>
          </div>
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">{devices.map((d) => <li key={d.id}><DeviceCard d={d} /></li>)}</ul>
        </Container>
      )}

      {weapons.length > 0 && (
        <Container className="pb-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="text-2xl font-bold">Gun guides</h2>
            <Button asChild variant="secondary" size="sm"><Link href="/sensitivity/guns">All guns <ArrowRight aria-hidden="true" /></Link></Button>
          </div>
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">{weapons.map((w) => <li key={w.id}><WeaponCard w={w} /></li>)}</ul>
        </Container>
      )}

      <Container className="pb-20">
        <ul className="grid gap-4 md:grid-cols-2">
          <li><Card interactive className="p-6"><h2 className="font-semibold"><Link href="/sensitivity/compare" className="after:absolute after:inset-0">Compare two setups →</Link></h2><p className="mt-1 text-sm text-muted">See every scope side by side with differences highlighted.</p></Card></li>
          <li><Card interactive className="p-6"><h2 className="font-semibold"><Link href="/sensitivity/codes" className="after:absolute after:inset-0">Share-code library →</Link></h2><p className="mt-1 text-sm text-muted">Verified in-game codes you can import directly — and submit your own.</p></Card></li>
        </ul>
      </Container>
    </>
  );
}
