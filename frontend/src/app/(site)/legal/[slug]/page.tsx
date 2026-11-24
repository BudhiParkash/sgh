import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";
import { getPreviewItem } from "@/lib/api/preview";
import { apiGet } from "@/lib/api/server";
import { formatDate } from "@/lib/format";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;
interface LegalPage { slug: string; title: string; contentHtml: string; headings: { id: string; text: string; level: number }[]; version: number; effectiveDate: string | null; updatedAt: string }

async function load(slug: string): Promise<LegalPage | null> {
  const preview = await getPreviewItem<LegalPage>("legal");
  if (preview && preview.slug === slug) return preview;
  if (!/^[a-z-]{3,40}$/.test(slug)) return null;
  return (await apiGet<LegalPage>(`/legal/${slug}`, { tags: ["legal", `legal:${slug}`, "settings"], revalidate: 3600 }).catch(() => null))?.data ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) return { title: "Not found", robots: { index: false } };
  return buildMetadata({ title: p.title, description: `${p.title} of Shivanshi Gaming Hub.`, path: `/legal/${slug}` });
}

export default async function LegalPageView({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) notFound();
  return (
    <Container className="py-10 md:py-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: p.title }]} />
      <article className="mt-6 max-w-3xl">
        <h1 className="text-display font-bold">{p.title}</h1>
        <p className="mt-3 text-sm text-subtle">
          {p.effectiveDate && <>Effective {formatDate(p.effectiveDate)} · </>}Last updated {formatDate(p.updatedAt)} · Version {p.version}
        </p>
        {p.headings.length > 3 && (
          <nav aria-label="Contents" className="mt-6 rounded-lg border border-border bg-surface-1 p-4 text-sm">
            <ol className="flex flex-col gap-1">{p.headings.filter((h) => h.level === 2).map((h) => <li key={h.id}><a href={`#${h.id}`} className="text-muted hover:text-text">{h.text}</a></li>)}</ol>
          </nav>
        )}
        <div className="prose-sgh mt-8" dangerouslySetInnerHTML={{ __html: p.contentHtml }} />
      </article>
    </Container>
  );
}
