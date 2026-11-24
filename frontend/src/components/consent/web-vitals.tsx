"use client";

import { useReportWebVitals } from "next/web-vitals";

/** Sends Core Web Vitals (LCP, INP, CLS…) to GA4 — only exists if analytics consent loaded gtag. */
export function WebVitals() {
  useReportWebVitals((m) => {
    if (typeof window === "undefined" || typeof window.gtag !== "function") return;
    window.gtag("event", m.name, { value: Math.round(m.name === "CLS" ? m.value * 1000 : m.value), metric_id: m.id, metric_rating: m.rating, non_interaction: true });
  });
  return null;
}
