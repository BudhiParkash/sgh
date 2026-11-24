"use client";

import { Environment, Lightformer } from "@react-three/drei";
import type { RenderTier } from "./use-render-tier";

/**
 * Shared lighting rig. Reflections come from procedural Lightformers (no HDR file download).
 */
export function GamingEnvironment({ tier }: { tier: RenderTier }) {
  return (
    <>
      <fog attach="fog" args={["#07070b", 9, 22]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[4, 6, 5]} intensity={1.4} color="#c4b5fd" />
      <pointLight position={[-5, -2, 2]} intensity={18} color="#3b82f6" distance={14} />
      <pointLight position={[5, 1, -2]} intensity={14} color="#8b5cf6" distance={14} />
      <Environment resolution={tier === "high" ? 256 : 64} frames={1}>
        <Lightformer form="rect" intensity={3} color="#a78bfa" position={[0, 4, -6]} scale={[10, 2, 1]} />
        <Lightformer form="rect" intensity={2} color="#3b82f6" position={[-6, 0, 2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="ring" intensity={2} color="#22d3ee" position={[5, -2, 3]} scale={2} />
      </Environment>
    </>
  );
}
