import { RESOURCES } from "@/lib/admin/resources";

/** Dedicated (non-generic) admin pages that exist. */
const STATIC_PAGES = new Set(["/admin", "/admin/media", "/admin/users", "/admin/roles", "/admin/audit", "/admin/settings", "/admin/account", "/admin/seo", "/admin/ai-agents", "/admin/rooms", "/admin/players", "/admin/rewards", "/admin/redemptions"]);

/** Only show navigation entries whose page is implemented. */
export function isAvailable(href: string): boolean {
  if (STATIC_PAGES.has(href)) return true;
  const key = href.replace(/^\/admin\//, "");
  return key in RESOURCES;
}

export function addStaticPage(href: string) {
  STATIC_PAGES.add(href);
}
