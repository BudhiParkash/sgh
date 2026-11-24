"use client";

import { useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { MediaThumb, MediaUploadForm, type MediaItem } from "@/components/admin/media-picker";
import { ConfirmButton, PageHeader, Pager, formatAdminDate } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { ApiError, adminFetch } from "@/lib/admin/api";
import { useAdmin } from "@/lib/admin/context";
import { useToast } from "@/lib/admin/toast";

export default function MediaLibraryPage() {
  const { can } = useAdmin();
  const toast = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [unused, setUnused] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const list = useQuery({ queryKey: ["media", "lib", page, q, unused], queryFn: () => adminFetch<MediaItem[]>("/media", { query: { page, q, unused, limit: 24 } }), placeholderData: keepPreviousData });

  const remove = async (m: MediaItem) => {
    try {
      await adminFetch(`/media/${m.id}`, { method: "DELETE" });
      toast({ tone: "success", title: "Image deleted" });
      qc.invalidateQueries({ queryKey: ["media"] });
    } catch (e) {
      toast({ tone: "error", title: "Couldn't delete", description: e instanceof ApiError ? e.message : undefined });
    }
  };

  return (
    <div>
      <PageHeader title="Media library" description="Images are re-encoded (AVIF/WebP), resized and stripped of location/camera data on upload." actions={can("media:create") && <Button size="sm" onClick={() => setShowUpload(!showUpload)}>{showUpload ? "Close" : "Upload image"}</Button>} />
      {showUpload && <div className="mb-6"><MediaUploadForm onUploaded={() => setShowUpload(false)} /></div>}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Input aria-label="Search media" placeholder="Search alt text or filename" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="sm:max-w-xs" />
        <div className="sm:w-48">
          <Select aria-label="Usage" value={unused} onChange={(e) => { setUnused(e.target.value); setPage(1); }}>
            <option value="">All images</option>
            <option value="true">Unused only</option>
          </Select>
        </div>
      </div>
      {list.isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="aspect-square" />)}</div>
      ) : !list.data?.data.length ? (
        <EmptyState title="No images" description={unused ? "Every image is in use." : "Upload your first image."} />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {list.data.data.map((m) => (
              <li key={m.id}>
                <Card className="overflow-hidden">
                  <div className="relative aspect-square bg-surface-2"><MediaThumb item={m} /></div>
                  <div className="flex flex-col gap-1 p-3 text-xs">
                    <p className="line-clamp-2 text-sm text-text">{m.alt}</p>
                    <p className="text-muted">{m.width}×{m.height} · {(m.sizeBytes / 1024).toFixed(0)} KB · {m.licence.replace("_", " ")}</p>
                    <p className="text-subtle">{m.usageCount ? `Used in ${m.usageCount}` : "Unused"} · {formatAdminDate(m.createdAt)}</p>
                    {can("media:delete") && (
                      <ConfirmButton title="Delete this image?" description={m.usageCount ? "It is in use and can't be deleted until removed from those items." : "This permanently removes all sizes of the image."} confirmLabel="Delete" disabled={m.usageCount > 0} onConfirm={() => remove(m)}>Delete</ConfirmButton>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          {list.data.meta && <Pager page={list.data.meta.page} totalPages={list.data.meta.totalPages} onPage={setPage} />}
        </>
      )}
    </div>
  );
}
