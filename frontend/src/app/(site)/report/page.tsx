import type { Metadata } from "next";
import Link from "next/link";
import { ReportForm } from "@/components/forms/report-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({ title: "Report content", description: "Report inaccurate, infringing, private or offensive content on Shivanshi Gaming Hub.", path: "/report" });

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const url = (await searchParams).url;
  const initial = url && url.startsWith("/") && url.length < 500 ? url : undefined;
  return (
    <Container className="py-10 md:py-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Report content" }]} />
      <h1 className="mt-4 text-display font-bold">Report content</h1>
      <p className="mt-3 max-w-2xl text-muted">Tell us about anything inaccurate, infringing, private or harmful. You&apos;ll get a ticket number; we acknowledge within 24 hours. See the <Link href="/legal/content-reporting" className="text-secondary underline">reporting policy</Link> and <Link href="/legal/grievance" className="text-secondary underline">grievance redressal</Link>.</p>
      <Card className="mt-8 max-w-2xl p-5 md:p-8"><ReportForm initialUrl={initial} /></Card>
    </Container>
  );
}
