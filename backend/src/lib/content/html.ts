import { slugify } from "@sgh/shared";
import { htmlToText, sanitizeRichHtml } from "../sanitize.js";

export interface ProcessedHtml {
  html: string;
  headings: { id: string; text: string; level: 2 | 3 }[];
  wordCount: number;
  readingMinutes: number;
  internalLinks: string[];
  hasAffiliateLinks: boolean;
}

/**
 * Sanitises CMS HTML and derives: heading ids (table of contents), word count, reading time,
 * internal links (for the SEO audit) and whether affiliate (/go/) links are present (→ disclosure).
 */
export function processHtml(input: string): ProcessedHtml {
  const clean = sanitizeRichHtml(input);
  const headings: ProcessedHtml["headings"] = [];
  const used = new Map<string, number>();
  const html = clean.replace(/<h([23])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>/g, (_m, lvl: string, inner: string) => {
    const text = htmlToText(inner);
    const base = slugify(text) || "section";
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    const id = n > 1 ? `${base}-${n}` : base;
    headings.push({ id, text, level: Number(lvl) as 2 | 3 });
    return `<h${lvl} id="${id}">${inner}</h${lvl}>`;
  });
  const text = htmlToText(html);
  const wordCount = text ? text.split(/\s+/).length : 0;
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
  const internalLinks = [...new Set(hrefs.filter((h) => h.startsWith("/") || /^https:\/\/(www\.)?shivanshigaming\.com\//.test(h)).map((h) => h.replace(/^https:\/\/(www\.)?shivanshigaming\.com/, "")))];
  return { html, headings, wordCount, readingMinutes: Math.max(1, Math.round(wordCount / 200)), internalLinks, hasAffiliateLinks: internalLinks.some((h) => h.startsWith("/go/")) };
}
