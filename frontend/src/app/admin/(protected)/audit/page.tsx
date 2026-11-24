"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PageHeader, Pager, formatAdminDate } from "@/components/admin/ui";
import { Input } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { adminFetch } from "@/lib/admin/api";

interface Entry { id: string; at: string; actorName?: string; actorRole?: string; action: string; entityType?: string; entityId?: string; summary?: string; changes?: Record<string, [unknown, unknown]> }

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const q = useQuery({ queryKey: ["audit", page, action], queryFn: () => adminFetch<Entry[]>("/audit-logs", { query: { page, action, limit: 50 } }), placeholderData: keepPreviousData });
  return (
    <div>
      <PageHeader title="Audit log" description="Every admin change is recorded here and cannot be edited." />
      <Input aria-label="Filter by exact action" placeholder="Filter by action, e.g. tournament.publish" value={action} onChange={(e) => { setAction(e.target.value.trim()); setPage(1); }} className="mb-4 sm:max-w-sm" />
      {q.isLoading ? <Skeleton className="h-96" /> : !q.data?.data.length ? <EmptyState title="No entries" /> : (
        <>
          <ol className="divide-y divide-border rounded-lg border border-border">
            {q.data.data.map((e) => (
              <li key={e.id} className="p-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span><span className="font-medium">{e.actorName ?? "Anonymous"}</span> <code className="text-xs text-primary-hover">{e.action}</code>{e.entityType && <span className="text-xs text-subtle"> · {e.entityType} {e.entityId}</span>}</span>
                  <time className="text-xs text-subtle" dateTime={e.at}>{formatAdminDate(e.at)}</time>
                </div>
                {e.summary && <p className="mt-1 text-muted">{e.summary}</p>}
                {e.changes && Object.keys(e.changes).length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-muted">{Object.keys(e.changes).length} field(s) changed</summary>
                    <pre className="mt-1 max-h-60 overflow-auto rounded bg-surface-2 p-2 text-xs whitespace-pre-wrap">{JSON.stringify(e.changes, null, 2)}</pre>
                  </details>
                )}
              </li>
            ))}
          </ol>
          {q.data.meta && <Pager page={q.data.meta.page} totalPages={q.data.meta.totalPages} onPage={setPage} />}
        </>
      )}
    </div>
  );
}
