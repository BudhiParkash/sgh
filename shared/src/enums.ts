/**
 * Canonical enums shared by the frontend, backend and (future) Android API contract.
 * Changing a value here is a breaking change: add new values, never rename existing ones.
 */
export const GAMES = ["bgmi", "pubg-mobile"] as const;
export type GameKey = (typeof GAMES)[number];

export const TOURNAMENT_STATUSES = ["rumour", "confirmed", "ongoing", "completed", "cancelled"] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];
/** Statuses that require at least one official source and a verification record. */
export const VERIFIED_TOURNAMENT_STATUSES: readonly TournamentStatus[] = ["confirmed", "ongoing", "completed"];

export const WORKFLOW_STATUSES = ["draft", "review", "approved", "scheduled", "published", "archived"] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const SOURCE_TYPES = ["official", "organiser_social", "news", "community"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SCOPE_KEYS = [
  "tpp_no_scope",
  "fpp_no_scope",
  "red_dot",
  "holo",
  "x2",
  "x3",
  "x4",
  "x6",
  "x8",
] as const;
export type ScopeKey = (typeof SCOPE_KEYS)[number];

export const SENSITIVITY_CATEGORIES = ["camera", "ads", "gyro", "ads_gyro"] as const;
export type SensitivityCategory = (typeof SENSITIVITY_CATEGORIES)[number];

export const GYRO_MODES = ["off", "scope_on", "always_on"] as const;
export type GyroMode = (typeof GYRO_MODES)[number];

export const PLAYSTYLES = ["rush", "balanced", "sniper"] as const;
export type Playstyle = (typeof PLAYSTYLES)[number];

export const FPS_OPTIONS = [30, 40, 60, 90, 120] as const;
export type FpsOption = (typeof FPS_OPTIONS)[number];

/** Shown publicly on every configuration. */
export const PROVENANCES = ["tested", "community_submitted", "baseline"] as const;
export type Provenance = (typeof PROVENANCES)[number];

export const ARTICLE_TYPES = ["news", "guide", "tutorial", "review"] as const;
export type ArticleType = (typeof ARTICLE_TYPES)[number];

export const ROLES = [
  "super_admin",
  "admin",
  "editor",
  "seo_manager",
  "tournament_manager",
  "content_writer",
  "ai_agent",
] as const;
export type RoleKey = (typeof ROLES)[number];

export const REPORT_TYPES = ["copyright", "inaccurate", "offensive", "privacy", "impersonation", "other"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const CONTACT_SUBJECTS = ["general", "advertising", "partnership", "correction", "privacy", "other"] as const;
export type ContactSubject = (typeof CONTACT_SUBJECTS)[number];
