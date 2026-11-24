"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the code is still visible to copy manually */
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border-strong bg-surface-1 p-3">
      <code className="font-mono text-lg tracking-wider select-all">{code}</code>
      <Button type="button" size="sm" variant="secondary" onClick={copy} aria-live="polite">
        {copied ? <><Check aria-hidden="true" /> Copied</> : <><Copy aria-hidden="true" /> Copy code</>}
      </Button>
    </div>
  );
}
