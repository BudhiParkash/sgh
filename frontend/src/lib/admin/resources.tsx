import type { ResourceDef } from "./resource";

/* eslint-disable @typescript-eslint/no-explicit-any -- resource rows are dynamic */
type Row = Record<string, any>;

export { seoSection } from "./sections";
import { seoSection } from "./sections";

const categories: ResourceDef<Row> = {
  key: "categories",
  title: "Categories",
  singular: "Category",
  endpoint: "/categories",
  perm: "category",
  filters: [{ name: "kind", label: "Type", options: [{ value: "news", label: "News" }, { value: "guide", label: "Guides" }] }],
  columns: [
    { key: "name", label: "Name" },
    { key: "kind", label: "Type", render: (r) => <span className="capitalize">{r.kind}</span> },
    { key: "slug", label: "Slug", render: (r) => <code className="text-xs text-muted">{r.slug}</code> },
  ],
  sections: [
    {
      title: "Details",
      fields: [
        { name: "name", label: "Name", type: "text", required: true, max: 80 },
        { name: "kind", label: "Type", type: "select", required: true, options: [{ value: "news", label: "News" }, { value: "guide", label: "Guides & tutorials" }] },
        { name: "slug", label: "URL slug", type: "slug", max: 120 },
        { name: "order", label: "Display order", type: "number", min: 0, max: 999 },
        { name: "description", label: "Description", type: "textarea", max: 500, wide: true },
      ],
    },
    seoSection as never,
  ],
  defaults: { order: 0, seo: { robots: { index: true, follow: true } } },
  titleOf: (r) => r.name,
};

const tags: ResourceDef<Row> = {
  key: "tags",
  title: "Tags",
  singular: "Tag",
  endpoint: "/tags",
  perm: "tag",
  description: "Tag pages are indexed only when they have enough articles (avoids thin pages).",
  columns: [
    { key: "name", label: "Name" },
    { key: "slug", label: "Slug", render: (r) => <code className="text-xs text-muted">{r.slug}</code> },
  ],
  sections: [
    {
      title: "Details",
      fields: [
        { name: "name", label: "Name", type: "text", required: true, max: 60 },
        { name: "slug", label: "URL slug", type: "slug" },
        { name: "description", label: "Description", type: "textarea", max: 300 },
      ],
    },
  ],
  titleOf: (r) => r.name,
};

const redirects: ResourceDef<Row> = {
  key: "redirects",
  title: "Redirects",
  singular: "Redirect",
  endpoint: "/redirects",
  perm: "redirect",
  description: "301 for moved pages, 410 for permanently removed pages. Slug changes on published content add redirects automatically.",
  columns: [
    { key: "from", label: "From", render: (r) => <code className="text-xs">{r.from}</code> },
    { key: "to", label: "To", render: (r) => <code className="text-xs text-muted">{r.code === 410 ? "(gone)" : r.to}</code> },
    { key: "code", label: "Code" },
    { key: "hits", label: "Hits" },
  ],
  sections: [
    {
      title: "Redirect",
      fields: [
        { name: "from", label: "From path", type: "text", required: true, placeholder: "/old-page" },
        { name: "code", label: "Type", type: "select", required: true, options: [{ value: "301", label: "301 — moved permanently" }, { value: "302", label: "302 — temporary" }, { value: "410", label: "410 — gone (removed)" }] },
        { name: "to", label: "To (path or https URL)", type: "text", showIf: (v) => String(v.code) !== "410" },
        { name: "note", label: "Note", type: "text", max: 200, wide: true },
      ],
    },
  ],
  defaults: { code: "301" },
  toForm: (d) => ({ ...d, code: String(d.code) }),
  fromForm: (v) => ({ ...v, code: Number(v.code) }),
  titleOf: (r) => r.from,
};

/** Registry of generic admin resources (extended in later milestones). */
import { tournaments } from "./resources-tournaments";
import { articles } from "./resources-articles";
import { enquiries, feedback, legal, privacyRequests, reports } from "./resources-inbox";
import { devices, scopes, sensitivity, sensitivityCodes, weapons } from "./resources-sensitivity";

export const RESOURCES: Record<string, ResourceDef<Row>> = {
  categories,
  tags,
  redirects,
  tournaments,
  sensitivity,
  "sensitivity-codes": sensitivityCodes,
  devices,
  weapons,
  scopes,
  articles,
  legal,
  feedback,
  enquiries,
  reports,
  "privacy-requests": privacyRequests,
};
