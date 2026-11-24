"use client";

import { useEffect } from "react";
import { LazyMotion, m, useReducedMotion } from "motion/react";

const features = () => import("motion/react").then((mod) => mod.domAnimation);

declare global {
  interface Window {
    __sghNavigated?: boolean;
  }
}

/**
 * Soft fade between routes. The first page load renders without any initial hidden state
 * (server HTML stays fully visible — important for LCP and crawlers).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  // false on the server and during hydration of the first page; true for client-side navigations.
  const animate = typeof window !== "undefined" && window.__sghNavigated === true && !reduce;
  useEffect(() => {
    window.__sghNavigated = true;
  }, []);
  return (
    <LazyMotion features={features} strict>
      <m.div initial={animate ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}>
        {children}
      </m.div>
    </LazyMotion>
  );
}
