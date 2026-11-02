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
- **Live drawing:** strokes reach other players when each line is finished (pen up), through a refetch on the
  realtime "changed" event, not point by point. Streaming points would feel smoother.
- **Round state in the database:** strokes, statements and guesses live in server-only tables for the round
  (needed on serverless hosts and for trustworthy report snapshots) and are wiped when it closes; nothing is kept
  in memory only.
- **No rewards:** the 18+ party games pay no XP or Sparks (only room points).

## Content-game tokens and the 18+ fixes (1.5.0)

- **Sealed quiz boards** (Flagged, Hunch, Pinned, Quickfire) still carry their string `ref`: it is the salt their
  boards unseal answers with, and those answers are on the client by design (instant feedback, server verify).
- **Brute force:** the generators are deterministic, so someone with the game code could still match a served
  board to its content index by generating every index; the token only stops the guess route from helping.
