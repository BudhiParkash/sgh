# 10 — Security Architecture

Threat model (top risks): admin account takeover → defacement or malicious content; stored XSS via rich text or SVG; NoSQL injection; form spam and abuse; upload-based attacks; secrets leakage; DDoS on the origin; supply-chain compromise of npm deps.

## 1. Edge & network
- Cloudflare proxy on all hostnames; **origin locked**: the EC2 security group allows 80/443 **only from Cloudflare IP ranges** (auto-updated script) and SSH only via **AWS SSM Session Manager** (no port 22 open).
- Cloudflare: Full (strict) TLS with an origin certificate, HSTS (`max-age=31536000; includeSubDomains; preload` after a stabilisation period), WAF managed rules, rate-limiting rules on `/api/v1/*` POSTs and `/admin/auth/*`, Bot Fight Mode, and Cloudflare Access (SSO/OTP) in front of `/admin` and staging as a **second layer** in addition to app auth.
- Nginx: `real_ip_header CF-Connecting-IP`, `client_max_body_size 10m` (admin upload) / `100k` elsewhere, timeouts, `server_tokens off`.
- MongoDB Atlas: IP access list = the EC2 Elastic IP only (or VPC peering/PrivateLink on a higher tier), TLS required, a separate DB user per environment with least-privilege custom roles (app user cannot drop collections or modify `audit_logs`).
- Redis: bound to localhost / private subnet, `requirepass`/ACL, not exposed.

## 2. Application (Express)
| Control | Implementation |
|---|---|
| Headers | `helmet()` with a strict CSP on the API (JSON only); Next sets the site CSP with a per-request **nonce** (scripts: self, nonce, GA/GAM domains only when consented), `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, mic, geolocation off) |
| CORS | allowlist from env; credentials only for the same origin; no wildcard |
| Input validation | Zod on body, query and params for **every** route (shared schemas), unknown keys stripped, length caps |
| NoSQL injection | reject keys starting with `$` or containing `.` (custom sanitize middleware; `express-mongo-sanitize` is unmaintained on Express 5), Mongoose `strictQuery`, never pass raw query objects to `find` |
| XSS | Tiptap JSON → server render → `sanitize-html` allowlist (no `style`, no `on*`, `href` protocol allowlist, `rel="noopener noreferrer"` + `ugc` for external). Plain-text fields are escaped by React. SVG uploads are **rejected** |
| CSRF | admin cookie `SameSite=Strict` **plus** a synchronizer token (`X-CSRF-Token` from `/auth/me`) on state-changing requests; Origin header check |
| Auth | Argon2id; 12+ char passwords, checked against a breached-password list (k-anonymity HIBP API or a local top-100k list); TOTP 2FA **mandatory for Super Admin and Admin**, optional for others (configurable); generic login errors; progressive lockout; login/2FA attempts written to the audit log |
| Sessions | opaque 256-bit IDs, Redis-stored, `HttpOnly; Secure; SameSite=Strict; Path=/; __Host-` prefix; rotate on login and privilege change; idle and absolute timeouts; logout-all |
| Authorization | `authorize('article:publish')` middleware **plus** service-level checks (ownership for Writers); deny-by-default route registration test |
| Mass assignment | DTOs from Zod; services pick allowed fields; `role`, `workflow.status` and `createdBy` can never be set via generic PATCH |
| Uploads | single file, 8 MB cap, magic-byte sniff (`file-type`), allowlist JPEG/PNG/WebP/AVIF, `sharp` re-encode (destroys polyglots and EXIF), random UUID keys, never a user-supplied filename in the path, served from a separate hostname (`media.`) with `Content-Disposition` for downloads and `X-Content-Type-Options: nosniff` |
| Open redirect | `/go/:slug` only resolves DB entries; all admin-entered URLs are https-only, with optional domain allowlist warnings |
| SSRF | the server never fetches arbitrary admin-supplied URLs (no link preview fetcher in Phase 1) |
| Rate limiting | Redis-backed (see doc 04) + Cloudflare rules |
| Spam | Cloudflare Turnstile + honeypot + minimum fill time on public forms |
| Errors | central `errorHandler`: logs full detail with the requestId and returns a safe message; `NODE_ENV=production` never leaks stacks |
| Logging | `pino` JSON logs with redaction (`password`, `token`, `cookie`, `authorization`, email in non-audit logs); request logs with hashed IPs; shipped to CloudWatch Logs |
| Monitoring | Sentry (frontend + backend) with PII scrubbing; uptime checks (Cloudflare health checks or UptimeRobot) on `/api/v1/health` and `/` |

## 3. Secrets & config
- No secrets in the repo; `.env.example` holds names only. Pre-commit `gitleaks` scan; GitHub secret scanning enabled.
- Production secrets live in **AWS SSM Parameter Store (SecureString)** or Secrets Manager. The EC2 instance role reads them at deploy time and writes a root-owned `0600` env file. No long-lived AWS keys exist on the server (the instance profile is used for S3 too).
- Rotation runbook for: DB password, session secret, revalidate HMAC secret, TOTP encryption key (key versioning supported), Cloudflare API token (scoped to purge + DNS for this zone only).

## 4. Supply chain & CI
- `pnpm` with a lockfile, `pnpm audit` + GitHub Dependabot, `--frozen-lockfile` in CI, pinned GitHub Actions by SHA, minimal-permission `GITHUB_TOKEN`.
- CodeQL / Semgrep on PRs; OWASP ZAP baseline scan against staging before each production release.

## 5. Environments separation
Separate Atlas projects (dev/staging/prod), separate S3 buckets, separate Cloudflare hostnames, separate secrets. Staging is behind Cloudflare Access and `noindex`. Production data is **never** copied to dev; seed scripts produce clearly-labelled demo data.

## 6. Backups & recovery
- Atlas continuous backup (PITR) + snapshots; monthly restore drill into staging.
- S3: versioning enabled, lifecycle rules for old versions, cross-region replication optional (cost decision).
- Infra as documented runbooks + scripts; target RPO ≤ 1 h, RTO ≤ 4 h (to be confirmed).
