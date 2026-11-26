import {
  BarChart3, Crosshair, FileText, FolderTree, Gauge, Image as ImageIcon, Inbox, KeyRound, LayoutDashboard, Link2, Megaphone,
  Bot, Gamepad2, Gift, Ticket, UsersRound, MessageSquare, Scale, ScrollText, Search, Settings, ShieldAlert, Smartphone, Sword, Tags, Trophy, UserCog, Users, Code2, Lock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  perm: string;
  icon: LucideIcon;
}

export const ADMIN_NAV: { group: string; items: NavItem[] }[] = [
  { group: "Overview", items: [{ href: "/admin", label: "Dashboard", perm: "dashboard:read", icon: LayoutDashboard }] },
  {
    group: "Content",
    items: [
      { href: "/admin/tournaments", label: "Tournaments", perm: "tournament:read", icon: Trophy },
      { href: "/admin/sensitivity", label: "Sensitivity", perm: "sensitivity:read", icon: Gauge },
      { href: "/admin/sensitivity-codes", label: "Share codes", perm: "sensitivity_code:read", icon: Code2 },
      { href: "/admin/devices", label: "Devices", perm: "device:read", icon: Smartphone },
      { href: "/admin/weapons", label: "Weapons", perm: "weapon:read", icon: Sword },
      { href: "/admin/scopes", label: "Scopes", perm: "scope:read", icon: Crosshair },
      { href: "/admin/articles", label: "Articles", perm: "article:read", icon: FileText },
      { href: "/admin/categories", label: "Categories", perm: "category:read", icon: FolderTree },
      { href: "/admin/tags", label: "Tags", perm: "tag:read", icon: Tags },
      { href: "/admin/media", label: "Media library", perm: "media:read", icon: ImageIcon },
    ],
  },
  {
    group: "Play",
    items: [
      { href: "/admin/rooms", label: "Custom rooms", perm: "room:read", icon: Gamepad2 },
      { href: "/admin/players", label: "Players", perm: "player:read", icon: UsersRound },
      { href: "/admin/redemptions", label: "Redemptions", perm: "redemption:read", icon: Ticket },
      { href: "/admin/rewards", label: "Rewards store", perm: "reward:read", icon: Gift },
    ],
  },
  {
    group: "Growth",
    items: [
      { href: "/admin/seo", label: "SEO", perm: "seo:read", icon: Search },
      { href: "/admin/redirects", label: "Redirects", perm: "redirect:read", icon: Link2 },
      { href: "/admin/ads", label: "Advertisements", perm: "ad:read", icon: Megaphone },
      { href: "/admin/affiliates", label: "Affiliate links", perm: "affiliate:read", icon: BarChart3 },
    ],
  },
  {
    group: "Inbox",
    items: [
      { href: "/admin/feedback", label: "Feedback", perm: "feedback:read", icon: MessageSquare },
      { href: "/admin/enquiries", label: "Contact enquiries", perm: "enquiry:read", icon: Inbox },
      { href: "/admin/reports", label: "Content reports", perm: "report:read", icon: ShieldAlert },
      { href: "/admin/privacy-requests", label: "Privacy requests", perm: "privacy_request:read", icon: Lock },
    ],
  },
  {
    group: "System",
    items: [
      { href: "/admin/legal", label: "Legal pages", perm: "legal:read", icon: Scale },
      { href: "/admin/users", label: "Users", perm: "admin:read", icon: Users },
      { href: "/admin/roles", label: "Roles", perm: "role:read", icon: KeyRound },
      { href: "/admin/ai-agents", label: "AI agents", perm: "ai:manage", icon: Bot },
      { href: "/admin/audit", label: "Audit log", perm: "audit:read", icon: ScrollText },
      { href: "/admin/settings", label: "Settings", perm: "settings:read", icon: Settings },
      { href: "/admin/account", label: "My account", perm: "dashboard:read", icon: UserCog },
    ],
  },
];
