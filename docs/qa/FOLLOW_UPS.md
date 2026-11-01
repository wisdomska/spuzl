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

## From 1.2.0

- **Party games:** Draw It and Two Truths were not built. They need free text or drawings between players,
  which conflicts with the no-free-text rule for young players. They need a decision and moderation design first.
- **Content-game references:** a content puzzle's `ref` (index and difficulty) is sent to the client, since the
  guess transport and the sealed quiz boards need it. The guess route answers a bare `ref` without an attempt
  (races, guided practice), so a player could try words on a Five board by reference before guessing on their
  attempt, and Penalty King's keeper dives follow from the index. Closing it needs attempt-bound or opaque refs.
