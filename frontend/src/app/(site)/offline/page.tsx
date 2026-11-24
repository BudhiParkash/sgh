import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = { title: "You're offline", robots: { index: false, follow: false } };
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <Container className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 py-20 text-center">
      <WifiOff className="size-12 text-subtle" aria-hidden="true" />
      <h1 className="text-display font-bold">You&apos;re offline</h1>
      <p className="max-w-md text-muted">This page hasn&apos;t been saved for offline use. Pages you&apos;ve opened before — including your saved setups — still work.</p>
      <Button asChild><Link href="/saved">Open my saved</Link></Button>
    </Container>
  );
}
