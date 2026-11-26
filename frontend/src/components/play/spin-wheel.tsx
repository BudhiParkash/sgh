"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const COLORS = ["#f59e0b", "#7c3aed", "#0ea5e9", "#22c55e", "#ef4444", "#ec4899", "#14b8a6", "#eab308", "#6366f1", "#f97316", "#84cc16", "#06b6d4"];

/**
 * SVG wheel. The result is decided by the server; `spinTo(index)` only animates to it.
 * Honors prefers-reduced-motion (jumps straight to the result).
 */
export function useWheel(count: number) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const seg = 360 / Math.max(count, 1);
  const spinTo = (index: number) =>
    new Promise<void>((resolve) => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // Pointer is at the top: bring the middle of segment `index` to 0°.
      const target = 360 - (index * seg + seg / 2);
      setSpinning(true);
      setRotation((r) => r - (r % 360) + (reduce ? 0 : 360 * 6) + target);
      setTimeout(() => {
        setSpinning(false);
        resolve();
      }, reduce ? 50 : 4200);
    });
  return { rotation, spinning, spinTo };
}

export function SpinWheel({ outcomes, rotation, className }: { outcomes: number[]; rotation: number; className?: string }) {
  const n = Math.max(outcomes.length, 1);
  const seg = 360 / n;
  const r = 100;
  const point = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [r + r * Math.cos(rad), r + r * Math.sin(rad)];
  };
  return (
    <div className={cn("relative aspect-square w-full max-w-[320px]", className)}>
      <div className="absolute top-[-6px] left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[12px] border-t-[22px] border-x-transparent border-t-white drop-shadow" aria-hidden="true" />
      <svg
        viewBox="0 0 200 200"
        className="size-full rounded-full shadow-[0_0_40px_rgba(124,58,237,0.35)]"
        style={{ transform: `rotate(${rotation}deg)`, transition: "transform 4.2s cubic-bezier(0.17, 0.67, 0.12, 0.99)" }}
        role="img"
        aria-label={`Prize wheel with ${outcomes.join(", ")} SGC coins`}
      >
        {outcomes.map((coins, i) => {
          const [x1, y1] = point(i * seg);
          const [x2, y2] = point((i + 1) * seg);
          const mid = i * seg + seg / 2;
          return (
            <g key={i}>
              <path d={`M100 100 L${x1} ${y1} A100 100 0 ${seg > 180 ? 1 : 0} 1 ${x2} ${y2} Z`} fill={COLORS[i % COLORS.length]} stroke="#0b0b12" strokeWidth="1" />
              <text x="100" y="28" transform={`rotate(${mid} 100 100)`} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="800" style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.35)", strokeWidth: 2 }}>
                {coins}
              </text>
            </g>
          );
        })}
        <circle cx="100" cy="100" r="16" fill="#0b0b12" stroke="#fff" strokeWidth="2" />
        <text x="100" y="104" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="800">SGC</text>
      </svg>
    </div>
  );
}
