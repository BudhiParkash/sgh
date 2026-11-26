# Shivanshi Gaming Hub — Architecture Package (Phase 1 / Step 0)

Status: **DRAFT — awaiting owner approval. No application code has been written.**
Prepared: 2026-11-23

| # | Document | Covers (brief §28 item) |
|---|----------|-------------------------|
| 01 | [Technical architecture](01-technical-architecture.md) | 1, key decisions & reasoning |
| 02 | [Folder structure](02-folder-structure.md) | 2, 3 |
| 03 | [MongoDB schema design](03-database-schema.md) | 4 |
| 04 | [API specification](04-api-specification.md) | 5 |
| 05 | [Admin dashboard](05-admin-dashboard.md) | 6 |
| 06 | [Homepage & responsive plan](06-homepage-and-responsive.md) | 7, 8 |
| 07 | [3D & animation architecture](07-3d-and-animation.md) | 9, 10 |
| 08 | [SEO & GEO strategy](08-seo-geo.md) | 11 |
| 09 | [India legal & privacy checklist](09-legal-privacy.md) | 12 |
| 10 | [Security architecture](10-security.md) | 13 |
| 11 | [AWS deployment architecture](11-aws-deployment.md) | 14 |
| 12 | [Milestones & effort](12-milestones.md) | 15 |
| 13 | [Missing information & open decisions](13-missing-information.md) | — |
| 14 | [MCP server for AI assistants](14-mcp-server.md) | — |
| 15 | [Play: player accounts, squads, custom rooms, SGC coins, rewards](15-play.md) | — |

## The ten decisions that shape everything

1. **Monorepo with pnpm workspaces and Turborepo.** `frontend/` (Next.js) and `backend/` (Express) are independent deployables. `shared/` holds the Zod schemas, TS types and enums both sides import, so a validation rule is written once.
2. **Same-origin API through Nginx.** `shivanshigaming.<tld>/api/v1/*` is proxied to Express, which avoids cross-site cookies, CORS preflights for the admin and third-party-cookie problems. The future Android app calls the same `/api/v1` with bearer tokens.
3. **Admin auth uses opaque server-side sessions in Redis, not JWT.** Sessions can be revoked instantly and carry no secrets on the client. JWT access/refresh tokens are reserved for future *player* accounts on Android.
4. **Rendering: ISR plus on-demand revalidation.** Public pages are statically generated and revalidated by tag when the admin publishes. The backend calls a signed Next.js revalidate webhook. This gives fast TTFB, full server-rendered HTML for SEO/GEO, and no rebuild needed to publish.
5. **Scheduled publishing uses a BullMQ worker**, run as its own PM2 process on Redis. A job flips the status at the scheduled UTC time and triggers revalidation.
6. **3D is progressive enhancement.** Every 3D slot renders a static poster (SVG/AVIF) first; that poster or the headline is the LCP element. The canvas mounts after idle, only when a capability check passes. Scenes are mostly procedural geometry (no copyrighted models, tiny payloads).
7. **Sensitivity is data, not text.** Configurations are structured documents (scope × category values). The finder, the comparison tool, the PNG cards and the device and gun pages all derive from that one source. Each config carries a provenance label (`tested`, `community-submitted`, `baseline`) so nothing is presented as tested when it isn't.
8. **PNG sensitivity cards are rendered server-side with `next/og` (Satori)**, cached at the CDN and keyed by config version. There's no client canvas hack, and branding stays consistent.
9. **Rich text is Tiptap JSON stored in Mongo**, rendered to sanitized HTML on the server. That's safer than storing raw HTML and makes internal-link validation possible.
10. **Region `ap-south-1` (Mumbai)** for EC2, S3 and Atlas, which keeps latency low for Indian users and keeps data in India. That isn't legally mandated today, but it's a sensible default.

## How we proceed
1. You review these documents and answer [13-missing-information.md](13-missing-information.md).
2. On approval, we scaffold Milestone M1 (repo, tooling, design tokens) and report at the end of each phase using the format in brief §26.
