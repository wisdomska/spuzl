# Game build brief (read fully before writing a game)

You are building SPUZL games inside an existing Next.js 16 + React 19 + TypeScript strict + Tailwind v4 app.
Quality bar: the design handoff is the floor. Match it exactly or do better, never worse.

## Read first
1. `games/types.ts`: the contract (GameLogic, BoardProps, BoardApi, ContentLogic, BoardGameRules, InputLog).
2. `games/crownfall/logic.ts`, `games/crownfall/Board.tsx`, `games/crownfall/logic.test.ts`: the reference implementation. Copy its structure, rigour and test style.
3. `components/game/GameShell.tsx`: the 6-zone shell your Board renders inside. The shell owns the timer, hints, pause, feedback line and controls. The board reports moves through `api`.
4. `lib/catalog.ts`: id, name, world, rule text, `unique`, `scoring` and `minTimeMs` for your games.
5. `docs/SRS.md` section 5: the rules per game.
6. Design files in `design/design_handoff_spuzl/design/` (HTML, open as text): `SPUZL Game Boards.dc.html` (15 launch boards: exact colours, sizes, states, controls copy), `SPUZL Board Games.dc.html` (Board Bay), `SPUZL Handoff.dc.html` (motion spec, rules). Reference screenshots: `tests/visual/reference/*.png` (`spuzl-game-boards__grid-games.png`, `spuzl-board-games__*.png`, `spuzl-game-boards__crownfall-states.png`). Look at them with the Read tool.
7. Motion skill: `.agents/skills/animate/SKILL.md` (read before writing motion).

## Per game, deliver
- `games/<id>/logic.ts`: pure TS, no React or DOM. Default export a `GameLogic` (or `ContentLogic`). Must include:
  - `generate(rng, difficulty)`: deterministic for (seed, difficulty). Difficulty curve: easy, medium, hard, expert, mega (Sunday, larger).
  - `countSolutions(puzzle, limit)` for every game where `unique: true` in the catalogue. Generated puzzles must have exactly 1 solution.
  - `verify(puzzle, solution, state)`: the server's only source of truth. Reject malformed input. Return a server-computed `progress` 0..1 that never leaks the solution, and `score` for score games.
  - `progress(...)` and `hint(...)` (one safe deduction or reveal), plus a grader that returns a 0..100 `grade`.
- `games/<id>/Board.tsx`: client component, default export, `BoardProps`.
  - Render the design exactly: colours from CSS variables (`var(--surface)`, `var(--world)`, `var(--text)`, `--danger`, `--accent`, `--gold`, `--board-bg`, ...), never raw hex for themeable surfaces. World fills get ink text `#0E0F1A`.
  - Boards are `role="grid"` with full keyboard support (use `components/game/useGridKeys.ts`): arrows move, Space cycles, Enter confirms. Every move calls `api.announce(...)` with row, column and mark. Rule breaks call `api.ruleBreak(message)`.
  - Cells at least 44 px (`components/game/useBoardSize.ts`).
  - Register controls with `api.setControls([...])`. Include `{ id: "hint", ... }` where hints apply; the shell wires it.
  - Motion (Handoff spec): cell pop 1 → 1.08 → 1 in 140 ms (`cell-pop-a/b` classes, alternate per tap), rule-break shake (`cell-shake-a/b`) with hatch (`.hatch`) and a danger ring, clear wave = flip cells to world colour with a 70 ms × Manhattan-distance delay from the last move (see Crownfall). Transform and opacity only. No ease-in. Every animation has a reduced-motion variant (`[data-motion="reduce"]`).
  - Sound with every action, via `play()` from `@/lib/audio`: `pop` with `{ step: correctStreak }`, `buzz` on a rule break, `chime` with `{ step }` per word letter, `synth` for line drawing, `jingle` on clear, `clack`/`capture` for board pieces, `twinkle` for hints. Haptics are paired automatically.
  - Never colour alone: every mark has a glyph or shape.
  - Copy: no em or en dashes anywhere, one label per action, no emoji in UI.
- `games/<id>/logic.test.ts`: Vitest. 90%+ line coverage of logic.ts. Cover generator determinism, uniqueness (where required) over 20+ seeds, verify accepting the solution and rejecting near misses and malformed input, hints being safe, and grader monotonicity across difficulties.
- Register the game by adding ONE line each to `games/logic-registry.ts` (LOGIC map) and `games/board-registry.tsx` (BOARDS map, same pattern as crownfall: `dynamic(() => import("./<id>/Board"), { ssr: false, loading: () => <BoardSkeleton /> })`). Do not otherwise edit shared files. If you truly need a shared change, describe it in your final report instead.

## Content games (Word Woods, Clue Cave)
Write ORIGINAL content in `games/<id>/content.ts` (export `CONTENT` and `needsReview = true`). Rules: global-first with about 20% Ghanaian and West African references. No politics, religion, insults, adult themes or brand trademarks in answers. Ages 13 and up. Implement `ContentLogic` (`contentCount`, `generateAt`). Aim for 60 days of Daily content per game; never fewer than 30. Word validity uses a word list you build into `games/_shared/words/` (a reasonable, family-safe English list; you may generate it from your own knowledge; keep it under 200 KB gzipped and lazy-load it on the client).

## Testing your board in a browser
Start your own dev server on the port given in your task: `pnpm dev -p <port>`. Open `http://localhost:<port>/dev/board/<id>?seed=a&d=easy` (fixture route that generates a puzzle locally). Screenshot it with Playwright (`import { chromium } from "@playwright/test"`, viewport 390 × 844) and compare it with the design reference image by eye. Fix anything worse than the design. Check light theme as well: `localStorage.setItem("spuzl.settings", JSON.stringify({ theme: "light" }))` before load. Stop your dev server when done.

## Checks before you commit
- `pnpm vitest run games/<id>` passes. `pnpm tsc --noEmit` has no errors in your files. `pnpm eslint games/<id>` is clean.
- Commit on your branch with Conventional Commits, for example `feat(games): add dusk with generator, solver and board`. One commit per game is ideal.
- Git identity is already configured. NEVER add Co-Authored-By, "Generated with", or any mention of Claude, Anthropic or AI in commit messages, code comments or docs. A hook rejects them.

## Final report (keep it short)
Per game: done or not, test count and coverage, any design deviations (with reasons), anything left undone, and content needing owner review.
