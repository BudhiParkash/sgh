"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { errorText, playerFetch } from "@/lib/play/client";
import { usePlayer } from "@/lib/play/context";
import type { Me } from "@/lib/play/types";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

interface GoogleId {
  accounts: { id: { initialize: (o: Record<string, unknown>) => void; renderButton: (el: HTMLElement, o: Record<string, unknown>) => void } };
}
declare global {
  interface Window {
    google?: GoogleId;
  }
}

let gisLoading: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  gisLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      gisLoading = null;
      reject(new Error("Google sign-in could not load"));
    };
    document.head.appendChild(s);
  });
  return gisLoading;
}

type Resp = { status: "signed_in"; player: Me } | { status: "consent_required"; name: string; email: string };

/** Google sign-in (18+ only). First sign-in asks for age confirmation and the Terms/Privacy Policy. */
export function SignInDialog() {
  const { signInOpen, closeSignIn, signedIn, signInReason } = usePlayer();
  const btnRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<{ credential: string; name: string; email: string } | null>(null);
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async (credential: string, consent?: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await playerFetch<Resp>("/auth/google", { method: "POST", body: { credential, ...(consent && { confirmAge: true, acceptTerms: true }) } });
      if (r.status === "signed_in") {
        setPending(null);
        signedIn(r.player);
      } else setPending({ credential, name: r.name, email: r.email });
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!signInOpen || pending || !CLIENT_ID) return;
    let cancelled = false;
    loadGis()
      .then(() => {
        if (cancelled || !btnRef.current || !window.google) return;
        window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: (r: { credential: string }) => void send(r.credential), ux_mode: "popup", itp_support: true });
        window.google.accounts.id.renderButton(btnRef.current, { theme: "filled_black", size: "large", shape: "pill", text: "continue_with", width: 280 });
      })
      .catch(() => setErr("Google sign-in could not load. Check your connection or ad blocker and try again."));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- send is stable enough for a one-time button render
  }, [signInOpen, pending]);

  return (
    <Dialog
      open={signInOpen}
      onOpenChange={(o) => {
        if (!o) {
          closeSignIn();
          setPending(null);
          setErr(null);
        }
      }}
    >
      <DialogContent title={pending ? "Create your player account" : "Sign in to play"} description={pending ? undefined : (signInReason ?? "Join Shivanshi Custom Rooms, build your squad and collect free SGC coins every day.")}>
        {!CLIENT_ID ? (
          <p className="text-sm text-muted">Player sign-in isn&apos;t switched on yet. Please check back soon.</p>
        ) : pending ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void send(pending.credential, true);
            }}
          >
            <p className="text-sm text-muted">
              Signing up as <strong className="text-text">{pending.name || pending.email}</strong> ({pending.email}).
            </p>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 size-4 accent-[var(--color-primary)]" checked={age} onChange={(e) => setAge(e.target.checked)} required />
              <span>I confirm I am <strong>18 years or older</strong>.</span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 size-4 accent-[var(--color-primary)]" checked={terms} onChange={(e) => setTerms(e.target.checked)} required />
              <span>
                I agree to the{" "}
                <Link href="/legal/terms" className="text-secondary underline" target="_blank">Terms</Link>,{" "}
                <Link href="/legal/custom-room-rules" className="text-secondary underline" target="_blank">Custom Room Rules</Link>,{" "}
                <Link href="/legal/sgc-rewards-terms" className="text-secondary underline" target="_blank">SGC Rewards Terms</Link> and the{" "}
                <Link href="/legal/privacy-policy" className="text-secondary underline" target="_blank">Privacy Policy</Link>.
              </span>
            </label>
            <p className="flex items-start gap-2 rounded-md bg-surface-2 p-3 text-xs text-muted">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              Free to play. No entry fees, no betting, and SGC coins can never be bought, sold or cashed out. Not affiliated with KRAFTON.
            </p>
            {err && <p role="alert" className="text-sm text-danger">{err}</p>}
            <Button type="submit" loading={busy} disabled={!age || !terms}>Create account</Button>
          </form>
        ) : (
          <div className="flex flex-col items-center gap-4 py-2">
            <div ref={btnRef} className="min-h-11" />
            {busy && <p className="text-sm text-muted">Signing you in…</p>}
            {err && <p role="alert" className="text-center text-sm text-danger">{err}</p>}
            <p className="text-center text-xs text-subtle">18+ only. We use your Google name and email to create your account — see the Privacy Policy.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
