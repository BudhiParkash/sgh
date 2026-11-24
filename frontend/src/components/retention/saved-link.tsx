"use client";

import Link from "next/link";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSaved } from "@/lib/saved";

/** Header shortcut to "My saved" with a count badge. */
export function SavedLink() {
  const n = useSaved().length;
  return (
    <Button asChild variant="ghost" size="icon" className="relative">
      <Link href="/saved" aria-label={n ? `My saved (${n})` : "My saved"}>
        <Bookmark className="size-5" aria-hidden="true" />
        {n > 0 && <span className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-primary-solid px-1 text-[0.6rem] font-bold text-white" aria-hidden="true">{n > 99 ? "99+" : n}</span>}
      </Link>
    </Button>
  );
}
