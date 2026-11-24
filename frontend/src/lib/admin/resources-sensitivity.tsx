import { FPS_OPTIONS, SCOPE_KEYS, SCOPE_LABELS } from "@sgh/shared";
import { CodeReviewPanel } from "@/components/admin/panels/code-review";
import { SensitivityGrid } from "@/components/admin/sensitivity-grid";
import { Badge } from "@/components/ui/badge";
import { isoToDateInput, type ResourceDef } from "./resource";
import { seoSection } from "./sections";

/* eslint-disable @typescript-eslint/no-explicit-any -- admin documents */
type Row = Record<string, any>;
const idOf = (v: any) => (v && typeof v === "object" ? (v.id ?? v._id) : v) ?? null;
const FPS = FPS_OPTIONS.map((f) => ({ value: String(f), label: `${f} FPS` }));
const GYRO = [{ value: "always_on", label: "Gyro always on" }, { value: "scope_on", label: "Gyro on when scoped" }, { value: "off", label: "Gyro off" }];
const STYLE = [{ value: "rush", label: "Rush" }, { value: "balanced", label: "Balanced" }, { value: "sniper", label: "Sniper" }];
const PROV = [{ value: "tested", label: "Tested (named tester, device, date, game version)" }, { value: "community_submitted", label: "Community submitted" }, { value: "baseline", label: "Baseline (device class, not device-tested)" }];
const provTone = { tested: "primary", community_submitted: "info", baseline: "neutral" } as const;
const commonSeo = (d: Row) => ({ ...(d.seo ?? {}), ogImage: idOf(d.seo?.ogImage), robots: d.seo?.robots ?? { index: true, follow: true } });

export const devices: ResourceDef<Row> = {
  key: "devices",
  title: "Devices",
  singular: "Device",
  endpoint: "/devices",
  perm: "device",
  workflow: true,
  description: "Specs must come from a source. Device pages are indexed only once they have a published setup.",
  columns: [
    { key: "model", label: "Device", render: (r) => `${r.brand} ${r.model}` },
    { key: "supportedFps", label: "FPS", render: (r) => (r.supportedFps ?? []).join(" / ") || "—" },
    { key: "deviceClass", label: "Class", render: (r) => (r.deviceClass ? `${r.deviceClass.refreshTier} Hz · ${r.deviceClass.perfTier}` : "—") },
  ],
  sections: [
    {
      title: "Device",
      fields: [
        { name: "brand", label: "Brand", type: "text", required: true, max: 40, placeholder: "e.g. iQOO" },
        { name: "model", label: "Model", type: "text", required: true, max: 80, placeholder: "e.g. Neo 9 Pro" },
        { name: "slug", label: "URL slug", type: "slug", hint: "Auto: brand-model" },
        { name: "releaseYear", label: "Release year", type: "number", min: 2015, max: 2100 },
        { name: "chipset", label: "Chipset", type: "text", max: 80 },
        { name: "displayRefreshRateHz", label: "Display refresh rate (Hz)", type: "number", min: 30, max: 240 },
        { name: "touchSamplingRateHz", label: "Touch sampling rate (Hz)", type: "number", min: 60, max: 4000 },
        { name: "screenSizeInches", label: "Screen size (inches)", type: "number", min: 4, max: 14, step: 0.01 },
        { name: "supportedFps", label: "In-game FPS options available on this device", type: "multiselect", options: FPS, wide: true },
        { name: "gyroscope", label: "Has a gyroscope", type: "checkbox" },
        { name: "specSourceUrl", label: "Spec source URL", type: "url" },
        { name: "fpsSourceUrl", label: "FPS support source URL", type: "url" },
        { name: "fpsVerifiedAt", label: "FPS checked on", type: "date" },
        { name: "summary", label: "Short summary", type: "textarea", max: 300 },
        { name: "image", label: "Image (original or licensed render)", type: "media", category: "device" },
      ],
    },
    seoSection as never,
  ],
  defaults: { gyroscope: true, supportedFps: [], seo: { robots: { index: true, follow: true } } },
  toForm: (d) => ({ ...d, image: idOf(d.image), supportedFps: (d.supportedFps ?? []).map(String), fpsVerifiedAt: isoToDateInput(d.fpsVerifiedAt), seo: commonSeo(d) }),
  fromForm: (v) => ({ ...v, supportedFps: ((v.supportedFps as string[] | undefined) ?? []).map(Number) }),
  titleOf: (r) => `${r.brand} ${r.model}`,
  publicUrl: (r) => `/sensitivity/devices/${r.brandSlug}/${r.slug}`,
};

export const weapons: ResourceDef<Row> = {
  key: "weapons",
  title: "Gun guides",
  singular: "Gun guide",
  endpoint: "/weapons",
  perm: "weapon",
  workflow: true,
  revisions: true,
  description: "Sensitivity is set per scope, not per gun. Guides explain recoil behaviour and which scopes matter — no invented per-gun numbers.",
  columns: [
    { key: "name", label: "Gun" },
    { key: "type", label: "Type" },
    { key: "game", label: "Game", render: (r) => r.game?.name ?? "—" },
  ],
  sections: [
    {
      title: "Gun",
      fields: [
        { name: "name", label: "Name", type: "text", required: true, max: 40, placeholder: "e.g. M416" },
        { name: "game", label: "Game", type: "reference", endpoint: "/games", labelKey: "name", required: true },
        { name: "type", label: "Type", type: "select", required: true, options: ["AR", "SMG", "DMR", "SR", "SG", "LMG", "Pistol"].map((t) => ({ value: t, label: t })) },
        { name: "ammo", label: "Ammo", type: "text", max: 20, placeholder: "e.g. 5.56mm" },
        { name: "order", label: "Display order", type: "number", min: 0, max: 999 },
        { name: "slug", label: "URL slug", type: "slug" },
        { name: "recommendedScopes", label: "Scopes that matter most for this gun", type: "multiselect", options: SCOPE_KEYS.map((k) => ({ value: k, label: SCOPE_LABELS[k] })), wide: true },
        { name: "summary", label: "One-line summary", type: "textarea", max: 300 },
        { name: "recoilNotes", label: "How it behaves (recoil, range, spray)", type: "richtext", required: true },
        { name: "attachmentNotes", label: "Attachment notes", type: "richtext" },
        { name: "image", label: "Illustration (original only)", type: "media", category: "weapon" },
      ],
    },
    seoSection as never,
  ],
  defaults: { recommendedScopes: [], order: 0, seo: { robots: { index: true, follow: true } } },
  toForm: (d) => ({ ...d, game: idOf(d.game), image: idOf(d.image), seo: commonSeo(d) }),
  titleOf: (r) => r.name,
  publicUrl: (r) => `/sensitivity/guns/${r.slug}`,
};

export const sensitivity: ResourceDef<Row> = {
  key: "sensitivity",
  title: "Sensitivity setups",
  singular: "Setup",
  endpoint: "/sensitivity",
  perm: "sensitivity",
  workflow: true,
  revisions: true,
  description: "Every setup shows its provenance publicly. Mark \"Tested\" only when a named person tested it on the device.",
  filters: [{ name: "provenance", label: "Provenance", options: PROV.map((p) => ({ value: p.value, label: p.value.replace("_", " ") })) }],
  columns: [
    { key: "title", label: "Setup" },
    { key: "device", label: "Device", render: (r) => (r.device ? `${r.device.brand} ${r.device.model}` : <span className="text-muted">Baseline {r.deviceClass?.refreshTier} Hz</span>) },
    { key: "fps", label: "FPS" },
    { key: "provenance", label: "Provenance", render: (r) => <Badge tone={provTone[r.provenance as keyof typeof provTone] ?? "neutral"}>{String(r.provenance).replace("_", " ")}</Badge> },
  ],
  sections: [
    {
      title: "Setup",
      fields: [
        { name: "title", label: "Title", type: "text", required: true, max: 140, placeholder: "e.g. iQOO Neo 9 Pro — 90 FPS, gyro always on (balanced)" },
        { name: "game", label: "Game", type: "reference", endpoint: "/games", labelKey: "name", required: true },
        { name: "provenance", label: "Provenance", type: "select", required: true, options: PROV },
        { name: "device", label: "Device", type: "reference", endpoint: "/devices", labelKey: "model", labelOf: (d) => `${d.brand} ${d.model}`, showIf: (v) => v.provenance !== "baseline" },
        { name: "deviceClass.refreshTier", label: "Device class: refresh rate", type: "select", options: ["60", "90", "120", "144+"].map((x) => ({ value: x, label: `${x} Hz` })), showIf: (v) => v.provenance === "baseline" },
        { name: "deviceClass.perfTier", label: "Device class: performance", type: "select", options: ["entry", "mid", "high", "flagship"].map((x) => ({ value: x, label: x })), showIf: (v) => v.provenance === "baseline" },
        { name: "fps", label: "FPS", type: "select", required: true, options: FPS },
        { name: "gyroscope", label: "Gyroscope", type: "select", required: true, options: GYRO },
        { name: "playstyle", label: "Playstyle", type: "select", required: true, options: STYLE },
        { name: "gameVersion", label: "Game version", type: "text", max: 20, placeholder: "e.g. 4.1" },
        { name: "shareCode", label: "In-game share code (optional)", type: "text", max: 40 },
        { name: "slug", label: "URL slug", type: "slug" },
      ],
    },
    {
      title: "Values",
      fields: [
        { name: "values", label: "Sensitivity values", type: "custom", wide: true, render: ({ value, onChange, values, error }) => <SensitivityGrid value={value} onChange={onChange} gyroscope={String(values.gyroscope ?? "always_on")} error={error} /> },
      ],
    },
    {
      title: "Testing",
      fields: [
        { name: "testing.testedBy", label: "Tested by (public display name)", type: "text", max: 80, hint: "Ask testers before showing their name." },
        { name: "testing.testedAt", label: "Tested on", type: "date" },
        { name: "testing.deviceUsed", label: "Device used (model + RAM)", type: "text", max: 120 },
        { name: "testing.notes", label: "Notes", type: "textarea", max: 600 },
        { name: "testing.method", label: "How it was tested", type: "richtext" },
      ],
    },
    {
      title: "Explanation",
      fields: [{ name: "explanation", label: "Why these values & how to fine-tune (150+ words to be indexed)", type: "richtext", required: true }],
    },
    seoSection as never,
  ],
  defaults: { provenance: "tested", fps: "90", gyroscope: "always_on", playstyle: "balanced", values: {}, seo: { robots: { index: true, follow: true } } },
  toForm: (d) => ({
    ...d,
    game: idOf(d.game),
    device: idOf(d.device),
    fps: String(d.fps),
    testing: { ...(d.testing ?? {}), testedAt: isoToDateInput(d.testing?.testedAt) },
    seo: commonSeo(d),
  }),
  fromForm: (v) => ({ ...v, fps: Number(v.fps), device: v.provenance === "baseline" ? null : v.device ?? null }),
  titleOf: (r) => r.title,
  publicUrl: (r) => `/sensitivity/${r.slug}`,
};

export const scopes: ResourceDef<Row> = {
  key: "scopes",
  title: "Scopes",
  singular: "Scope",
  endpoint: "/scopes",
  perm: "scope",
  canCreate: false,
  softDelete: false,
  description: "The nine in-game scope rows. Only labels and order can be changed.",
  columns: [{ key: "label", label: "Label" }, { key: "key", label: "Key", render: (r) => <code className="text-xs text-muted">{r.key}</code> }, { key: "order", label: "Order" }],
  sections: [{ title: "Scope", fields: [{ name: "label", label: "Label", type: "text", required: true, max: 60 }, { name: "order", label: "Order", type: "number", min: 0, max: 99 }] }],
  titleOf: (r) => r.label,
};

export const sensitivityCodes: ResourceDef<Row> = {
  key: "sensitivity-codes",
  title: "Share codes",
  singular: "Share code",
  endpoint: "/sensitivity-codes",
  perm: "sensitivity_code",
  softDelete: false,
  description: "Community submissions arrive as pending. Verify only after importing the code in-game.",
  filters: [{ name: "status", label: "Status", options: ["pending", "verified", "rejected", "expired"].map((s) => ({ value: s, label: s })) }],
  columns: [
    { key: "code", label: "Code", render: (r) => <code className="font-mono">{r.code}</code> },
    { key: "device", label: "Device", render: (r) => (r.device ? `${r.device.brand} ${r.device.model}` : (r.deviceText ?? "—")) },
    { key: "author", label: "Author", render: (r) => `${r.author} (${r.authorType})` },
    { key: "status", label: "Status", render: (r) => <Badge tone={r.status === "verified" ? "success" : r.status === "pending" ? "warning" : "neutral"} className="capitalize">{r.status}</Badge> },
  ],
  sections: [
    {
      title: "Code",
      fields: [
        { name: "code", label: "Share code", type: "text", required: true, max: 40 },
        { name: "author", label: "Author (display name)", type: "text", required: true, max: 60 },
        { name: "device", label: "Device", type: "reference", endpoint: "/devices", labelKey: "model", labelOf: (d) => `${d.brand} ${d.model}` },
        { name: "deviceText", label: "Device (as submitted)", type: "text", max: 80 },
        { name: "fps", label: "FPS", type: "select", options: FPS },
        { name: "gyroscope", label: "Gyroscope", type: "select", options: GYRO },
        { name: "gameVersion", label: "Game version", type: "text", max: 20 },
        { name: "testedAt", label: "Tested on", type: "date" },
        { name: "description", label: "Description", type: "textarea", max: 500 },
      ],
    },
  ],
  toForm: (d) => ({ ...d, device: idOf(d.device), fps: d.fps ? String(d.fps) : "", testedAt: isoToDateInput(d.testedAt) }),
  fromForm: (v) => ({ ...v, fps: v.fps ? Number(v.fps) : null, gyroscope: v.gyroscope || null }),
  titleOf: (r) => r.code,
  sidePanel: (doc, onChanged) => <CodeReviewPanel doc={doc} onChanged={onChanged} />,
};
