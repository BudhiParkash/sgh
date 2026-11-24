# 04 — API Specification (REST, `/api/v1`)

The OpenAPI 3.1 document is generated from the shared Zod schemas (`@asteasolutions/zod-to-openapi`). Swagger UI is served at `/api/v1/docs`, but only in non-production environments, or behind an admin session in production.

## Conventions

**Envelope**
```jsonc
// success
{ "success": true, "data": { ... } | [ ... ], "meta": { "page": 1, "limit": 20, "total": 143, "totalPages": 8 } }
// error
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Human-readable, safe", "details": [{ "path": "email", "message": "Invalid email" }], "requestId": "01J..." } }
```
- Error codes: `VALIDATION_ERROR` 400, `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409 (slug taken, stale version), `PAYLOAD_TOO_LARGE` 413, `UNSUPPORTED_MEDIA` 415, `RATE_LIMITED` 429, `INTERNAL` 500. A 500 never includes a stack or the original message.
- Pagination: `?page=&limit=` (limit ≤ 50 public, ≤ 100 admin). Cursor pagination is available on the large admin lists (`?cursor=`).
- Sorting: `?sort=-publishedAt` against a per-endpoint allowlist.
- Dates: ISO-8601 UTC in and out.
- Optimistic concurrency: admin `PATCH` sends `If-Match: <__v>` and gets `409` on a stale write, so two editors can't overwrite each other.
- Public GETs return `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`, plus `ETag`.
- Every response carries an `X-Request-Id` header.

## Public endpoints (anonymous)

Only `workflow.status = published` (with `publishAt ≤ now`) is ever returned.

| Method | Path | Query / Body | Notes |
|---|---|---|---|
| GET | `/tournaments` | `status, game, eligibility, from, to, q, featured, page, limit, sort` | |
| GET | `/tournaments/calendar` | `month=YYYY-MM` | compact list for the calendar |
| GET | `/tournaments/:slug` | | includes sources, verification, related (same game/organiser) |
| GET | `/sensitivity` | `device, brand, fps, gyroscope, playstyle, provenance, page` | |
| GET | `/sensitivity/find` | `device (slug) \| brand+model, fps, gyroscope, playstyle` | returns `{ match: 'exact'|'nearest'|'baseline'|'none', config, alternatives[] }` |
| GET | `/sensitivity/compare` | `a=<slug>&b=<slug>` | returns aligned values plus per-scope deltas |
| GET | `/sensitivity/codes` | `device, fps, gyroscope, page` | verified only |
| GET | `/sensitivity/:slug` | | |
| GET | `/devices` | `brand, q, hasConfigs, page` | |
| GET | `/devices/brands` | | brand list with counts of published configs |
| GET | `/devices/:slug` | | device plus its configs |
| GET | `/weapons`, `/weapons/:slug` | | |
| GET | `/scopes` | | |
| GET | `/articles` | `category, tag, type, q, page, limit` | |
| GET | `/articles/:slug` | | includes related articles and the breadcrumb chain |
| GET | `/categories`, `/tags/:slug` | | |
| GET | `/search` | `q (2–80 chars), type?, page` | grouped results |
| GET | `/settings` | | public subset only (site name, socials, disclaimer, contact if provided) |
| GET | `/legal/:slug` | | the current version, plus `?version=` for history |
| GET | `/ads/placements` | `page (path)` | active, in-window slots for a page; no targeting PII |
| GET | `/go/:slug` | | affiliate redirect (302), `rel=sponsored` on the link side, counter increment |
| GET | `/sitemap-data/:type` | `type=articles|tournaments|sensitivity|devices` | slug plus `updatedAt` for sitemap generation |
| POST | `/feedback` | `FeedbackInput` | rate limited; honeypot plus Turnstile |
| POST | `/contact` | `ContactInput` | rate limited; Turnstile; consent required |
| POST | `/reports` | `ReportInput` | returns `ticketNo`; sends an acknowledgement email (if email is configured) |
| POST | `/sensitivity/codes/submit` | `CodeSubmission` | goes to `pending`; never auto-published |
| POST | `/privacy-requests` | `PrivacyRequestInput` | email verification step before processing |
| GET | `/health` | | `{status, version}`; no dependency details publicly |

## Admin endpoints (session cookie + CSRF header + permission)

Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/admin/auth/login` | `{email, password}` → returns `{ requires2fa }` or sets the session |
| POST | `/admin/auth/2fa/verify` | `{code}` |
| POST | `/admin/auth/logout` | destroys the session |
| POST | `/admin/auth/logout-all` | |
| GET | `/admin/auth/me` | profile, role, permissions, CSRF token |
| POST | `/admin/auth/password` | change; requires the current password |
| POST | `/admin/auth/2fa/setup` · `/2fa/enable` · `/2fa/disable` | |
| POST | `/admin/auth/password-reset/request` · `/confirm` | single-use token, 30 min, emailed |

Dashboard
| GET | `/admin/dashboard` | real counts: published/draft/scheduled per module, pending verifications, open reports with SLA breaches, new feedback/enquiries, tournaments needing re-verification (lastVerifiedAt > N days), recent audit entries |

**Generic CRUD pattern** for each resource `R` ∈ {`tournaments`, `tournament-sources`, `sensitivity`, `sensitivity-codes`, `devices`, `weapons`, `scopes`, `games`, `articles`, `categories`, `tags`, `media`, `ads`, `affiliates`, `legal`, `redirects`, `admins`, `roles`}:

| Method | Path | Permission |
|---|---|---|
| GET | `/admin/R` | `R:read` — `q, status, filters, page, sort` |
| GET | `/admin/R/:id` | `R:read` |
| POST | `/admin/R` | `R:create` |
| PATCH | `/admin/R/:id` | `R:update` (+ `If-Match`) |
| DELETE | `/admin/R/:id` | `R:delete` (soft delete; `?hard=true` Super Admin only) |
| POST | `/admin/R/:id/workflow` | `{ action: submit|approve|reject|schedule|publish|unpublish|archive, publishAt?, note? }` → the permission depends on the action |
| GET | `/admin/R/:id/revisions` · POST `/:id/revisions/:rev/restore` | where revisions exist |
| GET | `/admin/R/:id/preview-token` | short-lived signed token → Next draft mode preview |

Resource-specific
| Method | Path | Notes |
|---|---|---|
| POST | `/admin/tournaments/:id/verify` | `{ notes, confidence, sourceIds[] }` → sets `verification`; required before confirmed |
| PATCH | `/admin/tournaments/:id/status` | goes through the service rules |
| POST | `/admin/sensitivity/:id/duplicate` | clone as a draft (e.g. for another FPS) |
| POST | `/admin/sensitivity-codes/:id/verify` · `/reject` | |
| POST | `/admin/media/upload` | multipart, single file, ≤ 8 MB; returns the Media doc after processing |
| PATCH | `/admin/media/:id` | alt, caption, licence |
| POST | `/admin/media/:id/replace` | keeps the id and references; new variants |
| GET | `/admin/media/unused` | |
| GET/PATCH | `/admin/settings` | Admin+ |
| GET/PATCH | `/admin/feedback/:id`, `/admin/enquiries/:id`, `/admin/reports/:id` | status, notes, assignment |
| GET/PATCH | `/admin/privacy-requests/:id` | |
| GET | `/admin/audit-logs` | `actor, entityType, entityId, action, from, to` |
| POST | `/admin/cache/purge` | `{ tags[] }` Admin+ |
| GET | `/admin/seo/overview` | missing meta, noindex pages, duplicate titles, broken internal links |

## Rate limits (Redis sliding window, keyed by IP plus route)
| Route | Limit |
|---|---|
| Public GET | 120/min/IP (Cloudflare handles bursts first) |
| POST feedback/contact/reports/codes | 5/10 min/IP, 20/day/IP |
| `/admin/auth/login` | 5/15 min per IP+email, then a progressive account lock (15 min → 1 h → admin unlock) |
| Admin API | 300/min/session |

## Future `/api/v1/app/*` (Android, not built)
`POST /app/auth/*` (OTP or Google sign-in → JWT access 15 min + rotating refresh token), `GET/PATCH /app/me`, `DELETE /app/me` (account deletion), `/app/squads`, `/app/matches`, `/app/matches/:id/room` (gated release). Versioned separately if breaking changes come up (`/api/v2`).
