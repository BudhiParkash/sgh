import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { env } from "../../config/env.js";
import { articleCreateSchema } from "../articles/article.routes.js";
import { categoryCreateSchema } from "../categories/category.routes.js";
import { configCreateSchema, deviceCreateSchema, weaponCreateSchema } from "../sensitivity/sensitivity.admin.js";
import { tagCreateSchema } from "../tags/tag.routes.js";
import { tournamentCreateSchema } from "../tournaments/tournament.routes.js";
import { LIMITS } from "@sgh/shared";
import type { AdminApiClient, ApiResult } from "./admin-client.js";
import { fetchImage, ImageFetchError } from "./fetch-image.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- API documents are passed through as JSON */

interface ContentType {
  path: string;
  perm: string;
  label: string;
  schema: z.ZodType;
  workflow: boolean;
  /** Public URL of the item (for preview links). */
  publicPath?: (d: any) => string | null;
  notes: string;
}

/** Every content type an AI agent can work with. Inbox data (people's messages) is deliberately absent. */
export const CONTENT_TYPES: Record<string, ContentType> = {
  tournament: {
    path: "/tournaments",
    perm: "tournament",
    label: "Tournament",
    schema: tournamentCreateSchema,
    workflow: true,
    publicPath: (d) => `/tournaments/${d.slug}`,
    notes:
      "officialSourceUrl must be the organiser's/KRAFTON's own announcement (website, official YouTube/Instagram/X post) — never a news site or a Google result. Also add it to `sources` with type \"official\". Leave dates, prize pool and registration link empty if the official source doesn't state them. status: rumour (not officially announced) | confirmed | ongoing | completed | cancelled | postponed. prizePool.verified=true only when the official source states the amount. `game` = id from list_reference_data.",
  },
  sensitivity: {
    path: "/sensitivity",
    perm: "sensitivity",
    label: "Sensitivity setup",
    schema: configCreateSchema,
    workflow: true,
    publicPath: (d) => `/sensitivity/${d.slug}`,
    notes:
      'provenance: "tested" ONLY when the owner gave you real test details (tester, date, device, game version) in this conversation; "community" for setups reported by players; "baseline" for a starting point derived from device class (no device link, needs deviceClass.refreshTier). Never invent test results. values: camera/ads/gyro/ads_gyro rows keyed by scope (tpp, fpp, red_dot, x2, x3, x4, x6, x8, free_look…); explanation needs 40+ words (150+ to be indexed by search engines).',
  },
  device: {
    path: "/devices",
    perm: "device",
    label: "Device",
    schema: deviceCreateSchema,
    workflow: true,
    publicPath: () => null,
    notes: "Use the manufacturer's official spec page as specSourceUrl. supportedFps = the FPS options the game offers on this phone; give fpsSourceUrl and only include values you can source.",
  },
  weapon: {
    path: "/weapons",
    perm: "weapon",
    label: "Gun guide",
    schema: weaponCreateSchema,
    workflow: true,
    publicPath: (d) => `/sensitivity/guns/${d.slug}`,
    notes: "recoilNotes needs 60+ words of original explanation (recoil pattern, range, best scopes). Do not copy text from other sites. No game artwork.",
  },
  article: {
    path: "/articles",
    perm: "article",
    label: "Article (news or guide)",
    schema: articleCreateSchema,
    workflow: true,
    publicPath: (d) => (d.category?.slug ? `/${d.category.kind === "news" ? "news" : "guides"}/${d.category.slug}/${d.slug}` : null),
    notes:
      "content = HTML (h2/h3/p/ul/ol/li/a/strong/em/blockquote/table). type: news | guide. category = id of a category with the matching kind; tags = tag ids (create missing tags with create_content type=tag). News must cite sources (official first). Write original text — no copying, no game assets, no betting/real-money content.",
  },
  category: { path: "/categories", perm: "category", label: "Category", schema: categoryCreateSchema, workflow: false, notes: "Live immediately (no review). Only the admin can create categories." },
  tag: { path: "/tags", perm: "tag", label: "Tag", schema: tagCreateSchema, workflow: false, notes: "Live immediately. Reuse existing tags before creating new ones." },
};
const TYPE_KEYS = Object.keys(CONTENT_TYPES) as [string, ...string[]];

export const EDITORIAL_GUIDELINES = `# Shivanshi Gaming Hub — editorial rules for AI assistants

You are helping the team of Shivanshi Gaming Hub (${env.SITE_URL}), an independent, English-language information site about BGMI and PUBG Mobile for players in India. It is not affiliated with KRAFTON, Tencent or any game publisher.

## Truth first
1. Never invent facts: no made-up dates, prize pools, teams, results, patch notes, device specs or sensitivity "test results". If you can't find it in a reliable source, leave the field empty and say so.
2. Tournaments need the organiser's own announcement as \`officialSourceUrl\` (KRAFTON / BGMI official site, official YouTube, Instagram or X account of the organiser). A Google search result, a news article or a Reddit post is NOT an official source — add those as additional sources with the right type, and mark the tournament \`rumour\` until it is officially announced.
3. Sensitivity setups marked "tested" must contain real test details supplied by the owner (tester name, date, device used, game version). Otherwise use "community" or "baseline".
4. Write in your own words. Never copy articles, and never upload or link game artwork, logos, screenshots or music.
5. Images (\`upload_media\`): only upload (a) images you generated or made yourself — licence \`original\`, and say how it was made in \`licenceNotes\` — or (b) official press-kit / clearly licensed images — licence \`press_kit\` or \`licensed\`, with the source URL and terms in \`licenceNotes\` and the owner in \`credit\`. Never upload game screenshots, KRAFTON/BGMI/PUBG logos or characters, player or creator photos from social media, or anything found via image search. Every image needs real alt text. Reuse existing images (\`list_media\`) before uploading.
6. No betting, gambling, entry-fee, wallet or real-money gaming content, and no hacks, mods or cheats.
7. Dates are in India Standard Time (IST, UTC+05:30). Send ISO 8601 with offset, e.g. 2026-12-20T18:00:00+05:30.

## How work flows
- Everything you create is a **draft**. Use \`content_action\` with \`submit\` to send it for review. A human admin reviews, verifies and publishes — you cannot publish, delete, or change settings, legal pages or users. Attach an uploaded image by setting the item's image field (e.g. \`featuredImage\`) to the media id with \`update_content\`.
- Before submitting, run \`get_publish_checks\` and fix every blocking problem.
- Look things up before creating: \`search_content\` to avoid duplicates, \`list_reference_data\` for game, category, tag and device ids, \`get_schema\` for the exact fields.
- Updates send only the fields you change. Include \`version\` from \`get_content\` to avoid overwriting someone else's edit.
- Quality bar: helpful, specific, original. No thin pages — the site's publish checks enforce minimum word counts.
`;

const text = (t: string): CallToolResult => ({ content: [{ type: "text", text: t }] });
const json = (v: unknown): CallToolResult => text(JSON.stringify(v, null, 2));

function fromApi(r: ApiResult, summarise?: (d: any) => unknown): CallToolResult {
  if (r.ok) return json(summarise ? summarise(r.data) : r.data);
  const details = r.error?.details?.length ? `\n${r.error.details.map((d) => `- ${d.path}: ${d.message}`).join("\n")}` : "";
  const hint = r.status === 403 ? "\n(This AI agent account doesn't have permission for that. A human admin must do it.)" : r.status === 409 ? "\n(The item changed since you read it: call get_content again and reapply your change.)" : "";
  return { isError: true, content: [{ type: "text", text: `Error ${r.status}: ${r.error?.message ?? "Request failed"}${details}${hint}` }] };
}

export function toJsonSchema(schema: z.ZodType) {
  return z.toJSONSchema(schema, {
    io: "input",
    unrepresentable: "any",
    override: (ctx) => {
      const def = (ctx.zodSchema as any)._zod?.def;
      if (def?.type === "date") Object.assign(ctx.jsonSchema, { type: "string", format: "date-time" });
    },
  });
}

/** Compact view of a list item so long lists fit in the model's context. */
function brief(d: any) {
  return {
    id: d.id,
    title: d.title ?? d.name ?? (d.brand ? `${d.brand} ${d.model}` : undefined),
    slug: d.slug,
    status: d.workflow?.status,
    ...(d.status && { tournamentStatus: d.status }),
    ...(d.type && { type: d.type }),
    ...(d.startDate !== undefined && { startDate: d.startDate }),
    updatedAt: d.updatedAt,
  };
}

const typeArg = z.enum(TYPE_KEYS).describe(`Content type: ${TYPE_KEYS.join(", ")}`);
const idArg = z.string().regex(/^[a-f\d]{24}$/i, "24-character id").describe("Item id");

/** Builds the MCP server for one AI agent (stateless: one instance per HTTP request). */
export function buildMcpServer(api: AdminApiClient): McpServer {
  const server = new McpServer({ name: "shivanshi-gaming-hub", version: "1.0.0" }, { instructions: EDITORIAL_GUIDELINES, capabilities: { logging: {} } });
  const ro = { readOnlyHint: true, openWorldHint: false } as const;

  server.registerResource("editorial-guidelines", "sgh://guidelines", { title: "Editorial guidelines", description: "Rules every AI-created item must follow", mimeType: "text/markdown" }, async (uri) => ({
    contents: [{ uri: uri.href, mimeType: "text/markdown", text: EDITORIAL_GUIDELINES }],
  }));

  server.registerTool("get_guidelines", { title: "Editorial guidelines", description: "Read the site's editorial rules. Call this first in every new conversation.", annotations: ro }, async () => text(EDITORIAL_GUIDELINES));

  server.registerTool(
    "get_overview",
    { title: "Dashboard overview", description: "Counts of content by status plus the 'needs attention' list (stale tournaments, pending reviews…). Also shows what this AI agent is allowed to do.", annotations: ro },
    async () => {
      const [dash, perms] = await Promise.all([api.call("GET", "/dashboard"), api.permissions()]);
      if (!dash.ok) return fromApi(dash);
      return json({ dashboard: dash.data, myPermissions: perms });
    },
  );

  server.registerTool(
    "get_schema",
    {
      title: "Field schema",
      description: "JSON Schema of the fields for creating/updating a content type, plus type-specific rules. Call before create_content.",
      inputSchema: { type: typeArg },
      annotations: ro,
    },
    async ({ type }) => {
      const t = CONTENT_TYPES[type]!;
      return json({ type, label: t.label, reviewWorkflow: t.workflow, rules: t.notes, schema: toJsonSchema(t.schema) });
    },
  );

  server.registerTool(
    "list_reference_data",
    {
      title: "Reference data",
      description: "Ids you need for references: games, categories (news/guide), tags, scopes, and devices (optionally filtered by text).",
      inputSchema: { kind: z.enum(["games", "categories", "tags", "scopes", "devices"]), q: z.string().max(100).optional().describe("Filter text (categories, tags, devices)") },
      annotations: ro,
    },
    async ({ kind, q }) => {
      const qs = q ? `&q=${encodeURIComponent(q)}` : "";
      const path = { games: "/games", scopes: "/scopes", categories: `/categories?limit=100${qs}`, tags: `/tags?limit=100${qs}`, devices: `/devices?limit=100${qs}` }[kind];
      return fromApi(await api.call("GET", path), (items: any[]) =>
        items.map((d) => ({ id: d.id, key: d.key, name: d.name ?? d.label ?? (d.brand ? `${d.brand} ${d.model}` : undefined), slug: d.slug, kind: d.kind, ...(d.workflow && { status: d.workflow.status }) })),
      );
    },
  );

  server.registerTool(
    "search_content",
    {
      title: "Search / list content",
      description: "List or search items of one type (newest first). Use before creating to avoid duplicates.",
      inputSchema: {
        type: typeArg,
        q: z.string().max(100).optional().describe("Text search in title/name/slug"),
        status: z.enum(["draft", "review", "approved", "scheduled", "published", "archived"]).optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(20),
      },
      annotations: ro,
    },
    async ({ type, q, status, page, limit }) => {
      const t = CONTENT_TYPES[type]!;
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q) params.set("q", q);
      if (status && t.workflow) params.set("status", status);
      const r = await api.call<any[]>("GET", `${t.path}?${params}`);
      if (!r.ok) return fromApi(r);
      return json({ items: (r.data ?? []).map(brief), meta: r.meta });
    },
  );

  server.registerTool(
    "get_content",
    { title: "Get one item", description: "Full item including its `version` (send it back on update_content).", inputSchema: { type: typeArg, id: idArg }, annotations: ro },
    async ({ type, id }) => fromApi(await api.call("GET", `${CONTENT_TYPES[type]!.path}/${id}`)),
  );

  server.registerTool(
    "create_content",
    {
      title: "Create a draft",
      description: "Create a new item. Workflow types (tournament, sensitivity, device, weapon, article) are saved as drafts for human review. Get the fields with get_schema first. Follow the editorial guidelines strictly — never invent facts.",
      inputSchema: { type: typeArg, data: z.record(z.string(), z.unknown()).describe("Fields matching get_schema(type)") },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async ({ type, data }) => {
      const t = CONTENT_TYPES[type]!;
      return fromApi(await api.call("POST", t.path, data), (d) => ({ created: brief(d), next: t.workflow ? "Run get_publish_checks, fix blockers, then content_action submit." : "Live now." }));
    },
  );

  server.registerTool(
    "update_content",
    {
      title: "Update an item",
      description: "Change some fields of an item. Send only the fields you change. Pass `version` from get_content to prevent overwriting newer edits.",
      inputSchema: { type: typeArg, id: idArg, data: z.record(z.string(), z.unknown()), version: z.number().int().min(0).optional() },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ type, id, data, version }) =>
      fromApi(await api.call("PATCH", `${CONTENT_TYPES[type]!.path}/${id}`, data, version === undefined ? {} : { "if-match": String(version) }), (d) => ({ updated: brief(d), version: d.version })),
  );

  server.registerTool(
    "get_publish_checks",
    {
      title: "Publish checks",
      description: "What still blocks publishing (must fix) and warnings (should fix) for a workflow item.",
      inputSchema: { type: typeArg, id: idArg },
      annotations: ro,
    },
    async ({ type, id }) => {
      const t = CONTENT_TYPES[type]!;
      if (!t.workflow) return text(`${t.label} has no review workflow — it's live as soon as it's saved.`);
      return fromApi(await api.call("GET", `${t.path}/${id}/checks`));
    },
  );

  server.registerTool(
    "content_action",
    {
      title: "Workflow action",
      description: "Move an item through review. AI agents normally use `submit` (draft → review). approve/publish/schedule/unpublish/archive need a human admin's permission and will be refused.",
      inputSchema: {
        type: typeArg,
        id: idArg,
        action: z.enum(["submit", "reject", "approve", "schedule", "publish", "unpublish", "archive", "restore"]),
        note: z.string().max(500).optional().describe("Note for the reviewer: what you did, what you couldn't verify"),
        publishAt: z.string().datetime({ offset: true }).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ type, id, action, note, publishAt }) => {
      const t = CONTENT_TYPES[type]!;
      if (!t.workflow) return text(`${t.label} has no review workflow.`);
      return fromApi(await api.call("POST", `${t.path}/${id}/workflow`, { action, note, publishAt }), (d) => ({ item: brief(d) }));
    },
  );

  server.registerTool(
    "get_preview_link",
    {
      title: "Preview link",
      description: "A 30-minute link to see an unpublished item exactly as it will look on the site. Share it with the owner for review.",
      inputSchema: { type: typeArg, id: idArg },
      annotations: ro,
    },
    async ({ type, id }) => {
      const t = CONTENT_TYPES[type]!;
      const item = await api.call<any>("GET", `${t.path}/${id}`);
      if (!item.ok) return fromApi(item);
      const path = t.publicPath?.(item.data) ?? null;
      if (!t.workflow || !path) return text("This type has no preview page.");
      const tok = await api.call<{ token: string }>("GET", `${t.path}/${id}/preview-token`);
      if (!tok.ok) return fromApi(tok);
      const url = new URL("/api/preview", env.SITE_URL);
      url.searchParams.set("token", tok.data!.token);
      url.searchParams.set("path", path);
      return json({ url: url.toString(), expiresInMinutes: 30 });
    },
  );

  server.registerTool(
    "list_media",
    {
      title: "Media library",
      description: "Find images in the library (to use as featuredImage/image ids). Check here before uploading a new image.",
      inputSchema: { q: z.string().max(100).optional(), page: z.number().int().min(1).default(1) },
      annotations: ro,
    },
    async ({ q, page }) => {
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      if (q) params.set("q", q);
      return fromApi(await api.call("GET", `/media?${params}`), (items: any[]) =>
        items.map((m) => ({ id: m.id, alt: m.alt, credit: m.credit, licence: m.licence, category: m.category, width: m.width, height: m.height, url: m.ref?.url, usedBy: m.usageCount })),
      );
    },
  );

  server.registerTool(
    "upload_media",
    {
      title: "Upload an image",
      description:
        "Add an image to the media library from a public https URL (preferred) or base64 data, then attach it with update_content (e.g. featuredImage = returned id). " +
        "JPEG, PNG, WebP or AVIF, at least 64×64, at most 8 MB; the site creates resized WebP/AVIF versions and strips metadata. " +
        "For base64, send a compact WebP/JPEG (ideally ≤ 300 KB, ~1280 px wide). Follow the image rules in get_guidelines: no game screenshots, logos, characters or images from image search.",
      inputSchema: {
        url: z.string().url().max(2000).optional().describe("Public https:// URL of the image file"),
        base64: z.string().max(12_000_000).optional().describe("Image bytes as base64 (a data: URL prefix is fine)"),
        filename: z.string().max(120).optional().describe("File name, e.g. bgmi-recoil-guide.webp"),
        alt: z.string().min(3).max(250).describe("What the image shows, for screen readers"),
        caption: z.string().max(300).optional(),
        credit: z.string().max(200).optional().describe("Who owns/made the image (required for press_kit and licensed)"),
        licence: z.enum(["original", "licensed", "press_kit"]).describe("original = you generated/made it; press_kit/licensed = official or licensed source"),
        licenceNotes: z.string().min(10).max(500).describe("How it was made (original) or the source URL + licence terms (press_kit/licensed)"),
        category: z.enum(["general", "tournament", "sensitivity", "article", "device", "weapon", "resource"]).default("general"),
      },
    },
    async ({ url, base64, filename, licence, credit, ...meta }) => {
      if (!url === !base64) return { isError: true, content: [{ type: "text", text: "Send exactly one of url or base64." }] };
      if (licence !== "original" && !credit) return { isError: true, content: [{ type: "text", text: "credit is required for press_kit and licensed images." }] };
      let file: { buffer: Buffer; filename: string };
      if (url) {
        try {
          file = await fetchImage(url, LIMITS.uploadBytesMax);
        } catch (e) {
          return { isError: true, content: [{ type: "text", text: e instanceof ImageFetchError ? e.message : "Could not download the image." }] };
        }
      } else {
        const data = base64!.replace(/^data:[^;,]+;base64,/, "").replace(/\s+/g, "");
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return { isError: true, content: [{ type: "text", text: "base64 is not valid base64 data." }] };
        const buffer = Buffer.from(data, "base64");
        if (buffer.length > LIMITS.uploadBytesMax) return { isError: true, content: [{ type: "text", text: "The image is larger than 8 MB." }] };
        file = { buffer, filename: filename ?? "image" };
      }
      const r = await api.upload<any>("/media", { ...meta, licence, credit }, { buffer: file.buffer, filename: (filename ?? file.filename).slice(0, 120) });
      return fromApi(r, (m) => ({ id: m.id, url: m.ref?.url, width: m.width, height: m.height, alt: m.alt, next: "Attach it with update_content, e.g. { featuredImage: id }." }));
    },
  );

  server.registerTool(
    "get_seo_overview",
    { title: "SEO overview", description: "Site-wide SEO audit: missing meta, thin content, noindexed pages, broken redirects.", annotations: ro },
    async () => fromApi(await api.call("GET", "/seo/overview")),
  );

  // ── Prompts: ready-made tasks for the owner ──────────────────────────
  server.registerPrompt(
    "add_tournament",
    {
      title: "Add a tournament from an official announcement",
      description: "Research a BGMI/PUBG Mobile tournament and save it as a draft",
      argsSchema: { announcement: z.string().describe("Official announcement URL, or the tournament name to look up") },
    },
    ({ announcement }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Add this tournament to Shivanshi Gaming Hub as a draft: ${announcement}\n\n1. Read get_guidelines.\n2. Find the organiser's OFFICIAL announcement (KRAFTON/BGMI or the organiser's own site/social account). If you can't find one, stop and tell me.\n3. search_content type=tournament to make sure it isn't already there.\n4. get_schema type=tournament and list_reference_data kind=games.\n5. create_content with only facts stated by the official source (leave unknown fields empty) and the official link in sources.\n6. get_publish_checks, fix what you can, then content_action submit with a note listing anything you couldn't verify.\n7. Give me the get_preview_link URL.`,
          },
        },
      ],
    }),
  );
  server.registerPrompt(
    "write_guide",
    { title: "Write a gaming guide", description: "Draft an original, well-structured guide article", argsSchema: { topic: z.string().describe("Guide topic, e.g. 'best sensitivity for 120 FPS phones'") } },
    ({ topic }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Write an original guide for Shivanshi Gaming Hub about: ${topic}\n\nRead get_guidelines first. Check search_content type=article for overlap. Use list_reference_data for a guide category and tags. Aim for 900–1500 words of genuinely useful, specific advice with h2/h3 sections, a short FAQ (3–5 questions) and sources for any facts. Save with create_content type=article (type "guide"), run get_publish_checks, submit for review, and give me the preview link.`,
          },
        },
      ],
    }),
  );
  server.registerPrompt(
    "add_sensitivity_setup",
    {
      title: "Add a sensitivity setup",
      description: "Save a sensitivity setup with honest provenance",
      argsSchema: { details: z.string().describe("Device, FPS, gyro mode and the values — and whether you actually tested them") },
    },
    ({ details }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Add this sensitivity setup to Shivanshi Gaming Hub as a draft:\n${details}\n\nRead get_guidelines. Use provenance "tested" only if my message includes real test details (who, when, device, game version); otherwise ask me or use "community"/"baseline". Find the device with list_reference_data kind=devices (create it as a draft if missing, with official spec sources). get_schema type=sensitivity, then create_content, write a 150+ word explanation of why these values work and how to fine-tune them, run get_publish_checks, submit, and give me the preview link.`,
          },
        },
      ],
    }),
  );

  return server;
}
