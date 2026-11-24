# 02 — Repository & Folder Structure

## Root

```
shivanshi-gaming-hub/
├── frontend/                 # Next.js (App Router) — public site + /admin
├── backend/                  # Express API + worker
├── shared/                   # @sgh/shared — Zod schemas, types, enums, constants
├── docs/                     # architecture, API (generated OpenAPI), DB, runbooks, checklist
├── infrastructure/           # nginx, pm2, scripts, GitHub Actions, docker-compose (local)
├── .github/workflows/        # ci.yml, deploy-staging.yml, deploy-prod.yml
├── package.json              # pnpm workspaces root
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .editorconfig  .nvmrc  .gitignore  .env.example (no secrets)
```

## Frontend (`frontend/`)

```
frontend/
├── public/
│   ├── fonts/                         # self-hosted subsets (if not next/font/google)
│   ├── posters/                       # static fallbacks for every 3D scene (AVIF + SVG)
│   ├── models/                        # Draco-compressed GLB (original assets only)
│   ├── llms.txt
│   └── favicon / manifest icons
├── src/
│   ├── app/
│   │   ├── (site)/                    # public route group — shared Header/Footer layout
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx               # Home
│   │   │   ├── tournaments/
│   │   │   │   ├── page.tsx           # listing + filters (searchParams)
│   │   │   │   ├── calendar/page.tsx
│   │   │   │   └── [slug]/page.tsx
│   │   │   ├── sensitivity/
│   │   │   │   ├── page.tsx           # hub + finder
│   │   │   │   ├── compare/page.tsx
│   │   │   │   ├── codes/page.tsx
│   │   │   │   ├── devices/[brand]/page.tsx
│   │   │   │   ├── devices/[brand]/[model]/page.tsx
│   │   │   │   ├── guns/[weapon]/page.tsx
│   │   │   │   ├── [slug]/page.tsx    # single configuration
│   │   │   │   └── [slug]/card.png/route.tsx   # next/og PNG card
│   │   │   ├── news/ [category]/ [slug]/
│   │   │   ├── guides/ [category]/ [slug]/
│   │   │   ├── resources/page.tsx
│   │   │   ├── search/page.tsx
│   │   │   ├── about/ contact/ report/
│   │   │   └── legal/[slug]/page.tsx  # privacy, terms, cookies, disclaimer, ...
│   │   ├── admin/                     # separate layout, no site chrome, noindex
│   │   │   ├── login/page.tsx
│   │   │   ├── (protected)/layout.tsx # session guard + sidebar
│   │   │   ├── (protected)/page.tsx   # dashboard
│   │   │   ├── (protected)/tournaments/ sensitivity/ devices/ weapons/ scopes/
│   │   │   ├── (protected)/articles/ categories/ tags/ media/ seo/ ads/ affiliates/
│   │   │   ├── (protected)/feedback/ enquiries/ reports/ legal/ users/ audit/ settings/
│   │   ├── api/revalidate/route.ts    # HMAC-verified on-demand revalidation
│   │   ├── sitemap.ts → sitemap index; sitemaps/[type]/route.ts
│   │   ├── robots.ts
│   │   ├── manifest.ts
│   │   ├── not-found.tsx  error.tsx  global-error.tsx
│   │   └── layout.tsx                 # html, fonts, theme, consent provider
│   ├── components/
│   │   ├── ui/                        # Button, Card, Badge, Input, Select, Dialog, Sheet, Tabs, Table, Skeleton, EmptyState, ErrorState, Pagination, Breadcrumbs
│   │   ├── layout/                    # Header, MobileNav, Footer, Container, Section
│   │   ├── 3d/                        # see doc 07
│   │   │   ├── GamingHeroScene.tsx  FloatingGamingObjects.tsx  DeviceShowcase3D.tsx
│   │   │   ├── TrophyShowcase3D.tsx  SensitivityDevice3D.tsx  GamingEnvironment.tsx
│   │   │   ├── SceneFallback.tsx  SceneGate.tsx  useRenderTier.ts
│   │   ├── motion/                    # Reveal, Stagger, PageTransition, MagneticButton
│   │   ├── tournaments/  sensitivity/  articles/  ads/  seo/ (JsonLd)  consent/
│   │   └── admin/                     # DataTable, FilterBar, FormShell, RichTextEditor, MediaPicker, SensitivityGridEditor, StatusPill, WorkflowActions
│   ├── lib/
│   │   ├── api/                       # typed fetch client (server + client variants), cache tags
│   │   ├── seo/                       # buildMetadata(), jsonld builders
│   │   ├── animation/                 # gsap registration, tokens, reduced-motion helpers
│   │   ├── format/                    # date (Asia/Kolkata), currency INR
│   │   └── consent/                   # consent state, GA4 consent-mode bridge
│   ├── hooks/
│   ├── styles/globals.css             # Tailwind layers + CSS variables (tokens)
│   └── middleware.ts                  # /admin guard (cookie presence), security headers nonce
├── tailwind.config.ts                 # (or CSS-first config, Tailwind v4)
├── next.config.ts
├── playwright.config.ts
└── vitest.config.ts
```

## Backend (`backend/`)

```
backend/
├── src/
│   ├── app.ts                    # express app factory (no listen) — testable
│   ├── server.ts                 # listen + graceful shutdown
│   ├── worker.ts                 # BullMQ worker entry (separate PM2 process)
│   ├── config/                   # env.ts (Zod), db.ts, redis.ts, s3.ts, logger.ts
│   ├── middleware/
│   │   ├── requestId.ts  httpLogger.ts  securityHeaders.ts (helmet)  cors.ts
│   │   ├── rateLimit.ts (redis store)  sanitize.ts (mongo operator stripping)
│   │   ├── validate.ts (zod: body/query/params)  csrf.ts
│   │   ├── authenticate.ts  authorize.ts (permission check)  audit.ts
│   │   └── errorHandler.ts  notFound.ts
│   ├── modules/                  # feature-first; each module is self-contained
│   │   ├── auth/                 auth.routes.ts auth.controller.ts auth.service.ts
│   │   ├── admins/  roles/
│   │   ├── tournaments/          tournament.model.ts .repository.ts .service.ts .controller.ts .routes.ts .public.routes.ts
│   │   ├── sensitivity/  devices/  weapons/  scopes/  games/
│   │   ├── articles/  categories/  tags/  media/
│   │   ├── feedback/  contact/  reports/
│   │   ├── ads/  affiliates/  legal/  settings/  seo/ (redirects)
│   │   ├── search/  dashboard/  audit/
│   │   └── privacy/              # data-rights requests (access/correction/erasure)
│   ├── jobs/                     # publishScheduled.ts, imageDerivatives.ts, sendMail.ts, retentionSweep.ts
│   ├── lib/                      # apiResponse.ts, errors.ts (AppError hierarchy), pagination.ts, slug.ts, sanitizeHtml.ts, revalidate.ts, cache.ts
│   ├── docs/openapi.ts           # generated from zod via zod-to-openapi
│   └── types/
├── scripts/                      # seed.ts, create-super-admin.ts, migrate-*.ts
├── tests/
│   ├── unit/  integration/ (supertest + mongodb-memory-server)  fixtures/
└── vitest.config.ts
```

## Shared (`shared/`)

```
shared/src/
├── enums.ts          # TournamentStatus, WorkflowStatus, Role, Permission, ScopeKey, SensitivityCategory, Playstyle, Provenance
├── schemas/          # zod: tournament.ts, sensitivity.ts, article.ts, feedback.ts, contact.ts, report.ts, common.ts (pagination, objectId, slug)
├── types/            # inferred types + API envelope types
└── constants.ts      # limits (upload size, text lengths), timezone 'Asia/Kolkata'
```

## Infrastructure (`infrastructure/`)

```
infrastructure/
├── nginx/sgh.conf            # server blocks, CF real-ip, proxy, caching, limits
├── pm2/ecosystem.config.cjs  # web, api (cluster ×N), worker
├── scripts/ deploy.sh rollback.sh backup-verify.sh
├── docker/docker-compose.local.yml   # mongo, redis, minio (S3 local)
└── runbooks/ deploy.md rollback.md incident.md backups.md
```

## Conventions
- TypeScript `strict`, ESLint (typescript-eslint, next, import order), Prettier, Husky + lint-staged, Conventional Commits.
- Path aliases: `@/` in the frontend and `@sgh/shared` across packages.
- File naming: `kebab-case` for routes, `PascalCase.tsx` for components, `x.service.ts` for backend layers.
