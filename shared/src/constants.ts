export const SITE_NAME = "Shivanshi Gaming Hub";
export const SITE_SHORT_NAME = "SGH";
/** All dates are stored in UTC and displayed in this zone. */
export const DISPLAY_TIMEZONE = "Asia/Kolkata";

export const INDEPENDENCE_DISCLAIMER =
  "Shivanshi Gaming Hub is an independent fan-made gaming information and community platform. It is not affiliated with, endorsed by, or sponsored by KRAFTON or Tencent Games unless expressly stated.";

export const LIMITS = {
  slugMax: 120,
  titleMax: 140,
  seoTitleMax: 60,
  seoDescriptionMax: 160,
  excerptMax: 300,
  messageMax: 1000,
  uploadBytesMax: 8 * 1024 * 1024,
  pageSizePublicMax: 50,
  pageSizeAdminMax: 100,
} as const;

export const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

/**
 * Allowed in-game slider ranges per sensitivity category (BGMI / PUBG Mobile).
 * Verify against the current game version before launch; adjust here only.
 */
export const SENSITIVITY_RANGES = {
  camera: { min: 1, max: 300 },
  ads: { min: 1, max: 300 },
  gyro: { min: 1, max: 400 },
  ads_gyro: { min: 1, max: 400 },
} as const;

export const SCOPE_LABELS = {
  tpp_no_scope: "3rd person, no scope",
  fpp_no_scope: "1st person, no scope",
  red_dot: "Red dot",
  holo: "Holographic",
  x2: "2× scope",
  x3: "3× scope",
  x4: "4× scope / VSS",
  x6: "6× scope",
  x8: "8× scope",
} as const;

export const CATEGORY_LABELS = {
  camera: "Camera (free look)",
  ads: "ADS (aim down sights)",
  gyro: "Gyroscope",
  ads_gyro: "ADS gyroscope",
} as const;

/** Explanation length (words) below which a configuration page is published as noindex (thin content guard). */
export const MIN_INDEXABLE_WORDS = 150;
