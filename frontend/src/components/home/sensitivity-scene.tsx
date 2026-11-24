"use client";

import { SceneFallback, SceneGate, SensitivityDevice3D } from "@/components/3d";

export function SensitivityScene({ levels }: { levels?: (number | null)[] }) {
  return (
    <SceneGate minTier="medium" fallback={<SceneFallback src="/posters/phone.svg" />}>
      {(tier) => <SensitivityDevice3D tier={tier} levels={levels} />}
    </SceneGate>
  );
}
