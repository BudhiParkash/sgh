import Link from "next/link";
import Image from "next/image";
import type { ArticleSummary } from "@sgh/shared";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function articleHref(a: Pick<ArticleSummary, "slug" | "category">): string {
  return `/${a.category.kind === "news" ? "news" : "guides"}/${a.category.slug}/${a.slug}`;
}

export function ArticleCard({ a, variant = "default", className }: { a: ArticleSummary; variant?: "default" | "lead" | "compact"; className?: string }) {
  const date = formatDate(a.publishedAt);
  if (variant === "compact") {
    return (
      <article className={cn("relative flex gap-4 rounded-lg p-3 hover:bg-surface-1", className)}>
        <div className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-md bg-surface-2">
          {a.featuredImage && <Image src={a.featuredImage.url} alt={a.featuredImage.alt} fill sizes="80px" className="object-cover" />}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-subtle">{a.category.name}{date && <> · <time dateTime={a.publishedAt}>{date}</time></>}</p>
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold">
            <Link href={articleHref(a)} className="after:absolute after:inset-0 focus-visible:outline-none">{a.title}</Link>
          </h3>
        </div>
      </article>
    );
  }
  return (
    <Card interactive className={cn("flex h-full flex-col overflow-hidden", className)}>
      <div className={cn("relative bg-surface-2", variant === "lead" ? "aspect-[16/9]" : "aspect-[3/2]")}>
        {a.featuredImage && (
          <Image src={a.featuredImage.url} alt={a.featuredImage.alt} fill sizes={variant === "lead" ? "(min-width:1024px) 60vw, 100vw" : "(min-width:1024px) 25vw, 90vw"} className="object-cover" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="primary">{a.category.name}</Badge>
          {a.isSponsored && <Badge tone="warning">Sponsored</Badge>}
        </div>
        <h3 className={cn("font-semibold", variant === "lead" ? "text-2xl" : "text-lg")}>
          <Link href={articleHref(a)} className="after:absolute after:inset-0 focus-visible:outline-none">{a.title}</Link>
        </h3>
        <p className="line-clamp-2 text-sm text-muted">{a.excerpt}</p>
        <p className="mt-auto pt-2 text-xs text-subtle">
          {a.author.name}{date && <> · <time dateTime={a.publishedAt}>{date}</time></>} · {a.readingMinutes} min read
        </p>
      </div>
    </Card>
  );
}
