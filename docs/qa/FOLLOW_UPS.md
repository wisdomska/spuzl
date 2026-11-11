# Follow-ups

What is still open after round 4 (10 Nov 2026), what was left as it is on purpose, and what round 4 closed. Every
item from earlier rounds that has since been done is gone from this list (see CHANGELOG.md for when).

## Open: needs the owner

- **Preview email:** production sends codes through Brevo SMTP with the SPUZL code templates. The preview project has
  no custom SMTP, so it still uses the built-in mailer (2 emails an hour, magic-link templates). Adding the same SMTP
  settings to the preview project needs the owner's Brevo and Supabase access.
- **Google brand verification:** the Search Console ownership tag is live on production; re-request verification from
  the Google Auth Platform Branding page (owner's Google account).
- **Content review notes (R4-C, 10 Nov):** the four content packs are reviewed and live-ready. Three calls for the
  owner:
  - Flagged lists Côte d'Ivoire's capital as Yamoussoukro (official), though the government mostly sits in Abidjan.
    The pack leaves out split capitals elsewhere; drop it, or keep it as the official answer.
  - Pinned's Cape Coast Castle, Elmina, Gorée Island and Bunce Island have neutral descriptions that don't mention
    the slave trade. Keep them neutral, or add a short, respectful line.
  - Two Truths says "Cabo Verde", Flagged says "Cape Verde". Both are right; pick one.
- **Daily Five typical scores (R4-S):** the score scale's typical scores are estimates from each game's scoring
  (Quickfire 400, Echo 8, Beat Tap 3000, Twins 550, Flinch 3000, Penalty 3000, ...). Tune them on the admin Library
  page after a week of play. Merge, Seven, Dead On, Stacked and Ricochet have none yet, so they score on time.

## Lab games switched on (11 Nov)

All 12 now fit 320 x 568, 375 x 667, 390 x 844 and 1280 x 800 on their easy boards (tests/e2e/r5-lab-fit.spec.ts),
and a switched-on lab game has its public page, How to play entry, llms.txt line and sitemap entry. Still open:

- **Graduated (done, 11 Nov 2026):** all twelve are live (migration 20261211300101); GAME_COUNT is 41 and the
  Explorer badges count their clears.
- **Hard boards on small phones:** Market Run mega (5 items, 5 rules) still scrolls about 200 px at 320 x 568 and
  375 x 667 (medium: 16 and 5 px); Tripwire mega about 128 / 102 px (its cells stop at 32 px); Killer Sums mega 6 px
  at 320 x 568. Market could fold its rule list behind a toggle on short screens; Tripwire mega needs pan and zoom
  like Light Up.
- **The first-slip tip:** once per device, the shell adds "That's a slip. Slips only lower your accuracy..." to the
  first rule break. On a 320 x 568 phone that 4-line feedback line pushes the tool bar about 6 px (seen in Market
  Run). A clamp on the feedback line would cover every game.
- **Emoji Hits (live)** scrolls 88 px at 320 x 568 before Start. It has its own board, not the quiz board.
- **Copy in code:** Tripwire, Pixl and Pinned keep some player-facing strings inline (cell labels, "World map",
  "km away", the practice line) instead of lib/copy.

## Left as it is, on purpose

- **Dusk swipe:** swipe up and down is not done; it would block page scroll when a finger starts on the board.
- **Guest session timing (R2-08):** the anonymous guest session is made at "Save my Spuz", after the age gate. Making it
  on the "Play now" tap would create an auth account before the birth step, including for under-13s who are then
  turned away.
- **Family Draw for under-16s (DECISIONS PD1):** drawings can't be checked before others see them. Draw It with preset
  words is on for 16+ (owner, 10 Nov) and stays off for under-16s; revisit only with an image classifier or
  pre-moderation.
- **Party TV for under-16 hosts:** refused (their rooms are friends only). Owner confirmed, 10 Nov.
- **Retired sealed quiz boards** (Hunch and the retired copies of Flagged and Pinned) still carry their string `ref`
  salt and sealed answers; move them to the guess transport if they come back.
- **Brute force:** the generators are deterministic, so someone with the game code could still match a served board
  to its content index by generating every index; the token only stops the guess route from helping.
- **Quads feedback on slow networks (R2-14):** answers are checked on the server, so on slow 3G the round trip alone
  can pass the 600 ms budget. The lifted four show a "checking" ring at once and "Checking…" after 250 ms.
- **Admin, still in code:** game icons (asset upload plus `scripts/prerender-3d.mjs`) and practice boards (the fixed
  seed `tutorial:<game>`; the per-game off switch is `practice.disabled`).

## Reference notes

- **Party size (1.50.0):** rooms hold up to 10 (the database's ceiling); the admin setting party.maxPlayers lowers
  it. Every progress update reaches everyone in the room, so messages grow with the square of the room size: rooms of
  7 or more send progress once a second (lib/multiplayer/constants progressMsFor). On Supabase's free Realtime plan
  (about 100 messages a second, 2 million a month) one full room of 10 is near the per-second limit; several big
  races at once, or more than 10, need the Pro plan.

- **Leagues:** the weekly rollover merges a tier below `leagues.minGroup` into the nearest tier (players keep their own
  tier through `league_members.home_tier`). With few active players most of the ladder can share one group; the table
  shows each player's own zones, but the group name is the host tier's.
- **Settings delay:** a setting reaches players within about 30 s (server cache) plus up to 60 s (edge cache of
  `/api/v1/settings/game`); the server refuses a switched-off game as soon as its own cache expires.
- **Prompt timing (R2-04):** the notification ask's "invite" trigger counts in-app invites only; the low-data prompt
  needs measured slow loads, so a fast device never sees it.
- **Landing to first clear** (admin metrics) starts at profile creation; visitors who leave before a profile exists
  are on the Onboarding completion card instead.
- **18+ round state** lives in server-only tables for the round and is wiped when it closes.
- **Hats (R4-H):** a hat shows when its wearer owns it (the Shop inventory); equipping sets `players.hat` and
  unequipping clears it, so the `equipped` flag isn't checked separately.
- **Tooling:** Turbopack doesn't follow a `node_modules` symlink outside the project (use `pnpm install --offline` in
  a worktree). The Daily pack's Periodic Background Sync only runs in installed Chrome-based apps.

## Closed in round 4 (1.45.0, 10 Nov)

Under-16 "Opens at 16" on Play live; Board Bay codes from under-16 hosts friends-only; signed-out Play returns to the
game; gates, invites and /daily skip the intro; the streak shield thank-you; Daily Five re-picks a switched-off lab
game and honours its reset hour; score games offer Party from their cards; Five fits 320 × 568 (and the board fit
re-arms when a layout changes under it); admin copy reaches every page; retention counts Board Bay moves; the stale
schedule flag; Metrics labels and birth years; rebuild upcoming days; Quads pool and audited export; join requests on
Home; one Duel clock (and no clock stepping back); practice before a challenge or Ghost Race; free-play share card;
Rage Ridge backdrop texture; Light Up zoom; Quickfire questions on open; Draw It ink stamped by the server; Party
Race XP cap; lab-game tap solvers; a test sign-in route; real first hints for Dusk and Nine; hats on every chip,
owned only; join requests in the data export; the Daily Five score scale; 18+ rooms count toward quests and badges;
the content review of Pinned, Flagged, Pixl and Two Truths.

## Closed in 1.44.1 (10 Nov)

The All games hydration warning (#418), keyboard play on the Four Up, Oware and Flip live boards, the Duel result
screens on short phones and laptops, Duel ink on gold, and a Gotcha or Dash level name pushing the page sideways.
