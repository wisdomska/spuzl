# Follow-ups (out of scope for the frictionless-play pass)

Things noticed while working on SPZ-01 to SPZ-27 that the tickets did not cover, or that need a decision.

## Game play and rules
- Free play returns its seed to the client, so a determined player could derive the solution. Free play gives
  capped XP only, but a server-only seed (as Dailies have) would close it.
- Buried's hint text uses unrotated cell positions after the board is rotated.
- Quickfire: the header clock starts on the first answer, not on Start (needs a board-to-shell "start" call).
- Quickfire: a run resumed from autosave forgets earlier wrong answers, so Results can say "Clean".
- Dusk: the 320 ms double-tap window is a constant; it could become an admin setting. Swipe up/down input not done
  (it would block page scroll when a finger starts on the board).
- Four Up: at 320 px each column is about 39 px wide (full height, so the target area is still large).
- Crownfall: the X mark colour is a fixed grey whose contrast on the new palette was not checked; white pattern
  textures are faint on the light-theme colours.

- Chess vs bot uses the Board Bay board: pawns always promote to a queen and there are no coordinates. The bot
  search ignores threefold repetition. The help sheet for bot games still mentions Dailies and hints.
- Duel: a random-mix ranked match picks games both players cleared; a chosen game never cleared shows the rules
  card first. A mix game neither player has cleared (brand-new players) still starts without a rules card.

## Layout
- Rage Ridge at 320 × 568: the 60 % canvas pushes the on-screen controls below the fold.
- Nine on a 375 × 667 phone with the 3 × 3 pad needs a little vertical scroll.

## Accounts and email
- Hosted email codes need custom SMTP (for example Resend) configured in the Supabase dashboard. Until then the
  built-in mailer allows 2 emails an hour and sends the magic link (which also signs in).
- The work-email owner admin account still exists alongside wisdomska@gmail.com.

- Board Bay pink surfaces in `components/multiplayer/bay/boards.tsx` still use raw hex colours.

## Tooling
- Worktrees: Turbopack does not follow a `node_modules` symlink outside the project; use `pnpm install --offline`.
