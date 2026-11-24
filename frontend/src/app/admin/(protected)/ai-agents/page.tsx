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
import { useToast } from "@/lib/admin/toast";
import { siteConfig } from "@/lib/site";

interface Token { id: string; name: string; prefix: string; expiresAt: string | null; lastUsedAt: string | null; createdAt: string }
interface Connection { clientId: string; clientName?: string; connectedAt: string; lastUsedAt?: string | null }
interface AiAgent {
  id: string;
  name: string;
  status: "active" | "suspended";
  role: { id: string; key: string; name: string } | null;
  effectivePermissions: string[];
  createdAt: string;
  tokens: Token[];
  connections: Connection[];
}
interface Role { id: string; key: string; name: string }

function CopyBox({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-stretch gap-2">
      <code aria-label={label} className="min-w-0 flex-1 rounded bg-surface-2 p-3 font-mono text-sm break-all">{value}</code>
      <Button
        size="sm"
        variant="secondary"
        className="shrink-0 self-center"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

export default function AiAgentsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const agents = useQuery({ queryKey: ["ai-agents"], queryFn: async () => (await adminFetch<AiAgent[]>("/ai-agents")).data });
  const roles = useQuery({ queryKey: ["roles"], queryFn: async () => (await adminFetch<Role[]>("/roles")).data });
  const mcpUrl = `${siteConfig.url.replace(/\/$/, "")}/mcp`;

  const [dialog, setDialog] = useState<null | { kind: "agent" } | { kind: "token"; agent: AiAgent } | { kind: "secret"; token: string }>(null);
  const [name, setName] = useState("");
  const [expires, setExpires] = useState("90");
  const [err, setErr] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["ai-agents"] });
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast({ tone: "success", title: ok });
      refresh();
    } catch (e) {
      toast({ tone: "error", title: "Action failed", description: e instanceof ApiError ? e.message : undefined });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      if (dialog?.kind === "agent") {
        await adminFetch("/ai-agents", { method: "POST", body: { name } });
        setDialog(null);
        toast({ tone: "success", title: "AI agent created" });
      } else if (dialog?.kind === "token") {
        const r = await adminFetch<{ token: string }>(`/ai-agents/${dialog.agent.id}/tokens`, { method: "POST", body: { name, expiresInDays: expires === "never" ? null : Number(expires) } });
        setDialog({ kind: "secret", token: r.data.token });
      }
      setName("");
      refresh();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? (e2.details[0]?.message ?? e2.message) : "Failed");
    }
  };

  return (
    <div>
      <PageHeader
        title="AI agents"
        description="Let Claude or ChatGPT research and draft content for you through the MCP server. Agents create drafts and submit them for review — a person always publishes."
        actions={<Button size="sm" onClick={() => { setDialog({ kind: "agent" }); setName(""); setErr(null); }}>New AI agent</Button>}
      />

      <Card className="mb-6 flex flex-col gap-4 p-4 md:p-6">
        <h2 className="font-display text-lg font-bold">How to connect</h2>
        <p className="text-sm text-muted">Server URL for every assistant:</p>
        <CopyBox value={mcpUrl} label="MCP server URL" />
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <div>
            <h3 className="mb-1 font-semibold">Claude (claude.ai, desktop, mobile)</h3>
            <ol className="list-decimal space-y-1 pl-5 text-muted">
              <li>Settings → Connectors → <strong>Add custom connector</strong>.</li>
              <li>Name it “Shivanshi Gaming Hub”, paste the URL above, and add it.</li>
              <li>Click <strong>Connect</strong>, sign in here and pick the AI agent.</li>
            </ol>
          </div>
          <div>
            <h3 className="mb-1 font-semibold">ChatGPT</h3>
            <ol className="list-decimal space-y-1 pl-5 text-muted">
              <li>Settings → Apps &amp; Connectors → Advanced → turn on <strong>Developer mode</strong>.</li>
              <li><strong>Create</strong> a connector with the URL above and OAuth authentication.</li>
              <li>Sign in here when asked and pick the AI agent.</li>
            </ol>
          </div>
          <div>
            <h3 className="mb-1 font-semibold">Claude Code / other tools</h3>
            <p className="text-muted">Create an access token below, then run:</p>
            <code className="mt-1 block rounded bg-surface-2 p-2 font-mono text-xs break-all">claude mcp add --transport http sgh {mcpUrl} --header &quot;Authorization: Bearer sgh_pat_…&quot;</code>
          </div>
        </div>
        <p className="text-xs text-subtle">
          Agents can never publish, delete, or see settings, legal pages, users or the inbox (personal data). Every change is in the Audit log under the agent’s name. Built-in prompts: “add_tournament”, “write_guide”, “add_sensitivity_setup”.
        </p>
      </Card>

      {agents.isLoading ? (
        <Skeleton className="h-48" />
      ) : agents.data?.length === 0 ? (
        <Card className="p-6 text-sm text-muted">No AI agents yet. Create one (for example “Claude” or “ChatGPT”) to connect an assistant.</Card>
      ) : (
        <ul className="flex flex-col gap-4">
          {agents.data?.map((a) => (
            <li key={a.id}>
              <Card className="flex flex-col gap-4 p-4 md:p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-bold">{a.name}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {a.role && <Badge tone="primary">{a.role.name}</Badge>}
                      <Badge tone={a.status === "active" ? "success" : "danger"}>{a.status}</Badge>
                      <span className="text-xs text-subtle">Created {formatAdminDate(a.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select aria-label={`Role for ${a.name}`} value={a.role?.id ?? ""} onChange={(e) => run(() => adminFetch(`/ai-agents/${a.id}`, { method: "PATCH", body: { role: e.target.value } }), "Role updated")} className="h-9 text-sm">
                      {roles.data?.filter((r) => r.key !== "super_admin" && r.key !== "admin").map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </Select>
                    <Button size="sm" variant="secondary" disabled={a.status !== "active"} onClick={() => { setDialog({ kind: "token", agent: a }); setName(""); setErr(null); }}>New access token</Button>
                    <ConfirmButton
                      variant="secondary"
                      title={a.status === "active" ? `Pause ${a.name}?` : `Resume ${a.name}?`}
                      description={a.status === "active" ? "All its connections stop working until you resume it." : undefined}
                      confirmLabel={a.status === "active" ? "Pause" : "Resume"}
                      onConfirm={() => run(() => adminFetch(`/ai-agents/${a.id}`, { method: "PATCH", body: { status: a.status === "active" ? "suspended" : "active" } }), "Updated")}
                    >
                      {a.status === "active" ? "Pause" : "Resume"}
                    </ConfirmButton>
                    <ConfirmButton title={`Remove ${a.name}?`} description="Revokes every token and connection. Content it created stays." confirmLabel="Remove" onConfirm={() => run(() => adminFetch(`/ai-agents/${a.id}`, { method: "DELETE" }), "AI agent removed")}>
                      Remove
                    </ConfirmButton>
                  </div>
                </div>

                <details className="text-sm">
                  <summary className="cursor-pointer text-muted">What it can do ({a.effectivePermissions.length} permissions)</summary>
                  <p className="mt-2 font-mono text-xs break-words text-subtle">{a.effectivePermissions.join(" · ")}</p>
                </details>

                <div className="grid gap-4 md:grid-cols-2">
                  <section>
                    <h3 className="mb-2 text-sm font-semibold">Connected assistants</h3>
                    {a.connections.length === 0 ? (
                      <p className="text-sm text-subtle">None yet.</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {a.connections.map((c) => (
                          <li key={c.clientId} className="flex items-center justify-between gap-2 rounded border border-border p-2 text-sm">
                            <span className="min-w-0">
                              <span className="font-medium">{c.clientName ?? "AI assistant"}</span>
                              <span className="block text-xs text-subtle">Connected {formatAdminDate(c.connectedAt)}</span>
                            </span>
                            <ConfirmButton variant="secondary" title={`Disconnect ${c.clientName ?? "this assistant"}?`} confirmLabel="Disconnect" onConfirm={() => run(() => adminFetch(`/ai-agents/${a.id}/connections/${encodeURIComponent(c.clientId)}`, { method: "DELETE" }), "Disconnected")}>
                              Disconnect
                            </ConfirmButton>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                  <section>
                    <h3 className="mb-2 text-sm font-semibold">Access tokens</h3>
                    {a.tokens.length === 0 ? (
                      <p className="text-sm text-subtle">None.</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {a.tokens.map((t) => (
                          <li key={t.id} className="flex items-center justify-between gap-2 rounded border border-border p-2 text-sm">
                            <span className="min-w-0">
                              <span className="font-medium">{t.name}</span> <code className="text-xs text-subtle">{t.prefix}…</code>
                              <span className="block text-xs text-subtle">
                                Expires {t.expiresAt ? formatAdminDate(t.expiresAt) : "never"} · last used {formatAdminDate(t.lastUsedAt)}
                              </span>
                            </span>
                            <ConfirmButton variant="secondary" title={`Revoke “${t.name}”?`} confirmLabel="Revoke" onConfirm={() => run(() => adminFetch(`/ai-agents/${a.id}/tokens/${t.id}`, { method: "DELETE" }), "Token revoked")}>
                              Revoke
                            </ConfirmButton>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent title={dialog?.kind === "agent" ? "New AI agent" : dialog?.kind === "token" ? `Access token for ${dialog.agent.name}` : "Copy your token now"}>
          {dialog?.kind === "secret" ? (
            <div className="flex flex-col gap-3 text-sm">
              <p>This token is shown <strong>only once</strong>. Store it in your password manager — anyone with it can draft content as this agent.</p>
              <CopyBox value={dialog.token} label="Access token" />
              <Button onClick={() => setDialog(null)}>Done</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <Field id="ai-name" label={dialog?.kind === "agent" ? "Agent name" : "Token name"} hint={dialog?.kind === "agent" ? "Shown in the audit log, e.g. “Claude” or “ChatGPT”." : "Where it's used, e.g. “Claude Code on laptop”."} required>
                {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
              </Field>
              {dialog?.kind === "token" && (
                <Field id="ai-exp" label="Expires after">
                  {(p) => (
                    <Select {...p} value={expires} onChange={(e) => setExpires(e.target.value)}>
                      <option value="30">30 days</option>
                      <option value="90">90 days</option>
                      <option value="365">1 year</option>
                      <option value="never">Never</option>
                    </Select>
                  )}
                </Field>
              )}
              {err && <p role="alert" className="text-sm text-danger">{err}</p>}
              <Button type="submit" disabled={name.trim().length < 2}>{dialog?.kind === "agent" ? "Create agent" : "Create token"}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
