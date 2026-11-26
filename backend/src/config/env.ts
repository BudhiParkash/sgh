import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SITE_ENV: z.enum(["local", "staging", "production"]).default("local"),
  PORT: z.coerce.number().int().default(4000),
  SITE_URL: z.string().url().default("http://localhost:3000"),
  /** Comma-separated origins allowed for CORS / Origin checks. */
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://127.0.0.1:6379"),
  /** ≥32 chars. Used for hashing IPs/UAs (HMAC) — never stored raw. */
  HASH_SECRET: z.string().min(32),
  /** 32-byte key, base64. Encrypts TOTP secrets at rest (AES-256-GCM). */
  ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "ENCRYPTION_KEY must be 32 bytes, base64-encoded"),
  /** HMAC secret shared with Next.js for on-demand revalidation. */
  REVALIDATE_SECRET: z.string().min(32),
  REVALIDATE_URL: z.string().url().default("http://localhost:3000/api/revalidate"),
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).default(30),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).default(12),
  /** Roles that must enable TOTP before using the admin. */
  ADMIN_2FA_REQUIRED_ROLES: z.string().default("super_admin,admin"),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  API_DOCS_ENABLED: bool.optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  // Storage (M4)
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default("ap-south-1"),
  S3_ENDPOINT: z.string().url().optional(),
  MEDIA_PUBLIC_BASE_URL: z.string().url().optional(),
  // Email (M4+). If unset, emails are logged instead of sent (dev).
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default("Shivanshi Gaming Hub <no-reply@shivanshigaming.com>"),
  /** IndexNow key (Bing/Yandex instant indexing). When unset, no pings are sent. */
  INDEXNOW_KEY: z.string().regex(/^[a-zA-Z0-9-]{8,128}$/).optional(),
  /** Google OAuth client id (Web) for player sign-in. When unset, player sign-in is disabled. */
  GOOGLE_CLIENT_ID: z.string().regex(/^[\w-]+\.apps\.googleusercontent\.com$/, "Must be a Google OAuth Web client id").optional(),
  /** Cloudflare Turnstile secret. When unset (dev/test), the bot check is skipped. */
  TURNSTILE_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    // Fail fast: never boot with incomplete configuration.
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = load();
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
export const corsOrigins = env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
export const required2faRoles = env.ADMIN_2FA_REQUIRED_ROLES.split(",").map((s) => s.trim()).filter(Boolean);
export const apiDocsEnabled = env.API_DOCS_ENABLED ?? env.SITE_ENV !== "production";
