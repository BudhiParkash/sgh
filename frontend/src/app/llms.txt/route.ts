import type { ArticleSummary, CategoryDto } from "@sgh/shared";
import { apiGetOr } from "@/lib/api/server";
import { siteConfig } from "@/lib/site";

export const revalidate = 3600;

/** llms.txt — a plain summary for AI assistants (no guarantee of use; https://llmstxt.org). */
export async function GET() {
  const [guides, news, cats] = await Promise.all([
    apiGetOr<ArticleSummary[]>("/articles", [], { tags: ["articles"], searchParams: { kind: "guide", limit: 15 } }),
    apiGetOr<ArticleSummary[]>("/articles", [], { tags: ["articles"], searchParams: { kind: "news", limit: 10 } }),
    apiGetOr<CategoryDto[]>("/categories", [], { tags: ["categories"] }),
  ]);
  const u = (p: string) => `${siteConfig.url}${p}`;
  const link = (a: ArticleSummary) => `- [${a.title}](${u(`/${a.category.kind === "news" ? "news" : "guides"}/${a.category.slug}/${a.slug}`)}): ${a.excerpt}`;
  const text = `# ${siteConfig.name}

> Independent information site for BGMI and PUBG Mobile players in India: verified tournament listings, tested sensitivity settings and practical guides. Free to use; no betting, no entry fees.

${siteConfig.disclaimer}

## How information is verified
- Tournaments link the organiser's or publisher's official announcement; unconfirmed events are labelled "Rumour"; each listing shows when it was last checked.
- Sensitivity setups are labelled "Tested" (named tester, device, FPS, game version, date), "Community" or "Baseline" (device class, not device-tested).
- Methodology: ${u("/about")}

## Main sections
- [Sensitivity finder](${u("/sensitivity")}): settings by phone, FPS, gyroscope mode and playstyle
- [Gun guides](${u("/sensitivity/guns")}): how guns behave; sensitivity is per scope, not per gun
- [Tournaments](${u("/tournaments/upcoming")}): upcoming verified BGMI / PUBG Mobile tournaments
- [Guides](${u("/guides")}) · [News](${u("/news")})
${cats.filter((c) => c.articleCount > 0).map((c) => `- [${c.name}](${u(`/${c.kind === "news" ? "news" : "guides"}/${c.slug}`)})`).join("\n")}

${guides.length ? `## Guides\n${guides.map(link).join("\n")}\n` : ""}
${news.length ? `## Recent news\n${news.map(link).join("\n")}\n` : ""}
## Contact
${siteConfig.contact.email}
`;
  return new Response(text.replace(/\n{3,}/g, "\n\n"), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
