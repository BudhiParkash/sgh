import type { Metadata } from "next";
import type { SensitivityDetail, SensitivitySummary } from "@sgh/shared";
import { ProvenanceBadge } from "@/components/sensitivity/provenance";
import { ValuesTable } from "@/components/sensitivity/values-table";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Field, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { apiGet, apiGetOr } from "@/lib/api/server";
import { gyroLabel } from "@/lib/format";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({ title: "Compare sensitivity setups", description: "Compare two BGMI sensitivity setups scope by scope.", path: "/sensitivity/compare", noindex: true });

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const { a, b } = await searchParams;
  const ok = (s?: string) => Boolean(s && /^[a-z0-9-]{1,120}$/.test(s));
  const [options, cmp] = await Promise.all([
    apiGetOr<SensitivitySummary[]>("/sensitivity", [], { tags: ["sensitivity"], searchParams: { limit: 50 } }),
    ok(a) && ok(b) && a !== b ? apiGet<{ a: SensitivityDetail; b: SensitivityDetail }>("/sensitivity/compare", { tags: ["sensitivity"], searchParams: { a, b } }).then((r) => r?.data ?? null).catch(() => null) : Promise.resolve(null),
  ]);
  return (
    <Container className="py-10 md:py-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Sensitivity", href: "/sensitivity" }, { label: "Compare" }]} />
      <h1 className="mt-4 text-display font-bold">Compare setups</h1>
      {/* Plain GET form: works without JavaScript */}
      <form method="get" className="mt-8 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        {(["a", "b"] as const).map((k, i) => (
          <Field key={k} id={`cmp-${k}`} label={`Setup ${i + 1}`}>
            {(aria) => (
              <Select {...aria} name={k} defaultValue={k === "a" ? a : b} required>
                <option value="">Choose a setup</option>
                {options.map((o) => <option key={o.slug} value={o.slug}>{o.title}</option>)}
              </Select>
            )}
          </Field>
        ))}
        <Button type="submit">Compare</Button>
      </form>
      {cmp ? (
        <div className="mt-10 grid gap-6 xl:grid-cols-2">
          {[cmp.a, cmp.b].map((c, i) => (
            <Card key={c.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-center gap-2"><ProvenanceBadge provenance={c.provenance} /><span className="text-sm text-muted">{c.fps} FPS · {gyroLabel[c.gyroscope]}</span></div>
              <h2 className="text-lg font-semibold">{c.title}</h2>
              <ValuesTable values={c.values} caption={c.title} compareTo={i === 1 ? cmp.a.values : undefined} />
              {i === 1 && <p className="text-xs text-muted">Coloured numbers show the difference from setup 1.</p>}
            </Card>
          ))}
        </div>
      ) : (
        a && b && <EmptyState className="mt-10" title="Couldn't compare those setups" description="Choose two different published setups." />
      )}
    </Container>
  );
}
