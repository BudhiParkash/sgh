import type { LegalSlug } from "./legal.model.js";

/**
 * DRAFT legal documents describing the platform as actually implemented (Phase 1).
 * Business facts are {{tokens}} filled from Settings — nothing is invented.
 * These drafts MUST be reviewed by qualified Indian legal counsel before production publishing
 * (enforced: `reviewedByCounsel` + no unresolved placeholders).
 */
export const LEGAL_DRAFTS: Record<LegalSlug, { title: string; html: string }> = {
  "privacy-policy": {
    title: "Privacy Policy",
    html: `
<p>This Privacy Policy explains how {{site.name}} ({{site.url}}), operated by {{owner}}, collects and uses personal data. We collect as little as we can: you can read everything on this website without creating an account or telling us who you are.</p>
<h2>Who is responsible</h2>
<p>The website is operated by {{owner}}. Legal entity: {{company.legalName}}. Address: {{company.registeredAddress}}. Contact: {{contact.email}}.</p>
<h2>What we collect and why</h2>
<ul>
<li><strong>Contact form</strong> — your name, email address, subject and message, to reply to you.</li>
<li><strong>Feedback</strong> — whether a page helped, an optional comment, and an email address only if you ask for a reply.</li>
<li><strong>Content reports and copyright notices</strong> — your name, email, the page concerned, your description and any evidence links, to handle the report as required by law.</li>
<li><strong>Privacy requests</strong> — your email address and request details, to verify and fulfil your request.</li>
<li><strong>Share-code submissions</strong> — the code, phone model and the display name you choose (it does not need to be your real name).</li>
<li><strong>Player accounts (optional, 18+ only)</strong> — if you sign in with Google to play Shivanshi Custom Rooms or collect SGC coins, we receive your Google account ID, name, email address and profile picture. You add a display name, your BGMI in-game name and your BGMI Character ID. We record that you confirmed you are 18 or older and accepted our terms, plus your squads, room registrations and results, your SGC coin history and reward redemptions. Voucher codes we send you are stored encrypted. We use hashed IP addresses to detect duplicate or fraudulent accounts.</li>
<li><strong>Security data</strong> — your IP address is used briefly to protect the site from abuse (rate limiting and spam prevention). We store only a keyed one-way hash of it, kept for {{retention.ipHashes}}.</li>
<li><strong>Analytics</strong> — only if you accept analytics cookies, we use Google Analytics 4 to understand which pages are useful. Advertising features and Google signals are switched off.</li>
<li><strong>Advertising</strong> — if advertising is enabled, ads are non-personalised unless you have accepted advertising cookies.</li>
</ul>
<p>We do not collect your date of birth, phone number or payment details, and we never sell personal data. Room results show your team name and in-game name publicly; your email address and Character ID are never shown publicly.</p>
<h2>Children</h2>
<p>Player accounts are for people aged 18 or older only. Many gamers are under 18: we do not knowingly create accounts for, track or profile children or show them targeted advertising. If you are under 18, please ask a parent or guardian before sending us any form. If you believe a child has created an account or sent us personal data, contact us and we will delete it.</p>
<h2>Who we share data with</h2>
<p>We use service providers who process data on our behalf: Amazon Web Services (hosting, India region), our database host, Cloudflare (content delivery and security), an email delivery provider (to send replies), Google (sign-in for player accounts, and analytics or advertising only if you consent to those cookies), and YouTube (embedded live streams of custom rooms). We may disclose information where required by law.</p>
<h2>How long we keep it</h2>
<ul>
<li>Contact enquiries: {{retention.contactEnquiries}}.</li>
<li>Feedback: {{retention.feedback}}.</li>
<li>Reports and grievances: {{retention.reports}}, or longer where the law requires.</li>
<li>Hashed IP addresses: {{retention.ipHashes}}.</li>
<li>Player accounts: until you delete your account (Account → Delete account). Deleting erases your name, email, Google ID, in-game name and Character ID; past room results stay under “Deleted player”, and an anonymous coin history is kept for fraud prevention and accounting.</li>
</ul>
<h2>Security</h2>
<p>Data is encrypted in transit (HTTPS) and stored on access-controlled systems. Staff access requires two-factor authentication and every administrative change is logged.</p>
<h2>Your rights</h2>
<p>Subject to applicable law, including the Digital Personal Data Protection Act, 2023, you may ask to access, correct or erase your personal data, withdraw consent, raise a grievance, or nominate another person to exercise your rights. Use the <a href="/privacy-request">privacy request form</a>. We verify your email address before acting on a request.</p>
<h2>Cookies</h2>
<p>See our <a href="/legal/cookie-policy">Cookie Policy</a>. You can change your choices at any time using “Cookie settings” at the bottom of every page.</p>
<h2>Grievance Officer</h2>
<p>{{grievanceOfficer.name}}, {{grievanceOfficer.email}}, {{grievanceOfficer.address}}. See the <a href="/legal/grievance">Grievance Redressal Policy</a>.</p>
<h2>Changes</h2>
<p>We will update this page when our practices change and show the effective date. Earlier versions are available on request.</p>`,
  },
  terms: {
    title: "Terms and Conditions",
    html: `
<p>These terms apply to your use of {{site.name}} ({{site.url}}), operated by {{owner}}. By using the website you agree to them.</p>
<h2>What we offer</h2>
<p>{{site.name}} is a free information and community website about BGMI and PUBG Mobile: tournament listings, sensitivity settings, guides and news. Using the website is free.</p>
<p><strong>We do not run paid competitions.</strong> We do not charge entry fees, accept deposits, operate wallets, sell coins or offer betting of any kind. For third-party tournaments listed on the website, registration happens on the organiser's own website, under the organiser's own rules.</p>
<h2>Player accounts, Shivanshi Custom Rooms and SGC coins</h2>
<p>You can optionally create a player account (18+ only) with Google sign-in to join our free custom rooms and collect SGC coins. These are governed by our <a href="/legal/custom-room-rules">Custom Room Rules</a> and <a href="/legal/sgc-rewards-terms">SGC Rewards Terms</a>, which form part of these terms. Keep your account to yourself — one account per person.</p>
<h2>Independence</h2>
<p>{{site.name}} is an independent fan-made gaming information and community platform. It is not affiliated with, endorsed by, or sponsored by KRAFTON or Tencent Games unless expressly stated. Game names and trademarks belong to their owners.</p>
<h2>Accuracy</h2>
<p>We verify tournament details against official announcements and show when each item was last checked, and we label sensitivity settings by how they were obtained. Details can still change without notice, so always confirm with the official source before relying on them.</p>
<h2>Things you send us</h2>
<p>When you submit a share code, feedback or a report, you confirm that you have the right to share it and you allow us to display and use it to run the website. Please follow our <a href="/legal/community-guidelines">Community Guidelines</a>.</p>
<h2>Acceptable use</h2>
<p>Do not misuse the website: no attempts to disrupt or gain unauthorised access, no automated scraping that harms the service, no unlawful content, and no promotion of cheats, hacks or real-money gaming.</p>
<h2>Third-party links and ads</h2>
<p>We link to organisers, publishers and other websites. We are not responsible for their content or practices. Advertising and affiliate links are labelled; see our <a href="/legal/advertising-disclosure">Advertising Disclosure</a> and <a href="/legal/affiliate-disclosure">Affiliate Disclosure</a>.</p>
<h2>Our content</h2>
<p>Text, graphics and the {{site.name}} brand are ours or used with permission. You may share links and short quotes with attribution.</p>
<h2>Liability</h2>
<p>The website is provided “as is”. To the extent permitted by law, we are not liable for losses arising from reliance on information on the website or on third-party websites.</p>
<h2>Governing law</h2>
<p>These terms are governed by the laws of India. Courts at {{legal.jurisdiction}} will have jurisdiction, subject to applicable law.</p>
<h2>Contact</h2>
<p>{{contact.email}}</p>`,
  },
  "cookie-policy": {
    title: "Cookie Policy",
    html: `
<p>This page lists the cookies and similar storage used by {{site.name}}. Only strictly necessary storage is used without your consent.</p>
<h2>Strictly necessary</h2>
<ul>
<li><strong>sgh_consent</strong> — remembers your cookie choices (12 months).</li>
<li><strong>Session cookie (staff only)</strong> — keeps website staff signed in to the admin area. Visitors never receive it.</li>
<li><strong>sgh_preview (staff only)</strong> — lets staff preview unpublished pages (30 minutes).</li>
<li><strong>sgh-reduce-effects (local storage)</strong> — remembers if you switched off 3D effects. Stays on your device.</li>
</ul>
<h2>Analytics (only with your consent)</h2>
<p>Google Analytics 4 cookies (names starting with <code>_ga</code>) help us understand which pages are useful. They are set only after you accept analytics cookies, for the periods set by Google.</p>
<h2>Advertising (only with your consent)</h2>
<p>If advertising is enabled, Google Ad Manager may use cookies to show and measure ads. Without your consent, only non-personalised ads are requested.</p>
<h2>Changing your choices</h2>
<p>Use “Cookie settings” at the bottom of any page. You can also delete cookies in your browser settings.</p>`,
  },
  disclaimer: {
    title: "Disclaimer",
    html: `
<p>Shivanshi Gaming Hub is an independent fan-made gaming information and community platform. It is not affiliated with, endorsed by, or sponsored by KRAFTON or Tencent Games unless expressly stated.</p>
<h2>Sensitivity settings</h2>
<p>Sensitivity is personal. Each setup shows whether it was tested by a named tester, submitted by the community, or is a baseline for a class of phones. Use any setup as a starting point and fine-tune it yourself.</p>
<h2>Tournaments</h2>
<p>Tournaments are organised by third parties. We list them for information only, link the official announcement and show when we last checked it. Unconfirmed events are labelled as rumours. Always confirm details with the organiser.</p>
<h2>No guarantees</h2>
<p>We do not promise rankings, wins, rewards or earnings of any kind.</p>
<h2>Advertising and affiliates</h2>
<p>Some pages show labelled advertisements or affiliate links. See the <a href="/legal/advertising-disclosure">Advertising Disclosure</a> and <a href="/legal/affiliate-disclosure">Affiliate Disclosure</a>.</p>`,
  },
  copyright: {
    title: "Copyright and Intellectual Property Policy",
    html: `
<p>We respect intellectual property. {{site.name}} uses its own original graphics and branding. Game names, logos, maps, characters and other game assets belong to their respective owners and are not used to suggest any affiliation.</p>
<h2>Our use of third-party material</h2>
<p>We may quote or reference publicly announced information for news reporting, review and commentary, with attribution and links to the source. Images are used only when original, licensed, or provided in an official press kit.</p>
<h2>Reporting infringement</h2>
<p>If you believe content on this website infringes your copyright, submit a notice through our <a href="/report">report form</a> (choose “Copyright”) or email {{grievanceOfficer.email}}. Include: the page URL, the work you own, evidence of ownership, and your contact details.</p>
<p>We will acknowledge your notice and act on it within the timelines required by applicable law, which may include removing or disabling access to the material.</p>
<h2>Counter-notice</h2>
<p>If your content was removed and you believe this was a mistake, contact us with the details and we will review it.</p>`,
  },
  grievance: {
    title: "Grievance Redressal Policy",
    html: `
<p>This policy explains how to raise a complaint about {{site.name}}, including about content on the website or how we handle your personal data.</p>
<h2>Grievance Officer</h2>
<p>Name: {{grievanceOfficer.name}}<br>Email: {{grievanceOfficer.email}}<br>Address: {{grievanceOfficer.address}}</p>
<h2>How to complain</h2>
<p>Use the <a href="/report">report form</a> or email the Grievance Officer. You will receive a ticket number.</p>
<h2>Timelines</h2>
<p>We acknowledge complaints within 24 hours and aim to resolve them within 15 days, or within any shorter period required by applicable law for specific types of content.</p>
<h2>Outcome</h2>
<p>We will tell you what we decided and why. If you disagree, reply to the same ticket and the decision will be reviewed.</p>`,
  },
  "community-guidelines": {
    title: "Community Guidelines",
    html: `
<p>These guidelines apply to everything you send us: share codes, feedback, reports and messages.</p>
<ul>
<li>Be respectful. No harassment, hate or threats.</li>
<li>Share only your own work, and only accurate information.</li>
<li>Don't post personal information — yours or anyone else's.</li>
<li><strong>No cheats, hacks, mods, account selling or anything that breaks a game's rules.</strong></li>
<li>No promotion of betting, real-money gaming, paid tournament slots or “guaranteed earnings”.</li>
<li>No spam, impersonation or misleading claims.</li>
</ul>
<p>We review submissions before they appear and may remove anything that breaks these guidelines.</p>`,
  },
  "advertising-disclosure": {
    title: "Advertising Disclosure",
    html: `
<p>{{site.name}} is free to use and is supported by advertising, sponsorships and affiliate links.</p>
<ul>
<li>Every ad is labelled “Advertisement”. Paid articles are labelled “Sponsored” above the headline and name the sponsor.</li>
<li>Advertisers do not decide what we write, test or verify.</li>
<li>We do not accept advertising for betting, gambling or real-money gaming.</li>
<li>Ads are non-personalised unless you have accepted advertising cookies.</li>
</ul>
<p>Questions about advertising: {{contact.email}}</p>`,
  },
  "affiliate-disclosure": {
    title: "Affiliate Disclosure",
    html: `
<p>Some links on {{site.name}} are affiliate links (they go through <code>/go/…</code>). If you buy something after clicking one, we may earn a commission at no extra cost to you.</p>
<p>Articles that contain affiliate links say so at the top. We only recommend products we believe are useful to mobile gamers; commissions do not change our opinions.</p>`,
  },
  "content-reporting": {
    title: "Content Reporting and Removal Policy",
    html: `
<p>You can report anything on {{site.name}} that is inaccurate, infringes rights, invades privacy, is offensive or impersonates someone.</p>
<h2>How to report</h2>
<p>Use the <a href="/report">report form</a>. Tell us the page, the problem and any evidence. You'll receive a ticket number.</p>
<h2>What happens next</h2>
<ul>
<li>We acknowledge your report within 24 hours.</li>
<li>We review it and may correct, restrict or remove the content.</li>
<li>We aim to close reports within 15 days, or faster where the law requires.</li>
</ul>
<p>Corrections to tournament or sensitivity information are made as soon as we verify them against official sources.</p>`,
  },
  "custom-room-rules": {
    title: "Shivanshi Custom Room Rules",
    html: `
<p>These rules apply to Shivanshi Custom Rooms — free BGMI custom-room matches organised by {{site.name}} ({{site.url}}), operated by {{owner}}. They form part of our <a href="/legal/terms">Terms and Conditions</a>.</p>
<h2>Free to play</h2>
<p>Custom rooms are always free. There is no entry fee, deposit or purchase of any kind, and no betting or wagering on results.</p>
<h2>Who can play</h2>
<ul>
<li>You must be 18 or older and have a {{site.name}} player account.</li>
<li>Your profile must show your own BGMI in-game name and Character ID. One account per person, and one Character ID per account.</li>
<li>You must follow BGMI's own terms of service. {{site.name}} is not affiliated with KRAFTON.</li>
</ul>
<h2>Registration and slots</h2>
<ul>
<li>Solo rooms: register yourself. Duo and squad rooms: the squad captain registers the squad and chooses the players (and an optional substitute for squads).</li>
<li>A player can be in only one team per room. Slots are given in order of registration; when a room is full, teams join the waitlist and move up automatically if a confirmed team withdraws before registration closes.</li>
<li>Captains can withdraw their team until registration closes.</li>
</ul>
<h2>Room ID and password</h2>
<p>The room ID and password are shown only to players of confirmed teams on the room page, shortly before each match. Do not share them. Join the room with the account that matches your registered Character ID and take the slot you were given.</p>
<h2>Fair play</h2>
<p>The following lead to disqualification and may lead to an account ban: hacks, mods, scripts or any unauthorised software; emulators unless the room says they are allowed; teaming with other teams; stream sniping; exploiting bugs; playing with someone else's account or Character ID; abusive behaviour; or sharing the room details.</p>
<h2>Scoring and results</h2>
<p>Each room shows its points table. Unless a room says otherwise: placement points 10, 6, 5, 4, 3, 2, 1, 1 for places 1 to 8 (0 below), plus 1 point per kill. Ties are broken by total placement points, then total kills, then placement in the last match played. Results are entered by our team from the match; standings are final when the room is marked completed.</p>
<h2>Disputes</h2>
<p>Raise a dispute within 24 hours of a match by writing to {{contact.email}} with your team name, match number and evidence. Our decision on disputes and disqualifications is final, subject to applicable law.</p>
<h2>Prizes</h2>
<p>Prizes, if any, are SGC coins credited to every player of the winning team's registered lineup, as shown on the room page. SGC coins are covered by the <a href="/legal/sgc-rewards-terms">SGC Rewards Terms</a>; they have no cash value.</p>
<h2>Streaming</h2>
<p>Matches may be streamed and recorded on our channels. Team names and in-game names appear in the stream and in public results.</p>
<h2>Changes and cancellations</h2>
<p>We may reschedule, change or cancel a room or match (for example because of technical issues or game updates). We'll show the change on the room page.</p>`,
  },
  "sgc-rewards-terms": {
    title: "SGC Coins and Rewards Terms",
    html: `
<p>These terms explain SGC coins and the rewards store on {{site.name}} ({{site.url}}), operated by {{owner}}. They form part of our <a href="/legal/terms">Terms and Conditions</a>.</p>
<h2>What SGC coins are</h2>
<p>SGC coins are free loyalty points on our website. They are <strong>not money</strong>: they cannot be bought, sold, transferred to anyone else, or exchanged for cash, and they have no monetary value. They can only be used in the {{site.name}} rewards store.</p>
<h2>How you get them</h2>
<ul>
<li><strong>Daily spin</strong> — one free spin per India calendar day (IST). Every result is a number of SGC coins; the wheel never pays out vouchers, cash or items directly.</li>
<li><strong>Daily streak</strong> — spinning on consecutive days earns bonus coins on the days shown on the rewards page. Missing a day restarts the streak.</li>
<li><strong>Custom room prizes</strong> and occasional promotions announced on the website.</li>
</ul>
<p>Nothing is ever charged for any of these: there is no entry fee, deposit, purchase or stake.</p>
<h2>Rewards store</h2>
<ul>
<li>Rewards (for example official BGMI UC or Royal Pass gift vouchers) are bought by us from authorised partners and offered while stock lasts. The coin price, stock and limits are shown in the store.</li>
<li>To redeem, you need a player account that meets the conditions shown in the store (such as a minimum account age and your BGMI Character ID on your profile). Monthly and per-reward limits apply.</li>
<li>Every redemption is reviewed by our team. Approved vouchers are delivered as a code in your account; voucher codes are subject to the issuer's and KRAFTON's terms.</li>
<li>If we reject a redemption, the coins are returned to your account.</li>
</ul>
<h2>Fair use</h2>
<p>One account per person. Multiple accounts, automated spinning, false information or any attempt to abuse the system may lead to rejected redemptions, removal of coins and closure of the account.</p>
<h2>Changes and ending the programme</h2>
<p>We may change coin amounts, rewards, prices or limits, or end the programme, by updating this page and the rewards page. Coins have no value outside the website and are removed when an account is deleted or closed for abuse.</p>
<h2>Independence</h2>
<p>{{site.name}} is not affiliated with, endorsed by, or sponsored by KRAFTON or Tencent Games. BGMI, UC and Royal Pass are trademarks of their owners.</p>
<h2>Questions and grievances</h2>
<p>{{contact.email}}. See the <a href="/legal/grievance">Grievance Redressal Policy</a>.</p>`,
  },
};
