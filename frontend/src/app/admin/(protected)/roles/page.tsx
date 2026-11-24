"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmButton, PageHeader } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, adminFetch } from "@/lib/admin/api";
import { useAdmin } from "@/lib/admin/context";
import { useToast } from "@/lib/admin/toast";

interface Role { id: string; key: string; name: string; description?: string; permissions: string[]; isSystem: boolean; memberCount: number }

function PermissionGrid({ all, value, onChange, disabled }: { all: string[]; value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const groups = all.reduce<Record<string, string[]>>((acc, p) => {
    const [m] = p.split(":");
    (acc[m!] ??= []).push(p);
    return acc;
  }, {});
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(groups).map(([m, ps]) => (
        <fieldset key={m} className="rounded-md border border-border p-3">
          <legend className="px-1 text-xs font-semibold tracking-wider text-subtle uppercase">{m.replace(/_/g, " ")}</legend>
          {ps.map((p) => (
            <label key={p} className="flex min-h-8 items-center gap-2 text-sm">
              <input type="checkbox" disabled={disabled} checked={value.includes(p)} onChange={(e) => onChange(e.target.checked ? [...value, p] : value.filter((x) => x !== p))} className="size-4 accent-[var(--primary)]" />
              {p.split(":")[1]!.replace(/_/g, " ")}
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}

export default function RolesPage() {
  const { can } = useAdmin();
  const toast = useToast();
  const qc = useQueryClient();
  const roles = useQuery({ queryKey: ["roles"], queryFn: async () => (await adminFetch<Role[]>("/roles")).data });
  const perms = useQuery({ queryKey: ["permissions"], queryFn: async () => (await adminFetch<string[]>("/roles/permissions")).data });
  const [editing, setEditing] = useState<{ id?: string; name: string; permissions: string[] } | null>(null);

  const save = async () => {
    if (!editing) return;
    try {
      if (editing.id) await adminFetch(`/roles/${editing.id}`, { method: "PATCH", body: { name: editing.name, permissions: editing.permissions } });
      else await adminFetch("/roles", { method: "POST", body: { name: editing.name, permissions: editing.permissions } });
      toast({ tone: "success", title: "Role saved", description: "Members will be asked to sign in again." });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["roles"] });
    } catch (e) {
      toast({ tone: "error", title: "Couldn't save role", description: e instanceof ApiError ? e.message : undefined });
    }
  };

  return (
    <div>
      <PageHeader title="Roles & permissions" description="System roles follow the approved permission matrix. Create custom roles for special cases." actions={can("role:create") && !editing && <Button size="sm" onClick={() => setEditing({ name: "", permissions: ["dashboard:read"] })}>New custom role</Button>} />
      {editing && perms.data && (
        <Card className="mb-6 flex flex-col gap-4 p-5">
          <Field id="role-name" label="Role name" required>{(a) => <Input {...a} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />}</Field>
          <PermissionGrid all={perms.data} value={editing.permissions} onChange={(p) => setEditing({ ...editing, permissions: p })} />
          <div className="flex gap-2"><Button onClick={save} disabled={editing.name.length < 2}>Save role</Button><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
        </Card>
      )}
      {roles.isLoading ? <Skeleton className="h-64" /> : (
        <ul className="grid gap-4 md:grid-cols-2">
          {roles.data?.map((r) => (
            <li key={r.id}>
              <Card className="flex h-full flex-col gap-2 p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold">{r.name}</h2>
                  <Badge tone={r.isSystem ? "neutral" : "info"}>{r.isSystem ? "System" : "Custom"}</Badge>
                </div>
                <p className="text-sm text-muted">{r.memberCount} member{r.memberCount === 1 ? "" : "s"} · {r.permissions.length} permissions</p>
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted hover:text-text">View permissions</summary>
                  <p className="mt-2 font-mono text-xs leading-relaxed text-subtle">{r.permissions.join(", ")}</p>
                </details>
                {!r.isSystem && (
                  <div className="mt-auto flex gap-2 pt-2">
                    {can("role:update") && <Button size="sm" variant="secondary" onClick={() => setEditing({ id: r.id, name: r.name, permissions: r.permissions })}>Edit</Button>}
                    {can("role:delete") && <ConfirmButton title={`Delete role "${r.name}"?`} confirmLabel="Delete" disabled={r.memberCount > 0} onConfirm={async () => { await adminFetch(`/roles/${r.id}`, { method: "DELETE" }); qc.invalidateQueries({ queryKey: ["roles"] }); }}>Delete</ConfirmButton>}
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
