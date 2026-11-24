"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { postPublic } from "./public-form";

/** "Was this helpful?" — anonymous by default; nothing is shown publicly until there are enough answers. */
export function FeedbackWidget({ targetType, targetSlug, summary }: { targetType: "sensitivity_config" | "article" | "tournament"; targetSlug: string; summary?: { total: number; helpfulShare: number | null } | null }) {
  const [step, setStep] = useState<"ask" | "comment" | "done">("ask");
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [text, setText] = useState("");
  const send = async (h: boolean, message?: string) => {
    await postPublic("/feedback", { targetType, targetSlug, helpful: h, ...(message && { message }) });
  };
  return (
    <section aria-labelledby="fb-title" className="rounded-lg border border-border bg-surface-1 p-5">
      <h2 id="fb-title" className="font-semibold">Was this helpful?</h2>
      {summary?.helpfulShare != null && <p className="mt-1 text-xs text-subtle">{summary.helpfulShare}% of {summary.total} visitors found this helpful.</p>}
      {step === "ask" && (
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => { setHelpful(true); setStep("comment"); void send(true); }}><ThumbsUp aria-hidden="true" /> Yes</Button>
          <Button variant="secondary" size="sm" onClick={() => { setHelpful(false); setStep("comment"); void send(false); }}><ThumbsDown aria-hidden="true" /> No</Button>
        </div>
      )}
      {step === "comment" && (
        <form className="mt-3 flex flex-col gap-2" onSubmit={async (e) => { e.preventDefault(); if (text.trim()) await send(helpful ?? false, text.trim()); setStep("done"); }}>
          <label htmlFor="fb-text" className="text-sm text-muted">Thanks! Anything we should improve? (optional, anonymous)</label>
          <Textarea id="fb-text" rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit" size="sm" variant="secondary" className="w-fit">Send</Button>
        </form>
      )}
      {step === "done" && <p role="status" className="mt-2 text-sm text-success">Thanks for the feedback.</p>}
    </section>
  );
}
