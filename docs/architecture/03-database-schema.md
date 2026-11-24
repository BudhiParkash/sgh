# 03 — MongoDB Schema Design (Mongoose)

Conventions applied to every collection:
- `timestamps: true` → `createdAt`, `updatedAt` (UTC). Display conversion to `Asia/Kolkata` happens only in the UI.
- `createdBy`, `updatedBy`: `ObjectId → Admin` on every admin-managed document.
- Soft delete via `deletedAt` (null = live) on content collections. A partial index ensures live slugs are unique. Hard delete is reserved for Super Admin plus the retention sweeper.
- Slugs: lowercase, `^[a-z0-9]+(?:-[a-z0-9]+)*$`, max 120 characters, with a unique partial index `{ slug: 1 }` where `deletedAt: null`.
- Content workflow field `workflow` (shared): `draft → review → approved → scheduled → published → archived`. It comes with `publishAt` (UTC), `publishedAt`, `archivedAt`, `reviewedBy` and `approvedBy`.
- Reusable `seo` subdocument: `{ title(≤60), description(≤160), canonicalUrl?, robots: { index: bool, follow: bool }, ogImage?: ObjectId→Media }`.
- All `enum` values come from `@sgh/shared/enums` so the API, the admin forms and the DB agree.

---

## 1. Identity & access

### `admins`
| Field | Type | Notes |
|---|---|---|
| name | String, req | |
| email | String, req, lowercase | unique index |
| passwordHash | String, req, `select:false` | Argon2id (m=19 MiB, t=2, p=1 minimum, per OWASP) |
| role | ObjectId→Role, req | single role per admin, which keeps reasoning simple |
| status | enum `active, suspended, invited` | |
| twoFactor | `{ enabled, secretEnc (AES-256-GCM, select:false), recoveryCodeHashes[] }` | TOTP |
| failedLoginCount, lockedUntil | Number, Date | progressive lockout |
| lastLoginAt, lastLoginIpHash | Date, String | IP stored as a salted hash |
| passwordChangedAt | Date | invalidates older sessions |

### `roles`
`{ key (unique: super_admin|admin|editor|seo_manager|tournament_manager|content_writer|custom-*), name, permissions: [String], isSystem: Boolean, version: Number }`
The permissions are strings like `tournament:create`, `tournament:publish` and `article:publish`, which keeps them flexible without a join. The `permissions` collection from the brief is a **seeded read-only catalogue** (`{ key, module, description }`) that the role editor uses. Bumping `roles.version` forces affected sessions to re-check.

Default matrix (summary):

| Permission group | Super | Admin | Editor | SEO Mgr | Tourn. Mgr | Writer |
|---|---|---|---|---|---|---|
| users/roles manage | ✓ | – | – | – | – | – |
| settings, ads, affiliates | ✓ | ✓ | – | – | – | – |
| tournaments CRUD / verify / publish | ✓ | ✓ | – | – | ✓ | – |
| sensitivity/devices/weapons/scopes CRUD / publish | ✓ | ✓ | ✓ | – | – | draft only |
| articles create/edit own | ✓ | ✓ | ✓ | – | ✓ (tournament category) | ✓ |
| articles review/approve/publish | ✓ | ✓ | ✓ | – | – | – |
| SEO fields, redirects, sitemaps | ✓ | ✓ | ✓ | ✓ | – | – |
| legal pages | ✓ | ✓ | – | – | – | – |
| feedback / enquiries / reports | ✓ | ✓ | ✓ | – | ✓ (tournament reports) | – |
| audit log read | ✓ | ✓ | – | – | – | – |

### `audit_logs` (append-only)
`{ actor: ObjectId→Admin|null, actorRole, action ('tournament.publish'), entityType, entityId, before?: Mixed (diff), after?: Mixed (diff), ipHash, userAgent, requestId, at }`
Indexes: `{ entityType:1, entityId:1, at:-1 }`, `{ actor:1, at:-1 }`, `{ at:-1 }`. The app DB user has no `update/delete` on this collection (via a custom Atlas role). Retention is a TBD, owner/legal decision. Nothing else is stored here — passwords and secrets are redacted before the diff.

---

## 2. Gaming reference data

### `games`
`{ name ('BGMI'), slug, publisher (text, e.g. 'KRAFTON' — factual reference only), platforms[], isActive }`

### `mobile_devices`
| Field | Notes |
|---|---|
| brand (String, indexed), model, slug (unique) | e.g. `iqoo`, `neo-9-pro` |
| releaseYear | |
| chipset, ramOptions[] | factual specs, entered by an admin with `specSourceUrl` |
| displayRefreshRateHz, touchSamplingRateHz?, screenSizeInches | |
| supportedFps: [Number] | the max BGMI FPS options *verified* for the device (e.g. 60, 90, 120) — `fpsSourceUrl`, `fpsVerifiedAt` |
| gyroscope: Boolean | |
| deviceClass | derived `{ refreshTier, screenBucket, perfTier }` used for baseline fallback |
| image?: ObjectId→Media | original or licensed render only |
| seo, workflow | |
Indexes: `{brand:1, model:1}` unique, text `{brand, model}`.

### `weapons`
`{ game:→Game, name ('M416'), slug, type (AR|SMG|DMR|SR|SG|LMG|Pistol), ammo, recommendedScopes:[→Scope], recoilNotes (rich text), attachmentNotes, image?, seo, workflow }`

### `scopes`
`{ key (tpp_no_scope|fpp_no_scope|red_dot|holo|x2|x3|x4|x6|x8), label, order, categoriesApplicable: [camera|ads|gyro|ads_gyro] }` — seeded, editable labels only.

---

## 3. Sensitivity

### `sensitivity_configs`
| Field | Type / Notes |
|---|---|
| title, slug | e.g. "iQOO Neo 9 Pro — 90 FPS Gyro (Balanced)" |
| game | →Game |
| device | →MobileDevice, **nullable** (null = class baseline) |
| deviceClass | used when `device` is null |
| fps | Number (enum from shared: 30/40/60/90/120) |
| gyroscope | `off | scope_on | always_on` |
| playstyle | `rush | balanced | sniper` |
| values | `{ camera: ScopeValues, ads: ScopeValues, gyro?: ScopeValues, adsGyro?: ScopeValues }` where `ScopeValues = { tpp_no_scope, fpp_no_scope, red_dot, holo, x2, x3, x4, x6, x8 }` — each Number in 0–400 (gyro) / 0–300 (camera/ads); the exact ranges go in shared constants and are verified against the current game version |
| freeLook? | `{ tppCam, fppCam, ... }` optional |
| gameVersion | String — the BGMI version this was tested on |
| provenance | `tested | community_submitted | baseline` (**shown publicly**) |
| testing | `{ testedBy: String (display name), testedAt: Date, deviceUsed?: String, method: rich text, notes }` — required when provenance = `tested` |
| shareCode? | →SensitivityCode |
| explanation | rich text: why these values, how to tune — the unique content that makes the page worth indexing |
| version | Number, incremented on value change (cache key for the PNG card) |
| seo, workflow | |
Indexes: `{device:1, fps:1, gyroscope:1, playstyle:1, 'workflow.status':1}` (the finder query), `{deviceClass.refreshTier:1, fps:1, gyroscope:1, playstyle:1}`, unique slug.
History: `sensitivity_config_revisions` `{ configId, version, values, changedBy, at }`.

### `sensitivity_codes` (Code Library)
`{ code (String, unique, format-validated), device?:→MobileDevice, fps, gyroscope, testedAt, author (display name), authorType: staff|community, description, gameVersion, status: pending|verified|rejected|expired, verifiedBy?, verifiedAt? }`
Only `verified` codes are public. Codes can stop working after game updates, so `gameVersion` is shown along with an "expired" state.

### `feedback`
`{ targetType: sensitivity_config|tournament|article|site, targetId?, rating?: 1–5, helpful?: Boolean, message (≤1000, sanitized), contactEmail? (optional, only if the user wants a reply — consent flag stored), consentAt?, status: new|reviewed|actioned|spam, ipHash, uaHash, createdAt }`
Aggregates (e.g. "% found helpful") are shown **only** above a minimum sample (e.g. n ≥ 20) and labelled as visitor feedback, not testing. The sample counts are never fabricated or seeded.

---

## 4. Tournaments

### `tournaments`
| Field | Notes |
|---|---|
| name, slug, game→Game, organiser (String) , organiserUrl? | |
| description | rich text |
| startDate, endDate, registrationDeadline | Date (UTC), each nullable — never filled without a source |
| prizePool | `{ amount?: Number, currency: 'INR', display?: String, verified: Boolean }` — shown only when `verified` |
| eligibility | `{ minAge?, region?, tierText?, deviceRules?, notes }` |
| format | rich text / structured `{ teamSize, stages[] }` |
| registrationUrl, officialSourceUrl | `officialSourceUrl` **required**; `https` only; domain allowlist warning in admin |
| featuredImage | →Media |
| status | `rumour | confirmed | ongoing | completed | cancelled` (stored) |
| verification | `{ lastVerifiedAt, verifiedBy:→Admin, notes, confidence: low|medium|high }` |
| sources | [→TournamentSource] |
| isFeatured | Boolean |
| seo, workflow | |
Business rules enforced in `TournamentService`:
- `confirmed | ongoing | completed` require ≥1 source with `type: official` and `lastVerifiedAt` set.
- `ongoing` and `completed` are suggested automatically from the dates, but they're applied only if the event is already confirmed.
- No field may hold entry-fee or payment data. There are no such fields, and the description is scanned for payment keywords as a warning.
Indexes: `{status:1, startDate:1}`, `{game:1, status:1, startDate:-1}`, `{isFeatured:1, 'workflow.status':1}`, text `{name:10, organiser:5, description:1}`.

### `tournament_sources`
`{ tournament:→Tournament, url, type: official|organiser_social|news|community, title, publisher, accessedAt, archivedUrl? (web.archive.org), notes }`

---

## 5. Content

### `articles` (GamingArticle)
| Field | Notes |
|---|---|
| title, slug, excerpt (≤300) | |
| content | `{ json: TiptapJSON, html: String (server-rendered, sanitized), wordCount, readingMinutes, headings[] (for ToC), internalLinks[] }` |
| featuredImage, ogImage | →Media |
| author | →Admin (public author profile fields on Admin: `displayName, bio, avatar, socials` — opt-in) |
| category | →Category |
| tags | [→Tag] |
| type | `news | guide | tutorial | review` → drives `NewsArticle` vs `Article` schema |
| sources | [{ title, url }] — shown at the bottom (GEO) |
| faq | [{ question, answer }] — only real questions |
| sponsored | `{ isSponsored, sponsorName?, disclosureText? }` |
| hasAffiliateLinks | Boolean (auto-detected from AffiliateLink usage) → shows the disclosure |
| seo, workflow | |
Revisions: `article_revisions { articleId, revision#, title, content.json, editedBy, at, note }` — kept for the last N=50 per article.
Indexes: unique slug, `{'workflow.status':1, publishedAt:-1}`, `{category:1, publishedAt:-1}`, `{tags:1, publishedAt:-1}`, text `{title:10, excerpt:4, 'content.html':1}`.

### `categories`
`{ name, slug, description, parent?:→Category, kind: news|guide, order, seo }` — seeded with the 8 categories from the brief.

### `tags`
`{ name, slug, description? }` — a tag page is indexed only when it has ≥ N published articles (configurable), which avoids thin pages.

### `media`
`{ key (S3 base key), originalFilename, mime, sizeBytes, width, height, variants: [{ width, format, key, sizeBytes }], alt (req for images), caption?, credit?, licence: original|licensed|press_kit|user_submitted, licenceNotes, category, usageRefs: [{ entityType, entityId }], uploadedBy, checksumSha256 }`
`usageRefs` is kept up to date by services, and it drives the "unused media" list and the delete guard.

### `legal_pages`
`{ slug (privacy-policy|terms|cookie-policy|disclaimer|copyright|grievance|community-guidelines|advertising-disclosure|affiliate-disclosure|content-reporting), title, content, version, effectiveDate, changeSummary, reviewedByCounsel: Boolean, workflow }` with `legal_page_versions` holding the history (needed to show past versions on request).

---

## 6. Inbound (visitor-submitted)

### `contact_enquiries`
`{ name, email, subject (enum: general|advertising|partnership|correction|privacy|other), message, consentAt, status: new|in_progress|closed, assignedTo?, notes[], ipHash }`

### `reports` (content reports, takedown and grievance)
`{ ticketNo (human readable, e.g. SGH-2026-000123), type: copyright|inaccurate|offensive|privacy|impersonation|other, targetUrl, description, reporterName, reporterEmail, isRightsHolder?, evidenceUrls[], status: received|acknowledged|under_review|resolved|rejected, acknowledgedAt, resolvedAt, slaDueAt, resolutionNote, handledBy }`
SLA timers follow the grievance timelines in [09](09-legal-privacy.md).

### `privacy_requests`
`{ ticketNo, type: access|correction|erasure|grievance|nominate, email, verifiedAt?, status, dueAt, notes }`

---

## 7. Monetisation & settings

### `advertisements`
`{ name, type: gam_slot|direct_banner|sponsor, placement: home_top|home_mid|tournament_list|tournament_detail|sensitivity|article_inline|sidebar|footer, gam?: { adUnitPath, sizes[][], sizeMapping }, creative?: →Media, destinationUrl? (https, allowlisted), sponsorName?, label: 'Advertisement'|'Sponsored', startAt, endAt, isEnabled, priority, pages?: [glob] }`
Index `{placement:1, isEnabled:1, startAt:1, endAt:1}`.

### `affiliate_links`
`{ slug (/go/<slug>), destinationUrl, merchant, productName, network?, disclosureText?, isActive, clickCount (aggregate counter only — no per-user tracking) }`

### `website_settings` (singleton, `key: 'global'`)
`{ siteName, tagline, contact: { email?, phone? }, grievanceOfficer: { name?, email?, address? }, company: { legalName?, cin?, gstin?, registeredAddress? }, socials: { youtube?, instagram?, discord?, telegram?, x? }, analytics: { ga4Id?, gscVerification?, bingVerification? }, ads: { gamNetworkCode?, enabled }, disclaimerText, maintenanceMode }`
Every optional legal-identity field renders a visible **"[To be provided]"** placeholder in staging, and **blocks production publishing of legal pages** until filled. That's the deliberate guard against invented details.

### `redirects`
`{ from (path, unique), to, code: 301|302|410, hits, createdBy }` — managed in the SEO module and applied in Next middleware (cached list).

---

## Future models (NOT implemented in Phase 1)
Documented only, so today's choices don't block them:
- `players` `{ authProviders, displayName, bgmiId (verified flag), dob/ageBand, guardianConsent{...}, status, deletionRequestedAt }`
- `squads` `{ name, captain→Player, members[], inviteCodes }`
- `matches` `{ type: custom_room, game, map (text), scheduledAt, roomCredentials (encrypted, released at T-x min to checked-in only), status }`
- `match_registrations` `{ match, squad|player, checkInAt, status }`
- `match_results` `{ match, placements[], kills[], evidence[], verifiedBy }`
- `leaderboards` (materialised by aggregation) and `player_statistics`.
Constraint already in place: no wallet, balance, fee or payout fields exist anywhere, and adding them would require an explicit owner and legal approval.

## Backups & retention
- Atlas cloud backups (M10+): continuous plus daily snapshots with point-in-time restore. Retention is to be decided (suggestion: 7 days PITR, 4 weekly, 3 monthly). Restores are tested quarterly per the runbook.
- Retention for personal data (enquiries, feedback emails, reports, IP hashes, logs) is **set by the owner with counsel**. The TTL indexes are configurable from settings. Nothing is hard-coded until then.
