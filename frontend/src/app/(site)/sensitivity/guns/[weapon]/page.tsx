import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { SensitivitySummary, WeaponDetail } from "@sgh/shared";
import { ConfigCard } from "@/components/sensitivity/config-card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { getPreviewItem } from "@/lib/api/preview";
import { apiGet } from "@/lib/api/server";
import { formatDate } from "@/lib/format";
import { JsonLd, breadcrumbLd } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;
type Detail = WeaponDetail & { testedSetups?: SensitivitySummary[] };

async function load(slug: string): Promise<{ w: Detail; preview: boolean } | null> {
  const preview = await getPreviewItem<Detail>("weapon");
  if (preview && preview.slug === slug) return { w: preview, preview: true };
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const r = await apiGet<Detail>(`/weapons/${slug}`, { tags: ["weapons", `weapon:${slug}`], revalidate: 3600 });
  return r ? { w: r.data, preview: false } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ weapon: string }> }): Promise<Metadata> {
  const { weapon } = await params;
  const res = await load(weapon).catch(() => null);
  if (!res) return { title: "Gun guide not found", robots: { index: false } };
  const { w } = res;
  return buildMetadata({
    title: `${w.name} sensitivity & recoil guide (${w.game.name})`,
    description: `How the ${w.name} (${w.type}${w.ammo ? `, ${w.ammo}` : ""}) behaves in ${w.game.name}, the scopes that matter for it, and where to find tested sensitivity values for those scopes.`,
    path: `/sensitivity/guns/${w.slug}`,
    seo: w.seo,
    image: w.image,
    type: "article",
    modifiedTime: w.updatedAt,
    noindex: res.preview,
  });
}

export default async function WeaponPage({ params }: { params: Promise<{ weapon: string }> }) {
  const { weapon } = await params;
  const res = await load(weapon);
  if (!res) notFound();
  const { w } = res;
  return (
    <article>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Sensitivity", path: "/sensitivity" }, { name: "Gun guides", path: "/sensitivity/guns" }, { name: w.name, path: `/sensitivity/guns/${w.slug}` }])} />
      <Container className="py-10 md:py-16">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Sensitivity", href: "/sensitivity" }, { label: "Gun guides", href: "/sensitivity/guns" }, { label: w.name }]} />
        <header className="mt-5 max-w-3xl">
          <div className="flex gap-2"><Badge tone="primary">{w.type}</Badge>{w.ammo && <Badge>{w.ammo}</Badge>}<Badge>{w.game.name}</Badge></div>
          <h1 className="mt-3 text-display font-bold">{w.name} sensitivity &amp; recoil guide</h1>
          <p className="mt-4 text-lg text-muted">
            There is no separate {w.name} sensitivity in {w.game.name}: the game uses the values of the scope mounted on the gun.
            {w.recommendedScopes.length > 0 && <> For the {w.name}, the rows that matter most are <strong className="text-text">{w.recommendedScopes.map((s) => s.label).join(", ")}</strong>.</>}
          </p>
        </header>
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            <section aria-labelledby="behaviour"><h2 id="behaviour" className="text-2xl font-semibold">How it behaves</h2><div className="prose-sgh mt-4" dangerouslySetInnerHTML={{ __html: w.recoilNotesHtml }} /></section>
            {w.attachmentNotesHtml && <section aria-labelledby="attachments" className="mt-10"><h2 id="attachments" className="text-2xl font-semibold">Attachments</h2><div className="prose-sgh mt-4" dangerouslySetInnerHTML={{ __html: w.attachmentNotesHtml }} /></section>}
            {w.testedSetups && w.testedSetups.length > 0 && (
              <section aria-labelledby="setups" className="mt-12">
                <h2 id="setups" className="text-2xl font-semibold">Tested setups to start from</h2>
                <p className="mt-2 text-muted">Open a setup for your phone and look at the {w.recommendedScopes.map((s) => s.label).join(" / ") || "scope"} rows.</p>
                <ul className="mt-5 grid gap-4 sm:grid-cols-2">{w.testedSetups.map((c) => <li key={c.id}><ConfigCard c={c} /></li>)}</ul>
              </section>
            )}
          </div>
          <aside>
            <Card className="p-5 text-sm">
              <h2 className="mb-2 font-semibold">Find your values</h2>
              <p className="text-muted">Use the finder to get a setup for your phone, FPS and gyroscope mode.</p>
              <Link href="/sensitivity" className="mt-3 inline-block text-secondary hover:underline">Open the sensitivity finder →</Link>
              <p className="mt-4 text-xs text-subtle">Updated {formatDate(w.updatedAt)}</p>
            </Card>
          </aside>
        </div>
      </Container>
    </article>
  );
}
