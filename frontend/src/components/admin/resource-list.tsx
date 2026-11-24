"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { WorkflowStatus } from "@sgh/shared";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ApiError, adminFetch } from "@/lib/admin/api";
import { useAdmin } from "@/lib/admin/context";
import type { ResourceDef } from "@/lib/admin/resource";
import { useToast } from "@/lib/admin/toast";
import { ConfirmButton, PageHeader, Pager, WorkflowBadge, formatAdminDate } from "./ui";

/* eslint-disable @typescript-eslint/no-explicit-any -- generic rows */
type Row = Record<string, any>;

const WORKFLOW_FILTER = ["draft", "review", "approved", "scheduled", "published", "archived"].map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1) }));

export function ResourceList({ def }: { def: ResourceDef<Row> }) {
  const { can } = useAdmin();
  const toast = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [trash, setTrash] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const query = useQuery({
    queryKey: ["list", def.key, page, q, trash, filters],
    queryFn: () => adminFetch<Row[]>(def.endpoint, { query: { page, limit: 20, q, trash: trash ? "true" : undefined, ...filters } }),
    // Keep the previous page visible while paging/filtering — but never across the list ⇄ trash switch,
    // where stale rows would show the wrong actions (e.g. "Restore" on live items).
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[4] === trash ? prev : undefined),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["list", def.key] });
  const del = async (row: Row) => {
    try {
      await adminFetch(`${def.endpoint}/${row.id}`, { method: "DELETE" });
      toast({ tone: "success", title: `${def.singular} moved to trash` });
      refresh();
    } catch (e) {
      toast({ tone: "error", title: "Couldn't delete", description: e instanceof ApiError ? e.message : undefined });
    }
  };
  const restore = async (row: Row) => {
    await adminFetch(`${def.endpoint}/${row.id}/restore`, { method: "POST" });
    toast({ tone: "success", title: `${def.singular} restored` });
    refresh();
  };

  const allFilters = [...(def.workflow ? [{ name: "status", label: "Status", options: WORKFLOW_FILTER }] : []), ...(def.filters ?? [])];
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const columns = [
    ...def.columns,
    ...(def.workflow ? [{ key: "workflow", label: "Status", render: (r: Row) => <WorkflowBadge status={(r.workflow?.status ?? "draft") as WorkflowStatus} /> }] : []),
    { key: "updatedAt", label: "Updated", render: (r: Row) => <span className="whitespace-nowrap text-muted">{formatAdminDate(r.updatedAt)}</span> },
  ];

  return (
    <div>
      <PageHeader
        title={trash ? `${def.title} — trash` : def.title}
        description={def.description}
        actions={
          <>
            {def.softDelete !== false && <Button variant="ghost" size="sm" onClick={() => { setTrash(!trash); setPage(1); }}>{trash ? "Back to list" : "Trash"}</Button>}
            {def.canCreate !== false && can(`${def.perm}:create`) && !trash && (
              <Button asChild size="sm">
                <Link href={`/admin/${def.key}/new`}><Plus aria-hidden="true" /> New {def.singular.toLowerCase()}</Link>
              </Button>
            )}
          </>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Input aria-label={`Search ${def.title.toLowerCase()}`} placeholder="Search…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="sm:max-w-xs" />
        {allFilters.map((f) => (
          <div key={f.name} className="sm:w-48">
            <Select aria-label={f.label} value={filters[f.name] ?? ""} onChange={(e) => { setFilters({ ...filters, [f.name]: e.target.value }); setPage(1); }}>
              <option value="">All {f.label.toLowerCase()}</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
        ))}
      </div>

      {query.isError ? (
        <ErrorState title="Couldn't load" description={(query.error as Error).message} requestId={query.error instanceof ApiError ? query.error.requestId : undefined} action={<Button variant="secondary" size="sm" onClick={() => query.refetch()}>Retry</Button>} />
      ) : query.isLoading ? (
        <div className="flex flex-col gap-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState title={trash ? "Trash is empty" : `No ${def.title.toLowerCase()} yet`} description={q ? "Try a different search." : undefined} />
      ) : (
        <>
          {/* table ≥ md */}
          <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-1 text-xs tracking-wider text-subtle uppercase">
                <tr>
                  {columns.map((c) => <th key={c.key} scope="col" className="px-4 py-3 font-medium">{c.label}</th>)}
                  <th scope="col" className="px-4 py-3 text-right font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-1">
                    {columns.map((c, i) => (
                      <td key={c.key} className="px-4 py-3 align-middle">
                        {i === 0 && !trash ? <Link href={`/admin/${def.key}/${r.id}`} className="font-medium hover:text-primary-hover">{c.render ? c.render(r) : String(r[c.key] ?? "—")}</Link> : c.render ? c.render(r) : String(r[c.key] ?? "—")}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <RowActions def={def} row={r} trash={trash} onDelete={del} onRestore={restore} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* cards < md */}
          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="rounded-lg border border-border bg-surface-1 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{def.columns[0]?.render ? def.columns[0].render(r) : String(r[def.columns[0]!.key] ?? "")}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      {def.workflow && <WorkflowBadge status={r.workflow?.status ?? "draft"} />}
                      {formatAdminDate(r.updatedAt)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2"><RowActions def={def} row={r} trash={trash} onDelete={del} onRestore={restore} /></div>
              </li>
            ))}
          </ul>
          {meta && <Pager page={meta.page} totalPages={meta.totalPages} onPage={setPage} />}
        </>
      )}
    </div>
  );
}

function RowActions({ def, row, trash, onDelete, onRestore }: { def: ResourceDef<Row>; row: Row; trash: boolean; onDelete: (r: Row) => Promise<void>; onRestore: (r: Row) => Promise<void> }) {
  const { can } = useAdmin();
  const name = def.titleOf?.(row) ?? String(row[def.columns[0]!.key] ?? def.singular);
  if (trash) {
    return can(`${def.perm}:delete`) ? (
      <Button size="sm" variant="secondary" onClick={() => onRestore(row)}><RotateCcw aria-hidden="true" /> Restore</Button>
    ) : null;
  }
  return (
    <>
      <Button asChild size="sm" variant="ghost"><Link href={`/admin/${def.key}/${row.id}`} aria-label={`Edit ${name}`}><Pencil aria-hidden="true" /><span className="md:sr-only">Edit</span></Link></Button>
      {can(`${def.perm}:delete`) && (
        <ConfirmButton title={def.softDelete === false ? `Delete "${name}"?` : `Move "${name}" to trash?`} description={def.softDelete === false ? "This can't be undone." : "You can restore it from the trash later."} confirmLabel={def.softDelete === false ? "Delete" : "Move to trash"} onConfirm={() => onDelete(row)}>
          <Trash2 aria-hidden="true" /><span className="md:sr-only">Delete</span>
        </ConfirmButton>
      )}
    </>
  );
}
