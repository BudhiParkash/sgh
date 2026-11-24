"use client";

import { forwardRef, useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

/** Gradient texture for the phone screen, generated in code (no image download, no brand marks). */
function useScreenTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 512;
    const ctx = c.getContext("2d");
    if (ctx) {
      const g = ctx.createLinearGradient(0, 0, 256, 512);
      g.addColorStop(0, "#1e1b4b");
      g.addColorStop(0.55, "#312e81");
      g.addColorStop(1, "#0c4a6e");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 512);
      // abstract HUD lines
      ctx.strokeStyle = "rgba(167,139,250,0.55)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(128, 256, 46, 0, Math.PI * 2);
      ctx.moveTo(128, 190);
      ctx.lineTo(128, 225);
      ctx.moveTo(128, 287);
      ctx.lineTo(128, 322);
      ctx.moveTo(62, 256);
      ctx.lineTo(97, 256);
      ctx.moveTo(159, 256);
      ctx.lineTo(194, 256);
      ctx.stroke();
      ctx.fillStyle = "rgba(34,211,238,0.9)";
      ctx.fillRect(28, 448, 120, 8);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(28, 466, 200, 6);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

/** Generic, unbranded smartphone (landscape-gaming proportions when rotated). */
export const PhoneModel = forwardRef<THREE.Group, React.ComponentProps<"group">>(function PhoneModel(props, ref) {
  const screen = useScreenTexture();
  return (
    <group ref={ref} {...props}>
      <RoundedBox args={[1.9, 3.9, 0.18]} radius={0.16} smoothness={4}>
        <meshStandardMaterial color="#14151f" metalness={0.85} roughness={0.3} />
      </RoundedBox>
      <mesh position={[0, 0, 0.092]}>
        <planeGeometry args={[1.72, 3.7]} />
        <meshBasicMaterial map={screen} toneMapped={false} />
      </mesh>
      {/* camera island — generic */}
      <RoundedBox args={[0.6, 0.6, 0.06]} radius={0.1} position={[-0.5, 1.45, -0.11]}>
        <meshStandardMaterial color="#1f2133" metalness={0.9} roughness={0.2} />
      </RoundedBox>
    </group>
  );
});
