# Ticket brief (shared rules for every SPZ ticket)

Read first: `AGENTS.md`, `docs/ARCHITECTURE_NOTES.md`, `components/game/GameShell.tsx` (BoardApi contract),
the board(s) you are changing, and the ticket text below.

Rules

- One commit per ticket, message `SPZ-XX: <short title>`. Plain message, no trailers of any kind. The commit
  author is already configured (`git config user.name` = wisdomska(senya)); do not change it. The repo's
  commit-msg hook rejects some words; if it fails, reword. Do not push.
- New player-facing strings go in `lib/copy/<area>.ts` (create it, export a const object), re-exported from
  `lib/copy/index.ts` only if you need to; never inline new strings in JSX.
- Use design tokens (`var(--accent)`, `var(--ink)`, `var(--line)`, `var(--surface-2)` etc. from
  `app/globals.css`) and existing components (`components/ui/*`). No new raw hex colours, spacing on the 4 px grid.
- Don't change game rules, scoring or economy beyond the ticket. Server enforces every rule the UI shows
  (`logic.ts` `verify` is what the server runs).
- Runtime tunables come from `useGameSettings()` (`lib/game-settings/client.ts`), never hard-coded copies.
- Accessibility: real `<button>`s, 44 px targets, aria labels, no colour-only signals, honour reduced motion
  (`useReducedMotion` from motion/react or the `reduced` setting).
- Phone first: must fit 320–414 px wide with no horizontal scroll; check 1280 too.
- Before committing run: `pnpm typecheck`, `pnpm lint`, `pnpm vitest run <the tests you touched or games/<id>>`,
  and `pnpm prettier --check` on changed files. Add or update unit tests for logic changes.
- You can view a board at `http://localhost:3000/dev/board/<game>?seed=x&d=easy` if a dev server is running
  in your worktree (`pnpm dev -p <free port 3100-3199>`); optional.
- If your worktree has no `node_modules`, symlink it: `ln -s /home/user/spuzl/node_modules node_modules`.
- Report back: commits (hash + title), files changed, what you verified, anything left or noticed
  (for `docs/qa/FOLLOW_UPS.md`).
