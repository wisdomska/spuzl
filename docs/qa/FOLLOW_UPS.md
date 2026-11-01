# Follow-ups (outside the frictionless-play pass)

Things noticed while working on SPZ-01 to SPZ-27 that the tickets didn't cover, or that need a decision.

## Game play and rules

- **Dusk:**
  - Swipe up and down is not done; it would block page scroll when a finger starts on the board.
- **Ranked Duel mix games:** a mix uses games both players have cleared. Two brand-new players can still get a
  game neither has seen, with no rules card.
- **Guided first play:**
  - Before the first move, Dusk, Nine and Merge have no deduction, so the first hint coaches with the rule.
  - Learned games are remembered per device. Cleared games are remembered per account.
- **Party:** "Choose games" means one game or a random mix. Hand-picking several needs a column for the chosen
  list, since `matches.games` is overwritten at race start.

## Layout and motion

- Nine on a 375 × 667 phone: the board and the 3 × 3 pad fit (cells step down to 35 px), but the shell's tool bar
  (Undo, Erase, Notes, Hint) is still below the fold. Fitting it too needs a smaller shell header or a 1 × 9 pad.
- Five and Nine still scroll a little at 320 × 568.
- Light Up 10 × 10 cells are 36 px at 375 wide (30 px at 320). 44 px would need a smaller hard board or zoom.
- Party (`components/multiplayer/party.tsx`) still has raw hex colours (QR, podium, confetti, Open label).

## Accounts and email

- **Email:** production sends codes through Brevo SMTP with the SPUZL code templates. The preview project has
  no custom SMTP, so it still uses the built-in mailer (2 emails an hour, magic-link templates).
- **Google sign-in** is live on production. Google's brand verification needs the Search Console ownership tag
  (`GOOGLE_SITE_VERIFICATION` in Vercel), then a re-request from the Google Auth Platform Branding page.
- The work-email owner admin account still exists alongside wisdomska@gmail.com.

## Leagues and metrics

- `leagues.minGroup` applies only when a player joins mid-week; the weekly rollover doesn't top up small tiers.
- `/leagues/current` makes one extra database call for players already placed.

## Tooling

- **Worktrees:** Turbopack doesn't follow a `node_modules` symlink outside the project; use
  `pnpm install --offline`.
- **Periodic Background Sync:** the Daily pack's background sync only runs in installed Chrome-based apps.

## From 1.2.0

- **Party games:** Draw It and Two Truths were not built. They need free text or drawings between players,
  which conflicts with the no-free-text rule for young players. They need a decision and moderation design first.
- **Solve-check gaps:** Penalty King, Beat Tap, Higher or Lower, Light Up, Killer Sums and Dara have no
  solved-state shape, so the admin solve-check asks for a Play test.
- **Trotro Jam** lots grow from a bank of 96 deep starting lots, so their shapes can repeat; about 7% of medium
  boards have one vehicle more than the level's range.
- **Content-game references:** a content puzzle's `ref` (index and difficulty) is sent to the client, since the
  guess transport and the sealed quiz boards need it. The guess route answers a bare `ref` without an attempt
  (races, guided practice), so a player could try words on a Five board by reference before guessing on their
  attempt, and Penalty King's keeper dives follow from the index. Closing it needs attempt-bound or opaque refs.
- **Admin copy:** the content editor, moderation case panels and the remaining admin pages still have inline
  strings (`lib/copy/admin.ts` covers the lists).
- **Five content** is still marked `needsReview` for the owner.
