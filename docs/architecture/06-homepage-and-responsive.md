# 06 — Homepage UI/UX Wireframe, Design System & Responsive Plan

## 1. Design system (tokens live in CSS variables; Tailwind maps to them)

**Colour** (dark-first; contrast checked to WCAG AA for text)
| Token | Value | Use |
|---|---|---|
| `--bg` | `#07070B` | page background (near-black, slightly cool) |
| `--surface-1` | `#0F1016` | cards |
| `--surface-2` | `#161823` | raised / hover |
| `--surface-glass` | `rgba(22,24,35,0.6)` + 16px blur | nav, overlays only (glass used sparingly) |
| `--border` | `rgba(255,255,255,0.08)` | hairlines |
| `--text` | `#ECEDF3` | body |
| `--text-muted` | `#9A9DB0` | secondary (AA on surface-1) |
| `--primary` | `#8B5CF6` electric purple | primary CTA, focus ring |
| `--secondary` | `#3B82F6` neon blue | links, secondary accents |
| `--accent` | `#22D3EE` cyan | **sparingly**: live/active indicators, data highlights |
| `--success / --warning / --danger` | `#22C55E / #F59E0B / #EF4444` | status pills |
| Status | Rumour = amber outline, Confirmed = green, Ongoing = cyan pulse (motion-safe only), Completed = neutral, Cancelled = red outline | |

Gradient budget: one hero atmosphere gradient (purple→blue radial, ≤ 20% opacity), plus a 1px gradient border on the featured card only. Glow is reserved for the primary CTA hover and the active nav item, so not every component glows.

**Typography**
- Display: *Space Grotesk* or *Orbitron* (Orbitron for the logo/hero only, it tires the eye in body text). Body: *Inter*. Mono (values, codes): *JetBrains Mono*.
- Loaded via `next/font` with the Latin subset, `display: swap` and size-adjust fallbacks, so there's zero CLS.
- Fluid scale (`clamp`): `xs 12 / sm 14 / base 16 / lg 18 / xl 20 / 2xl 24 / 3xl 30 / 4xl 36→44 / 5xl 44→64 / hero 48→96`.
- Line height 1.6 for body, 1.1 for display. Max line length 70ch.

**Spacing** 4px base: `1=4, 2=8, 3=12, 4=16, 6=24, 8=32, 12=48, 16=64, 24=96, 32=128`. Section vertical rhythm: mobile 64, desktop 128.
**Radius** `sm 6 · md 10 · lg 16 · xl 24 · full`. Cards use `lg`, buttons `md`, pills `full`.
**Shadows** `sm: 0 1px 2px rgb(0 0 0/.4)`, `md: 0 8px 24px -8px rgb(0 0 0/.6)`, `lg: 0 24px 48px -12px rgb(0 0 0/.7)`, `glow-primary: 0 0 0 1px var(--primary), 0 8px 32px -8px rgb(139 92 246/.5)`.
**Motion** durations `instant 100 · fast 160 · base 240 · slow 400 · cinematic 800–1200`; easing `out: cubic-bezier(.2,.8,.2,1)`, `in-out: cubic-bezier(.65,0,.35,1)`.
**Breakpoints** (min-width, mobile-first): `xs 360 · sm 480 · md 768 · lg 1024 · xl 1440 · 2xl 1920`. The 320 and 390/414 widths are tested sizes, not breakpoints.
**Component states**: default, hover (pointer devices only, `@media (hover:hover)`), focus-visible (2px primary ring + offset), active (scale .98), disabled (40% opacity, no pointer), loading (spinner + `aria-busy`), selected.

## 2. Homepage wireframe (desktop 1440)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ◆ SHIVANSHI GAMING HUB  Home Tournaments Sensitivity Guides News About  [Find │
│                                                                   Sensitivity]│ glass nav, sticky, shrinks on scroll
├──────────────────────────────────────────────────────────────────────────────┤
│                                                ╭──── 3D scene (right 55%) ───╮│
│  LEVEL UP                                      │ floating low-poly crystals,  ││
│  YOUR GAME                                     │ abstract controller/phone    ││ 1. HERO  (min-h 88vh)
│  Your ultimate destination for BGMI            │ silhouettes, volumetric fog, ││ text is LCP; poster under canvas
│  tournaments, sensitivity setups and           │ mouse parallax               ││
│  mobile gaming intelligence.                   ╰──────────────────────────────╯│
│  [Explore Tournaments]  [Find Your Sensitivity]                               │
│  Independent fan platform · not affiliated with KRAFTON/Tencent              │
├──────────────────────────────────────────────────────────────────────────────┤
│ FEATURED TOURNAMENTS                                       View all →         │ 2.
│ ┌─────────── featured (2 col, trophy 3D) ────────┐ ┌─────────┐ ┌─────────┐    │
│ │ Name · Game · dates IST · prize (if verified)  │ │ card    │ │ card    │    │
│ │ Eligibility · [Confirmed] · Verified 2d ago    │ │ (tilt)  │ │         │    │
│ │ [Official page ↗]                               │ └─────────┘ └─────────┘    │
│ └────────────────────────────────────────────────┘                            │
├──────────────────────────────────────────────────────────────────────────────┤
│ SENSITIVITY FINDER                                                            │ 3.
│ ┌──── form ────────────────────────┐   ╭─ 3D phone shows live preview ──╮    │
│ │ Brand ▾  Model ▾  FPS ◉60 ◉90 ◉120│   │ panels animate to new values   │    │
│ │ Gyro ◉on ◉off  Style ◉Rush◉Bal◉Snp│   ╰────────────────────────────────╯    │
│ │ [Show my settings]               │                                         │
│ └──────────────────────────────────┘                                         │
├──────────────────────────────────────────────────────────────────────────────┤
│ POPULAR DEVICES  ◀ [iQOO][POCO][Samsung][OnePlus][Realme][Xiaomi][iPhone] ▶   │ 4. horizontal snap scroller
├──────────────────────────────────────────────────────────────────────────────┤
│ GUN GUIDES   [M416] [AKM] [M762] [UMP] [UZI] [S12K] [AWM]                    │ 5. original line-art silhouettes
│ "Sensitivity is set per scope, not per gun — here's how each gun behaves."   │
├──────────────────────────────────────────────────────────────────────────────┤
│ LATEST NEWS      [lead story large] [3 compact rows]                          │ 6.
├──────────────────────────────────────────────────────────────────────────────┤
│ [Ad: label "Advertisement", reserved 728×90 / 300×250 box]                    │ (one slot, below fold)
├──────────────────────────────────────────────────────────────────────────────┤
│ GAMING GUIDES    [card][card][card][card]                                     │ 7.
├──────────────────────────────────────────────────────────────────────────────┤
│ COMMUNITY  [YouTube] [Instagram] [Discord] [Telegram] — real links from       │ 8. hidden per link if not set
│            settings only; no follower counts unless pulled from an API        │
├──────────────────────────────────────────────────────────────────────────────┤
│ RESOURCES  [Sensitivity card PNG] [Checklist] …  (Download)                   │ 9.
├──────────────────────────────────────────────────────────────────────────────┤
│ FOOTER: brand + disclaimer │ Explore │ Legal (11 links) │ Contact/Grievance   │ 10.
└──────────────────────────────────────────────────────────────────────────────┘
```

Empty-state rule: a section with no published data **hides itself**, or shows an honest "Coming soon" with a CTA. It never shows placeholder or fake items. There are no visitor counters, fake "live now" badges or invented stats.

## 3. Mobile homepage (360px)

```
┌────────────────────────┐
│ ◆ SGH          [🔍][≡] │ 56px header; ≡ opens full-height sheet nav
├────────────────────────┤
│  LEVEL UP              │
│  YOUR GAME             │ hero: text first, then 3D/poster below at 4:3,
│  Your ultimate…        │ Tier-low → static AVIF poster, no canvas
│ [Explore Tournaments]  │ full-width buttons, 48px tall
│ [Find Sensitivity]     │
│ ┌────────────────────┐ │
│ │  poster / light 3D │ │
│ └────────────────────┘ │
├────────────────────────┤
│ Featured tournaments   │ horizontal snap carousel, 85% card width,
│ [card ▸][ca            │ dots + swipe; no hover-only info
├────────────────────────┤
│ Sensitivity finder     │ stacked fields; segmented controls for
│ Brand ▾                │ FPS/Gyro/Style (44px targets)
│ Model ▾                │ result slides up as a bottom sheet
│ [60][90][120]          │
│ [Show my settings]     │
├────────────────────────┤
│ …sections stack…       │
├────────────────────────┤
│ Footer accordions      │
└────────────────────────┘
  Bottom quick bar (optional, md-): [Home][Tourneys][Sens][News]
```

## 4. Responsive rules

| Concern | Mobile (<768) | Tablet (768–1023) | Desktop (≥1024) |
|---|---|---|---|
| Nav | header + sheet menu, optional bottom bar | header + condensed links | full header, mega-dropdown for Sensitivity |
| Grid | 1 col (cards), 2 col at 480+ for small cards | 2 col | 3–4 col, 12-col layout |
| Hero 3D | poster, or light scene on high tier only | light scene | full scene |
| Cards hover tilt | off (tap → navigate) | off | on (pointer:fine only) |
| Filters | bottom sheet with "Apply" button, active filter chips | sidebar collapsible | sticky sidebar |
| Tables (compare, values) | scope rows as cards, sticky first column with horizontal scroll *inside* the component only | full table | full table |
| Forms | single column, native inputs, `inputmode`, `autocomplete` | 2 col | 2 col |
| Sticky elements | header only (hide on scroll down, show on up) | header | header + filter sidebar |
| Ads | 300×250 / 320×100 reserved boxes | 728×90 | 728×90, sidebar 300×600 on article pages |

Global guards: `overflow-x: clip` on the body is **not** used to hide bugs. Playwright asserts `scrollWidth === clientWidth` at 320/360/390/414/480/768/1024/1440/1920 on every key page. Also: touch targets ≥ 44×44, `prefers-reduced-motion` is honoured, and focus order is logical.

## 5. Key inner pages (summary)
- **Tournament listing**: status tabs (Upcoming / Ongoing / Completed / Cancelled / Rumour), filters (game, eligibility, month), list and calendar toggle. Every card shows its verification badge with the date.
- **Tournament detail**: hero with the 3D trophy on desktop, a facts box (all fields, "Not announced" where unknown), sources list, verification note, related events, report button.
- **Sensitivity config**: provenance banner, values grid (tabs per category), share code with copy, a "Download card" PNG, the explanation, the testing method, feedback ("Did this help?"), related devices and guns.
- **Device page**: specs (with source), the configs available per FPS/gyro, and a link to compare.
- **Gun page**: behaviour notes, recommended scopes → links to the scope values in the configs, with an explanation that sensitivity is scope-based.
- **Article**: breadcrumb, H1, author box, published/updated dates (IST), ToC, content, sources, FAQ, related, and the affiliate/sponsored disclosure at the top when it applies.
