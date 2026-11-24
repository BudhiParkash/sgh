# 01 — Technical Architecture

## 1. System context

```
                         ┌──────────────────────────── Cloudflare ────────────────────────────┐
  Visitors (India,       │  DNS · TLS edge · CDN cache · WAF · Bot fight · Rate rules         │
  mostly mobile) ───────▶│  shivanshigaming.<tld>            media.shivanshigaming.<tld>     │
                         └───────────────┬───────────────────────────────┬────────────────────┘
                                         │ (origin TLS, CF-only IPs)      │
                                ┌────────▼─────────┐                ┌─────▼──────┐
                                │   Nginx (EC2)     │                │  AWS S3    │
                                │  /        → :3000 │                │  media     │
                                │  /api/v1  → :4000 │                │  bucket    │
                                └──┬─────────────┬──┘                └─────▲──────┘
                                   │             │                         │ PutObject (server)
                     ┌─────────────▼───┐   ┌─────▼──────────────┐          │
                     │ Next.js (PM2)   │   │ Express API (PM2)  │──────────┘
                     │ SSR/ISR, admin  │──▶│ REST /api/v1       │
                     │ UI, OG/PNG cards│   │ auth · RBAC · CMS  │
                     └─────────────────┘   └──┬──────────┬──────┘
                              ▲ revalidate      │          │
                              │ webhook         │          │
                     ┌────────┴────────┐   ┌───▼────┐ ┌───▼──────────────┐
                     │ Worker (PM2)    │◀─▶│ Redis  │ │ MongoDB Atlas    │
                     │ BullMQ: publish │   │ cache, │ │ (ap-south-1, M10+│
                     │ schedule, image │   │ rate,  │ │  for backups)    │
                     │ processing, mail│   │ session│ └──────────────────┘
                     └─────────────────┘   └────────┘
```

Future: the **Android app (Kotlin)** goes straight to `/api/v1` with bearer tokens. It shares the services, but has its own auth strategy and routes under `/api/v1/app/*`.

## 2. Layers and responsibilities

| Layer | Responsibility | Must NOT do |
|---|---|---|
| Next.js Server Components | Fetch published content from the API and render SEO-complete HTML | Talk to MongoDB directly |
| Next.js Client Components | Interactivity: finder, filters, 3D, admin forms | Hold secrets; fetch admin data without a session cookie |
| Express routes → controllers | HTTP parsing, call the validator, call the service, format the response | Business rules, DB queries |
| Services | Business rules (verification gates, workflow transitions, audit) | Know about `req`/`res` |
| Repositories | Mongoose queries, aggregations, pagination | Business rules |
| Models | Schema, indexes, hooks (slug, timestamps) | Cross-model orchestration |
| Worker | Scheduled publishing, image derivatives, emails, sitemap pings | Serve HTTP |

## 3. Key technical decisions and reasoning

### 3.1 Why Express + separate Next.js instead of Next.js API routes only
The brief needs a backend shared with a future Android app, plus queues and rate limiting. That backend also has to scale and deploy independently. Next.js route handlers would couple API releases to UI releases. Express keeps the API a stable product with its own OpenAPI contract.

### 3.2 Why same-origin proxying
- Admin cookies stay `SameSite=Strict`, `HttpOnly` and `Secure` on one origin, so no CORS credential handling is needed.
- Cloudflare caches public GET API responses selectively. Admin paths are bypassed.
- CORS stays as an allowlist, and is only relevant for Android/web previews.

### 3.3 Sessions vs JWT for admin
Admin is a small, high-privilege group, so revocation matters more than statelessness:
- Session ID: 256-bit random value in a cookie. Redis holds `{adminId, roleVersion, ip-hash, ua-hash, createdAt, lastSeen}`.
- Idle timeout 30 min, absolute timeout 12 h (configurable). The session is rotated on login and on privilege change.
- "Log out all sessions" and forced logout on role change come almost for free.

### 3.4 Rendering strategy per route

| Route | Strategy | Revalidation |
|---|---|---|
| `/` | ISR | tags: `home`, `tournaments`, `articles`, `sensitivity` |
| `/tournaments`, `/tournaments/[slug]` | ISR | tag `tournament:<id>` + a time fallback (1 h) so status changes like Upcoming→Ongoing are recomputed |
| `/sensitivity/**` | ISR | tag `sensitivity:<id>`, `device:<id>` |
| `/news/**`, `/guides/**` | ISR | tag `article:<id>`, `category:<id>` |
| `/search` | SSR (dynamic), `noindex` | — |
| Legal pages | ISR | tag `legal:<slug>` |
| `/admin/**` | Client-rendered behind an auth check, `noindex`, no 3D bundle | — |

Tournament status is **derived** at read time from dates *and* the stored verification state. "Ongoing" is never shown for an unconfirmed event.

### 3.5 Caching layers
1. Cloudflare edge: HTML (respecting `s-maxage` from Next), static assets (immutable), media.
2. Next.js data cache: tagged fetches.
3. Redis: hot API responses (lists, finder lookups) with a short TTL, invalidated by key prefix on write.
4. MongoDB indexes.

Invalidation flow on publish: service → Redis prefix purge → POST `/api/revalidate` (HMAC-signed) on Next → Next revalidates tags → optional Cloudflare purge-by-URL via API.

### 3.6 Sensitivity data model rationale
BGMI sensitivity is **scope-based**: one value per scope per category (Camera, ADS, Gyro, ADS-Gyro). Gun guides therefore *reference* a base config and add weapon-specific notes (recoil pattern, recommended attachments, scope). They never invent "M416 sensitivity" numbers that aren't tied to a scope config. This keeps the content honest and avoids thin duplicate pages.

Finder resolution order:
1. Exact match: device + fps + gyro + playstyle, published.
2. Same device, nearest fps/playstyle (the page says so).
3. Device class baseline: refresh-rate tier, screen size bucket, chipset tier. Labelled "Baseline — not tested on this exact device".
4. No result → empty state with "Request this device" (feedback form).

### 3.7 Search
Phase 1 uses MongoDB text indexes (weighted title > tags > description) over articles, tournaments, devices and configs, plus Atlas Search if the cluster tier allows (better relevance and autocomplete). It sits behind a `SearchService` interface so the engine can be swapped later.

### 3.8 Images and media
- Admin upload goes to Express (multer memory, max 8 MB). We sniff magic bytes with `file-type` and accept only JPEG/PNG/WebP/AVIF.
- Then `sharp` strips EXIF, re-encodes, and produces AVIF/WebP plus the original at widths 320/640/960/1280/1920.
- Files go to S3 under `media/<yyyy>/<mm>/<uuid>/<w>.<ext>`.
- They're served via `media.<domain>`, with Cloudflare proxying to an S3 bucket named `media.<domain>`. Public ACLs stay blocked. The bucket policy allows `GetObject` only on the `public/` prefix, and only from Cloudflare's published IP ranges. Originals and unpublished downloads live under `private/` and are only ever read by the backend. Details are in [11](11-aws-deployment.md).
- `next/image` uses a custom loader pointing to the pre-generated widths, so the server doesn't optimise on every request.

### 3.9 Why not a headless CMS (Strapi/Sanity)
The brief requires custom RBAC roles, a verification workflow, audit logs and domain-specific editors (the sensitivity grid). A custom admin is more work, but it avoids fighting a CMS's model and its licensing and hosting. The Tiptap editor covers the rich-text needs.

## 4. Environments

| Env | Frontend | API | DB | Notes |
|---|---|---|---|---|
| local | `localhost:3000` | `localhost:4000` | Docker Mongo + Redis (docker-compose) | seed script with fictional demo data clearly flagged `isDemo` |
| staging | `staging.<domain>` (CF Access protected) | same EC2 or small instance | Atlas staging cluster | `noindex` header globally |
| production | `<domain>` | `<domain>/api/v1` | Atlas prod cluster | |

The config is read from env vars and validated at boot with Zod (`backend/src/config/env.ts`); the process refuses to start if any are missing.

## 5. Future readiness (designed now, not built)
- API namespaces: `/api/v1/public/*` (anonymous), `/api/v1/admin/*` (session), `/api/v1/app/*` (reserved for player bearer tokens).
- `shared/` enums already include future statuses, but they're not exposed.
- Collections `players`, `squads`, `matches`, `match_registrations`, `leaderboards`, `match_results`, `player_statistics` are only *documented* in [03](03-database-schema.md#future-models-not-implemented).
- Before player accounts launch: verifiable parental consent for under-18 users (DPDP §9), an account deletion endpoint plus a web deletion URL (Google Play requirement), and data export.
