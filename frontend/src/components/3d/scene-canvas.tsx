"use client";

import { Canvas, useThree, type CanvasProps } from "@react-three/fiber";
import { AdaptiveDpr, PerformanceMonitor } from "@react-three/drei";
import { useEffect, useState, type ReactNode } from "react";
import type { RenderTier } from "./use-render-tier";
import { useSceneLifecycle } from "./scene-context";

/** Drives a "demand" frameloop at a capped frame rate (30 fps on phones/tablets saves battery and CPU). */
function FrameLimiter({ fps }: { fps: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const t = window.setInterval(() => invalidate(), 1000 / fps);
    return () => window.clearInterval(t);
  }, [invalidate, fps]);
  return null;
}

const DPR: Record<RenderTier, [number, number]> = { none: [1, 1], low: [1, 1], medium: [1, 1.5], high: [1, 2] };

/**
 * Shared Canvas wrapper: tier-based DPR, performance monitor (degrades DPR when FPS drops),
 * pauses rendering when the tab is hidden, reports readiness/context loss to SceneGate.
 */
export function SceneCanvas({ tier, children, camera, ...rest }: { tier: RenderTier; children: ReactNode } & Omit<CanvasProps, "children">) {
  const { onReady, onContextLost } = useSceneLifecycle();
  const [dpr, setDpr] = useState<number>(DPR[tier][1]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <Canvas
      dpr={dpr}
      frameloop={!visible ? "never" : tier === "high" ? "always" : "demand"}
      gl={{ antialias: tier === "high", alpha: true, powerPreference: "high-performance", stencil: false }}
      camera={camera ?? { position: [0, 0, 8], fov: 40 }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          onContextLost();
        });
        requestAnimationFrame(onReady);
      }}
      {...rest}
    >
      <PerformanceMonitor
        onDecline={() => setDpr((d) => Math.max(DPR[tier][0], d - 0.25))}
        onIncline={() => setDpr((d) => Math.min(DPR[tier][1], d + 0.25))}
        flipflops={3}
        onFallback={() => setDpr(1)}
      />
      <AdaptiveDpr pixelated={false} />
      {tier !== "high" && visible && <FrameLimiter fps={30} />}
      {children}
    </Canvas>
  );
}
