import type { ResourceDef } from "./resource";

/** Shared SEO tab used by every public content type. */
export const seoSection = {
  title: "SEO",
  fields: [
    { name: "seo.title", label: "SEO title", type: "text", max: 60, hint: "Up to 60 characters. Defaults to the title." },
    { name: "seo.description", label: "Meta description", type: "textarea", max: 160, rows: 3, hint: "Up to 160 characters." },
    { name: "seo.canonicalUrl", label: "Canonical URL (override)", type: "url", hint: "Leave empty to use this page's own URL." },
    { name: "seo.robots.index", label: "Allow search engines to index this page", type: "checkbox" },
    { name: "seo.ogImage", label: "Social sharing image", type: "media", hint: "Defaults to the featured image." },
  ],
} as const satisfies ResourceDef["sections"][number];
