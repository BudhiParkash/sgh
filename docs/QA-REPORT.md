# QA report: Phase 1 (2026-11-24)

## Automated tests (all passing)
| Suite | Count | What it covers |
|---|---|---|
| Backend integration (Vitest + Supertest, real MongoDB + Redis) | 85 | auth/2FA/lockout/CSRF/RBAC, CRUD + workflow engine, media pipeline, tournaments, sensitivity, articles + scheduler, search, legal + inbox + privacy, SEO, security guards |
| Unit (frontend + shared) | 18 | formatting (IST), render tiers, countdowns, calendar files, slugs, URL rules |
| End-to-end (Playwright, desktop + Pixel 7) | 78 | every public page type, responsive widths 320–1920 (no horizontal scroll), axe WCAG 2.1 AA, 3D progressive enhancement, consent, CSP, full admin flows on a disposable real stack (2FA enrolment → publish tournament / setup / article / legal → public pages, forms → inboxes, favourites, offline, redirects, sitemaps) |

The suite is run twice in a row with no failures before each milestone is signed off.

## Lighthouse (mobile emulation, 4× CPU throttle, slow 4G; production build)
| Page | Performance | Accessibility | Best practices | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| `/` | 99 | 100 | 100 | 100 | 0.9 s | 130 ms | 0 |
| `/sensitivity` | 98 | 98 → fixed* | 100 | 100 | 0.8 s | 160 ms | 0 |
| `/tournaments/upcoming` | 100 | 99 → fixed* | 100 | 100 | 0.8 s | 50 ms | 0 |
| `/news` | 100 | 98 → fixed* | 100 | 100 | 0.6 s | 50 ms | 0 |
| `/contact` | 100 | 100 | 100 | 100 | 0.8 s | 30 ms | 0 |
| `/` desktop (full 3D) | 92 | — | — | — | 0.3 s | 220 ms | 0 |

\*The remaining points were heading order in empty states, which has since been fixed. Budgets are enforced in CI (`infrastructure/lighthouserc.json`).

### Performance work done in QA
- Cookie banner moved into the server HTML, with a check that runs before the first paint. It no longer becomes a late LCP (4.0 s → 0.8 s on light pages).
- 3D on phones waits for the first touch or scroll and renders at 30 fps on phones and tablets. Homepage total blocking time dropped from 11 s to 0.13 s.
- The hero poster is inline SVG, and the headline animates without clipping, so the headline is the immediate LCP (4.2 s → 0.9 s).
- GSAP and Lenis load only on desktop; Motion is loaded lazily (`LazyMotion`).
- Zod is no longer bundled on public pages (shared package marked side-effect free), and Zod runs without eval, so a strict CSP raises no violations.

## Security checks
- `pnpm audit --prod`: **no known vulnerabilities**.
- Tested: Argon2id hashing, rate limits + lockout, timing-equal login errors, TOTP replay protection, CSRF tokens, origin guard, NoSQL-operator and prototype-pollution rejection, body size limits, upload sniffing (disguised/SVG/polyglot rejected), HTML sanitisation (script/handler stripping), no stack traces in errors, `__Host-` HttpOnly Secure SameSite=Strict session cookie (verified on the production bundle), API docs hidden in production, CSP + security headers.
- **Not run:** OWASP ZAP (needs Docker, which isn't on the build machine). Run `zap-baseline.py -t https://staging.shivanshigaming.com` against staging before launch.

## Bugs found and fixed during testing (highlights)
- PATCH requests reset fields that have defaults (status, sources), so a partial edit could wipe data. Fixed in the engine.
- A fast first edit in the admin editor could be lost; the form now mounts only after the data loads.
- New redirects, categories and tags weren't visible for up to 5 minutes (cache not refreshed on create).
- Approving a share code didn't refresh the public page.
- Service worker: served stale pages while online, and broke redirects. Both fixed, with regression tests.
- Word counts merged across HTML blocks (a 300-word article could be refused); entities leaked into heading anchors.
- Accessibility: contrast of buttons and subtle text, definition-list semantics, unlabelled rich-text editor, heading order.

## Known limitations (accepted for Phase 1)
- The CSP allows `'unsafe-inline'` scripts. A nonce would force every page to render dynamically and lose ISR; every other directive is strict.
- Tests run on desktop Chromium plus Android (Pixel 7) emulation. Before launch, spot-check on one real mid-range Android phone and Safari on iPhone.
- Visitors have no accounts in Phase 1; favourites live in the browser on that device (by design).
