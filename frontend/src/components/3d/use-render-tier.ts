"use client";

import { useEffect, useState } from "react";

export type RenderTier = "none" | "low" | "medium" | "high";
export const TIER_RANK: Record<RenderTier, number> = { none: 0, low: 1, medium: 2, high: 3 };
export const REDUCE_EFFECTS_KEY = "sgh-reduce-effects";

interface NavigatorWithHints extends Navigator {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function userReducedEffects(): boolean {
  try {
    return window.localStorage.getItem(REDUCE_EFFECTS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Capability-based render tier (docs/architecture/07 §2). Pure function of the environment
 * so it can be unit-tested; `useRenderTier` calls it after hydration.
 */
export function detectTier(env: {
  reducedMotion: boolean;
  saveData: boolean;
  userReduced: boolean;
  webgl: boolean;
  deviceMemory?: number;
  cores?: number;
  coarsePointer: boolean;
  width: number;
}): RenderTier {
  if (env.reducedMotion || env.saveData || env.userReduced || !env.webgl) return "none";
  const mem = env.deviceMemory ?? 4;
  const cores = env.cores ?? 4;
  if (mem <= 2 || cores <= 2) return "none";
  if (env.coarsePointer && env.width < 768) return mem >= 8 && cores >= 8 ? "medium" : "low";
  if (mem <= 4 || cores <= 4) return "low";
  if (!env.coarsePointer && cores >= 8 && env.width >= 1024) return "high";
  return "medium";
}

/** Returns null until measured on the client (server and first paint always use the poster). */
export function useRenderTier(): RenderTier | null {
  const [tier, setTier] = useState<RenderTier | null>(null);
  useEffect(() => {
    const nav = navigator as NavigatorWithHints;
    const reducedMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compute = () =>
      setTier(
        detectTier({
          reducedMotion: reducedMq.matches,
          saveData: Boolean(nav.connection?.saveData),
          userReduced: userReducedEffects(),
          webgl: hasWebGL(),
          deviceMemory: nav.deviceMemory,
          cores: nav.hardwareConcurrency,
          coarsePointer: window.matchMedia("(pointer: coarse)").matches,
          width: window.innerWidth,
        }),
      );
    compute();
    reducedMq.addEventListener("change", compute);
    window.addEventListener("sgh:effects-changed", compute);
    return () => {
      reducedMq.removeEventListener("change", compute);
      window.removeEventListener("sgh:effects-changed", compute);
    };
  }, []);
  return tier;
}
