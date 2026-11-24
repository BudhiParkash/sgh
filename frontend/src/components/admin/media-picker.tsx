"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, adminFetch } from "@/lib/admin/api";
import { useToast } from "@/lib/admin/toast";

export interface MediaItem {
  id: string;
  alt: string;
  width: number;
  height: number;
  licence: string;
  category: string;
  usageCount: number;
  sizeBytes: number;
  originalFilename?: string;
  createdAt: string;
  ref: { url: string; srcSet: string } | null;
}

export function MediaThumb({ item, className }: { item: Pick<MediaItem, "ref" | "alt">; className?: string }) {
  if (!item.ref) return null;
  return <Image src={item.ref.url} alt={item.alt} fill unoptimized sizes="200px" className={className ?? "object-cover"} />;
}

/** Upload form used by the picker and the media library page. */
export function MediaUploadForm({ category = "general", onUploaded }: { category?: string; onUploaded: (m: MediaItem) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [alt, setAlt] = useState("");
  const [licence, setLicence] = useState("original");
  const [credit, setCredit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new ApiError(400, "VALIDATION_ERROR", "Choose an image.");
      const form = new FormData();
      form.set("file", file);
      form.set("alt", alt);
      form.set("licence", licence);
      form.set("category", category);
      if (credit) form.set("credit", credit);
      return (await adminFetch<MediaItem>("/media", { method: "POST", form })).data;
    },
    onSuccess: (item) => {
      toast({ tone: "success", title: "Image uploaded" });
      qc.invalidateQueries({ queryKey: ["media"] });
      setAlt("");
      if (fileRef.current) fileRef.current.value = "";
      onUploaded(item);
    },
    onError: (e) => setError(e instanceof ApiError ? (e.details[0]?.message ?? e.message) : "Upload failed."),
  });
  return (
    <form
      className="grid gap-4 rounded-lg border border-dashed border-border-strong p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        m.mutate();
      }}
    >
      <Field id="upload-file" label="Image (JPEG, PNG, WebP or AVIF, max 8 MB)" required>
        {(aria) => <input {...aria} ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="block w-full text-sm text-muted file:mr-3 file:h-10 file:rounded-md file:border-0 file:bg-surface-3 file:px-4 file:text-text" />}
      </Field>
      <Field id="upload-alt" label="Alt text (describe the image)" required hint="Used by screen readers and search engines.">
        {(aria) => <Input {...aria} value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={250} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="upload-licence" label="Licence / source" required hint="Only original or properly licensed images.">
          {(aria) => (
            <Select {...aria} value={licence} onChange={(e) => setLicence(e.target.value)}>
              <option value="original">Original (we created it)</option>
              <option value="licensed">Licensed</option>
              <option value="press_kit">Official press kit</option>
              <option value="user_submitted">User submitted (with permission)</option>
            </Select>
          )}
        </Field>
        <Field id="upload-credit" label="Credit (optional)">
          {(aria) => <Input {...aria} value={credit} onChange={(e) => setCredit(e.target.value)} maxLength={200} />}
        </Field>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" loading={m.isPending} className="w-fit">
        <Upload aria-hidden="true" /> Upload
      </Button>
    </form>
  );
}

/** Form field: pick an image from the library (or upload one). Value = media id. */
export function MediaPicker({ value, onChange, category, invalid }: { value: string | null | undefined; onChange: (id: string | null) => void; category?: string; invalid?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = useQuery({ queryKey: ["media", "one", value], queryFn: async () => (await adminFetch<MediaItem>(`/media/${value}`)).data, enabled: Boolean(value) });
  const list = useQuery({ queryKey: ["media", "picker", q], queryFn: async () => (await adminFetch<MediaItem[]>("/media", { query: { q, limit: 24 } })).data, enabled: open });

  return (
    <div className={`flex items-center gap-3 rounded-md border p-2 ${invalid ? "border-danger" : "border-border-strong"}`}>
      <div className="relative size-20 shrink-0 overflow-hidden rounded bg-surface-2">
        {selected.data ? <MediaThumb item={selected.data} /> : <ImagePlus className="absolute inset-0 m-auto size-6 text-subtle" aria-hidden="true" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="truncate text-sm text-muted">{selected.data ? selected.data.alt : "No image selected"}</p>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
            {value ? "Change" : "Choose image"}
          </Button>
          {value && (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)} aria-label="Remove image">
              <X aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Media library" className="max-w-3xl">
          <div className="flex flex-col gap-5">
            <MediaUploadForm category={category} onUploaded={(m) => { onChange(m.id); setOpen(false); }} />
            <Input placeholder="Search by alt text or filename" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search media" />
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {list.isLoading && Array.from({ length: 8 }, (_, i) => <li key={i}><Skeleton className="aspect-square" /></li>)}
              {list.data?.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => { onChange(m.id); setOpen(false); }}
                    className={`relative block aspect-square w-full overflow-hidden rounded-md border-2 ${m.id === value ? "border-primary" : "border-transparent hover:border-border-strong"}`}
                    aria-label={`Select: ${m.alt}`}
                  >
                    <MediaThumb item={m} />
                  </button>
                </li>
              ))}
              {list.data?.length === 0 && <li className="col-span-full text-sm text-muted">No images found.</li>}
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
