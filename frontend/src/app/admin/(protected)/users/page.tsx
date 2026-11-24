"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmButton, PageHeader, formatAdminDate } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, adminFetch } from "@/lib/admin/api";
import { useAdmin } from "@/lib/admin/context";
import { useToast } from "@/lib/admin/toast";

interface AdminUser { id: string; name: string; email: string; role: { id: string; key: string; name: string }; status: string; twoFactorEnabled: boolean; lockedUntil: string | null; lastLoginAt: string | null }
interface Role { id: string; key: string; name: string }

export default function UsersPage() {
  const { can, me } = useAdmin();
  const toast = useToast();
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["admins"], queryFn: async () => (await adminFetch<AdminUser[]>("/admins")).data });
  const roles = useQuery({ queryKey: ["roles"], queryFn: async () => (await adminFetch<Role[]>("/roles")).data });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "" });
  const [temp, setTemp] = useState<{ email: string; password: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast({ tone: "success", title: ok });
      qc.invalidateQueries({ queryKey: ["admins"] });
    } catch (e) {
      toast({ tone: "error", title: "Action failed", description: e instanceof ApiError ? e.message : undefined });
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const r = await adminFetch<AdminUser & { temporaryPassword: string }>("/admins", { method: "POST", body: form });
      setTemp({ email: r.data.email, password: r.data.temporaryPassword });
      setForm({ name: "", email: "", role: "" });
      qc.invalidateQueries({ queryKey: ["admins"] });
    } catch (e2) {
      setErr(e2 instanceof ApiError ? (e2.details[0]?.message ?? e2.message) : "Failed");
    }
  };

  return (
    <div>
      <PageHeader title="Users" description="Admin team members. Changing someone's role or status signs them out immediately." actions={can("admin:create") && <Button size="sm" onClick={() => { setOpen(true); setTemp(null); }}>Add user</Button>} />
      {users.isLoading ? <Skeleton className="h-64" /> : (
        <ul className="flex flex-col gap-3">
          {users.data?.map((u) => (
            <li key={u.id}>
              <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{u.name} {u.id === me.id && <span className="text-xs text-subtle">(you)</span>}</p>
                  <p className="truncate text-sm text-muted">{u.email}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge tone="primary">{u.role.name}</Badge>
                    {u.status !== "active" && <Badge tone="danger">{u.status}</Badge>}
                    <Badge tone={u.twoFactorEnabled ? "success" : "warning"}>{u.twoFactorEnabled ? "2FA on" : "2FA off"}</Badge>
                    {u.lockedUntil && new Date(u.lockedUntil) > new Date() && <Badge tone="danger">Locked</Badge>}
                    <span className="text-xs text-subtle">Last sign-in: {formatAdminDate(u.lastLoginAt)}</span>
                  </div>
                </div>
                {can("admin:update") && u.id !== me.id && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Select aria-label={`Role for ${u.name}`} value={u.role.id} onChange={(e) => run(() => adminFetch(`/admins/${u.id}`, { method: "PATCH", body: { role: e.target.value } }), "Role updated")} className="h-9 text-sm">
                      {roles.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </Select>
                    {u.lockedUntil && <Button size="sm" variant="secondary" onClick={() => run(() => adminFetch(`/admins/${u.id}/unlock`, { method: "POST" }), "Unlocked")}>Unlock</Button>}
                    <ConfirmButton variant="secondary" title={`Sign ${u.name} out everywhere?`} confirmLabel="Sign out" onConfirm={() => run(() => adminFetch(`/admins/${u.id}/force-logout`, { method: "POST" }), "Signed out")}>Force sign-out</ConfirmButton>
                    <ConfirmButton title={u.status === "active" ? `Suspend ${u.name}?` : `Reactivate ${u.name}?`} confirmLabel={u.status === "active" ? "Suspend" : "Reactivate"} onConfirm={() => run(() => adminFetch(`/admins/${u.id}`, { method: "PATCH", body: { status: u.status === "active" ? "suspended" : "active" } }), "Updated")}>{u.status === "active" ? "Suspend" : "Reactivate"}</ConfirmButton>
                    {me.role === "super_admin" && (
                      <>
                        <ConfirmButton title={`Reset 2FA for ${u.name}?`} description="They will need to set it up again at next sign-in." confirmLabel="Reset 2FA" onConfirm={() => run(() => adminFetch(`/admins/${u.id}/reset-2fa`, { method: "POST" }), "2FA reset")}>Reset 2FA</ConfirmButton>
                        <ConfirmButton title={`Reset password for ${u.name}?`} confirmLabel="Reset" onConfirm={async () => { const r = await adminFetch<{ temporaryPassword: string }>(`/admins/${u.id}/reset-password`, { method: "POST" }); setTemp({ email: u.email, password: r.data.temporaryPassword }); setOpen(true); }}>Reset password</ConfirmButton>
                      </>
                    )}
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={temp ? "Temporary password" : "Add user"}>
          {temp ? (
            <div className="flex flex-col gap-3 text-sm">
              <p>Share this with <strong>{temp.email}</strong> over a private channel. It is shown only once; they should change it after signing in.</p>
              <code className="rounded bg-surface-2 p-3 font-mono break-all">{temp.password}</code>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          ) : (
            <form onSubmit={create} className="flex flex-col gap-4">
              <Field id="nu-name" label="Name" required>{(a) => <Input {...a} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
              <Field id="nu-email" label="Email" required>{(a) => <Input {...a} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
              <Field id="nu-role" label="Role" required>{(a) => (
                <Select {...a} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="">Select role</option>
                  {roles.data?.filter((r) => r.key !== "super_admin" || me.role === "super_admin").map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Select>
              )}</Field>
              {err && <p role="alert" className="text-sm text-danger">{err}</p>}
              <Button type="submit" disabled={!form.name || !form.email || !form.role}>Create user</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
