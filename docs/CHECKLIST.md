# Development Checklist

Legend: [x] done & tested · [ ] to do · (M#) milestone

## M1 — Foundation ✅ (2026-11-23)
- [x] Monorepo: pnpm workspaces + Turborepo, strict TS base config, Prettier, EditorConfig, .nvmrc
- [x] `@sgh/shared`: enums (games, statuses, scopes, provenance, roles…), constants, common Zod schemas, API envelope types — unit tested
- [x] Brand: original logo mark (colour + mono), horizontal lockup, brand guide
- [x] Design tokens (colour, type scale, spacing, radius, shadow, motion, breakpoints) in CSS variables → Tailwind v4 theme
- [x] Fonts via next/font (Inter, Space Grotesk, JetBrains Mono) — self-hosted, swap
- [x] UI kit: Button, Card, Badge, Input/Textarea/Select/Field, Dialog, Sheet, Tabs, Skeleton, EmptyState, ErrorState, Container/Section, Breadcrumbs
- [x] Layout: sticky glass Header (hide-on-scroll), mobile sheet menu, Footer with all legal links + disclaimer, skip link
- [x] Homepage hero shell (brief copy + CTAs), 404, error boundary, web manifest, favicon
- [x] Baseline security headers; non-production `X-Robots-Tag: noindex`
- [x] Tests: Vitest (unit), Playwright — no horizontal overflow at 320/360/390/414/480/768/1024/1440/1920, axe WCAG 2.1 AA, mobile menu, touch targets ≥ 44px, footer legal links

## M2 — Homepage & 3D ✅
- [x] Data-driven homepage: hero, featured tournaments (3D trophy), sensitivity finder (3D phone), popular devices, gun guides, news, guides, community, resources — sections hide or show honest empty states without data
- [x] 3D system: capability tiers (none/low/medium/high), SceneGate (idle + in-view mount, unmount off-screen, error/context-loss → poster), shared SceneCanvas (adaptive DPR, pause when hidden), procedural original geometry, SVG posters, "Reduce 3D effects" visitor switch
- [x] Animation: CSS-first hero entrance (no LCP delay), progressive scroll reveals (visible without JS), GSAP ScrollTrigger parallax, Lenis (desktop pointer only), Motion page transitions (no hidden first paint)
- [x] Tests: render-tier unit tests, empty states with API down, no-JS visibility, reduced-motion poster, 3D mount on desktop, CLS < 0.05, axe with and without 3D

## M3 — Backend foundation ✅
- [x] Express 5 + TS, Zod env validation (fail fast), pino logs with redaction, request ids, Helmet/CSP, CORS allowlist, origin guard, NoSQL-operator/prototype-pollution guard, body limits, central error handler (no internals leaked)
- [x] Auth: Argon2id (@node-rs/argon2), Redis sessions (`__Host-` cookie, HttpOnly, SameSite=Strict, idle+absolute expiry, rotation, logout-all), CSRF synchronizer token, login rate limits + progressive account lockout, timing-equalised errors
- [x] 2FA: RFC 6238 TOTP (own implementation, test-vector verified), AES-256-GCM secret at rest, replay protection, 10 single-use recovery codes, mandatory for Super Admin/Admin
- [x] RBAC permission catalogue + default role matrix; append-only audit log; OpenAPI 3.1 at /api/v1/docs (non-prod)
- [x] Tests: 28 integration tests on real MongoDB + Redis

## M4 — Admin dashboard & CMS core ✅
- [x] Generic CRUD/workflow engine: draft→review→approved→scheduled→published→archived, publish checks, optimistic concurrency (If-Match), soft delete/trash/restore, revisions (last 50) with restore, signed preview tokens, tag cache + Next.js revalidation webhook (HMAC + timestamp)
- [x] Media library: magic-byte sniffing, SVG/polyglot rejection, sharp re-encode (EXIF stripped), AVIF/WebP/JPEG responsive variants, S3 or local storage, duplicate detection, usage tracking, in-use delete guard, replace-in-place
- [x] Categories (8 seeded), tags, redirects (+public list), website settings (owner-provided values seeded; legal identity left empty), users (temp passwords, unlock, force sign-out, reset 2FA/password, last-Super-Admin guard), custom roles, real-data dashboard
- [x] Admin UI: login + 2FA step, mandatory 2FA enrolment, permission-filtered shell (mobile drawer), config-driven list/editor (tabs, validation, server field errors, unsaved-changes guard, conflict banner, workflow panel, schedule, preview, revisions), media library, users, roles, settings, audit log, account
- [x] Tests: 47 backend tests; 9 admin E2E tests against a disposable real stack (login → TOTP enrolment → CRUD → upload → settings → audit → a11y → mobile → sign-out)

## M5 — Tournament Hub ✅
- [x] Games (seeded), tournaments with embedded official sources, verification records (who/when/confidence), rules: confirmed/ongoing/completed need an official source + verification; rumours never auto-advance; date sanity; payment-wording warnings (no real-money events); prize shown only if verified; reserved slugs; automatic 301 on published slug change
- [x] Public: hub + upcoming/ongoing/completed/cancelled/rumours pages (filters, crawlable pagination, filtered views noindex), IST month calendar (agenda on mobile), detail page (key facts, sources, verification, related, report link), Event JSON-LD only for verified events (never `offers`), draft preview
- [x] Admin: tournament editor (tabs, sources repeater) + verification panel; dashboard attention (stale verification, published rumours)
- [x] Fixed during M5: PATCH no longer resets defaulted fields (engine-wide); revalidation uses `{ expire: 0 }` so corrections show immediately; definition-list a11y

## M6 — Sensitivity Hub ✅
- [x] Scopes (seeded), gun guides, devices (derived device class), setups (range-validated 9×4 grid, provenance rules, thin-content noindex under 150 words, values version for card cache), share-code library with moderation (community submissions, honeypot, rate limit)
- [x] Finder: exact → nearest (same phone) → device-class baseline → none, each labelled honestly; compare with per-scope deltas
- [x] Public: hub + finder result, setup page (all values in server HTML, provenance banner, share code copy, Article JSON-LD), downloadable 1080×1350 PNG card (next/og, watermark + URL), devices/brand/device pages (3D showcase), gun guides (scope-based explanation), compare (works without JS), codes library + submit form
- [x] Admin: grid editor (paste from spreadsheet, copy columns, gyro-aware), device/gun/setup/scope/code resources, code review panel
- [x] Tests: 70 backend, 61 E2E (full flows incl. finder and moderation)

## M7 — News & Guides CMS ✅
- [x] Articles (news/guide/tutorial/review), Tiptap editor (headings, links, images from the library, YouTube no-cookie), auto table of contents, word count, sources, FAQ (FAQPage JSON-LD), sponsored and affiliate disclosures, revisions, writer→editor review, scheduled publishing worker (BullMQ), category redirects, search, tag/author pages

## M8 — Legal & privacy ✅
- [x] 10 legal drafts (accurate to the implementation, tokens from Settings, version history, production publish guard: counsel review + no placeholders)
- [x] Consent banner (equal choices, Consent Mode v2, GA4 only after consent), contact / report (ticket + 24 h / 15 day SLA + emails) / privacy requests (email-verified, export, erasure), feedback (helpful share only with 20+ answers), retention sweep, Turnstile-ready, honeypots, CSP

## Retention features ✅ (owner request 2026-11-24, replaces M10 for now)
- [x] Save setups / follow tournaments on the visitor's device (no account) + "My saved" page + header badge
- [x] Live countdowns, calendar reminders (.ics with a 1-day alarm, Google Calendar)
- [x] Installable app (PWA): icons, manifest shortcuts, offline for visited pages, install button / iOS hint
- [x] Sharing: native share sheet, WhatsApp, copy link

## AI automation — MCP server ✅ (owner request 2026-11-24)
- [x] MCP server at `/mcp` (Streamable HTTP) with OAuth 2.1 (dynamic registration, PKCE, admin consent) for claude.ai / ChatGPT, and personal tokens for Claude Code
- [x] Tools for every content type (schema-driven from the API's own Zod schemas), publish checks, review submission, preview links, prompts and editorial guidelines
- [x] AI agent service accounts: no password login, drafts only, hard permission ceiling, no inbox/personal data, full audit trail
- [x] Admin → AI agents page (agents, tokens, connected assistants), Nginx + dev routing, 4 API tests

## M9 — SEO / GEO ✅
- [x] Sitemap index + 5 sitemaps (indexable only), robots (staging blocked), managed 301/302/410 redirects in the proxy, llms.txt, Organization/WebSite JSON-LD, verification tags from Settings, web vitals → GA4 (consented), IndexNow, admin SEO audit (duplicates, thin pages, broken links, missing meta)

## M10 — Advertising ⏸ deferred by owner (data model + settings already in place)

## M11 — QA ✅ (see docs/QA-REPORT.md)

## M12 — Launch preparation ✅ (execution needs owner accounts — infrastructure/runbooks/go-live.md)
- [x] Nginx (Cloudflare-only origin, AOP, HSTS, upload limits), PM2 (API cluster, worker, web), server bootstrap, zero-downtime deploy with automatic rollback, rollback script, Cloudflare IP refresh, config backups
- [x] GitHub Actions: CI (lint, types, unit, API, audit, E2E, Lighthouse budgets), deploy (OIDC → S3 artifact → SSM, staging on main, production on tag with approval, cache purge, smoke test)
- [x] IAM / bucket policy templates, production env templates, go-live runbook, operations guide

## Before going live (owner)
- [ ] Grievance Officer postal address, court jurisdiction, retention periods → Admin → Settings
- [ ] Legal counsel review → publish the 10 legal pages
- [ ] Accounts: AWS, MongoDB Atlas, Cloudflare, GitHub (follow go-live.md)
- [ ] Real content: tested setups, devices, gun guides, verified tournaments, articles
- [ ] OWASP ZAP baseline on staging; spot-check on a real Android phone and an iPhone
