"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { ApiError, adminFetch, setCsrfToken } from "@/lib/admin/api";

function safeNext(n: string | null): string {
  if (n && /^\/oauth\/consent\?req=[\w-]+$/.test(n)) return n; // AI assistant connection approval (served by the API)
  return n && n.startsWith("/admin") && !n.startsWith("//") ? n : "/admin";
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [step, setStep] = useState<"password" | "2fa">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const done = (mustSetup2fa: boolean) => {
    qc.removeQueries({ queryKey: ["me"] });
    const next = mustSetup2fa ? "/admin/setup-2fa" : safeNext(params.get("next"));
    if (next.startsWith("/oauth/")) window.location.assign(next);
    else router.replace(next);
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await adminFetch<{ requires2fa: boolean; mustSetup2fa?: boolean; csrfToken?: string }>("/auth/login", { method: "POST", body: { email, password } });
      if (r.data.csrfToken) setCsrfToken(r.data.csrfToken);
      if (r.data.requires2fa) setStep("2fa");
      else done(Boolean(r.data.mustSetup2fa));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
      setPassword("");
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await adminFetch<{ csrfToken: string; mustSetup2fa: boolean }>("/auth/2fa/verify", { method: "POST", body: { code: code.trim() } });
      setCsrfToken(r.data.csrfToken);
      done(r.data.mustSetup2fa);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verification failed.");
      if (err instanceof ApiError && err.status === 400) setStep("password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="w-full max-w-sm p-6 md:p-8">
      <div className="mb-6 flex items-center gap-3">
        <LogoMark className="size-10" />
        <div>
          <h1 className="font-display text-xl font-bold">Admin sign in</h1>
          <p className="text-sm text-muted">Shivanshi Gaming Hub</p>
        </div>
      </div>
      {step === "password" ? (
        <form onSubmit={submitPassword} className="flex flex-col gap-4" noValidate>
          <Field id="email" label="Email" required>{(a) => <Input {...a} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
          <Field id="password" label="Password" required>{(a) => <Input {...a} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button type="submit" loading={busy} disabled={!email || !password}>Continue</Button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="flex flex-col gap-4" noValidate>
          <Field id="code" label="Authentication code" hint="6-digit code from your authenticator app, or a recovery code (XXXXX-XXXXX)." required>
            {(a) => <Input {...a} autoComplete="one-time-code" inputMode="text" autoFocus value={code} onChange={(e) => setCode(e.target.value)} maxLength={11} />}
          </Field>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <Button type="submit" loading={busy} disabled={code.trim().length < 6}>Verify</Button>
          <Button type="button" variant="ghost" onClick={() => { setStep("password"); setCode(""); }}>Back</Button>
        </form>
      )}
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main id="main" className="bg-atmosphere grid min-h-dvh place-items-center p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
