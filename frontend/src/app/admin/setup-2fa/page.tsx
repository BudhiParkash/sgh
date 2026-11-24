"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { ApiError, adminFetch, setCsrfToken } from "@/lib/admin/api";
import { useMeQuery } from "@/lib/admin/context";

export default function Setup2faPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMeQuery();
  const [setup, setSetup] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) router.replace("/admin/login");
  }, [me.error, router]);

  const begin = async () => {
    setError(null);
    try {
      setSetup((await adminFetch<{ secret: string; qrDataUrl: string }>("/auth/2fa/setup", { method: "POST" })).data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't start setup.");
    }
  };

  const enable = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await adminFetch<{ recoveryCodes: string[]; csrfToken: string }>("/auth/2fa/enable", { method: "POST", body: { code } });
      setCsrfToken(r.data.csrfToken);
      setCodes(r.data.recoveryCodes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main id="main" className="bg-atmosphere grid min-h-dvh place-items-center p-4">
      <Card className="w-full max-w-lg p-6 md:p-8">
        <h1 className="font-display text-2xl font-bold">Set up two-factor authentication</h1>
        <p className="mt-2 text-sm text-muted">Your role requires a second sign-in step. Use any authenticator app (Google Authenticator, Microsoft Authenticator, Authy, 1Password…).</p>
        {codes ? (
          <div className="mt-6 flex flex-col gap-4">
            <h2 className="font-semibold">Save your recovery codes</h2>
            <p className="text-sm text-muted">Each code works once if you lose your phone. Store them somewhere safe — they won&apos;t be shown again.</p>
            <ul className="grid grid-cols-2 gap-2 rounded-lg bg-surface-2 p-4 font-mono text-sm">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
            <Button onClick={() => { qc.removeQueries({ queryKey: ["me"] }); router.replace("/admin"); }}>I&apos;ve saved them — continue</Button>
          </div>
        ) : !setup ? (
          <div className="mt-6">
            {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
            <Button onClick={begin}>Start setup</Button>
          </div>
        ) : (
          <form onSubmit={enable} className="mt-6 flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <Image src={setup.qrDataUrl} alt="QR code for your authenticator app" width={180} height={180} unoptimized className="rounded-lg bg-white p-2" />
              <div className="text-sm">
                <p>1. Scan the QR code in your app.</p>
                <p className="mt-2">Can&apos;t scan? Enter this key:</p>
                <code className="mt-1 block rounded bg-surface-2 p-2 font-mono text-xs break-all">{setup.secret}</code>
              </div>
            </div>
            <Field id="totp" label="2. Enter the 6-digit code" required>{(a) => <Input {...a} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />}</Field>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button type="submit" loading={busy} disabled={code.length !== 6}>Enable</Button>
          </form>
        )}
      </Card>
    </main>
  );
}
