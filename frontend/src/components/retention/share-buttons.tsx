"use client";

import { useEffect, useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[1.1em] fill-current">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.3-.4.8-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.8 11.8 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}

/**
 * Share: native share sheet on phones (WhatsApp, Instagram, Telegram…), WhatsApp link and copy-link fallback.
 * `path` is the page path; the full URL is built from the current origin.
 */
export function ShareButtons({ path, title, text }: { path: string; title: string; text?: string }) {
  const [canNative, setCanNative] = useState(false);
  const [copied, setCopied] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- feature detection is only possible after mount
  useEffect(() => setCanNative(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);
  const url = () => `${window.location.origin}${path}?utm_source=share`;
  const message = text ?? title;

  const native = async () => {
    try {
      await navigator.share({ title, text: message, url: url() });
    } catch {
      /* user cancelled */
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Share">
      {canNative && <Button type="button" variant="secondary" size="sm" onClick={native}><Share2 aria-hidden="true" /> Share</Button>}
      <Button asChild variant="secondary" size="sm">
        <a href={`https://wa.me/?text=${encodeURIComponent(`${message} `)}`} onClick={(e) => { e.currentTarget.href = `https://wa.me/?text=${encodeURIComponent(`${message} ${url()}`)}`; }} target="_blank" rel="noopener noreferrer"><WhatsAppIcon /> WhatsApp</a>
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={copy} aria-live="polite">{copied ? <><Check aria-hidden="true" /> Copied</> : <><Link2 aria-hidden="true" /> Copy link</>}</Button>
    </div>
  );
}
