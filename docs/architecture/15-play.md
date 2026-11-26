# 15 — Play: player accounts, squads, custom rooms, SGC coins and rewards

The engagement layer of the site, for **BGMI only**. "PUBG Mobile" appears in titles and descriptions for SEO; it is not a separate game here. The owner decided:

- **Accounts:** 18+ only.
- **Sign-in:** Google.
- **Daily engagement:** a daily spin plus a streak bonus.
- **Rewards:** official BGMI gift-voucher codes, which the owner buys and an admin sends.

## Legal guardrails (must stay true)
- **Free to play.** There are no entry fees, coins can't be bought, and there is no wallet top-up. India's Online Gaming Act 2025 bans *online money games*, meaning games where the user pays a fee, deposit or stake.
- **SGC coins can't leave the site.** They are non-transferable, can't be cashed out and have no money value. They can only be spent in the rewards store. The 2026 Rules look at whether rewards can be converted to money outside the game.
- **The spin wheel only pays coins.** UC and Royal Pass vouchers are never won directly; they are only redeemed from the store.
- **18+ only.** Under DPDP, under-18s are children and need verifiable parental consent.
- **Independence.** The site is not affiliated with KRAFTON. Players must follow BGMI's terms (no hacks or emulators unless a room allows them).
- **Counsel review.** The *Custom room rules* and *SGC rewards terms* legal drafts must be reviewed by counsel before launch.

## Accounts (`/api/v1/player/*`)
- **Google sign-in.** The browser gets a Google ID token from Google Identity Services. The API verifies it with Google's JWKS: signature, issuer, `aud = GOOGLE_CLIENT_ID`, and `email_verified`.
- **Agreements at first sign-in.** The player must confirm they are 18+ and accept the Terms and Privacy Policy. Both are recorded with versions and a timestamp.
- **Sessions.** A separate cookie (`__Host-sgh_psid`) and Redis store from the admin side. 30-day sliding expiry and a CSRF token.
- **Profile.** Display name, BGMI in-game name and **Character ID**, which is unique: one per account. The Character ID is locked once a reward has been redeemed.
- **Deleting an account.** The player can delete their account. Personal data is erased. Tournament results stay, shown as "Deleted player".

## Squads
- **Members.** Up to 5 (4 players plus 1 substitute). One captain. Others join with an 8-character invite code, which the captain can reset.
- **Limits.** A player can be in up to 3 squads.

## Custom rooms ("Shivanshi Custom Rooms", `/custom-rooms/[slug]`)
- **Room setup.** An admin creates a room event with:
  - mode: solo, duo or squad
  - perspective: TPP or FPP
  - maps for each match: Erangel, Miramar, Sanhok, Vikendi, Livik, Rondo, Karakin, Nusa
  - the slot count and the registration window
  - the rules, prizes and points table
- **Registration.**
  - Solo players register themselves.
  - For duo and squad, the captain registers a squad and picks its players: 2 for duo, or 4 plus an optional substitute for squad.
  - Every player in the entry needs a Character ID.
  - A player can only be in one entry per room. This is enforced by a unique index.
- **Slots.**
  - Slots are allocated atomically: a freed slot is reused first, then the next number.
  - When a room is full, new entries go to a waitlist.
  - If a confirmed entry withdraws before registration closes, the earliest waitlisted entry is promoted into that slot.
- **Room ID and password.** Stored encrypted. They're shown only to signed-in members of confirmed entries, from `revealMinutes` (default 15) before the match starts.
- **Live.** BGMI has no public API, so live means the owner's YouTube stream, embedded with `youtube-nocookie`. Each match has a status: scheduled, live, completed or cancelled.
- **Results.**
  - After each match, an admin enters placement and kills per entry.
  - Standings = placement points + kill points. The default follows the current BGMI esports standard: 10, 6, 5, 4, 3, 2, 1, 1 for places 1–8, then 0, plus 1 point per kill. It can be edited per room.
  - Tiebreakers: total placement points, then total kills, then placement in the last match played.
- **Winners.** When the admin completes the room, the final standings are frozen and prizes in SGC coins are credited to every member of the winning entries. Credits are idempotent. Disqualified entries are excluded.

## SGC coins
- **Ledger.** An append-only ledger (`CoinTransaction`) with a unique `refKey` for idempotency. Each player's balance is updated atomically (`$inc`, guarded by `$gte` for spending).
- **Daily spin.** One per India calendar day (IST).
  - The server picks the result with `crypto.randomInt` from weighted outcomes set in Settings.
  - Consecutive days build a streak, and bonus days (by default day 3 and day 7) add extra coins.
  - Missing a day resets the streak.
- **Other sources.** Coins also come from room prizes and admin adjustments, which need a reason and are audited.

## Rewards store and redemption
- **Rewards.** Each reward has a title, coin cost, stock, a per-player limit per 30 days, and active/inactive.
- **Redeeming.**
  - Coins are taken atomically and a *pending* request is created.
  - An admin either **fulfils** it by pasting the official voucher code, which is stored encrypted and shown only to that player, or **rejects** it, which refunds the coins.
- **Anti-abuse.**
  - The account must be at least N days old (Settings, default 7) and have a Character ID.
  - A monthly cap applies to each player.
  - There's a per-account rate limit.
  - The admin queue shows risk signals: other accounts from the same network (hashed IP) and account age.
  - Banned players can't sign in, spin or redeem.

## Admin
New permissions: `player:*`, `room:*`, `reward:*` and `redemption:*`. AI agents never get them: the MCP permission ceiling strips them because they involve personal data and things of value.

New admin pages:
- **Players:** search, ban, and coin adjustments.
- **Custom rooms:** settings, matches, results entry, registrations and complete.
- **Rewards.**
- **Redemptions:** the approval queue.
