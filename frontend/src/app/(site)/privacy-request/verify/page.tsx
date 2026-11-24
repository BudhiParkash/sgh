import type { Metadata } from "next";
import { PrivacyVerify } from "@/components/forms/privacy-form";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "Confirm privacy request", robots: { index: false, follow: false } };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  return (
    <Container className="py-16">
      <Card className="mx-auto max-w-lg p-6 md:p-8">
        <h1 className="text-2xl font-bold">Confirm your privacy request</h1>
        <p className="mt-2 mb-6 text-sm text-muted">Click below to confirm. If you didn&apos;t make this request, simply close this page.</p>
        {/^[\w-]{20,100}$/.test(token) ? <PrivacyVerify token={token} /> : <p className="text-danger">This link is incomplete. Please open the full link from your email.</p>}
      </Card>
    </Container>
  );
}
