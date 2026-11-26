import type { Metadata } from "next";
import { AccountClient } from "@/components/play/account-client";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "My account", robots: { index: false, follow: false } };

export default function AccountPage() {
  return (
    <Container className="py-8 md:py-12">
      <h1 className="mb-8 text-display font-bold">My account</h1>
      <AccountClient />
    </Container>
  );
}
