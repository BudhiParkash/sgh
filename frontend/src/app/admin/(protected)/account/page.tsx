"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { ApiError, adminFetch } from "@/lib/admin/api";
import { useAdmin } from "@/lib/admin/context";
import { useToast } from "@/lib/admin/toast";
import { useQuery } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/field";

/** Public author profile shown on articles (opt-in). */
function ProfileCard() {
  const toast = useToast();
  const me = useQuery({ queryKey: ["me-profile"], queryFn: async () => (await adminFetch<{ profile: { displayName?: string; slug?: string; bio?: string; isPublic?: boolean } | null; name: string }>("/auth/me")).data });
  const [p, setP] = useState<{ displayName: string; slug: string; bio: string; isPublic: boolean } | null>(null);
  const v = p ?? { displayName: me.data?.profile?.displayName ?? me.data?.name ?? "", slug: me.data?.profile?.slug ?? "", bio: me.data?.profile?.bio ?? "", isPublic: Boolean(me.data?.profile?.isPublic) };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminFetch("/auth/profile", { method: "PATCH", body: v });
      toast({ tone: "success", title: "Profile saved" });
    } catch (err) {
      toast({ tone: "error", title: "Couldn't save profile", description: err instanceof ApiError ? (err.details[0]?.message ?? err.message) : undefined });
    }
  };
  if (me.isLoading) return null;
  return (
    <Card className="mb-6 p-5">
      <h2 className="mb-1 font-semibold">Author profile</h2>
      <p className="mb-4 text-sm text-muted">Shown on articles you write (and at /authors/your-slug) only if you make it public.</p>
      <form onSubmit={save} className="flex flex-col gap-4" noValidate>
        <Field id="pf-name" label="Display name" required>{(a) => <Input {...a} value={v.displayName} onChange={(e) => setP({ ...v, displayName: e.target.value })} maxLength={80} />}</Field>
        <Field id="pf-slug" label="Profile URL slug" hint="e.g. shivanshi" required>{(a) => <Input {...a} value={v.slug} onChange={(e) => setP({ ...v, slug: e.target.value.toLowerCase() })} maxLength={80} />}</Field>
        <Field id="pf-bio" label="Short bio">{(a) => <Textarea {...a} rows={3} value={v.bio} onChange={(e) => setP({ ...v, bio: e.target.value })} maxLength={600} />}</Field>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={v.isPublic} onChange={(e) => setP({ ...v, isPublic: e.target.checked })} className="size-5 accent-[var(--primary)]" /> Show my profile publicly</label>
        <Button type="submit" className="w-fit" disabled={v.displayName.length < 2 || !v.slug}>Save profile</Button>
      </form>
    </Card>
  );
}

export default function AccountPage() {
  const { me } = useAdmin();
  const toast = useToast();
  const router = useRouter();
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [err, setErr] = useState<string | null>(null);

  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pw.newPassword !== pw.confirm) return setErr("New passwords don't match.");
    try {
      await adminFetch("/auth/password", { method: "POST", body: { currentPassword: pw.currentPassword, newPassword: pw.newPassword } });
      toast({ tone: "success", title: "Password changed", description: "Your other sessions were signed out." });
      setPw({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (e2) {
      setErr(e2 instanceof ApiError ? (e2.details[0]?.message ?? e2.message) : "Failed");
    }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="My account" description={`${me.email} · ${me.role.replace(/_/g, " ")}`} />
      <Card className="mb-6 p-5">
        <h2 className="font-semibold">Two-factor authentication</h2>
        <p className="mt-2 flex items-center gap-2 text-sm">Status: <Badge tone={me.twoFactorEnabled ? "success" : "warning"}>{me.twoFactorEnabled ? "Enabled" : "Not enabled"}</Badge></p>
        {!me.twoFactorEnabled && <Button className="mt-3" size="sm" onClick={() => router.push("/admin/setup-2fa")}>Set up 2FA</Button>}
      </Card>
      <Card className="mb-6 p-5">
        <h2 className="mb-4 font-semibold">Change password</h2>
        <form onSubmit={change} className="flex flex-col gap-4" noValidate>
          <Field id="cur" label="Current password" required>{(a) => <Input {...a} type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />}</Field>
          <Field id="new" label="New password" hint="At least 12 characters. A passphrase of 4+ words works well." required>{(a) => <Input {...a} type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />}</Field>
          <Field id="conf" label="Confirm new password" required>{(a) => <Input {...a} type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />}</Field>
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
          <Button type="submit" className="w-fit" disabled={!pw.currentPassword || pw.newPassword.length < 12}>Change password</Button>
        </form>
      </Card>
      <ProfileCard />
      <Card className="p-5">
        <h2 className="font-semibold">Sessions</h2>
        <p className="mt-1 text-sm text-muted">Sign out of every browser and device, including this one.</p>
        <Button className="mt-3" variant="secondary" size="sm" onClick={async () => { await adminFetch("/auth/logout-all", { method: "POST" }); router.replace("/admin/login"); }}>Sign out everywhere</Button>
      </Card>
    </div>
  );
}
