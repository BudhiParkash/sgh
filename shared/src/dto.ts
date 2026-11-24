/**
 * Public API data-transfer objects (what /api/v1 public endpoints return).
 * The backend maps Mongoose documents to these; the website and future Android app consume them.
 * Dates are ISO-8601 UTC strings.
 */
import type {
  ArticleType,
  FpsOption,
  GameKey,
  GyroMode,
  Playstyle,
  Provenance,
  ScopeKey,
  SensitivityCategory,
  SourceType,
  TournamentStatus,
} from "./enums";

export interface MediaRef {
  url: string;
  alt: string;
  width: number;
  height: number;
}

export interface GameRef {
  key: GameKey;
  name: string;
}

export interface TournamentSummary {
  id: string;
  slug: string;
  name: string;
  game: GameRef;
  organiser: string;
  status: TournamentStatus;
  startDate: string | null;
  endDate: string | null;
  registrationDeadline: string | null;
  /** Only present when verified. */
  prizePool: { amount: number | null; currency: "INR"; display: string | null } | null;
  eligibilitySummary: string | null;
  registrationUrl: string | null;
  officialSourceUrl: string;
  lastVerifiedAt: string | null;
  featuredImage: MediaRef | null;
  isFeatured: boolean;
}

export interface TournamentSourceDto {
  id: string;
  url: string;
  type: SourceType;
  title: string;
  publisher: string;
  accessedAt: string;
}

export interface TournamentDetail extends TournamentSummary {
  descriptionHtml: string;
  formatHtml: string | null;
  eligibility: { minAge: number | null; region: string | null; notes: string | null };
  verification: { lastVerifiedAt: string | null; notes: string | null; confidence: "low" | "medium" | "high" | null };
  sources: TournamentSourceDto[];
  related: TournamentSummary[];
  seo: SeoDto;
  updatedAt: string;
}

export interface DeviceSummary {
  id: string;
  slug: string;
  brand: string;
  brandSlug: string;
  model: string;
  supportedFps: number[];
  gyroscope: boolean;
  configCount: number;
  image: MediaRef | null;
}

export interface DeviceDetail extends DeviceSummary {
  releaseYear: number | null;
  chipset: string | null;
  displayRefreshRateHz: number | null;
  screenSizeInches: number | null;
  specSourceUrl: string | null;
  fpsSourceUrl: string | null;
  configs: SensitivitySummary[];
  seo: SeoDto;
  updatedAt: string;
}

export interface BrandSummary {
  brand: string;
  brandSlug: string;
  deviceCount: number;
  configCount: number;
}

export interface WeaponSummary {
  id: string;
  slug: string;
  name: string;
  type: string;
  game: GameRef;
  image: MediaRef | null;
}

export interface WeaponDetail extends WeaponSummary {
  ammo: string | null;
  recoilNotesHtml: string;
  attachmentNotesHtml: string | null;
  recommendedScopes: { key: ScopeKey; label: string }[];
  seo: SeoDto;
  updatedAt: string;
}

export type ScopeValues = Record<ScopeKey, number | null>;
export type SensitivityValues = Partial<Record<SensitivityCategory, ScopeValues>>;

export interface SensitivitySummary {
  id: string;
  slug: string;
  title: string;
  game: GameRef;
  device: { slug: string; brand: string; brandSlug: string; model: string } | null;
  fps: FpsOption;
  gyroscope: GyroMode;
  playstyle: Playstyle;
  provenance: Provenance;
  gameVersion: string | null;
  testedAt: string | null;
  version: number;
  updatedAt: string;
}

export interface SensitivityDetail extends SensitivitySummary {
  values: SensitivityValues;
  explanationHtml: string;
  testing: { testedBy: string | null; testedAt: string | null; deviceUsed: string | null; methodHtml: string | null; notes: string | null } | null;
  shareCode: string | null;
  seo: SeoDto;
}

export interface SensitivityFindResult {
  match: "exact" | "nearest" | "baseline" | "none";
  config: SensitivityDetail | null;
  alternatives: SensitivitySummary[];
}

export interface SensitivityCodeDto {
  id: string;
  code: string;
  device: { slug: string; brand: string; brandSlug: string; model: string } | null;
  fps: FpsOption;
  gyroscope: GyroMode;
  testedAt: string;
  author: string;
  description: string;
  gameVersion: string | null;
}

export interface ArticleSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  type: ArticleType;
  category: { slug: string; name: string; kind: "news" | "guide" };
  featuredImage: MediaRef | null;
  author: { name: string; slug: string | null };
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
  isSponsored: boolean;
}

export interface ArticleDetail extends ArticleSummary {
  contentHtml: string;
  headings: { id: string; text: string; level: 2 | 3 }[];
  tags: { slug: string; name: string }[];
  sources: { title: string; url: string }[];
  faq: { question: string; answer: string }[];
  sponsor: { name: string; disclosureText: string | null } | null;
  hasAffiliateLinks: boolean;
  related: ArticleSummary[];
  seo: SeoDto;
}

export interface CategoryDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  kind: "news" | "guide";
  articleCount: number;
}

export interface ResourceSummary {
  id: string;
  title: string;
  description: string;
  href: string;
  kind: "sensitivity_card" | "download" | "guide";
  image: MediaRef | null;
}

export interface SeoDto {
  title: string | null;
  description: string | null;
  canonicalUrl: string | null;
  robots: { index: boolean; follow: boolean };
  ogImage: MediaRef | null;
}

export interface HomeData {
  featuredTournaments: TournamentSummary[];
  popularDevices: DeviceSummary[];
  brands: BrandSummary[];
  weapons: WeaponSummary[];
  latestNews: ArticleSummary[];
  latestGuides: ArticleSummary[];
  resources: ResourceSummary[];
}

export interface LegalPageDto {
  slug: string;
  title: string;
  contentHtml: string;
  version: number;
  effectiveDate: string | null;
  updatedAt: string;
}

export interface PublicSettings {
  siteName: string;
  contactEmail: string | null;
  socials: Record<string, string>;
  disclaimer: string;
}

export interface AdPlacementDto {
  id: string;
  placement: string;
  type: "gam_slot" | "direct_banner" | "sponsor";
  label: "Advertisement" | "Sponsored";
  gam: { adUnitPath: string; sizes: [number, number][] } | null;
  creative: MediaRef | null;
  destinationUrl: string | null;
  sponsorName: string | null;
}

export interface SearchResults {
  query: string;
  tournaments: TournamentSummary[];
  articles: ArticleSummary[];
  devices: DeviceSummary[];
  sensitivity: SensitivitySummary[];
}
