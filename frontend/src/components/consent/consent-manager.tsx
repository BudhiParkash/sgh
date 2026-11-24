"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { readConsent, writeConsent, type Consent } from "@/lib/consent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function gtagConsent(c: Consent | null, mode: "default" | "update") {
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = window.gtag ?? function gtag(...args: unknown[]) { window.dataLayer!.push(args); };
  window.gtag("consent", mode, {
    analytics_storage: c?.analytics ? "granted" : "denied",
    ad_storage: c?.ads ? "granted" : "denied",
    ad_user_data: c?.ads ? "granted" : "denied",
    ad_personalization: c?.ads ? "granted" : "denied",
  });
}

/**
 * Cookie consent (necessary / analytics / advertising). Defaults are DENIED (Consent Mode v2);
 * GA4 loads only after analytics consent. "Reject all" is as prominent as "Accept all" (no dark patterns).
 */
export function ConsentManager({ ga4Id }: { ga4Id: string | null }) {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [ready, setReady] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [draft, setDraft] = useState({ analytics: false, ads: false });

  useEffect(() => {
    const c = readConsent();
    gtagConsent(null, "default");
    if (c) gtagConsent(c, "update");
    // The pre-paint script only checks the cookie exists; an outdated version must show the banner again.
    document.documentElement.classList.toggle("has-consent", Boolean(c));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a cookie is only possible after mount
    setConsent(c);
    setReady(true);
    const open = () => {
      const cur = readConsent();
      setDraft({ analytics: Boolean(cur?.analytics), ads: Boolean(cur?.ads) });
      setPrefsOpen(true);
    };
    window.addEventListener("sgh:open-cookie-settings", open);
    return () => window.removeEventListener("sgh:open-cookie-settings", open);
  }, []);

  const save = useCallback((c: { analytics: boolean; ads: boolean }) => {
    const full = writeConsent(c);
    gtagConsent(full, "update");
    document.documentElement.classList.add("has-consent");
    setConsent(full);
    setPrefsOpen(false);
  }, []);

  return (
    <>
      {ga4Id && consent?.analytics && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(ga4Id)},{allow_google_signals:false,allow_ad_personalization_signals:false});`}
          </Script>
        </>
      )}
      {/* Always in the server HTML (painted immediately, no late layout/LCP shift). Hidden by CSS when a
          choice exists — set before first paint by the inline script in the root layout. */}
      <section aria-labelledby="consent-title" className="consent-banner fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4" hidden={ready && Boolean(consent)}>
        <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-xl border border-border-strong bg-surface-2 p-5 shadow-lg md:flex-row md:items-center">
          <div className="flex-1 text-sm">
            <h2 id="consent-title" className="mb-1 font-semibold">Cookies</h2>
            <p className="text-muted">
              We use necessary cookies to run the site. With your permission we&apos;d also like to use analytics cookies to see which pages help gamers most. <Link href="/legal/cookie-policy" className="text-secondary underline">Cookie policy</Link>
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" onClick={() => save({ analytics: false, ads: false })}>Reject all</Button>
            <Button variant="secondary" onClick={() => { setDraft({ analytics: false, ads: false }); setPrefsOpen(true); }}>Customise</Button>
            <Button variant="secondary" onClick={() => save({ analytics: true, ads: true })}>Accept all</Button>
          </div>
        </div>
      </section>
      <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
        <DialogContent title="Cookie settings" description="Choose which optional cookies we may use. You can change this at any time.">
          <div className="flex flex-col gap-4 text-sm">
            <label className="flex items-start gap-3 opacity-70">
              <input type="checkbox" checked disabled className="mt-1 size-5" />
              <span><strong>Necessary</strong><span className="block text-muted">Remembers this choice and keeps the site secure. Always on.</span></span>
            </label>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={draft.analytics} onChange={(e) => setDraft({ ...draft, analytics: e.target.checked })} className="mt-1 size-5 accent-[var(--primary)]" />
              <span><strong>Analytics</strong><span className="block text-muted">Google Analytics 4, to understand which pages are useful. No advertising features.</span></span>
            </label>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={draft.ads} onChange={(e) => setDraft({ ...draft, ads: e.target.checked })} className="mt-1 size-5 accent-[var(--primary)]" />
              <span><strong>Advertising</strong><span className="block text-muted">Lets ad partners personalise ads. Without it, only non-personalised ads are shown.</span></span>
            </label>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => save({ analytics: false, ads: false })}>Reject all</Button>
              <Button onClick={() => save(draft)}>Save choices</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CookieSettingsButton() {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event("sgh:open-cookie-settings"))} className="inline-flex min-h-11 items-center text-xs text-subtle hover:text-text">
      Cookie settings
    </button>
  );
}
