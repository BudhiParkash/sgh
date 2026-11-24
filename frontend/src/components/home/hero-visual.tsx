"use client";

import { useEffect, useRef } from "react";
import { GamingHeroScene, SceneGate } from "@/components/3d";
import { HeroPoster } from "./hero-poster";

/**
 * Hero 3D slot: reserved box (no CLS), inline poster first, scene when capable.
 * Scroll parallax (GSAP ScrollTrigger) runs on desktop only — GSAP is imported lazily there,
 * so phones never download it.
 */
export function HeroVisual() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)").matches) return;
    let revert = () => {};
    let cancelled = false;
    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([{ default: gsap }, { ScrollTrigger }]) => {
      if (cancelled || !ref.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const tween = gsap.to(ref.current, {
        yPercent: 14,
        opacity: 0.35,
        ease: "none",
        scrollTrigger: { trigger: ref.current, start: "top top+=80", end: "bottom top", scrub: true },
      });
      revert = () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    });
    return () => {
      cancelled = true;
      revert();
    };
  }, []);
  return (
    <div ref={ref} className="relative aspect-[5/4] w-full lg:aspect-auto lg:h-full">
      <SceneGate minTier="low" fallback={<HeroPoster />}>
        {(tier) => <GamingHeroScene tier={tier} />}
      </SceneGate>
    </div>
  );
}
