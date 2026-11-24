import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ArticleSummary } from "@sgh/shared";
import { ArticleCard } from "@/components/articles/article-card";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/container";

export function LatestNews({ articles }: { articles: ArticleSummary[] }) {
  const [lead, ...rest] = articles;
  if (!lead) return null;
  return (
    <Section
      id="news"
      eyebrow="News"
      title="Latest gaming news"
      action={<Button asChild variant="secondary"><Link href="/news">All news <ArrowRight aria-hidden="true" /></Link></Button>}
    >
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div data-reveal><ArticleCard a={lead} variant="lead" /></div>
        <ul className="flex flex-col gap-1">
          {rest.slice(0, 4).map((a, i) => (
            <li key={a.id} data-reveal style={{ "--reveal-i": i + 1 } as React.CSSProperties}>
              <ArticleCard a={a} variant="compact" />
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

export function GamingGuides({ articles }: { articles: ArticleSummary[] }) {
  if (articles.length === 0) return null;
  return (
    <Section
      id="guides"
      eyebrow="Guides"
      title="Gaming guides, tips & tutorials"
      action={<Button asChild variant="secondary"><Link href="/guides">All guides <ArrowRight aria-hidden="true" /></Link></Button>}
    >
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {articles.slice(0, 4).map((a, i) => (
          <li key={a.id} data-reveal style={{ "--reveal-i": i } as React.CSSProperties}>
            <ArticleCard a={a} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
