import type { Metadata } from "next";
import type { WeaponSummary } from "@sgh/shared";
import { WeaponCard } from "@/components/sensitivity/weapon-card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/states";
import { apiGetOr } from "@/lib/api/server";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;
export const metadata: Metadata = buildMetadata({
  title: "BGMI gun guides — M416, AKM, M762, UMP and more",
  description: "How each BGMI gun behaves and which scope sensitivity rows matter for it. Sensitivity is set per scope, not per gun — here's what that means for recoil control.",
  path: "/sensitivity/guns",
});

export default async function GunsPage() {
  const weapons = await apiGetOr<WeaponSummary[]>("/weapons", [], { tags: ["weapons"] });
  return (
    <Container className="py-10 md:py-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Sensitivity", href: "/sensitivity" }, { label: "Gun guides" }]} />
      <h1 className="mt-4 text-display font-bold">Gun guides</h1>
      <p className="mt-3 max-w-2xl text-muted">BGMI has no per-gun sensitivity setting. Each guide explains recoil, range and the scopes you&apos;ll use most — then points you to those rows in a tested setup for your phone.</p>
      {weapons.length === 0 ? <EmptyState className="mt-10" title="Gun guides are being written" /> : <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">{weapons.map((w) => <li key={w.id}><WeaponCard w={w} /></li>)}</ul>}
    </Container>
  );
}
