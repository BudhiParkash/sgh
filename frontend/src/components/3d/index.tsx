"use client";

import dynamic from "next/dynamic";

/** Lazy, client-only entry points — three.js is never in the initial bundle. */
export const GamingHeroScene = dynamic(() => import("./gaming-hero-scene"), { ssr: false });
export const TrophyShowcase3D = dynamic(() => import("./trophy-showcase-3d"), { ssr: false });
export const DeviceShowcase3D = dynamic(() => import("./device-showcase-3d"), { ssr: false });
export const SensitivityDevice3D = dynamic(() => import("./sensitivity-device-3d"), { ssr: false });
export { SceneGate } from "./scene-gate";
export { SceneFallback } from "./scene-fallback";
export { useRenderTier, detectTier, REDUCE_EFFECTS_KEY, type RenderTier } from "./use-render-tier";
