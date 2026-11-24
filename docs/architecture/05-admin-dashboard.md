# 05 — Admin Dashboard: Wireframes & Module Breakdown

Route: `/admin` (Next.js route group with its own layout). `noindex, nofollow`, the `X-Robots-Tag` header, excluded from the sitemap, and no 3D, ads or analytics scripts loaded.
UI: dark surface palette (shared tokens), a dense but readable 14px base, keyboard accessible.

## Shell (desktop ≥1024px)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ ◆ SGH Admin        [ Search everything…  ⌘K ]          (+ New ▾)   🔔3   ◯ AK ▾│
├──────────────┬────────────────────────────────────────────────────────────────┤
│ Overview     │  Dashboard                                         Last 30 days ▾│
│ ─ Content ── │ ┌──────────┐┌──────────┐┌──────────┐┌──────────┐                 │
│ Tournaments  │ │Published ││Scheduled ││In review ││Open      │                 │
│ Sensitivity  │ │articles  ││ 4        ││ 7        ││reports 2 │ ← real DB counts│
│ Devices      │ │ 128      ││          ││          ││ 1 overdue│                 │
│ Weapons      │ └──────────┘└──────────┘└──────────┘└──────────┘                 │
│ Scopes       │ ┌─────────────────────────────┐┌──────────────────────────────┐ │
│ Articles     │ │ Needs attention             ││ Publishing activity (chart)  │ │
│ Categories   │ │ • 3 tournaments not verified││  ▁▃▅▂▇▅▃  items published/day │ │
│ Tags         │ │   in 7 days                 ││                              │ │
│ Media        │ │ • 2 codes pending           ││                              │ │
│ ─ Growth ─── │ │ • 5 articles missing meta   ││                              │ │
│ SEO          │ └─────────────────────────────┘└──────────────────────────────┘ │
│ Ads          │ ┌──────────────────────────────────────────────────────────────┐│
│ Affiliates   │ │ Recent activity (audit log)                                  ││
│ ─ Inbox ──── │ │ 14:02 Priya published “BGMI 90 FPS guide”                    ││
│ Feedback  12 │ │ 13:40 Ravi verified “XYZ Cup” (official source added)        ││
│ Enquiries  3 │ └──────────────────────────────────────────────────────────────┘│
│ Reports    2 │                                                                  │
│ Privacy    0 │                                                                  │
│ ─ System ─── │                                                                  │
│ Legal pages  │                                                                  │
│ Users & roles│                                                                  │
│ Audit log    │                                                                  │
│ Settings     │                                                                  │
└──────────────┴────────────────────────────────────────────────────────────────┘
```
The sidebar is filtered by permission, so a module the user can't access doesn't appear. Below 1024px the sidebar becomes a drawer, and tables become stacked cards with the primary columns only.

## List view pattern (every module)

```
Tournaments                                              [ + New tournament ]
[ Search… ] [Status ▾] [Game ▾] [Verified ▾] [Date range] [Reset]   ⋮ Columns
┌──┬───────────────────────────┬──────────┬───────────┬────────────┬─────────┬──┐
│☐ │ Name                      │ Status   │ Verified  │ Starts     │ Workflow│ ⋯│
├──┼───────────────────────────┼──────────┼───────────┼────────────┼─────────┼──┤
│☐ │ Example Cup S2            │ Confirmed│ 2d ago ✓  │ 12 Dec IST │Published│ ⋯│
│☐ │ Rumoured Pro Series       │ Rumour   │ —         │ —          │ Draft   │ ⋯│
└──┴───────────────────────────┴──────────┴───────────┴────────────┴─────────┴──┘
Bulk: [Archive] [Change status]            ‹ 1 2 3 … 8 ›   20 / page ▾
```
States: a skeleton table while loading, an empty state with a CTA, and an error state with a retry button and the request ID.

## Editor pattern

```
← Tournaments / Example Cup S2                 Draft • autosaved 10s ago
┌─────────────────────────────────────────────┬─────────────────────────────┐
│ Tabs: [Details] [Sources & verification]    │ Workflow                    │
│       [Media] [SEO] [History]               │ Status: Draft               │
│                                             │ [Submit for review]         │
│ Name ______________________                 │ Publish at: [date time IST] │
│ Organiser __________  Game [BGMI ▾]         │ [Schedule] [Publish now]    │
│ Start [  ] End [  ] Reg. deadline [  ]      │─────────────────────────────│
│ Prize pool ₹[      ] ☐ verified             │ Checks                      │
│ Eligibility … Format (rich text) …          │ ✗ Official source missing   │
│ Registration URL ____ Official source ____  │ ✓ Featured image has alt    │
│                                             │ ⚠ Meta description 182/160  │
│                                             │ [Preview ↗]                 │
└─────────────────────────────────────────────┴─────────────────────────────┘
```
The **Checks** panel holds publish gates computed by the service and mirrored in the UI. Blocking checks disable Publish. Examples: confirmed without a source, a tested config without testing notes, a legal page with placeholders in production, an image without alt text.

## Sensitivity grid editor (custom component)

```
Device [iQOO Neo 9 Pro ▾]  FPS [90 ▾]  Gyro [Always on ▾]  Playstyle [Balanced ▾]
Provenance (•) Tested ( ) Community ( ) Baseline   Game version [ 4.1 ]
┌──────────────┬────────┬────────┬────────┬──────────┐
│ Scope        │ Camera │ ADS    │ Gyro   │ ADS Gyro │
├──────────────┼────────┼────────┼────────┼──────────┤
│ TPP no scope │ [120]  │ [110]  │ [300]  │ [300]    │
│ FPP no scope │ [110]  │ [100]  │ [300]  │ [300]    │
│ Red dot/Holo │ [ 60]  │ [ 55]  │ [300]  │ [290]    │
│ 2x … 8x      │  …     │  …     │  …     │  …       │
└──────────────┴────────┴────────┴────────┴──────────┘
[Copy column ▸] [Paste from spreadsheet] [Compare with… ▾]    Live card preview ▸
```
(The values above are layout placeholders, not recommendations.)

## Module breakdown

| # | Module | Key capabilities | Roles (write) |
|---|---|---|---|
| 1 | Dashboard | real metrics, attention queue, activity | all (read scoped) |
| 2 | Tournaments | CRUD, sources, verification record, status rules, featured flag, schedule | Tournament Mgr, Admin |
| 3 | Sensitivity | grid editor, provenance, testing method, duplicate, codes queue, revisions | Editor, Admin (Writer: draft) |
| 4 | Devices | specs with sources, FPS support verification, class tiers, brand pages | Editor, Admin |
| 5 | Weapons | notes, recommended scopes, image | Editor |
| 6 | Scopes | label and order only (seeded) | Admin |
| 7 | Articles | Tiptap editor, embeds (YouTube by URL only), ToC, FAQ, sources, sponsored flag, revisions, preview, schedule | Writer → Editor |
| 8 | Categories | tree, SEO | Editor |
| 9 | Tags | merge duplicates, indexability threshold | Editor, SEO |
| 10 | Media library | upload, alt, licence, replace, unused filter, usage list | Writer+ |
| 11 | SEO | per-entity overrides, redirects, robots toggles, audit (missing meta, duplicates, broken links), sitemap preview | SEO Mgr |
| 12 | Ads | slots, GAM unit paths, direct creatives, windows, enable/disable, page targeting | Admin |
| 13 | Affiliates | `/go/` links, destinations, disclosure text | Admin |
| 14 | Feedback | triage, mark spam, link to config | Editor |
| 15 | Enquiries | assign, status, notes | Admin |
| 16 | Reports | SLA timers, acknowledge/resolve, takedown action, ticket history | Admin, Editor |
| 17 | Legal pages | versioned editor, effective date, counsel-reviewed flag, placeholder guard | Admin |
| 18 | Users & roles | invite (email link), role assign, suspend, force logout, custom roles | Super Admin |
| 19 | Audit log | filter, diff viewer, CSV export | Admin |
| 20 | Settings | identity, contact, grievance officer, socials, analytics IDs, GAM code, maintenance mode | Super Admin / Admin |

Plus the **Privacy requests** inbox (part of the legal compliance work).

## Tech choices (admin)
TanStack Table, TanStack Query (cache, optimistic updates), React Hook Form + Zod (the same schemas as the API), Tiptap, Recharts (lazy-loaded) for the few charts, `cmdk` for ⌘K search, and Radix primitives for accessible dialogs and menus.
