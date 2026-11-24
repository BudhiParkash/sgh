"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { easing } from "maath";
import gsap from "gsap";
import * as THREE from "three";
import { GamingEnvironment } from "./gaming-environment";
import { FloatingGamingObjects } from "./floating-gaming-objects";
import { PhoneModel } from "./phone-model";
import { SceneCanvas } from "./scene-canvas";
import type { RenderTier } from "./use-render-tier";

function HexRing({ radius, color, speed, tilt }: { radius: number; color: string; speed: number; tilt: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * speed;
  });
  return (
    <mesh ref={ref} rotation={[tilt, 0, 0]}>
      <torusGeometry args={[radius, 0.025, 6, 6]} />
      <meshBasicMaterial color={color} transparent opacity={0.7} toneMapped={false} />
    </mesh>
  );
}

function Rig({ tier }: { tier: RenderTier }) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();

  // Cinematic entrance: dolly in + rise (GSAP timeline).
  useEffect(() => {
    if (!group.current) return;
    const tl = gsap.timeline();
    tl.fromTo(camera.position, { z: 13 }, { z: 8, duration: 1.6, ease: "power3.out" }, 0);
    tl.fromTo(group.current.position, { y: -1.2 }, { y: 0, duration: 1.4, ease: "power3.out" }, 0.1);
    tl.fromTo(group.current.scale, { x: 0.85, y: 0.85, z: 0.85 }, { x: 1, y: 1, z: 1, duration: 1.4, ease: "power3.out" }, 0.1);
    return () => {
      tl.kill();
    };
  }, [camera]);

  // Subtle mouse parallax (desktop) — damped, never jarring.
  useFrame((state, dt) => {
    if (tier !== "high" && tier !== "medium") return;
    easing.damp3(state.camera.position, [state.pointer.x * 0.6, state.pointer.y * 0.35, state.camera.position.z], 0.35, dt);
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <group ref={group}>
      <Float speed={1.4} rotationIntensity={0.35} floatIntensity={0.6}>
        <PhoneModel rotation={[0.25, -0.55, 0.12]} scale={0.8} />
      </Float>
      <HexRing radius={1.6} color="#8b5cf6" speed={0.12} tilt={1.2} />
      <HexRing radius={1.95} color="#3b82f6" speed={-0.08} tilt={1.35} />
      {tier === "high" && <HexRing radius={2.3} color="#22d3ee" speed={0.05} tilt={1.1} />}
      <FloatingGamingObjects tier={tier} radius={5.2} />
    </group>
  );
}

/** Homepage hero: abstract phone, orbiting hex rings and drifting crystals. Original, procedural. */
export default function GamingHeroScene({ tier }: { tier: RenderTier }) {
  return (
    <SceneCanvas tier={tier} camera={{ position: [0, 0, 8], fov: 40 }}>
      <GamingEnvironment tier={tier} />
      <Rig tier={tier} />
    </SceneCanvas>
  );
}
