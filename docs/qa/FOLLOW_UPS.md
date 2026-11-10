# Follow-ups (outside the frictionless-play pass)

Things noticed while working on SPZ-01 to SPZ-27 that the tickets didn't cover, or that need a decision.

## Game play and rules

- **Dusk:**
  - Swipe up and down is not done; it would block page scroll when a finger starts on the board.

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

## Content-game tokens and the 18+ fixes (1.5.0)

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
- **Duel timer vs strip clock (R2-15):** in a live round the header timer starts on the first move, while the
  opponent strip's "my time" runs from the round start (server time). Both are true; a later pass could show only
  the server's round time in live matches.
- **Practice rounds on Challenge and Ghost links (R2-07):** `/challenge/<code>` and `/ghost/<game>` still open the
  real board on a first try (they race a fixed run, so a practice round would need its own flow). They show the
  visible rule (R2-06) and the first-move timer (R2-15).
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
- **R2-P5 part B, Family Draw for under-16s:** not done, on purpose (DECISIONS PD1): drawings can't be checked before
  others see them. Revisit only with an image classifier or pre-moderation. The owner should also confirm the 16+
  call itself before switching `party.familyDraw` on.
- **R2-P5 part B, Family Draw words:** the list lives in code (`lib/party-adult/content.ts`, filtered in
  `lib/party-adult/family.ts`). The admin Content page previews it, exports it and checks a pasted pack, but cannot
  save one; storing the list in the database would let the owner edit it without a release.
- **R2-P5 settings delay:** a lab switch reaches players within about 30 s (server settings cache) plus up to 60 s
  (edge cache of `/api/v1/settings/game`); the server refuses a switched-off game as soon as its own cache expires.
- **Admin cascade audit (R2-ADMIN), left out or partial** (full table: `docs/qa/ADMIN_CASCADE_R2.md`):
  - **Rule overrides, places still on the catalog text:** the practice round's coaching hint (built on the server in
    `app/api/v1/guided/[game]/route.ts`), the Duel queue rules card and next-game card (`DuelScreen`), the
    `/how-to-play` page, the Play page's meta description. Wiring them needs `loadGamesMeta()` on those server
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
- **Share images for free play (R2-P5):** before the story card, Share on a free-play clear pointed at the Daily card,
  which 404s for anything but Daily and archive clears. Story cards fix it while `features.storyCards` is on; with it
  off, free play still has no image to share.
- **Google link and the streak shield (R2-P5):** linking Google from "Save your streak" grants the shield in
  `/auth/callback` and adds `?shield=1` to the return URL, but no screen reads it yet, so the player isn't thanked
  the way the email path thanks them. A small toast on the return page would close it.
- **Party TV for under-16 hosts (R2-P5):** the big-screen view is refused for hosts under 16 (their rooms are friends
  only, R2-13). If teachers under 16 ever host classroom rooms, this needs a product decision.
- **Retired content and boards built before the retire (round 3, item 12):** every board built after a retire leaves
  the entry out, but Dailies and Daily Five days already generated (up to 60 days ahead) keep the puzzle they were
  built with, and an in-memory duel round cache may hold a board for a few minutes. Swap an affected Daily from the
  calendar, or add a "rebuild unlocked days for this game" action if retiring becomes common.

## Round 3

- **Score games from game cards (R3-08):** the Challenge sheet and Library card offer Party only for time races
  (`isRaceGame`); a score game can be raced only by picking it in the Party Host tab.
- **Hats on initial chips (R3-15):** every drawn Spuz now wears the player's look (`MySpuz` for the player, `SpuzWear`
  with the seat's `hat` for others), but list rows still use letter chips in the skin colour, not a Spuz:
  `AvatarChip` (friends, leaderboards, crews, leagues, settings blocked list, side panel) and the multiplayer
  `Avatar` (Duel HUD, Party seats and standings, chat, invites, Board Bay seats), plus the Home header `LevelRing`.
  Turning those into tiny hatted Spuz needs a design call and `hat` in the friends, leaderboard, crew, chat and TV
  payloads (`SpuzWear` already draws legibly at 24 to 40 px).

## SEO pass (round 3)

- **Admin copy overrides** (games.rule / games.blurb) don't reach the static `/games/<id>` pages or llms.txt, which use
  the catalog's copy until the next deploy.

## UX pass (9 Nov)

Arcade, Board Games and the shared game shell. Fixed in this pass: keyboard focus on cells, pads and tools; Try
again on a failed start; Echo's pause between rounds; Beat Tap and Rage Ridge per-frame work; last move and refused
taps on the live Draughts, Oware and Four Up boards; Resign and the bot draw ask first; bot thinking in Board Bay;
the Duel loss line. Nothing is left open.

Puzzles (Crownfall, Dusk, Sixer, Nine, Weave, Flowline, Pairup, Lost, Trotro Jam), Words & Quiz (Coil, Rungs, Quads,
Seven, Minicross, Buried, Remix, Quickfire, Emoji Hits) and Two Truths. All audit items fixed (the last, Duel ink on gold,
in 1.44.1).

## Follow-ups closed (10 Nov, 1.44.1)

- **Hydration warning on All games (#418):** the server drew the default settings (29 games) because the app-wide
  AlertsAsk created the game-settings query while the seeded page streamed, and HydrationBoundary leaves existing
  queries to an effect. `components/shell/HydrateNow.tsx` applies the seed in the first render on both sides.
  Guarded by `tests/e2e/r4-follow-ups.spec.ts`.
- **Four Up, Oware and Flip live boards:** one Tab stop with arrow keys (`useRovingGrid`, `gridMoveRC`); Four Up's
  columns are the grid cells. `tests/e2e/r4-board-keys.spec.ts`.
- **Fit at 320 × 568:** Flinch and Beat Tap fit. The Duel round end and match end now go compact under 880 px of
  height, Rematch stays on the screen's bottom edge, and the body no longer lets the centred card's margin add a
  scroll on laptops. `/dev/duel` fixture, `tests/e2e/r4-follow-ups.spec.ts`.
- **Duel ink on gold:** `text-on-gold` on the round and win badges.
- Found on the way: a long Gotcha or Dash level name pushed the page 7 px sideways on phones with keyboard hints
  (an inline `truncate`); the r2-phase4 spec's Quickfire, Four Up and chess checks were updated to the current boards.
