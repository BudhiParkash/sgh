import type { Metadata } from "next";
import { PrivacyRequestForm } from "@/components/forms/privacy-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({ title: "Privacy request", description: "Ask for a copy of your data, correct it, delete it or withdraw consent.", path: "/privacy-request" });

export default function PrivacyRequestPage() {
  return (
    <Container className="py-10 md:py-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Privacy request" }]} />
      <h1 className="mt-4 text-display font-bold">Your privacy rights</h1>
      <p className="mt-3 max-w-2xl text-muted">We only hold data you sent us through our forms. Choose a request below — we&apos;ll email you a link to confirm it&apos;s really you before we act.</p>
      <Card className="mt-8 max-w-2xl p-5 md:p-8"><PrivacyRequestForm /></Card>
    </Container>
  );
}
