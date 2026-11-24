import Link from "next/link";
import { ArrowRight, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/lib/site";
import { HeroVisual } from "./hero-visual";

export function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="relative -mt-[var(--header-h)] overflow-hidden pt-[var(--header-h)]">
      <div className="bg-atmosphere pointer-events-none absolute inset-0" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(var(--border-strong)_1px,transparent_1px),linear-gradient(90deg,var(--border-strong)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(70%_60%_at_50%_40%,black,transparent)]"
        aria-hidden="true"
      />
      <Container className="relative grid min-h-[calc(92dvh-var(--header-h))] items-center gap-6 py-12 lg:grid-cols-[1fr_1.15fr] lg:py-16">
        <div className="relative z-10">
          <p className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-border-strong bg-surface-1/70 px-3 py-1 text-xs font-medium text-muted">
            <Crosshair className="size-3.5 text-accent" aria-hidden="true" />
            BGMI &amp; PUBG Mobile
          </p>
          <h1 id="hero-heading" className="text-hero font-bold tracking-tight">
            <span className="hero-line"><span>LEVEL UP</span></span>
            <span className="hero-line"><span className="text-gradient-brand">YOUR GAME</span></span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted md:text-xl">{siteConfig.description}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/tournaments">
                Explore Tournaments <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/sensitivity">Find Your Sensitivity</Link>
            </Button>
          </div>
          <p className="mt-10 max-w-xl text-xs text-subtle">Independent fan platform · not affiliated with KRAFTON or Tencent Games.</p>
        </div>
        <div className="relative -mx-4 h-full min-h-[280px] sm:mx-0 lg:min-h-[560px]">
          <HeroVisual />
        </div>
      </Container>
    </section>
  );
}
