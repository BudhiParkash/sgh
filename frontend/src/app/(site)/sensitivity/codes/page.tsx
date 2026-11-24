import type { Metadata } from "next";
import type { SensitivityCodeDto } from "@sgh/shared";
import { CodeSubmitForm } from "@/components/sensitivity/code-submit-form";
import { ShareCode } from "@/components/sensitivity/share-code";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/states";
import { apiGetOr } from "@/lib/api/server";
import { formatDate, gyroLabel } from "@/lib/format";
import { buildMetadata } from "@/lib/seo/metadata";

export const revalidate = 600;
export const metadata: Metadata = buildMetadata({
  title: "BGMI sensitivity share codes (verified)",
  description: "Verified BGMI sensitivity share codes you can import in-game, with the device, FPS and game version each was made for.",
  path: "/sensitivity/codes",
});

export default async function CodesPage() {
  const codes = await apiGetOr<SensitivityCodeDto[]>("/sensitivity/codes", [], { tags: ["codes"], revalidate: 600, searchParams: { limit: 50 } });
  return (
    <Container className="py-10 md:py-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Sensitivity", href: "/sensitivity" }, { label: "Share codes" }]} />
      <h1 className="mt-4 text-display font-bold">Share-code library</h1>
      <p className="mt-3 max-w-2xl text-muted">Every code here was imported and checked by our team before publishing. Codes can stop working after a game update — check the game version.</p>
      <div className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="verified">
          <h2 id="verified" className="mb-4 text-2xl font-semibold">Verified codes</h2>
          {codes.length === 0 ? (
            <EmptyState level={3} title="No verified codes yet" description="Submitted codes appear here after review." />
          ) : (
            <ul className="flex flex-col gap-4">
              {codes.map((c) => (
                <li key={c.id}>
                  <Card className="flex flex-col gap-3 p-5">
                    <ShareCode code={c.code} />
                    <p className="text-sm">{c.device ? `${c.device.brand} ${c.device.model}` : "Any device"}{c.fps && ` · ${c.fps} FPS`}{c.gyroscope && ` · ${gyroLabel[c.gyroscope]}`}{c.gameVersion && ` · v${c.gameVersion}`}</p>
                    {c.description && <p className="text-sm text-muted">{c.description}</p>}
                    <p className="text-xs text-subtle">By {c.author} · checked {formatDate(c.testedAt)}</p>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="submit">
          <h2 id="submit" className="mb-4 text-2xl font-semibold">Submit your code</h2>
          <Card className="p-5"><CodeSubmitForm /></Card>
        </section>
      </div>
    </Container>
  );
}
