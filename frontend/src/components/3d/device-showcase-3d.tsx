"use client";

import { Float, PresentationControls } from "@react-three/drei";
import { GamingEnvironment } from "./gaming-environment";
import { PhoneModel } from "./phone-model";
import { SceneCanvas } from "./scene-canvas";
import type { RenderTier } from "./use-render-tier";

/** Generic device showcase used on device pages and resources. */
export default function DeviceShowcase3D({ tier }: { tier: RenderTier }) {
  return (
    <SceneCanvas tier={tier} camera={{ position: [0, 0, 7], fov: 38 }}>
      <GamingEnvironment tier={tier} />
      <PresentationControls global={false} polar={[-0.3, 0.3]} azimuth={[-0.8, 0.8]} snap enabled={tier === "high"}>
        <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.4}>
          <PhoneModel rotation={[0.1, -0.4, 0]} />
        </Float>
      </PresentationControls>
    </SceneCanvas>
  );
}
