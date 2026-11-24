"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; remove: (id: string) => void };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** Cloudflare Turnstile (privacy-friendly bot check). Renders nothing when no site key is configured. */
export function Turnstile({ onToken }: { onToken: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  useEffect(() => {
    if (!SITE_KEY) return;
    const t = window.setInterval(() => {
      if (window.turnstile && ref.current && !id.current) {
        id.current = window.turnstile.render(ref.current, { sitekey: SITE_KEY, theme: "dark", callback: onToken });
        window.clearInterval(t);
      }
    }, 200);
    return () => {
      window.clearInterval(t);
      if (id.current) window.turnstile?.remove(id.current);
      id.current = null;
    };
  }, [onToken]);
  if (!SITE_KEY) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
      <div ref={ref} />
    </>
  );
}
