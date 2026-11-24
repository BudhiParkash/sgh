"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { RenderTier } from "./use-render-tier";

const COUNT: Record<RenderTier, number> = { none: 0, low: 10, medium: 18, high: 30 };

interface Shard {
  pos: THREE.Vector3;
  rot: THREE.Euler;
  spin: THREE.Vector3;
  scale: number;
  phase: number;
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Instanced low-poly crystals drifting around the focal point — one draw call per material.
 * Deterministic layout (seeded) so the scene matches its static poster composition.
 */
export function FloatingGamingObjects({ tier, radius = 6 }: { tier: RenderTier; radius?: number }) {
  const count = COUNT[tier];
  const crystals = useRef<THREE.InstancedMesh>(null);
  const wires = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const shards = useMemo<Shard[]>(() => {
    const rand = seeded(7);
    return Array.from({ length: count }, () => {
      const theta = rand() * Math.PI * 2;
      const r = radius * (0.75 + rand() * 0.45);
      return {
        pos: new THREE.Vector3(Math.cos(theta) * r, (rand() - 0.5) * radius * 0.9, Math.sin(theta) * r * 0.5 - 3),
        rot: new THREE.Euler(rand() * Math.PI, rand() * Math.PI, 0),
        spin: new THREE.Vector3((rand() - 0.5) * 0.4, (rand() - 0.5) * 0.4, 0),
        scale: 0.1 + rand() * 0.24,
        phase: rand() * Math.PI * 2,
      };
    });
  }, [count, radius]);

  const half = Math.ceil(count / 2);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    shards.forEach((s, i) => {
      dummy.position.set(s.pos.x, s.pos.y + Math.sin(t * 0.6 + s.phase) * 0.18, s.pos.z);
      dummy.rotation.set(s.rot.x + t * s.spin.x, s.rot.y + t * s.spin.y, 0);
      dummy.scale.setScalar(s.scale);
      dummy.updateMatrix();
      if (i < half) crystals.current?.setMatrixAt(i, dummy.matrix);
      else wires.current?.setMatrixAt(i - half, dummy.matrix);
    });
    if (crystals.current) crystals.current.instanceMatrix.needsUpdate = true;
    if (wires.current) wires.current.instanceMatrix.needsUpdate = true;
  });

  if (count === 0) return null;
  return (
    <group>
      <instancedMesh ref={crystals} args={[undefined, undefined, half]} frustumCulled={false}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#8b5cf6" metalness={0.7} roughness={0.25} emissive="#2e1065" emissiveIntensity={0.4} flatShading />
      </instancedMesh>
      <instancedMesh ref={wires} args={[undefined, undefined, count - half]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color="#60a5fa" wireframe transparent opacity={0.35} />
      </instancedMesh>
    </group>
  );
}
