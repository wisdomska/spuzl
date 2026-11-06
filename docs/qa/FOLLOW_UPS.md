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
