import type { RoleKey } from "@sgh/shared";

/**
 * Permission catalogue: "<module>:<action>". Single source of truth for RBAC.
 * docs/architecture/03-database-schema.md §1 (default matrix).
 */
export const PERMISSION_CATALOG = {
  dashboard: ["read"],
  tournament: ["read", "create", "update", "delete", "publish", "verify"],
  sensitivity: ["read", "create", "update", "delete", "publish"],
  sensitivity_code: ["read", "update", "verify", "delete"],
  device: ["read", "create", "update", "delete", "publish"],
  weapon: ["read", "create", "update", "delete", "publish"],
  scope: ["read", "update"],
  game: ["read", "update"],
  article: ["read", "create", "update", "update_any", "delete", "publish"],
  category: ["read", "create", "update", "delete"],
  tag: ["read", "create", "update", "delete"],
  media: ["read", "create", "update", "delete"],
  seo: ["read", "update"],
  redirect: ["read", "create", "update", "delete"],
  ad: ["read", "create", "update", "delete"],
  affiliate: ["read", "create", "update", "delete"],
  feedback: ["read", "update", "delete"],
  enquiry: ["read", "update", "delete"],
  report: ["read", "update"],
  privacy_request: ["read", "update"],
  legal: ["read", "create", "update", "publish"],
  admin: ["read", "create", "update", "delete"],
  role: ["read", "create", "update", "delete"],
  audit: ["read"],
  settings: ["read", "update"],
  cache: ["purge"],
  /** Manage AI agents, their access tokens and MCP connections. */
  ai: ["manage"],
  /** Play (docs/architecture/15-play.md): player accounts, custom rooms, rewards store, redemption queue. */
  player: ["read", "update"],
  room: ["read", "create", "update", "delete", "results"],
  reward: ["read", "create", "update", "delete"],
  redemption: ["read", "update"],
} as const;

export type PermissionModule = keyof typeof PERMISSION_CATALOG;
export type Permission = {
  [M in PermissionModule]: `${M}:${(typeof PERMISSION_CATALOG)[M][number]}`;
}[PermissionModule];

export const ALL_PERMISSIONS: Permission[] = Object.entries(PERMISSION_CATALOG).flatMap(([m, actions]) =>
  (actions as readonly string[]).map((a) => `${m}:${a}` as Permission),
);

const all = (m: PermissionModule) => ALL_PERMISSIONS.filter((p) => p.startsWith(`${m}:`));
const pick = (...ps: Permission[]) => ps;

const CONTENT_ADMIN: Permission[] = [
  "dashboard:read",
  ...all("tournament"),
  ...all("sensitivity"),
  ...all("sensitivity_code"),
  ...all("device"),
  ...all("weapon"),
  ...all("scope"),
  ...all("game"),
  ...all("article"),
  ...all("category"),
  ...all("tag"),
  ...all("media"),
  ...all("seo"),
  ...all("redirect"),
  ...all("feedback"),
  ...all("enquiry"),
  ...all("report"),
  ...all("privacy_request"),
  ...all("legal"),
  ...all("ad"),
  ...all("affiliate"),
  ...all("settings"),
  "audit:read",
  "cache:purge",
  "ai:manage",
  ...all("player"),
  ...all("room"),
  ...all("reward"),
  ...all("redemption"),
];

export const DEFAULT_ROLES: Record<RoleKey, { name: string; permissions: Permission[] }> = {
  super_admin: { name: "Super Admin", permissions: ALL_PERMISSIONS },
  admin: { name: "Admin", permissions: CONTENT_ADMIN },
  editor: {
    name: "Editor",
    permissions: [
      "dashboard:read",
      ...all("sensitivity"),
      ...all("sensitivity_code"),
      ...all("device"),
      ...all("weapon"),
      "scope:read",
      "game:read",
      ...all("article"),
      ...all("category"),
      ...all("tag"),
      ...all("media"),
      ...all("seo"),
      ...all("redirect"),
      ...pick("feedback:read", "feedback:update", "report:read", "report:update", "tournament:read"),
    ],
  },
  seo_manager: {
    name: "SEO Manager",
    permissions: [
      "dashboard:read",
      ...all("seo"),
      ...all("redirect"),
      ...pick("article:read", "tournament:read", "sensitivity:read", "device:read", "weapon:read", "category:read", "category:update", "tag:read", "tag:update", "media:read", "media:update"),
    ],
  },
  tournament_manager: {
    name: "Tournament Manager",
    permissions: [
      "dashboard:read",
      ...all("tournament"),
      ...all("room"),
      "player:read",
      ...pick("game:read", "media:read", "media:create", "media:update", "article:read", "article:create", "article:update", "category:read", "tag:read", "report:read", "report:update"),
    ],
  },
  /**
   * AI assistants (Claude / ChatGPT via MCP). Research → create/edit drafts → submit for review.
   * Can add images to the media library (upload_media) but not edit or delete existing media.
   * No publish, verify, delete, settings, legal, people or inbox (personal data) by default.
   * Give an AI agent a custom role if you deliberately want it to publish.
   */
  ai_agent: {
    name: "AI agent",
    permissions: [
      "dashboard:read",
      ...pick(
        "tournament:read", "tournament:create", "tournament:update",
        "sensitivity:read", "sensitivity:create", "sensitivity:update",
        "sensitivity_code:read", "sensitivity_code:update",
        "device:read", "device:create", "device:update",
        "weapon:read", "weapon:create", "weapon:update",
        "scope:read", "game:read",
        "article:read", "article:create", "article:update",
        "category:read", "tag:read", "tag:create",
        "media:read", "media:create", "seo:read", "seo:update", "redirect:read",
      ),
    ],
  },
  /**
   * Opt-in AI role for owners who want the assistant to finish the job: everything "AI agent" can do, plus
   * approve / publish / schedule / unpublish / archive / restore content. Still no delete, verify, settings,
   * legal, people, inbox or Play (the agent ceiling below strips those regardless).
   */
  ai_publisher: {
    name: "AI agent (publisher)",
    permissions: [
      "dashboard:read",
      ...pick(
        "tournament:read", "tournament:create", "tournament:update", "tournament:publish",
        "sensitivity:read", "sensitivity:create", "sensitivity:update", "sensitivity:publish",
        "sensitivity_code:read", "sensitivity_code:update",
        "device:read", "device:create", "device:update", "device:publish",
        "weapon:read", "weapon:create", "weapon:update", "weapon:publish",
        "scope:read", "game:read",
        "article:read", "article:create", "article:update", "article:publish",
        "category:read", "tag:read", "tag:create",
        "media:read", "media:create", "seo:read", "seo:update", "redirect:read",
      ),
    ],
  },
  content_writer: {
    name: "Content Writer",
    permissions: [
      "dashboard:read",
      ...pick(
        "article:read",
        "article:create",
        "article:update", // own articles only — enforced in the service
        "sensitivity:read",
        "sensitivity:create",
        "sensitivity:update",
        "device:read",
        "weapon:read",
        "scope:read",
        "game:read",
        "category:read",
        "tag:read",
        "tag:create",
        "media:read",
        "media:create",
        "media:update",
      ),
    ],
  },
};

/**
 * Hard ceiling for AI agent accounts, applied to every agent session regardless of its role:
 * no people, roles, settings, legal, audit, cache or AI management; no inbox (personal data);
 * nothing destructive. Publishing stays possible only if a Super Admin deliberately gives an
 * agent a role with publish permission.
 */
export function agentPermissionFilter(p: string): boolean {
  const [mod, action] = p.split(":");
  if (["admin", "role", "audit", "settings", "legal", "cache", "ai", "feedback", "enquiry", "report", "privacy_request", "ad", "affiliate", "player", "room", "reward", "redemption"].includes(mod!)) return false;
  return action !== "delete";
}
