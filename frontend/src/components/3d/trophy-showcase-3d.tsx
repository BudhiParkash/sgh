"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { ContactShadows, PresentationControls } from "@react-three/drei";
import * as THREE from "three";
import { GamingEnvironment } from "./gaming-environment";
import { SceneCanvas } from "./scene-canvas";
import type { RenderTier } from "./use-render-tier";

/** Original stylised trophy built from a lathe profile — no external model. */
function Trophy() {
  const cup = useMemo(() => {
    const pts = [
      [0, 0], [0.2, 0], [0.22, 0.08], [0.12, 0.25], [0.1, 0.9], [0.18, 1.05], [0.55, 1.3],
      [0.8, 1.9], [0.86, 2.55], [0.8, 2.6], [0.74, 2.0], [0.5, 1.45], [0, 1.35],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 48);
  }, []);
  const gold = <meshStandardMaterial color="#f1c96b" metalness={1} roughness={0.18} />;
  return (
    <group position={[0, -1.6, 0]}>
      <mesh geometry={cup} position={[0, 0.55, 0]}>{gold}</mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.86, 2.45, 0]} rotation={[0, side === 1 ? 0 : Math.PI, 0]}>
          <torusGeometry args={[0.32, 0.05, 12, 24, Math.PI]} />
          {gold}
        </mesh>
      ))}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.7, 0.8, 0.5, 6]} />
        <meshStandardMaterial color="#161823" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.52, 0]}>
        <cylinderGeometry args={[0.71, 0.71, 0.04, 6]} />
        <meshBasicMaterial color="#8b5cf6" toneMapped={false} />
      </mesh>
    </group>
  );
}

function Spinner({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.35;
  });
  return <group ref={ref}>{children}</group>;
}

export default function TrophyShowcase3D({ tier }: { tier: RenderTier }) {
  const interactive = tier === "high";
  return (
    <SceneCanvas tier={tier} camera={{ position: [0, 0.6, 6.5], fov: 35 }}>
      <GamingEnvironment tier={tier} />
      {interactive ? (
        <PresentationControls global={false} polar={[-0.2, 0.2]} azimuth={[-0.6, 0.6]} snap>
          <Spinner>
            <Trophy />
          </Spinner>
        </PresentationControls>
      ) : (
        <Spinner>
          <Trophy />
        </Spinner>
      )}
      <ContactShadows position={[0, -1.62, 0]} opacity={0.55} scale={6} blur={2.4} far={3} frames={1} />
    </SceneCanvas>
  );
}
