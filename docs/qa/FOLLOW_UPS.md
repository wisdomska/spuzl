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
  - The 320 ms double-tap window is a constant and could become an admin setting.
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
- The shared `components/meta/Sheet` slides in even with reduced motion on (used by the Challenge sheet).
- Board Bay pink surfaces in `components/multiplayer/bay/boards.tsx` still use raw hex colours.
- `BackButton` in `components/meta/ui.tsx` still uses `history.length > 1`; `useBackOrHome` is safer for deep
  links.

## Accounts and email

- **Custom SMTP:** hosted email codes need custom SMTP (for example Resend) set up in the Supabase dashboard.
  - Until then the built-in mailer allows 2 emails an hour and sends the magic link, which also signs in.
  - The hosted "Change email address" template also needs `{{ .Token }}` for the guest "Save your streak" code.
- The work-email owner admin account still exists alongside wisdomska@gmail.com.
- **Settings page:** "Send magic link" for a guest says "Check your email" even when the change applied
  straight away.

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
