import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

/** Production: crawl everything public; staging/local: crawl nothing (also sent as X-Robots-Tag). */
export default function robots(): MetadataRoute.Robots {
  if (process.env.SITE_ENV !== "production") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/search", "/saved", "/offline", "/privacy-request/verify", "/sensitivity/compare", "/tournaments/calendar", "/*?*sort="],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
