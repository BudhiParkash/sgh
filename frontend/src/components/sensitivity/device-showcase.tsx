"use client";

import { DeviceShowcase3D, SceneFallback, SceneGate } from "@/components/3d";

/** Client wrapper: server components can't pass render functions to SceneGate. */
export function DeviceScene() {
  return (
    <SceneGate minTier="medium" fallback={<SceneFallback src="/posters/phone.svg" />}>
      {(tier) => <DeviceShowcase3D tier={tier} />}
    </SceneGate>
  );
}
