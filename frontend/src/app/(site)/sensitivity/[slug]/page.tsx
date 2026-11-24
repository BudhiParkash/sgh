import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Flag } from "lucide-react";
import type { SensitivityDetail } from "@sgh/shared";
import { ProvenanceBanner, ProvenanceBadge } from "@/components/sensitivity/provenance";
import { ShareCode } from "@/components/sensitivity/share-code";
import { SaveButton } from "@/components/retention/save-button";
import { ShareButtons } from "@/components/retention/share-buttons";
import { FeedbackWidget } from "@/components/forms/feedback-widget";
import { apiGetOr } from "@/lib/api/server";
import { ValuesTable } from "@/components/sensitivity/values-table";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getPreviewItem } from "@/lib/api/preview";
import { apiGet } from "@/lib/api/server";
import { formatDate, gyroLabel, playstyleLabel } from "@/lib/format";
import { JsonLd, breadcrumbLd } from "@/lib/seo/jsonld";
import { absoluteUrl, buildMetadata } from "@/lib/seo/metadata";
import { siteConfig } from "@/lib/site";

export const revalidate = 3600;

async function load(slug: string) {
  const preview = await getPreviewItem<SensitivityDetail>("sensitivity");
  if (preview && preview.slug === slug) return { c: preview, preview: true };
  const r = await apiGet<SensitivityDetail>(`/sensitivity/${encodeURIComponent(slug)}`, { tags: ["sensitivity", `sensitivity:${slug}`], revalidate: 3600 });
  return r ? { c: r.data, preview: false } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const res = await load(slug).catch(() => null);
  if (!res) return { title: "Setup not found", robots: { index: false } };
  const { c } = res;
  const device = c.device ? `${c.device.brand} ${c.device.model}` : "your phone class";
  return buildMetadata({
    title: c.title,
    description: `${c.game.name} sensitivity for ${device} at ${c.fps} FPS (${gyroLabel[c.gyroscope].toLowerCase()}, ${c.playstyle}): camera, ADS and gyro values for every scope. ${c.provenance === "tested" ? "Tested" : c.provenance === "baseline" ? "Baseline" : "Community"} setup.`.slice(0, 160),
    path: `/sensitivity/${c.slug}`,
    seo: c.seo,
    image: { url: absoluteUrl(`/sensitivity/${c.slug}/card.png?v=${c.version}`), width: 1080, height: 1350, alt: c.title },
    type: "article",
    modifiedTime: c.updatedAt,
    noindex: res.preview,
  });
}

export default async function ConfigPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const res = await load(slug);
  if (!res) notFound();
  const { c, preview } = res;
  const crumbs = [{ name: "Home", path: "/" }, { name: "Sensitivity", path: "/sensitivity" }, ...(c.device ? [{ name: `${c.device.brand} ${c.device.model}`, path: `/sensitivity/devices/${c.device.brandSlug}/${c.device.slug}` }] : []), { name: c.title, path: `/sensitivity/${c.slug}` }];
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: c.title,
    dateModified: c.updatedAt,
    ...(c.testing?.testedAt && { datePublished: c.testing.testedAt }),
    author: c.testing?.testedBy ? { "@type": "Person", name: c.testing.testedBy } : { "@type": "Organization", name: siteConfig.name },
    publisher: { "@id": `${siteConfig.url}/#organization` },
    image: absoluteUrl(`/sensitivity/${c.slug}/card.png?v=${c.version}`),
    mainEntityOfPage: absoluteUrl(`/sensitivity/${c.slug}`),
  };

  return (
    <article>
      <JsonLd data={[breadcrumbLd(crumbs), articleLd]} />
      {preview && <p className="bg-warning/15 py-2 text-center text-sm text-warning" role="status">Preview — this version is not published.</p>}
      <Container className="py-10 md:py-14">
        <Breadcrumbs items={crumbs.slice(0, -1).map((x) => ({ label: x.name, href: x.path })).concat([{ label: c.title, href: "" }])} />
        <header className="mt-5 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2"><ProvenanceBadge provenance={c.provenance} /><span className="text-sm text-muted">{c.game.name}</span></div>
          <h1 className="mt-3 text-display font-bold">{c.title}</h1>
          {/* Answer-first summary (GEO) */}
          <p className="mt-4 text-lg text-muted">
            {c.device ? `For the ${c.device.brand} ${c.device.model}` : "For phones in this class"} at <strong className="text-text">{c.fps} FPS</strong> with <strong className="text-text">{gyroLabel[c.gyroscope].toLowerCase()}</strong> and a {playstyleLabel[c.playstyle].toLowerCase()} playstyle, these are the values for every scope{c.gameVersion && ` on game version ${c.gameVersion}`}.
          </p>
        </header>
        <ProvenanceBanner className="mt-6 max-w-3xl" provenance={c.provenance} testedBy={c.testing?.testedBy} testedAt={c.testing?.testedAt} deviceUsed={c.testing?.deviceUsed} gameVersion={c.gameVersion} />

        <section aria-labelledby="values" className="mt-10">
          <h2 id="values" className="mb-4 text-2xl font-semibold">Sensitivity values</h2>
          <ValuesTable values={c.values} caption={`Sensitivity values for ${c.title}`} />
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild><a href={`/sensitivity/${c.slug}/card.png?v=${c.version}`} download={`${c.slug}.png`}><Download aria-hidden="true" /> Download card (PNG)</a></Button>
            <SaveButton item={{ kind: "setup", slug: c.slug, title: c.title, fps: c.fps, gyroscope: c.gyroscope, device: c.device ? `${c.device.brand} ${c.device.model}` : null }} />
            <Button asChild variant="secondary"><Link href={`/sensitivity/compare?a=${c.slug}`}>Compare with another setup</Link></Button>
          </div>
          <div className="mt-4"><ShareButtons path={`/sensitivity/${c.slug}`} title={c.title} text={`My BGMI sensitivity: ${c.title}`} /></div>
        </section>

        {c.shareCode && (
          <section aria-labelledby="code" className="mt-10 max-w-3xl">
            <h2 id="code" className="mb-2 text-2xl font-semibold">In-game share code</h2>
            <p className="mb-3 text-sm text-muted">In the game: Settings → Sensitivity → Cloud share code → Use code, then paste.</p>
            <ShareCode code={c.shareCode} />
          </section>
        )}

        <section aria-labelledby="why" className="mt-12 max-w-3xl">
          <h2 id="why" className="text-2xl font-semibold">Why these values</h2>
          <div className="prose-sgh mt-4" dangerouslySetInnerHTML={{ __html: c.explanationHtml }} />
        </section>

        {c.testing && (c.testing.methodHtml || c.testing.notes) && (
          <section aria-labelledby="method" className="mt-12 max-w-3xl">
            <h2 id="method" className="text-2xl font-semibold">How it was tested</h2>
            {c.testing.methodHtml && <div className="prose-sgh mt-4" dangerouslySetInnerHTML={{ __html: c.testing.methodHtml }} />}
            {c.testing.notes && <p className="mt-3 text-muted">{c.testing.notes}</p>}
          </section>
        )}

        <div className="mt-12 max-w-3xl">
          <FeedbackWidget targetType="sensitivity_config" targetSlug={c.slug} summary={await apiGetOr("/feedback/summary", null, { tags: ["feedback"], revalidate: 3600, searchParams: { targetType: "sensitivity_config", targetSlug: c.slug } })} />
        </div>

        <footer className="mt-12 flex max-w-3xl flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-sm text-muted">
          <span>Last updated {formatDate(c.updatedAt)}</span>
          <Link href={`/report?url=${encodeURIComponent(`/sensitivity/${c.slug}`)}`} className="inline-flex items-center gap-1 text-secondary hover:underline"><Flag className="size-3.5" aria-hidden="true" /> Report a problem</Link>
        </footer>
      </Container>
    </article>
  );
}
