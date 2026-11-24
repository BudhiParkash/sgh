import type { Metadata } from "next";
import type { SeoDto } from "@sgh/shared";
import { siteConfig } from "@/lib/site";

export const absoluteUrl = (path: string) => new URL(path, siteConfig.url).toString();

interface Input {
  title: string;
  description: string;
  path: string;
  seo?: SeoDto | null;
  image?: { url: string; width?: number; height?: number; alt?: string } | null;
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  /** Force noindex (e.g. filtered listings, empty pages). */
  noindex?: boolean;
}

/** Single place that turns page data + admin SEO overrides into Next.js Metadata. */
export function buildMetadata(i: Input): Metadata {
  const title = i.seo?.title || i.title;
  const description = i.seo?.description || i.description;
  const canonical = i.seo?.canonicalUrl || absoluteUrl(i.path);
  const index = !i.noindex && (i.seo?.robots.index ?? true);
  const follow = i.seo?.robots.follow ?? true;
  const img = i.seo?.ogImage ?? i.image ?? null;
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index, follow, googleBot: { index, follow, "max-image-preview": "large", "max-snippet": -1 } },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: siteConfig.name,
      locale: "en_IN",
      type: i.type ?? "website",
      ...(i.publishedTime && { publishedTime: i.publishedTime }),
      ...(i.modifiedTime && { modifiedTime: i.modifiedTime }),
      ...(img && { images: [{ url: img.url, width: img.width, height: img.height, alt: "alt" in img ? img.alt : undefined }] }),
    },
    twitter: { card: "summary_large_image", title, description, ...(img && { images: [img.url] }) },
  };
}
