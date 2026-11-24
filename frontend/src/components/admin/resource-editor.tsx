"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, History, Save } from "lucide-react";
import type { WorkflowStatus } from "@sgh/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, adminFetch, applyFieldErrors } from "@/lib/admin/api";
import { useAdmin } from "@/lib/admin/context";
import { buildSchema, localInputToIso, type FieldDef, type ResourceDef } from "@/lib/admin/resource";
import { useToast } from "@/lib/admin/toast";
import { FieldRenderer } from "./form-fields";
import { ConfirmButton, PageHeader, WorkflowBadge, formatAdminDate } from "./ui";

/* eslint-disable @typescript-eslint/no-explicit-any -- generic documents */
type Doc = Record<string, any>;

function defaultsFor(def: ResourceDef<Doc>): Doc {
  const out: Doc = { ...(def.defaults ?? {}) };
  for (const f of def.sections.flatMap((s) => s.fields)) {
    if (f.name.includes(".") || out[f.name] !== undefined) continue;
    out[f.name] = f.type === "checkbox" ? false : f.type === "list" || f.type === "references" || f.type === "multiselect" ? [] : f.type === "media" || f.type === "reference" ? null : "";
  }
  return out;
}

const getPath = (o: Doc, path: string): any => path.split(".").reduce<any>((acc, k) => acc?.[k], o);
function setPath(o: Doc, path: string, v: unknown) {
  const keys = path.split(".");
  let cur = o;
  keys.slice(0, -1).forEach((k) => {
    cur[k] = cur[k] && typeof cur[k] === "object" ? cur[k] : {};
    cur = cur[k];
  });
  cur[keys[keys.length - 1]!] = v;
}

/** Normalise form values → API payload: empty strings → undefined, datetime-local → ISO. Supports dotted names (seo.title). */
export function cleanPayload(fields: FieldDef[], values: Doc): Doc {
  const out: Doc = {};
  for (const f of fields) {
    let v = getPath(values, f.name);
    if (f.showIf && !f.showIf(values)) continue;
    if (f.type === "datetime") v = localInputToIso(v);
    if (f.type === "number") v = v === "" || v === null || v === undefined ? null : Number(v);
    if (f.type === "reference" || f.type === "media") v = v && typeof v === "object" ? v.id : v || null;
    if (f.type === "references") v = Array.isArray(v) ? v.map((x: any) => (typeof x === "object" ? x.id : x)) : [];
    if (f.type === "list" && Array.isArray(v)) v = v.map((item: Doc) => cleanPayload(f.itemFields, item));
    if (v === "") v = undefined;
    setPath(out, f.name, v);
  }
  return out;
}

const formValues = (def: ResourceDef<Doc>, doc: Doc) => ({ ...defaultsFor(def), ...(def.toForm ? def.toForm(doc) : doc) });

/**
 * Loads the document first, then mounts the form initialised from it. (Rendering inputs before the
 * data arrived and resetting afterwards could silently discard a fast first edit.)
 */
export function ResourceEditor({ def, id }: { def: ResourceDef<Doc>; id?: string }) {
  const isNew = !id;
  const docQ = useQuery({ queryKey: ["doc", def.key, id], queryFn: async () => (await adminFetch<Doc>(`${def.endpoint}/${id}`)).data, enabled: !isNew });
  if (!isNew && docQ.isLoading) return <div className="flex flex-col gap-3"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-96" /></div>;
  if (!isNew && docQ.isError) return <ErrorState title="Couldn't load this item" description={(docQ.error as Error).message} />;
  return <EditorForm def={def} id={id} initialDoc={docQ.data} />;
}

function EditorForm({ def, id, initialDoc }: { def: ResourceDef<Doc>; id?: string; initialDoc?: Doc }) {
  const isNew = !id;
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAdmin();
  const fields = useMemo(() => def.sections.flatMap((s) => s.fields), [def]);
  const [conflict, setConflict] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const docQ = useQuery({ queryKey: ["doc", def.key, id], queryFn: async () => (await adminFetch<Doc>(`${def.endpoint}/${id}`)).data, enabled: !isNew });
  const resolver = useMemo(() => zodResolver(buildSchema(def) as never) as unknown as Resolver<Doc>, [def]);
  const form = useForm<Doc>({ resolver, defaultValues: initialDoc ? formValues(def, initialDoc) : defaultsFor(def), mode: "onTouched" });
  const { reset, formState } = form;
  // "Unsaved" = fields the user actually changed. (formState.isDirty can stay true after a reset when
  // field arrays are involved, which would wrongly block publishing.)
  const changedFields = Object.keys(formState.dirtyFields);
  const hasChanges = changedFields.length > 0;

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (hasChanges) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [hasChanges]);

  const save = useMutation({
    mutationFn: async (values: Doc) => {
      let payload = cleanPayload(fields, values);
      if (def.fromForm) payload = def.fromForm(payload);
      if (isNew) return (await adminFetch<Doc>(def.endpoint, { method: "POST", body: payload })).data;
      return (await adminFetch<Doc>(`${def.endpoint}/${id}`, { method: "PATCH", body: payload, ifMatch: docQ.data?.version })).data;
    },
    onSuccess: (doc) => {
      toast({ tone: "success", title: `${def.singular} saved` });
      qc.invalidateQueries({ queryKey: ["list", def.key] });
      setFormError(null);
      if (isNew) router.replace(`/admin/${def.key}/${doc.id}`);
      else {
        qc.setQueryData(["doc", def.key, id], doc);
        reset(formValues(def, doc));
      }
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409 && e.message.includes("Reload")) setConflict(true);
      const mapped = applyFieldErrors(e, form.setError as never);
      setFormError(e instanceof ApiError ? [e.message, ...e.details.map((d) => `${d.path}: ${d.message}`)].join(" — ") : "Save failed.");
      if (!mapped) toast({ tone: "error", title: "Couldn't save", description: e instanceof ApiError ? e.message : undefined });
    },
  });

  const doc = docQ.data ?? initialDoc;
  const title = isNew ? `New ${def.singular.toLowerCase()}` : (def.titleOf?.(doc!) ?? def.singular);
  const canSave = isNew ? can(`${def.perm}:create`) : can(`${def.perm}:update`);

  return (
    <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
      <PageHeader
        title={title}
        breadcrumb={<Link href={`/admin/${def.key}`} className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" aria-hidden="true" /> {def.title}</Link>}
        actions={
          <>
            {doc && def.workflow && <WorkflowBadge status={(doc.workflow?.status ?? "draft") as WorkflowStatus} />}
            {canSave && (
              <Button type="submit" loading={save.isPending} disabled={!hasChanges && !isNew}>
                <Save aria-hidden="true" /> {isNew ? "Create" : "Save changes"}
              </Button>
            )}
          </>
        }
      />
      {conflict && (
        <div role="alert" className="mb-4 rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm">
          Someone else saved this item after you opened it.{" "}
          <button type="button" className="underline" onClick={async () => { setConflict(false); const r = await docQ.refetch(); if (r.data) reset(formValues(def, r.data)); }}>Reload their version</button> (your unsaved edits will be lost).
        </div>
      )}
      {formError && !conflict && <p role="alert" className="mb-4 rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm text-danger">{formError}</p>}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {def.sections.length > 1 ? (
            <Tabs defaultValue={def.sections[0]!.title}>
              <TabsList aria-label="Sections">
                {def.sections.map((s) => <TabsTrigger key={s.title} value={s.title}>{s.title}</TabsTrigger>)}
              </TabsList>
              {def.sections.map((s) => (
                <TabsContent key={s.title} value={s.title} forceMount className="data-[state=inactive]:hidden">
                  <Card className="grid gap-5 p-5 sm:grid-cols-2">
                    {s.fields.map((f) => <FieldRenderer key={f.name} f={f} control={form.control} register={form.register} errors={formState.errors} />)}
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <Card className="grid gap-5 p-5 sm:grid-cols-2">
              {def.sections[0]?.fields.map((f) => <FieldRenderer key={f.name} f={f} control={form.control} register={form.register} errors={formState.errors} />)}
            </Card>
          )}
        </div>
        {doc && (
          <aside className="flex flex-col gap-4">
            {def.sidePanel?.(doc, (d) => { qc.setQueryData(["doc", def.key, id], d); reset(formValues(def, d)); })}
            {def.workflow && <WorkflowPanel def={def} doc={doc} dirty={hasChanges} dirtyFields={changedFields} onChanged={(d) => { qc.setQueryData(["doc", def.key, id], d); reset(formValues(def, d)); }} />}
            <Card className="p-4 text-sm">
              <dl className="grid gap-2">
                <div className="flex justify-between gap-2"><dt className="text-muted">Created</dt><dd>{formatAdminDate(doc.createdAt)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-muted">Updated</dt><dd>{formatAdminDate(doc.updatedAt)}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-muted">Version</dt><dd className="font-mono">{doc.version}</dd></div>
              </dl>
            </Card>
            {def.revisions && <Revisions def={def} id={doc.id} onRestored={(d) => { qc.setQueryData(["doc", def.key, id], d); reset(formValues(def, d)); }} />}
          </aside>
        )}
      </div>
    </form>
  );
}

function WorkflowPanel({ def, doc, dirty, dirtyFields, onChanged }: { def: ResourceDef<Doc>; doc: Doc; dirty: boolean; dirtyFields: string[]; onChanged: (d: Doc) => void }) {
  const { can } = useAdmin();
  const toast = useToast();
  const status: WorkflowStatus = doc.workflow?.status ?? "draft";
  const [publishAt, setPublishAt] = useState("");
  const checks = useQuery({ queryKey: ["checks", def.key, doc.id, doc.version], queryFn: async () => (await adminFetch<{ blocking: string[]; warnings: string[] }>(`${def.endpoint}/${doc.id}/checks`)).data });
  const canPublish = can(`${def.perm}:publish`);

  const act = async (action: string, extra: Doc = {}) => {
    try {
      const d = (await adminFetch<Doc>(`${def.endpoint}/${doc.id}/workflow`, { method: "POST", body: { action, ...extra } })).data;
      toast({ tone: "success", title: `Done: ${action}` });
      onChanged(d);
      checks.refetch();
    } catch (e) {
      toast({ tone: "error", title: `Couldn't ${action}`, description: e instanceof ApiError ? [e.message, ...e.details.map((x) => x.message)].join(" ") : undefined });
    }
  };
  const preview = async () => {
    const { token } = (await adminFetch<{ token: string }>(`${def.endpoint}/${doc.id}/preview-token`)).data;
    window.open(`/api/preview?token=${encodeURIComponent(token)}&path=${encodeURIComponent(def.publicUrl?.(doc) ?? "/")}`, "_blank", "noopener");
  };

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Publishing</h2>
        <WorkflowBadge status={status} />
      </div>
      {doc.workflow?.publishAt && status === "scheduled" && <p className="text-sm text-muted">Scheduled for {formatAdminDate(doc.workflow.publishAt)}</p>}
      {doc.workflow?.publishedAt && <p className="text-sm text-muted">First published {formatAdminDate(doc.workflow.publishedAt)}</p>}
      {dirty && <p className="text-xs text-warning" data-testid="unsaved">Save your changes before changing the status{dirtyFields.length > 0 && <> (changed: {dirtyFields.join(", ")})</>}.</p>}

      {checks.data && (checks.data.blocking.length > 0 || checks.data.warnings.length > 0) && (
        <ul className="flex flex-col gap-1.5 text-sm" aria-label="Publish checks">
          {checks.data.blocking.map((m) => <li key={m} className="text-danger">✗ {m}</li>)}
          {checks.data.warnings.map((m) => <li key={m} className="text-warning">⚠ {m}</li>)}
        </ul>
      )}
      {checks.data && checks.data.blocking.length === 0 && <p className="text-sm text-success">✓ Ready to publish</p>}

      <div className="flex flex-wrap gap-2">
        {status === "draft" && <Button type="button" size="sm" variant="secondary" disabled={dirty} onClick={() => act("submit")}>Submit for review</Button>}
        {canPublish && status === "review" && <Button type="button" size="sm" variant="secondary" disabled={dirty} onClick={() => act("approve")}>Approve</Button>}
        {canPublish && (status === "review" || status === "approved") && <Button type="button" size="sm" variant="ghost" disabled={dirty} onClick={() => act("reject")}>Send back</Button>}
        {canPublish && ["draft", "review", "approved", "scheduled"].includes(status) && (
          <ConfirmButton variant="primary" title="Publish now?" description="It will be visible to everyone on the website." confirmLabel="Publish" onConfirm={() => act("publish")} disabled={dirty || Boolean(checks.data?.blocking.length)}>Publish now</ConfirmButton>
        )}
        {canPublish && ["published", "scheduled"].includes(status) && <ConfirmButton variant="secondary" title="Unpublish?" description="It will be removed from the website and returned to draft." confirmLabel="Unpublish" onConfirm={() => act("unpublish")}>Unpublish</ConfirmButton>}
        {canPublish && ["published", "draft", "approved"].includes(status) && <ConfirmButton title="Archive?" confirmLabel="Archive" onConfirm={() => act("archive")}>Archive</ConfirmButton>}
        {canPublish && status === "archived" && <Button type="button" size="sm" variant="secondary" onClick={() => act("restore")}>Restore to draft</Button>}
      </div>

      {canPublish && ["draft", "review", "approved"].includes(status) && (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <Label htmlFor="publish-at">Schedule (your local time)</Label>
          <Input id="publish-at" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
          <Button type="button" size="sm" variant="secondary" disabled={!publishAt || dirty || Boolean(checks.data?.blocking.length)} onClick={() => act("schedule", { publishAt: localInputToIso(publishAt) })}>Schedule</Button>
        </div>
      )}
      {def.publicUrl && (
        <Button type="button" size="sm" variant="ghost" onClick={preview} className="w-fit"><Eye aria-hidden="true" /> Preview</Button>
      )}
    </Card>
  );
}

function Revisions({ def, id, onRestored }: { def: ResourceDef<Doc>; id: string; onRestored: (d: Doc) => void }) {
  const { can } = useAdmin();
  const toast = useToast();
  const q = useQuery({ queryKey: ["revisions", def.key, id], queryFn: async () => (await adminFetch<Doc[]>(`${def.endpoint}/${id}/revisions`)).data });
  return (
    <Card className="p-4">
      <h2 className="mb-3 flex items-center gap-2 font-semibold"><History className="size-4" aria-hidden="true" /> Revisions</h2>
      <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto text-sm">
        {q.data?.map((r, i) => (
          <li key={r.id} className="flex items-center justify-between gap-2">
            <span className="min-w-0">
              <span className="font-mono text-xs text-subtle">#{r.rev}</span> {r.editedByName ?? "—"}
              <span className="block text-xs text-muted">{formatAdminDate(r.at)}{r.note ? ` · ${r.note}` : ""}</span>
            </span>
            {i > 0 && can(`${def.perm}:update`) && (
              <ConfirmButton variant="ghost" title={`Restore revision #${r.rev}?`} description="Current content will be replaced (a new revision is recorded, nothing is lost)." confirmLabel="Restore" onConfirm={async () => {
                const d = (await adminFetch<Doc>(`${def.endpoint}/${id}/revisions/${r.rev}/restore`, { method: "POST" })).data;
                toast({ tone: "success", title: `Restored revision #${r.rev}` });
                onRestored(d);
                q.refetch();
              }}>Restore</ConfirmButton>
            )}
          </li>
        ))}
        {q.data?.length === 0 && <li className="text-muted">No revisions yet.</li>}
      </ul>
    </Card>
  );
}
