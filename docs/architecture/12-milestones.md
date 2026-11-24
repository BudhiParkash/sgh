# 12 — Development Milestones & Estimated Effort

Assumptions: one senior full-stack developer working with AI assistance, plus part-time design/3D asset support. Estimates are in **developer-weeks** and include tests and documentation for each module. They exclude legal counsel time, content writing and real tournament/sensitivity data entry, which are owner-side tasks on the critical path for launch.

| Milestone | Brief phase | Scope | Est. (dev-weeks) | Exit criteria |
|---|---|---|---|---|
| **M0** Architecture | 1 | this package; owner answers doc 13 | done → approval | signed-off decisions |
| **M1** Foundation | 1–2 | monorepo, tooling, CI skeleton, shared package, design tokens, base UI kit (Button, Card, Input, Select, Sheet, Dialog, Tabs, Badge, Skeleton, Empty/Error states), Header/MobileNav/Footer, layout, fonts | 1.5 | Storybook-lite page of components passes axe; responsive at all 9 widths |
| **M2** Homepage & 3D | 2 | homepage sections (data-driven with empty states), SceneGate/tiers, hero scene, posters, Motion/GSAP/Lenis system, reduced-motion | 2.5 | Lighthouse mobile ≥ 90 perf with 3D gated; WebGL-off test passes |
| **M3** Backend core | 3 | Express app, env, Mongo/Redis, middleware stack, error/response envelope, logging, rate limit, OpenAPI, auth (sessions, Argon2, 2FA, lockout), RBAC, audit log, seed scripts | 2 | Supertest suites for auth/RBAC/validation green; ZAP baseline clean (no high) |
| **M4** Admin shell + CMS core | 4 | admin layout, dashboard (real metrics), generic DataTable/Form/Workflow components, media library (S3 + sharp), categories/tags, users/roles, settings, audit viewer | 2.5 | full CRUD + workflow on a reference module with tests |
| **M5** Tournament Hub | 4–5 | admin module with sources/verification rules, public list/detail/calendar/filters/search, trophy 3D, Event JSON-LD rules | 1.5 | verification gates tested; no Event markup on rumours |
| **M6** Sensitivity Hub | 4–5 | devices/weapons/scopes admin, grid editor, provenance, finder resolution, compare, code library + moderation, device/gun pages, PNG cards (next/og), feedback, SensitivityDevice3D | 3 | finder resolution unit-tested; card PNG snapshot tests |
| **M7** News & Guides CMS | 4–5 | Tiptap editor, revisions, preview (draft mode), scheduling worker, related/internal links, listing/category/tag pages, search | 2 | scheduled publish E2E test; sanitizer XSS test corpus passes |
| **M8** Legal & privacy | 6 | legal page module + versions + placeholder guard, consent banner + Consent Mode v2, report/takedown flow with SLAs, privacy requests + erasure, contact form | 1.5 | consent default-deny verified; erasure test |
| **M9** SEO/GEO | 7 | metadata builder everywhere, sitemaps, robots, redirects, JSON-LD set, SEO admin audit, llms.txt, GSC/Bing readiness, analytics | 1 | Lighthouse SEO ≥ 95; schema tests; link checker clean |
| **M10** Advertising | 8 | ad slot component (reserved sizes, lazy, consent-aware, non-personalised default), GAM loader (only on pages with active slots), direct banners, affiliates `/go/`, disclosures | 1 | CLS unchanged with ads; ads absent on legal/admin pages |
| **M11** QA hardening | 9 | full Playwright suite (public + admin), cross-browser (Chromium/WebKit/Firefox + Android Chrome emulation + 1–2 real devices), a11y (axe + manual keyboard/screen reader pass), perf, ZAP full scan, fixes | 2 | acceptance criteria §27 checklist all green |
| **M12** Launch | 10 | AWS + Atlas prod provisioning, Cloudflare, SSL, monitoring, backups + restore drill, runbooks, go-live checklist | 1 | production verification signed off |
| **Total** | | | **≈ 22 dev-weeks** (~5–6 calendar months for one dev; ~3–3.5 months with two devs in parallel tracks: frontend/3D vs backend/admin) | |

Critical-path dependencies on the owner:
- Brand assets (logo, wordmark) and decisions on fonts and colour sign-off → needed by **M1**.
- Original 3D assets (trophy and generic phone GLBs) → commission by **M2** (procedural placeholders until then).
- Real, tested sensitivity data and methodology → before the **M6** content launch.
- Legal entity details, grievance officer, counsel review → before **M12**.
- Google Ad Manager account approval → can follow launch (slots stay disabled).

Each phase ends with the report format required by the brief: completed features, files created, DB changes, API endpoints, tests performed, remaining tasks and known risks.

## Key risks
| Risk | Mitigation |
|---|---|
| 3D hurting mobile performance / SEO | tier gating, posters as LCP, budgets enforced in CI |
| Thin or unverified content (sensitivity/tournaments) at launch | publish gates, provenance labels, launch with fewer, better pages |
| Legal uncertainty (DPDP phase-in, Online Gaming Act rules) | non-personalised ads default, minimal data, counsel review gate |
| GAM approval delay / low ad revenue early | affiliate and direct sponsors are ready; ads are fully optional in code |
| Single-EC2 failure | stateless app, scripted rebuild, Atlas managed; scale path documented |
| Scope creep into player/match features | explicitly out of Phase 1; API namespace reserved |
