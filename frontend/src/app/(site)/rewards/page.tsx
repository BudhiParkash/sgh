import type { Metadata } from "next";
import { RewardsClient } from "@/components/play/rewards-client";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { JsonLd, breadcrumbLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Daily Spin & BGMI Rewards — free SGC coins",
  description:
    "Spin the wheel every day for free SGC coins, build your streak and redeem official BGMI UC and Royal Pass gift vouchers. Free to play — no purchases, no betting.",
  path: "/rewards",
});

export default function RewardsPage() {
  return (
    <Container className="py-8 md:py-12">
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Rewards", path: "/rewards" }])} />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Rewards" }]} />
      <header className="mt-4 mb-10 max-w-3xl">
        <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-primary-hover uppercase">SGC coins</p>
        <h1 className="text-display font-bold">Daily spin &amp; rewards</h1>
        <p className="mt-3 text-muted md:text-lg">
          Come back every day: spin for free SGC coins, keep your streak alive for bonus coins, win custom rooms, and redeem official BGMI gift vouchers. 18+ only. Not affiliated with KRAFTON.
        </p>
      </header>
      <RewardsClient />
    </Container>
  );
}
