# Follow-ups (outside the frictionless-play pass)

Things noticed while working on SPZ-01 to SPZ-27 that the tickets didn't cover, or that need a decision.

## Game play and rules

- **Free play seed:** free play sends its seed to the client, so a determined player could work out the
  solution. Free play gives capped XP only, but a server-only seed (as Dailies have) would close it.
- **Buried:** hint text uses unrotated cell positions after the board is rotated.
- **Quickfire:**
  - The header clock starts on the first answer, not on Start. This needs a board-to-shell "start" call.
  - A run resumed from autosave forgets earlier wrong answers.
- **Dusk:**
  - Swipe up and down is not done; it would block page scroll when a finger starts on the board.
- **Four Up:** at 320 px each column is about 39 px wide. The columns are full height, so the target area is
  still large.
- **Crownfall:**
  - The X mark is a fixed grey; its contrast on the new palette wasn't checked.
  - White pattern textures are faint on the light-theme colours.
- **Chess vs bot:**
  - It uses the Board Bay board: pawns always promote to a queen and there are no coordinates.
  - The bot search ignores threefold repetition.
  - The help sheet for bot games still mentions Dailies and hints.
- **Ranked Duel mix games:** a mix uses games both players have cleared. Two brand-new players can still get a
  game neither has seen, with no rules card.
- **Guided first play:**
  - Before the first move, Dusk, Nine and Merge have no deduction, so the first hint coaches with the rule.
  - Learned games are remembered per device. Cleared games are remembered per account.
- **Party:** "Choose games" means one game or a random mix. Hand-picking several needs a column for the chosen
  list, since `matches.games` is overwritten at race start.

## Layout and motion

- Rage Ridge at 320 × 568: the 60% canvas pushes the on-screen controls below the fold.
- Nine on a 375 × 667 phone with the 3 × 3 pad needs a little vertical scroll.
- Party (`components/multiplayer/party.tsx`) still has raw hex colours (QR, podium, confetti, Open label).

## Accounts and email

- **Custom SMTP:** hosted email codes need custom SMTP (for example Resend) set up in the Supabase dashboard.
  - Until then the built-in mailer allows 2 emails an hour and sends the magic link, which also signs in.
  - The hosted "Change email address" template also needs `{{ .Token }}` for the guest "Save your streak" code.
- The work-email owner admin account still exists alongside wisdomska@gmail.com.

## Leagues and metrics

- `leagues.minGroup` applies only when a player joins mid-week; the weekly rollover doesn't top up small tiers.
- `/leagues/current` makes one extra database call for players already placed.
- **Hint confirm cancels:** these feed the accidental-hint metric, but the confirm only shows on the first hint
  per game per device, so they undercount.
- **Onboarding completion:** this uses "started a real game" as a stand-in for "reached Home". A first-party
  `onboarding_step` event would make it exact.
- **Tap stamp:** any button press sets the tap stamp; a `data-play-nav` attribute on Play buttons would make
  tap-to-board exact.
- Admin page strings are inline, as in the other admin components, not in `lib/copy`.

## Tooling

- **Worktrees:** Turbopack doesn't follow a `node_modules` symlink outside the project; use
  `pnpm install --offline`.
- **Periodic Background Sync:** the Daily pack's background sync only runs in installed Chrome-based apps.

## From 1.2.0

- **Dailies off:**
  - Ghost Race still uses the day's puzzle for Rage Ridge.
- **Party games:** Draw It and Two Truths were not built. They need free text or drawings between players,
  which conflicts with the no-free-text rule for young players. They need a decision and moderation design first.
- **Five and Emoji Hits:** the "show the answer" request is stateless. It can reveal an answer but can't change a
  score. It should read the attempt's saved state before answering.
- **Emoji Hits:** the artist and year hints need a fact-check before the switch goes on. Both content files are
  marked `needsReview`.
- **Admin content tools:** the new content games aren't in the admin content review or solve-check tools yet.
- **Expert and mega Killer Sums** can need a guess; the hint engine would need the "45 rule".
- **Trotro Jam:** hard boards can take 3 to 7 s to generate on the server.
- **Small cells on phones:** Light Up 10 × 10 cells are about 30 px.
- **Five:** needs a little vertical scroll at 375 × 812.
- **Penalty King:** keeper dives ship in the puzzle data, so a modified client could read them; there is also no
  timing-spread bot check.
- **Seasonal event quests** live outside the admin quest catalogue.
- **Admin list filters** are kept in the page, not the URL; links keep the page number but not the filters.
