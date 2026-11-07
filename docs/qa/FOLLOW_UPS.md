# Follow-ups (outside the frictionless-play pass)

Things noticed while working on SPZ-01 to SPZ-27 that the tickets didn't cover, or that need a decision.

## Game play and rules

- **Dusk:**
  - Swipe up and down is not done; it would block page scroll when a finger starts on the board.
- **Guided first play:**
  - Before the first move, Dusk, Nine and Merge have no deduction, so the first hint coaches with the rule.

## Layout and motion

- Five still scrolls about 75 px at 320 × 568 (tiles at their 30 px floor, title row hidden). Six tile rows, the
  44 px keyboard and the tool bar need more than 568 px; fitting it needs a tool-bar-free layout or smaller keys.
- Light Up 10 × 10 cells are 36 px at 375 wide (30 px at 320). 44 px would need a smaller hard board or zoom.

## Accounts and email

- **Email:** production sends codes through Brevo SMTP with the SPUZL code templates. The preview project has
  no custom SMTP, so it still uses the built-in mailer (2 emails an hour, magic-link templates).
- **Google sign-in** is live on production. Google's brand verification needs the Search Console ownership tag
  (`GOOGLE_SITE_VERIFICATION` in Vercel), then a re-request from the Google Auth Platform Branding page.
- The work-email owner admin account still exists alongside wisdomska@gmail.com.

## Leagues and metrics

- The weekly rollover merges a tier below `leagues.minGroup` into the nearest tier (players keep their own tier
  through `league_members.home_tier`). With few active players most of the ladder can share one group; the
  table shows each player's own zones, but the group name is the host tier's.

## Tooling

- **Worktrees:** Turbopack doesn't follow a `node_modules` symlink outside the project; use
  `pnpm install --offline`.
- **Periodic Background Sync:** the Daily pack's background sync only runs in installed Chrome-based apps.

## 18+ party games (Draw It, Two Truths)

- **Age:** fixed in 1.7.0. Birth month and year are asked at sign-up and locked; the 18+ gate uses the derived band.
- **Round state in the database:** strokes, statements and guesses live in server-only tables for the round
  (needed on serverless hosts and for trustworthy report snapshots) and are wiped when it closes; nothing is kept
  in memory only.
- **Live ink sender:** the realtime transport doesn't say who sent a broadcast, so viewers keep live ink only when
  it names the round's drawer (from the server's view). A room member could still forge a line that shows for a
  few seconds until it times out or the stored drawing replaces it; reports and the canonical drawing only ever
  use stored strokes. Stamping the sender server side (a relay route, or Ably's clientId) would close it.
- **Rewards and quests:** 18+ rooms pay XP and Sparks but don't count toward quests, badges or the friends feed
  (those reach friends of any age). Party Race XP is still fixed in code with no daily cap.

## Content-game tokens and the 18+ fixes (1.5.0)

- **Quickfire** no longer ships answers: it is judged through the guess route, timed on the server and audited at
  finish (games/quickfire/logic.ts). Left open: the questions themselves still arrive with the board, so a player
  can read all five from the payload before opening the first one; the server window only bounds the time from
  each open. Closing that would mean the server hands out each question on open. Quickfire stays out of races
  (it is score-based); if it ever joins them, race rounds need a per-player move log first.
- **Retired sealed quiz boards** (Flagged, Hunch, Pinned) still carry their string `ref` salt and sealed answers,
  and their boards import their logic (with content) into the client bundle. Move them to the guess transport if
  they come back.
- **Admin content desk:** `SCHEDULABLE[...].guessRoute` blocks scheduling a custom item with copy saying the guess
  route can't resolve by puzzle, but attempt guesses already check the stored puzzle; the flag looks stale.
- **Brute force:** the generators are deterministic, so someone with the game code could still match a served
  board to its content index by generating every index; the token only stops the guess route from helping.

## Round 2

- **R2-04 prompt timing:** the "invite" trigger for the notification ask counts in-app friend invites (Duel or
  Party, sent through Invite your friends or received as an Inbox card). Sharing a code or link is not counted, as
  the app cannot tell whether anyone opened it. The audit suggests the low-data prompt on mobile only; it stays on
  every device but now needs measured slow loads, so a fast desktop never sees it. Navigations the service worker
  answers from cache (transfer size 0) are not measured as page loads; in-app link taps and tap-to-board still are.
- **R2-02, under-16 entry points outside Duel:** the Library game card (`components/library/GameCard.tsx`) and the world
  page board-game links (`components/world/LiveEntry.tsx`) still show "Play live" and "Quick Match" to 13 to 15
  accounts. The server refuses both (403 `age_restricted`, `lib/multiplayer/server/liveGate.ts`), so nothing widens,
  but the tap ends in an error. They should show the same muted "Opens at 16" note as Duel (`canPlayLive`).
- **R2-13, needs a privacy decision (left out on purpose):** join requests (`room_join_requests`) are not in the
  player's data export (`app/api/v1/account/export/route.ts`). Rows go with either account on deletion and are
  pruned after 180 days. Whether the export should list requests a player made or received (the other player's
  nickname included) is a privacy call for the lead.
- **R2-13, host away:** a request reaches the host only in the lobby (realtime plus a 15 s poll). There is no push
  or Home card, so a host who left the lobby screen won't see it until they come back. The asker can wait or cancel.
- **R2-13, Board Bay invites:** friends-only covers Party rooms and friend duels (the ticket). Board Bay invite codes
  from an under-16 host (`/api/v1/bay/[id]/join`) still let anyone with the code in.
- **Daily Five reset hour (R2-05):** with `dailyFive.resetHour` above 0, a Daily Five attempt's `daily_date` is the
  Daily Five day, while the offline-clear check in `finishAttempt` ("offline clear outside its day") and the regular
  Daily (when `features.dailies` is on) still use the GMT date. Keep the reset hour at 0 while Dailies are on, or
  teach those two places the Daily Five day.
- **Daily Five scoring (R2-05):** points come from time against the game's typical time (Library), hints and
  mistakes, so score-based games (Quickfire, Echo, Beat Tap) are scored on time too. A per-game score scale would
  be fairer once the game designers pick one.
- **R2-08, onboarding funnel:** landing visitors now start at the age step (`/welcome/play`), so the admin Metrics
  "Welcome" column only counts `/welcome` visits (sign-in links, deep links, Home redirects). Completion % is
  measured from the age step, so it is unaffected; the column label could say "Welcome (sign-in screen)".
- **R2-08, other first-run entries:** server gates (`lib/auth/gate.ts`), invite links (`app/i/[code]`) and the
  `/daily` deep link still open the `/intro` logo animation first. They could go to `/welcome/play` too.
- **R2-08, guest session timing (left as is on purpose):** the anonymous guest session is still made at "Save my
  Spuz", after the age gate, as "Play as guest" always did. Making it on the "Play now" tap would create an auth
  account before the birth step, including for under-13s who are then turned away. The lead may decide otherwise.
- **R2-09, admin year list:** the admin player editor (`components/admin/PlayerDetail.tsx`) still lists years from
  this year back (`birthYears()`). It is staff-only, so it was left as is; it could start at this year minus 13.
- **Quads pool from the console (R2-14):** approved Quads items can be scheduled on a Daily from the Content page,
  but free play still reads `games/quads/content.ts`; "put in the pool" today means export the pack and add it to
  that file. A database-backed pool (approved items mixed into free play) would make it a one-click step.
- **Quads feedback on slow networks (R2-14):** answers are checked on the server (the groups never reach the
  client), so the 600 ms budget from Submit to feedback holds on a normal connection; on slow 3G the round trip
  alone can pass it. The lifted four show a "checking" ring at once and "Checking…" after 250 ms meanwhile.
- **R2-12, Emoji Hits card icon:** not reproducible from the code. The catalog icon (`smiley`) is in
  `components/ui/icons.generated.ts`, both tiles (`public/3d/icons{,-sm}/emojihits.webp`) exist and draw a smiley,
  and production serves them (direct and through `/_next/image`). The likeliest cause is a miss cached while Emoji
  Hits was a lab game with no tile (the tile landed on 2 November). `GameIcon3D` now falls back to the flat tile
  with the game's Phosphor icon when the image fails, and `lib/catalog.test.ts` checks every live game's icon and
  tiles. If it shows again on a device, clear that site's data and check whether the image request returned 404.
- **Practice rounds on Challenge and Ghost links (R2-07):** `/challenge/<code>` and `/ghost/<game>` still open the
  real board on a first try (they race a fixed run, so a practice round would need its own flow). They show the
  visible rule (R2-06) and the first-move timer (R2-15).
- **Duel timer vs strip clock (R2-15):** in a live round the header timer starts on the first move, while the
  opponent strip's "my time" runs from the round start (server time). Both are true; a later pass could show only
  the server's round time in live matches.
- **R2-P5 lab games, content review:** Pinned, Flagged and Pixl still have `needsReview = true` in their content
  files (`games/pinned/content.ts`, `games/flagged/content.ts`, `games/pixl/art.ts`). The owner should review them on
  the admin Content page before ticking them in `features.labGames`. Five's word list is already reviewed.
- **R2-P5 Daily Five and a lab game switched off:** future automatic days that are not locked are re-picked without
  it, but a day already locked, or today's five, keeps the game, and the server then refuses that slot. Re-pick the
  day on the admin Daily Five page after switching a lab game off. A later pass could re-pick today automatically.
- **R2-P5 harness solvers:** Five, Higher or Lower, Flagged, Light Up, Killer Sums and Dara have tap solvers. Penalty
  King (timing taps), Pinned (map taps by coordinates), Market Run, Tripwire and Pixl do not yet; their seeded
  boards render in `tests/e2e/r2-p5-lab-games.spec.ts` and their practice rounds are skipped there.
- **R2-P5 players' view of a lab game:** a switched-on lab game looks like any other game in All games and on its
  world (no "in testing" mark), and the public `/api/v1/games/meta` lists every lab game's duration and tags (ids
  only) even while it is switched off. A small "New, in testing" tag on the card is a design call for the owner.
- **R2-P5 part B, Two Truths content review:** `games/twotruths/content.ts` has `needsReview = true`. The 64 rounds
  were written to well-established facts with a source each, but the owner should read them on the admin Content
  page (content.ts review) before ticking `twotruths` in `features.labGames`. New rounds come in as drafts through
  the Two Truths pack import and join the pool once copied into content.ts.
- **R2-P5 part B, Two Truths in Party:** not a Party race game. Races rank by finish time and take only time-scored
  live games, so no quiz game (Quickfire, Emoji Hits) races today. A score race mode would let all three join.
- **R2-P5 part B, Azonto Steps art:** Spuz has no rigged arms, so the "dance" is a spring sway per move with the
  move's name, arrow and shape in a bubble. A drawn or rigged pose per move (an iron in hand, a phone at the ear)
  would read better; the beat is the shared tick and chime sounds, and a recorded Azonto loop would suit it more.
  Azonto's 3D tile uses Phosphor `person-arms-spread`.
- **R2-P5 settings delay:** a lab switch reaches players within about 30 s (server settings cache) plus up to 60 s
  (edge cache of `/api/v1/settings/game`); the server refuses a switched-off game as soon as its own cache expires.
- **Admin cascade audit (R2-ADMIN), left out or partial** (full table: `docs/qa/ADMIN_CASCADE_R2.md`):
  - **Rule overrides, places still on the catalog text:** the practice round's coaching hint (built on the server in
    `app/api/v1/guided/[game]/route.ts`), the Duel queue rules card and next-game card (`DuelScreen`), the
    `/how-to-play` page, the Play page's meta description and the School Cup game picker's card copy. Wiring them needs `loadGamesMeta()` on those server
    paths (one extra read per hint or page) or `useGameCopy` in the Duel cards.
  - **Icons:** the Library page previews each tile; editing needs an asset upload and the 3D pre-render
    (`scripts/prerender-3d.mjs`), so icons still change in code.
  - **Practice boards:** previewed read only. The board is the fixed seed `tutorial:<game>` (or a game's own
    practice board) in code; changing it needs a code change, and the per-game off switch is `practice.disabled`.
  - **Quads pack export** runs in the browser from the content list, so it writes no audit row (reads of the list are
    not audited either). If exports must be logged, it needs a server export route like the Daily Five one.
  - **Push count** is devices with alerts on, not distinct players: PostgREST head counts cannot count distinct
    players, so that needs an `svc_*` function.
  - **Retention activity** counts attempts (solo, Duel and Party rounds), as Live ops does; Board Games moves
    (`board_moves`) do not count as a day's activity yet.
  - **Landing to first clear** starts at profile creation (Welcome's guest profile). Visitors who leave before a
    profile exists are not in the cohort; that part of the funnel is on the Onboarding completion card.
  - **Deploy order:** apply `20261202000101` to `20261202000701` before deploying. Until then the copy overrides and
    the `warm` split fall back quietly, but `practice_*` and `game_over` metrics are refused by the old name check
    (the client ignores the error, so players see nothing).
- **Google link and the streak shield (R2-P5):** linking Google from "Save your streak" grants the shield in
  `/auth/callback` and adds `?shield=1` to the return URL, but no screen reads it yet, so the player isn't thanked
  the way the email path thanks them. A small toast on the return page would close it.
- **Share images for free play (R2-P5):** before the story card, Share on a free-play clear pointed at the Daily card,
  which 404s for anything but Daily and archive clears. Story cards fix it while `features.storyCards` is on; with it
  off, free play still has no image to share.
- **School league policy (R2-P5):** under-16s join a school only through a class code, and the public table drops
  schools with fewer than `schoolLeagues.minPlayers` active players. Whether a small school's average is still too
  revealing (for example 3 players in one class) is a policy call for the owner.
- **Party TV for under-16 hosts (R2-P5):** the big-screen view is refused for hosts under 16 (their rooms are friends
  only, R2-13). If teachers under 16 ever host classroom rooms, this needs a product decision.
