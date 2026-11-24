# 09 — India Legal & Privacy Implementation Checklist

> **This is an engineering checklist, not legal advice.** Every item marked ⚖️ needs confirmation by qualified Indian legal counsel before launch. Commencement dates of laws and rules change, so verify each one as of the launch date.

## 1. Laws and rules to review (and why each matters here)

| Instrument | Relevance to this platform | Status to verify at launch |
|---|---|---|
| Information Technology Act, 2000 | §79 safe harbour (we host visitor feedback, code submissions and reports); §43A/72A data obligations | in force |
| IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 (as amended) | If treated as an intermediary: publish rules/privacy/user agreement, appoint a **Grievance Officer**, acknowledge complaints (currently 24 h) and resolve them (currently 15 days); expedited timelines for certain content categories | ⚖️ whether we qualify as an intermediary, given the limited UGC |
| Digital Personal Data Protection Act, 2023 | consent notice, purpose limitation, data principal rights, **children (<18): verifiable parental consent; no tracking, behavioural monitoring or targeted advertising directed at children** | ⚖️ The DPDP Rules, 2025 were notified in Nov 2025 with **phased commencement** (most obligations ~18 months later). Confirm which sections are in force on launch day, but build to the full standard now |
| DPDP Rules, 2025 | notice contents, security safeguards, breach intimation, retention/erasure, consent managers, children's consent mechanics | ⚖️ as above |
| Promotion and Regulation of Online Gaming Act, 2025 | prohibits online **money** games and their advertising/promotion; recognises e-sports | ⚖️ Confirm commencement and rules. **Impact: we must not advertise, list or link to real-money gaming apps or paid-entry fantasy/betting platforms** (enforced by an ad destination blocklist and tournament review checks) |
| Consumer Protection Act, 2019 & CCPA guidelines | misleading ads; **Guidelines for Prevention of Misleading Advertisements and Endorsements, 2022**; **Guidelines for Prevention and Regulation of Dark Patterns, 2023** | in force — applies to sponsored content, affiliate copy and consent UI |
| ASCI Code & influencer guidelines | disclosure labels for sponsored and affiliate content (self-regulatory but expected) | |
| Copyright Act, 1957 | §52 fair dealing for news, review and criticism; screenshots and trailers need care; takedown process | in force |
| Trade Marks Act, 1999 | BGMI/PUBG/KRAFTON/Tencent and device brand names used only nominatively; no logos | in force |

## 2. Product-level legal safeguards (built into the code)

| Safeguard | Implementation |
|---|---|
| No money gaming | No fee, wallet, deposit, coin or payout fields in any schema. Tournament admin warns on payment keywords. The ad/affiliate destination blocklist covers known RMG/betting domains, plus a manual category declaration |
| No misleading prize claims | `prizePool` is shown only when `verified=true`, with the source link and "as announced by <organiser>" |
| No false affiliation | Global disclaimer in the footer and on the About page (exact text from the brief); no official logos; brand names in plain text |
| Sponsored content | `sponsored.isSponsored` → a "Sponsored" label above the title, sponsor name, `rel="sponsored"` |
| Affiliate links | `/go/` links get `rel="sponsored nofollow"` and an inline disclosure at the top of the page, not hidden in the footer |
| Ads | "Advertisement" label on every slot; no ads placed next to buttons or download links; no "click here" prompts |
| Dark patterns | Cookie banner: "Reject all" equally prominent as "Accept all"; no pre-ticked boxes; no confirm-shaming; no fake urgency or scarcity |
| Content reporting | `/report` form (copyright, inaccurate, privacy, offensive…), ticket number, SLA timers in the admin |
| Copyright | `/legal/copyright` + notice-and-takedown flow; media `licence` is required on upload; YouTube embeds by official embed only |

## 3. Privacy implementation (DPDP-aligned, data minimisation by design)

**Personal data we will collect in Phase 1 (complete list — anything new needs a review)**
| Data | Where | Purpose | Lawful basis (proposed) ⚖️ | Retention (owner to set) |
|---|---|---|---|---|
| Name, email, message | Contact form | reply to the enquiry | consent | TBD |
| Optional email | Feedback form (only if a reply is wanted) | reply | consent | TBD |
| Name, email, evidence links | Report/takedown | process the complaint (legal obligation) | legitimate use / legal obligation | TBD |
| Email | Privacy request | verify and fulfil the request | legal obligation | TBD |
| Hashed IP, hashed UA | abuse prevention on forms | security | legitimate use ⚖️ | short (e.g. 30 days) — TBD |
| Analytics identifiers | GA4 (only after consent) | usage statistics | consent | GA4 setting (2 or 14 months) |
| Ad identifiers | GAM (only after consent; otherwise non-personalised/limited ads) | advertising | consent | Google's terms |
| Admin accounts | admin only | operation | contract/employment | while active + TBD |

**No player accounts and no age or DOB collection in Phase 1.**

Children ⚖️: the audience likely includes under-18s, and the DPDP Act bars behavioural monitoring of and targeted advertising directed at children. Proposed default: **serve only non-personalised ads (GAM `requestNonPersonalizedAds`/limited ads)** and keep GA4 behind consent with Google signals and ad personalisation **off**, until counsel advises otherwise. This trades some ad revenue for lower legal risk.

**Mechanisms to build**
- [ ] Consent banner plus a preferences centre (necessary / analytics / advertising), stored in a first-party cookie (no server-side profile). Consent is versioned so it can be re-prompted when the policy changes. A "Cookie settings" link stays in the footer.
- [ ] GA4 Consent Mode v2, with `analytics_storage`, `ad_storage`, `ad_user_data` and `ad_personalization` all defaulting to denied.
- [ ] A notice at every collection point: a short purpose statement plus a link to the Privacy Policy, an unticked consent checkbox where consent is the basis, and a record of the consent timestamp and notice version.
- [ ] Data principal rights workflow: `/privacy-request` → email verification → admin queue with a due date → fulfilment (export JSON / correction / erasure across collections) → closure email.
- [ ] Erasure implementation: a service that deletes or anonymises by email across `contact_enquiries`, `feedback`, `reports` and `privacy_requests`, logged in the audit log without the PII.
- [ ] Retention: configurable TTL per collection, with a nightly `retentionSweep` job.
- [ ] Breach response runbook: detection → containment → assessment → notifications to the Data Protection Board and affected people within the prescribed timelines ⚖️.
- [ ] Processor register (in `docs/legal/processors.md`): AWS (hosting/S3), MongoDB Atlas, Cloudflare, Google (GA4, GAM, reCAPTCHA if used — we propose Cloudflare Turnstile instead), the email provider (to be chosen: SES proposed), and the error monitoring provider (Sentry proposed — with PII scrubbing). ⚖️ DPAs to be signed and reviewed.
- [ ] Security safeguards (doc 10) referenced in the policy truthfully.

## 4. Legal pages to draft (each with configurable placeholders — nothing invented)
1. Privacy Policy — generated from the actual data inventory above
2. Terms and Conditions
3. Cookie Policy — generated from the actual cookie/script list
4. Disclaimer — accuracy, independence, no guarantee of results ("sensitivity is personal")
5. Copyright & IP Policy + takedown procedure
6. Grievance Redressal Policy — Grievance Officer name, email, address and timelines **[placeholders until provided]**
7. Community Guidelines — for feedback and code submissions
8. Advertising Disclosure
9. Affiliate Disclosure
10. Content Reporting & Removal Policy

Production guard: a legal page containing an unresolved placeholder, or with `reviewedByCounsel=false`, **cannot be published to production** (only an explicit Super Admin override, which is logged).

## 5. Items counsel must review before launch ⚖️
- Intermediary status and Grievance Officer obligations.
- DPDP sections in force on the launch date; the children's-data approach; the legitimate-use basis for security logs.
- Whether listing third-party tournaments that have prize pools creates any obligation, and the wording of verification disclaimers.
- The Online Gaming Act 2025 scope: confirm that free-to-enter e-sports information listings are outside the "online money game" restrictions, and confirm the advertising blocklist approach.
- Use of game names, screenshots and trailers under fair dealing.
- All final policy texts, entity details and retention periods.
