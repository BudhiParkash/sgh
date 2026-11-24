import type { Metadata } from "next";
import { SavedList } from "@/components/retention/saved-list";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "My saved", robots: { index: false, follow: true } };

export default function SavedPage() {
  return (
    <Container className="py-10 md:py-16">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "My saved" }]} />
      <h1 className="mt-4 text-display font-bold">My saved</h1>
      <p className="mt-3 max-w-2xl text-muted">Your saved sensitivity setups and followed tournaments. They&apos;re stored only on this device — no account needed.</p>
      <SavedList />
    </Container>
  );
}
