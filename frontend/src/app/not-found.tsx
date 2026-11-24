import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main id="main" className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-24 text-center">
        <p className="font-mono text-sm text-accent">404</p>
        <h1 className="text-display font-bold">Page not found</h1>
        <p className="max-w-md text-muted">
          This page doesn&apos;t exist yet or has moved. Many sections of the site are still being built.
        </p>
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </main>
      <Footer />
    </div>
  );
}
