"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
}

/** Registers the service worker (production only). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}

/** "Install app" — shown only when the browser offers installation (Android/desktop Chrome); iOS gets instructions. */
export function InstallAppButton({ variant = "button" }: { variant?: "button" | "card" }) {
  const [available, setAvailable] = useState(false);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const update = () => setAvailable(Boolean(deferred));
    listeners.add(update);
    update();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- platform detection only after mount
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !("standalone" in navigator && (navigator as { standalone?: boolean }).standalone));
    return () => {
      listeners.delete(update);
    };
  }, []);
  if (installed || (!available && !ios)) return null;
  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    setAvailable(false);
  };
  const body = ios && !available ? <p className="text-sm text-muted">On iPhone: tap the Share button, then <strong>Add to Home Screen</strong>.</p> : null;
  if (variant === "card") {
    return (
      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
        <Smartphone className="size-8 shrink-0 text-primary-hover" aria-hidden="true" />
        <div className="flex-1">
          <h2 className="font-semibold">Get the app</h2>
          <p className="text-sm text-muted">Open Shivanshi Gaming Hub from your home screen — saved setups work even offline.</p>
          {body}
        </div>
        {available && <Button onClick={install}><Download aria-hidden="true" /> Install</Button>}
      </Card>
    );
  }
  return available ? <Button size="sm" variant="secondary" onClick={install}><Download aria-hidden="true" /> Install app</Button> : null;
}
