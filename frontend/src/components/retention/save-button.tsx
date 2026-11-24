"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isSaved, toggleSaved, useSaved, type SavedItem } from "@/lib/saved";

type Item = SavedItem extends infer T ? (T extends SavedItem ? Omit<T, "savedAt"> : never) : never;

/** Save / follow toggle. Works without an account — stored on this device only. */
export function SaveButton({ item, label = "Save", savedLabel = "Saved", size = "md" }: { item: Item; label?: string; savedLabel?: string; size?: "sm" | "md" }) {
  const items = useSaved();
  const saved = isSaved(items, item.kind, item.slug);
  return (
    <Button type="button" variant="secondary" size={size} aria-pressed={saved} onClick={() => toggleSaved({ ...item, savedAt: Date.now() } as SavedItem)}>
      {saved ? <BookmarkCheck className="text-accent" aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
      {saved ? savedLabel : label}
    </Button>
  );
}
