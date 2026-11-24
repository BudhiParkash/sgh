"use client";

import { SceneFallback, SceneGate, TrophyShowcase3D } from "@/components/3d";

export function TrophyScene() {
  return (
    <SceneGate minTier="medium" fallback={<SceneFallback src="/posters/trophy.svg" />}>
      {(tier) => <TrophyShowcase3D tier={tier} />}
    </SceneGate>
  );
}
