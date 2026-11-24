"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { adminFetch } from "@/lib/admin/api";

interface Overview {
  counts: { error: number; warning: number; info: number };
  issues: { severity: "error" | "warning" | "info"; type: string; entity: string; id: string; title: string; adminPath: string; message: string }[];
  sitemaps: { type: string; count: number }[];
}
const tone = { error: "danger", warning: "warning", info: "info" } as const;

export default function SeoPage() {
  const q = useQuery({ queryKey: ["seo-overview"], queryFn: async () => (await adminFetch<Overview>("/seo/overview")).data });
  return (
    <div>
      <PageHeader title="SEO audit" description="Live checks on published content. Fix errors first." actions={<Button asChild size="sm" variant="secondary"><a href="/sitemap.xml" target="_blank" rel="noopener noreferrer">View sitemap</a></Button>} />
      {q.isLoading || !q.data ? <Skeleton className="h-64" /> : (
        <div className="flex flex-col gap-6">
          <ul className="grid gap-4 sm:grid-cols-3">
            {(["error", "warning", "info"] as const).map((k) => (
              <li key={k}><Card className="p-5"><p className="text-sm text-muted capitalize">{k}s</p><p className="font-display text-3xl font-bold">{q.data.counts[k]}</p></Card></li>
            ))}
          </ul>
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Sitemaps (indexable URLs)</h2>
            <ul className="flex flex-wrap gap-3 text-sm">{q.data.sitemaps.map((s) => <li key={s.type}><a className="text-secondary underline" href={`/sitemaps/${s.type}.xml`} target="_blank" rel="noopener noreferrer">{s.type}</a> <span className="text-muted">({s.count})</span></li>)}</ul>
          </Card>
          {q.data.issues.length === 0 ? <EmptyState title="No issues found" /> : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {q.data.issues.map((i, n) => (
                <li key={`${i.type}-${i.id}-${n}`} className="flex flex-col gap-1 p-3 text-sm md:flex-row md:items-center md:gap-4">
                  <Badge tone={tone[i.severity]} className="w-fit">{i.type.replace(/-/g, " ")}</Badge>
                  <Link href={i.adminPath} className="font-medium hover:underline">{i.title}</Link>
                  <span className="text-muted md:ml-auto">{i.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
