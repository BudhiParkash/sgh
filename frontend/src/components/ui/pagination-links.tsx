import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Crawlable pagination (real links, ?page=N). */
export function PaginationLinks({ page, totalPages, hrefFor }: { page: number; totalPages: number; hrefFor: (p: number) => string }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1);
  const item = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border px-3 text-sm";
  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && <Link href={hrefFor(page - 1)} rel="prev" className={cn(item, "hover:border-border-strong")}><ChevronLeft className="size-4" aria-hidden="true" /><span className="sr-only">Previous page</span></Link>}
      {pages.map((p, i) => (
        <span key={p} className="contents">
          {i > 0 && p - pages[i - 1]! > 1 && <span className="px-1 text-subtle" aria-hidden="true">…</span>}
          <Link href={hrefFor(p)} aria-current={p === page ? "page" : undefined} className={cn(item, p === page ? "border-primary bg-primary/10 text-text" : "text-muted hover:border-border-strong hover:text-text")}>{p}</Link>
        </span>
      ))}
      {page < totalPages && <Link href={hrefFor(page + 1)} rel="next" className={cn(item, "hover:border-border-strong")}><ChevronRight className="size-4" aria-hidden="true" /><span className="sr-only">Next page</span></Link>}
    </nav>
  );
}
