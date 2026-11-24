# 08 — SEO & GEO Implementation Strategy

## 1. Information architecture & URLs
```
/                                     Home
/tournaments                          hub (status tabs as ?status= — canonical to /tournaments for non-default filters)
/tournaments/upcoming | /ongoing | /completed     indexable status pages (real content lists)
/tournaments/calendar                 noindex,follow (duplicate of list data)
/tournaments/{slug}
/sensitivity                          hub + finder
/sensitivity/devices/{brand}          brand hub (indexed only if ≥1 published config)
/sensitivity/devices/{brand}/{model}  device page (indexed only if ≥1 published config with explanation)
/sensitivity/guns/{weapon}            gun guide
/sensitivity/{config-slug}            single configuration
/sensitivity/compare?a=&b=            noindex,follow
/sensitivity/codes
/news/{category}/{slug} · /guides/{category}/{slug}
/resources
/legal/{slug}, /about, /contact, /report
```
Rules: lowercase, hyphenated, no trailing slash, no dates in article URLs (they don't age). Changed slugs automatically create a 301 in `redirects`.

## 2. Technical SEO implementation
| Item | Implementation |
|---|---|
| Rendering | Server Components with ISR, so all primary content is in the initial HTML |
| Metadata | `generateMetadata()` per route via `lib/seo/buildMetadata()`: title template `%s | Shivanshi Gaming Hub`, description, `alternates.canonical` (absolute), `robots`, OG and Twitter (summary_large_image) |
| OG images | admin-chosen image or an auto-generated `opengraph-image.tsx` per entity (branded, no game assets) |
| Canonicals | self-referencing; filtered and paginated variants handled below; admin override field |
| Pagination | `/news?page=2` is self-canonical, indexable and has a unique title "Page 2"; no rel prev/next reliance (Google ignores it) |
| Faceted filters | parameters other than `page` → `noindex,follow` + canonical to the base |
| Sitemaps | `/sitemap.xml` index → `/sitemaps/articles.xml`, `tournaments.xml`, `sensitivity.xml`, `devices.xml`, `pages.xml`; `lastmod` = real `updatedAt`; only indexable URLs; split at 10k URLs |
| News sitemap | `/sitemaps/news.xml` (last 48 h of `type=news`), only if pursuing Google News (Publisher Center) |
| robots.txt | allow all; disallow `/admin`, `/api/`, `/search`, `/*?*sort=`; sitemap reference; staging serves `Disallow: /` and the `X-Robots-Tag: noindex` header |
| Status codes | real 404 (`notFound()`), 410 for deleted content (via redirects `code:410`), 301 for moved; soft-404 avoided (empty lists still have content or are noindexed) |
| Images | `next/image` with explicit dimensions, descriptive alt, AVIF/WebP, `priority` only on a true LCP image |
| Breadcrumbs | visible component + `BreadcrumbList` JSON-LD from the same data |
| Internal linking | automatic "related" blocks (same device/brand/category/game); the editor suggests internal links; the SEO audit flags orphans and broken links |
| Core Web Vitals | see doc 07 §5; `web-vitals` reporting to GA4 (with consent) |
| Mobile-first | same content on mobile and desktop; no content hidden only on mobile |
| hreflang | not in Phase 1 (English only). If Hindi is added: `/hi/` subpath + hreflang pairs |

## 3. Structured data (JSON-LD, generated server-side, validated in tests against schema.org types)
| Page | Types |
|---|---|
| All | `Organization` (name, url, logo, `sameAs` = verified socials only), `WebSite` + `SearchAction` (sitelinks search box) |
| Article / guide | `Article` (or `NewsArticle` when `type=news`): headline, image, datePublished, dateModified, author `Person` (with url to author page), publisher → Organization |
| Tournament | `Event` **only when** the status is confirmed/ongoing/completed **and** the start date and organiser are verified: name, startDate/endDate (with +05:30 offset), `eventStatus` (EventScheduled/EventCancelled…), `eventAttendanceMode: OnlineEventAttendanceMode`, `location: VirtualLocation(url=officialSourceUrl)`, organizer. **Rumour events get no Event markup.** No `offers` (no entry fee exists). |
| Sensitivity config / device | `Article` (HowTo is deprecated for rich results; plain Article plus clear headings) |
| Lists | `ItemList` for hub pages (optional) |
| FAQ sections | `FAQPage` markup only where the FAQ is visible on the page (Google limits FAQ rich results, but the markup still aids understanding) |
| Breadcrumbs | `BreadcrumbList` |

## 4. Content & keyword plan (mapped to page types)
| Cluster | Primary target | Page |
|---|---|---|
| Sensitivity (head) | "BGMI sensitivity settings", "best BGMI sensitivity" | `/sensitivity` hub — explains categories/scopes, the finder, methodology |
| Gyro | "BGMI gyro settings", "BGMI gyroscope sensitivity" | guide article + gyro filter landing |
| Device long-tail | "BGMI sensitivity for <model>" | device pages — **only** where a real config with an explanation exists |
| FPS | "BGMI 90 FPS sensitivity", "120 FPS" | guide per FPS tier explaining the differences, linking to device configs |
| Gun | "M416 sensitivity" | gun guide — honest framing: scope-based values + recoil control technique |
| Tournaments | "BGMI tournament India", "upcoming BGMI tournaments", "PUBG Mobile tournaments" | `/tournaments/upcoming` with verified entries and update dates |
| Tips | "gaming tips and tricks" | guides category |

Thin-content guards (enforced by the publish checks):
- A device or config page needs ≥ 150 words of unique explanation, or it is published `noindex`.
- Tag pages need ≥ 3 articles to be indexed.
- No auto-generated device × FPS × playstyle matrix pages without data.

## 5. GEO (generative engine optimisation)
- **Answer-first blocks**: each guide and config opens with a 2–3 sentence factual summary ("For the X at 90 FPS with gyro always on, these are the values we tested on game version Y on DATE…") in plain HTML.
- **Semantic HTML**: one H1, logical H2/H3, `<table>` for values (not images), `<time datetime>`, `<address>` for contact, `<figure>/<figcaption>`.
- **Provenance everywhere**: author, tested date, game version, testing methodology page (`/about/how-we-test`), source links for tournaments, "Last verified" stamps.
- **Entity consistency**: the same organisation name, logo and `sameAs` everywhere; an About page describing who runs the site and the independence disclaimer.
- **`/llms.txt`**: site summary, key hubs, methodology and policy links (optional; adoption by AI engines is not guaranteed).
- **Crawler policy**: a decision for the owner on allowing or blocking AI crawlers (GPTBot, ClaudeBot, Google-Extended, PerplexityBot) in robots.txt and Cloudflare's AI-bot settings. Default proposal: allow search-oriented bots and decide on training bots separately.
- No promises of AI citation or rankings are made anywhere.

## 6. Tooling & launch checklist
- Google Search Console (domain property via DNS TXT on Cloudflare), Bing Webmaster Tools (import from GSC), and IndexNow ping on publish (Bing/Yandex).
- GA4 with **Consent Mode v2** — default denied until the visitor consents (see doc 09).
- CI: Lighthouse CI (SEO ≥ 95), structured-data unit tests, a link checker on the built site, and a sitemap validity check.
- The admin SEO module surfaces missing or duplicate titles and descriptions, noindex pages, orphans and redirect chains.
