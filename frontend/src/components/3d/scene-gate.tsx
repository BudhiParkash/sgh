"use client";

import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SceneLifecycleContext } from "./scene-context";
import { TIER_RANK, useRenderTier, type RenderTier } from "./use-render-tier";

class SceneErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.warn("[3d] scene failed, using poster", error);
    this.props.onError();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

interface SceneGateProps {
  /** Minimum tier required to mount the scene. */
  minTier?: Exclude<RenderTier, "none">;
  /** Static poster (always rendered underneath; fades out once the scene is ready). */
  fallback: ReactNode;
  children: (tier: RenderTier) => ReactNode;
  className?: string;
}

/**
 * Mounts a 3D scene only when: the device tier qualifies, the container is near the viewport,
 * and the browser is idle. Unmounts when scrolled far away (frees the WebGL context; mobile
 * browsers cap the number of live contexts). Any error or context loss falls back to the poster.
 */
export function SceneGate({ minTier = "medium", fallback, children, className }: SceneGateProps) {
  const tier = useRenderTier();
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [idle, setIdle] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const visible = Boolean(entry?.isIntersecting);
        setInView(visible);
        if (!visible) setReady(false); // canvas unmounts → poster must show again on return
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    // Phones/tablets: wait for the first touch/scroll before loading 3D, so it never competes with
    // page load (protects LCP/INP and data). Desktop: load when the browser is idle.
    if (window.matchMedia("(pointer: coarse)").matches) {
      const go = () => setIdle(true);
      const opts = { once: true, passive: true } as const;
      for (const ev of ["pointerdown", "touchstart", "scroll", "keydown"]) window.addEventListener(ev, go, opts);
      return () => {
        for (const ev of ["pointerdown", "touchstart", "scroll", "keydown"]) window.removeEventListener(ev, go);
      };
    }
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setIdle(true), { timeout: 2500 });
      return () => window.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setIdle(true), 1200);
    return () => window.clearTimeout(t);
  }, []);

  const eligible = tier !== null && TIER_RANK[tier] >= TIER_RANK[minTier] && !failed;
  const mounted = eligible && idle && inView;

  return (
    <div ref={ref} className={cn("relative h-full w-full", className)} data-scene-state={mounted ? "3d" : "poster"}>
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-[var(--dur-slow)]",
          ready && mounted ? "opacity-0" : "opacity-100",
        )}
      >
        {fallback}
      </div>
      {mounted && tier && (
        <div
          className={cn("absolute inset-0 transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")}
          aria-hidden="true"
        >
          <SceneErrorBoundary onError={() => setFailed(true)}>
            <SceneLifecycleContext.Provider value={{ onReady: () => setReady(true), onContextLost: () => setFailed(true) }}>
              {children(tier)}
            </SceneLifecycleContext.Provider>
          </SceneErrorBoundary>
        </div>
      )}
    </div>
  );
}
