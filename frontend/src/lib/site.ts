import { INDEPENDENCE_DISCLAIMER, SITE_NAME } from "@sgh/shared";

export const siteConfig = {
  name: SITE_NAME,
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://shivanshigaming.com",
  owner: "Shivanshi Tripathi",
  description:
    "Your ultimate destination for BGMI tournaments, sensitivity setups and mobile gaming intelligence.",
  disclaimer: INDEPENDENCE_DISCLAIMER,
  /** Public contact — provided by the owner on 2026-11-23. */
  contact: {
    name: "Budhi Parkash",
    email: "budhiparkash00@gmail.com",
  },
  /**
   * Grievance Officer (IT Rules 2021). Name/email provided; postal address still required
   * before the Grievance Redressal page can be published (placeholder guard, M8).
   */
  grievanceOfficer: {
    name: "Budhi Parkash",
    email: "budhiparkash00@gmail.com",
    address: "",
  },
  /**
   * Official social profiles. Empty entries are not rendered anywhere (no placeholder links).
   * Order here = display order in the footer.
   */
  socials: {
    youtube: "https://www.youtube.com/@ShivanshiGamings",
    instagram: "https://www.instagram.com/shivanshigaming/",
    instagramChannel: "https://www.instagram.com/channel/7zFYFMVALxg8FyMh/",
    facebook: "https://www.facebook.com/profile.php?id=61583809210977",
    discord: "",
    telegram: "",
    x: "",
  },
} as const;

export const socialLabels: Record<keyof typeof siteConfig.socials, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  instagramChannel: "Instagram Channel",
  facebook: "Facebook",
  discord: "Discord",
  telegram: "Telegram",
  x: "X (Twitter)",
};

export interface NavItem {
  label: string;
  href: string;
  /** false = only in the mobile menu (the logo already links home; Contact is in the footer). */
  desktop?: boolean;
}

export const mainNav: NavItem[] = [
  { label: "Home", href: "/", desktop: false },
  { label: "Tournaments", href: "/tournaments" },
  { label: "Custom Rooms", href: "/custom-rooms" },
  { label: "Rewards", href: "/rewards" },
  { label: "Sensitivity", href: "/sensitivity" },
  { label: "Gaming Guides", href: "/guides" },
  { label: "News", href: "/news" },
  { label: "About", href: "/about" },
  { label: "Contact Us", href: "/contact", desktop: false },
];

export const footerNav: { title: string; items: NavItem[] }[] = [
  {
    title: "Explore",
    items: [
      { label: "My saved", href: "/saved" },
      { label: "Tournaments", href: "/tournaments" },
  { label: "Custom Rooms", href: "/custom-rooms" },
  { label: "Rewards", href: "/rewards" },
      { label: "Sensitivity Finder", href: "/sensitivity" },
      { label: "Gaming Guides", href: "/guides" },
      { label: "News", href: "/news" },
      { label: "Resources", href: "/resources" },
    ],
  },
  {
    title: "Legal",
    items: [
      { label: "Privacy Policy", href: "/legal/privacy-policy" },
      { label: "Terms and Conditions", href: "/legal/terms" },
      { label: "Disclaimer", href: "/legal/disclaimer" },
      { label: "Cookie Policy", href: "/legal/cookie-policy" },
      { label: "Copyright Policy", href: "/legal/copyright" },
      { label: "Advertising Disclosure", href: "/legal/advertising-disclosure" },
      { label: "Affiliate Disclosure", href: "/legal/affiliate-disclosure" },
      { label: "Community Guidelines", href: "/legal/community-guidelines" },
    ],
  },
  {
    title: "Support",
    items: [
      { label: "About Shivanshi Gaming Hub", href: "/about" },
      { label: "Contact Us", href: "/contact" },
      { label: "Grievance Redressal", href: "/legal/grievance" },
      { label: "Report Content", href: "/report" },
    ],
  },
];
