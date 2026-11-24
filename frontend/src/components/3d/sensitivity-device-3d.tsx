"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { easing } from "maath";
import * as THREE from "three";
import { GamingEnvironment } from "./gaming-environment";
import { PhoneModel } from "./phone-model";
import { SceneCanvas } from "./scene-canvas";
import type { RenderTier } from "./use-render-tier";

const PANEL_COLORS = ["#8b5cf6", "#3b82f6", "#22d3ee", "#a78bfa"];

/**
 * One floating panel per sensitivity category. `level` (0–1) is the share of the category's
 * max value; bars animate (damped) when the configuration changes. With no data, panels idle
 * at a neutral height and show no numbers — numbers are always rendered as HTML, never in 3D.
 */
function Panel({ index, level, color }: { index: number; level: number | null; color: string }) {
  const bar = useRef<THREE.Mesh>(null);
  useFrame(({ clock }, dt) => {
    if (!bar.current) return;
    const target = level ?? 0.35 + Math.sin(clock.elapsedTime * 0.8 + index) * 0.08;
    easing.damp(bar.current.scale, "y", Math.max(0.04, target), 0.25, dt);
    bar.current.position.y = -0.6 + bar.current.scale.y * 0.6;
  });
  const x = (index - 1.5) * 0.62;
  return (
    <group position={[x + 2.4, 0.2 - index * 0.05, 0.6 + index * 0.08]} rotation={[0, -0.35, 0]}>
      <mesh>
        <boxGeometry args={[0.5, 1.4, 0.04]} />
        <meshStandardMaterial color="#161823" metalness={0.4} roughness={0.5} transparent opacity={0.85} />
      </mesh>
      <mesh ref={bar} position={[0, -0.6, 0.03]}>
        <boxGeometry args={[0.3, 1.2, 0.02]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

export default function SensitivityDevice3D({ tier, levels }: { tier: RenderTier; levels?: (number | null)[] }) {
  return (
    <SceneCanvas tier={tier} camera={{ position: [0.8, 0, 8], fov: 38 }}>
      <GamingEnvironment tier={tier} />
      <Float speed={1.1} rotationIntensity={0.2} floatIntensity={0.35}>
        <PhoneModel rotation={[0.15, 0.45, -0.05]} position={[-1.2, 0, 0]} />
      </Float>
      {PANEL_COLORS.map((c, i) => (
        <Panel key={c} index={i} color={c} level={levels?.[i] ?? null} />
      ))}
    </SceneCanvas>
  );
}
