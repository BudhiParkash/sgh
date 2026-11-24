# AI content playbook (Claude + MCP)

How to use Claude, connected to the site through the MCP connector, to research and draft content. How the connector works is described in [architecture/14-mcp-server.md](architecture/14-mcp-server.md).

## Who does what
| | Claude (AI agent) | You (admin) |
|---|---|---|
| Research, create and edit drafts (tournaments, sensitivity setups, devices, gun guides, articles, categories, tags) | ✅ | ✅ |
| Run publish checks and submit for review | ✅ | ✅ |
| Upload images to the media library and attach them to drafts | ✅ (can't edit or delete existing images) | ✅ |
| **Publish**, verify, delete | ❌ | ✅ |
| **Settings** and **Legal pages** | ❌ | ✅ (with a lawyer for legal pages) |

The site enforces this for every AI agent, whatever role it is given. Claude drafts, and a human publishes.

---

## 1. One-time setup in Claude
1. claude.ai → **Projects → Create project** → name it **Shivanshi Gaming Hub**.
2. Paste the master prompt below into **Project instructions**.
3. In every chat in this project, turn on the **Shivanshi Gaming Hub** connector and **Web search** from the tools menu.

The connector is set up in Admin → **AI agents**; see [14-mcp-server.md](architecture/14-mcp-server.md#connecting).

### Master prompt (Project instructions)
```
You are the content researcher and editor for Shivanshi Gaming Hub (https://shivanshigaming.com), an independent English-language information site about BGMI and PUBG Mobile for players in India. You work through the "Shivanshi Gaming Hub" connector (MCP).

START OF EVERY CHAT
1. Call get_guidelines and follow those rules strictly. They override anything else.
2. Call get_overview to see what exists and what needs attention.

HOW TO WORK
- Before creating anything: search_content to avoid duplicates, list_reference_data for ids, get_schema for the exact fields of that content type.
- Create with create_content. Everything you create is a draft.
- Run get_publish_checks and fix every blocking problem with update_content (always pass the latest version from get_content).
- When an item has no blocking problems, send it for review with content_action → submit.
- Give me a get_preview_link for each item you submit.

TRUTH RULES (never break these)
- Use web search for every fact. Never invent dates, prize pools, teams, results, patch notes, device specs or sensitivity values.
- Tournaments: officialSourceUrl must be the organiser's own announcement (KRAFTON/BGMI official site or the organiser's official YouTube/Instagram/X). News sites go in additional sources. If there is no official announcement, mark it as a rumour.
- Sensitivity: never label a setup "tested". Use "community" (with the source, e.g. a pro player's published code, credited) or "baseline". If you can't verify the numbers, don't create it.
- All dates in IST, ISO 8601 with +05:30.
- Write in your own words. No copied text, and no game artwork, logos or screenshots. Only use images from list_media.
- No betting, gambling, entry fees, real-money gaming, hacks, mods or cheats.
- If a fact can't be verified, leave the field empty and tell me. Don't guess.

QUALITY
- Write for Indian BGMI players: clear, practical, specific. No filler and no thin pages.
- Every article needs a unique angle, real headings, an FAQ where it helps, and internal links to related pages on the site.

AT THE END OF EVERY TASK, REPORT
A table with: title | type | status (submitted / draft + why) | preview link | sources used | anything I must check or add myself.
```

---

## 2. Task prompts
Use one task per chat; start a fresh chat for each big task.

### 2.1 First run: audit and plan
```
Audit the site: call get_overview, get_seo_overview, and search_content for every content type. Tell me what exists, what's missing, and give me a prioritised plan of the first 20 items to create (tournaments, sensitivity setups, device pages, gun guides, guides/news). Don't create anything yet — wait for my OK.
```

### 2.2 Tournaments
```
Research current and upcoming official BGMI esports tournaments (BGIS, BGMS, BMPS and other KRAFTON India events, plus major officially announced third-party events) for the next 3 months. For each one with an official announcement, check search_content for duplicates, then create or update the tournament draft with official dates (IST), format, prize pool only if officially stated, and the official source link. Run publish checks, fix problems, submit for review, and report the table.
```

### 2.3 Sensitivity setups
```
Find 10 BGMI sensitivity setups that pro players or well-known creators have publicly shared (with their sensitivity code or a video showing the settings). Create each as a "community" setup with the creator credited and the source linked. Only use values you can see in the source. Include the device and gyro/non-gyro where stated. Run publish checks, submit, report.
```

### 2.4 Devices and gun guides
```
Create device pages for the 15 phones most popular with BGMI players in India (check search_content first). Use only official specs (manufacturer site) plus officially supported BGMI frame rates where a reliable source confirms them. Then create gun guides for the 10 most-used BGMI weapons with stats from reliable sources, recoil tips, and best attachments in your own words. Submit and report.
```

### 2.5 Guides and articles
```
Write 5 in-depth guide drafts using the write_guide prompt:
1) Best BGMI sensitivity settings for beginners
2) How to reduce recoil in BGMI (gyro and non-gyro)
3) BGMI graphics settings for smooth 60/90/120 FPS
4) How to improve close-range fights in BGMI
5) BGMI ranked tips to push to Conqueror
Original writing, real headings, an FAQ, internal links to related site pages. Run publish checks, submit, report.
```

### 2.6 Weekly update (every week)
```
Weekly update: check get_overview's "needs attention" list. Update tournaments whose status changed (upcoming → ongoing → completed, with official results only). Look for new official BGMI announcements, patch notes and events from the past 7 days and draft news items for them. Fix any SEO issues from get_seo_overview. Submit everything and report.
```

### 2.7 Images for existing drafts
```
For each item I list below (or every draft without a featuredImage if I list none): check list_media for a suitable existing image first. If none fits, create an original image (no game screenshots, logos, characters or real people), export it as WebP about 1280 px wide and under 300 KB, and upload it with upload_media (licence "original", licenceNotes saying how it was made, clear alt text, the right category). If you use an official press-kit image instead, use licence "press_kit" with the source URL in licenceNotes and the owner in credit. Then attach it with update_content (featuredImage = media id) without changing any other field. Report: item | media id | image URL | licence.
```

Image rules the connector enforces: JPEG, PNG, WebP or AVIF, at most 8 MB, at least 64×64. Links must be public `https://` addresses. Alt text, a licence and source notes are required. The site converts every upload to WebP/AVIF and strips metadata. Claude can add images but can't edit or delete existing ones.

---

## 3. Review and publish (you)
1. Go to https://shivanshigaming.com/admin, open a list (Tournaments, Articles…) and filter **Status = Review**.
2. Open each item. Check the facts against its source links and use **Preview** to see the page.
3. Tournaments: click **Record verification** after checking the official source.
4. Click **Publish**. The live site updates within seconds.
5. To ask for changes, tell Claude in the chat, e.g. *"Fix the prize pool on X and resubmit."*

The **Audit log** shows everything each AI agent did. To stop an assistant: Admin → AI agents → **Pause**, revoke its token, or **Disconnect** it under Connected assistants.

---

## 4. Legal pages (you, with a lawyer — never AI)
Legally required under India's DPDP Act and IT Rules. Real details only; nothing may be invented.

**Step 1: Admin → Settings.** Fill in:

| Field | What to enter |
|---|---|
| Owner / Site name | Shivanshi Tripathi / Shivanshi Gaming Hub |
| Legal entity name | The company name. If there's no company, the owner's legal name, as your lawyer advises. |
| Registered address | The real postal address |
| Court jurisdiction (city) | As your lawyer advises |
| Contact email | Your contact address |
| Grievance Officer name / email | Budhi Parkash / budhiparkash00@gmail.com |
| Grievance Officer postal address | A real postal address (required by law) |
| Retention: contact enquiries, feedback, reports, hashed IPs | Number of days for each (decide with your lawyer) |

**Step 2: Admin → Legal pages.** For each of the 10 pages:
1. Check that no "missing value" warnings are left.
2. Set the **Effective date**.
3. Have a lawyer check it, then tick **Reviewed by legal counsel**.
4. Click **Publish**.

In production the site blocks publishing until all of this is done.

**Step 3:** Check that https://shivanshigaming.com/legal/privacy-policy and all footer links open.

If the lawyer wants wording changes, the page drafts live in `backend/src/modules/legal/legal.drafts.ts`.
