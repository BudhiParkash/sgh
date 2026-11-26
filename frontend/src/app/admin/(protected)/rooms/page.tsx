"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Pager, formatAdminDate } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { adminFetch } from "@/lib/admin/api";
import { useAdmin } from "@/lib/admin/context";

interface Row { id: string; title: string; slug: string; mode: string; slotsTotal: number; status: string; published: boolean; registrationOpensAt: string; registrationClosesAt: string; live: boolean; confirmed: number; waitlist: number }

export default function RoomsPage() {
  const { can } = useAdmin();
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["rooms", page], queryFn: () => adminFetch<Row[]>("/rooms", { query: { page } }) });
  return (
    <div>
      <PageHeader
        title="Custom rooms"
        description="Shivanshi Custom Rooms: free BGMI matches. Create a room, set the matches, share the room ID before each match, enter results, then complete it to pay SGC prizes."
        actions={can("room:create") && <Button asChild size="sm"><Link href="/admin/rooms/new">New room</Link></Button>}
      />
      {q.isLoading ? (
        <Skeleton className="h-48" />
      ) : !q.data?.data.length ? (
        <Card className="p-6 text-sm text-muted">No rooms yet.</Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {q.data.data.map((r) => (
            <li key={r.id}>
              <Card className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <Link href={`/admin/rooms/${r.id}`} className="font-semibold hover:underline">{r.title}</Link>
                  <p className="text-sm text-muted">{r.mode} · {r.confirmed}/{r.slotsTotal} confirmed{r.waitlist ? ` · ${r.waitlist} waitlist` : ""} · registration closes {formatAdminDate(r.registrationClosesAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.live && <Badge tone="danger">LIVE</Badge>}
                  <Badge tone={r.published ? "success" : "neutral"}>{r.published ? "Published" : "Hidden"}</Badge>
                  <Badge tone={r.status === "completed" ? "info" : r.status === "cancelled" ? "warning" : "primary"}>{r.status}</Badge>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Pager page={page} totalPages={q.data?.meta?.totalPages ?? 1} onPage={setPage} />
    </div>
  );
}
