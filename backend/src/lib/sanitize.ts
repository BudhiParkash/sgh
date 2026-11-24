import sanitizeHtml from "sanitize-html";
import { z } from "zod";

/**
 * Server-side HTML allowlist for rich text (docs/architecture/10 §2): no scripts, styles, event
 * handlers or iframes except YouTube embeds; links forced to safe protocols with rel attributes.
 */
export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["h2", "h3", "h4", "p", "br", "hr", "strong", "em", "u", "s", "code", "pre", "blockquote", "ul", "ol", "li", "a", "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td", "iframe", "span", "mark"],
    allowedAttributes: {
      a: ["href", "rel", "target", "title"],
      img: ["src", "alt", "width", "height", "loading", "srcset", "sizes"],
      iframe: ["src", "title", "allow", "allowfullscreen", "loading", "width", "height"],
      th: ["scope", "colspan", "rowspan"],
      td: ["colspan", "rowspan"],
      "*": ["id", "data-type", "data-callout"],
    },
    allowedSchemes: ["https", "mailto"],
    allowedSchemesByTag: { img: ["https", "http"] },
    allowedIframeHostnames: ["www.youtube-nocookie.com", "www.youtube.com"],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        const external = /^https?:\/\//.test(href) && !/^https:\/\/(www\.)?shivanshigaming\.com/.test(href);
        return { tagName, attribs: { ...attribs, ...(external ? { rel: "noopener noreferrer ugc", target: "_blank" } : {}) } };
      },
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
      iframe: (tagName, attribs) => ({ tagName, attribs: { ...attribs, src: (attribs.src ?? "").replace("www.youtube.com", "www.youtube-nocookie.com"), loading: "lazy" } }),
    },
  });
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#x27;": "'", "&nbsp;": " " };

/** Plain text from HTML: tag boundaries become spaces (so words never merge) and entities are decoded. */
export function htmlToText(html: string): string {
  return sanitizeHtml(html.replace(/</g, " <"), { allowedTags: [], allowedAttributes: {} })
    .replace(/&(amp|lt|gt|quot|nbsp|#39|#x27);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

/** Rich text as stored: editor JSON (optional) + sanitised HTML. Accepts a plain HTML string too. */
export const richTextSchema = z
  .union([z.string().max(200_000), z.object({ json: z.unknown().optional(), html: z.string().max(200_000) })])
  .transform((v) => {
    const html = sanitizeRichHtml(typeof v === "string" ? v : v.html);
    return { json: typeof v === "string" ? undefined : v.json, html };
  });
