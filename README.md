# SPUZL

51 puzzle, skill and classic board games across 9 worlds ("The Grid"), with Spuz the mascot, daily puzzles, endless free play, live Duels, Party Races, leagues and crews.

Production: https://spuzl.vercel.app · Admin: https://spuzl.vercel.app/admin

## Stack

- Next.js 16 (App Router), React 19, TypeScript strict
- Tailwind v4 with the SPUZL design tokens (`styles/spuzl-tokens.css`, `styles/tailwind-theme.css`, used unchanged)
- Motion, Radix primitives, Phosphor Bold icons, Phaser 3 for Rage Ridge (lazy-loaded per game)
- Supabase: Postgres with RLS, Auth, Realtime, Storage
- TanStack Query, Zustand, Zod
- Vitest, Playwright, pgTAP, k6

## Getting started

```bash
nvm use            # Node 22+
pnpm install
pnpm supabase start   # local Postgres, Auth and Realtime in Docker
cp .env.example .env.local   # fill in the values printed by supabase start
pnpm dev
```

## Scripts

| Script                             | What it does                                               |
| ---------------------------------- | ---------------------------------------------------------- |
| `pnpm dev`                         | Dev server on :3000                                        |
| `pnpm build`                       | Production build                                           |
| `pnpm check`                       | Typecheck, lint, format check and unit tests               |
| `pnpm test` / `pnpm test:coverage` | Vitest                                                     |
| `pnpm test:e2e`                    | Playwright end-to-end                                      |
| `pnpm test:visual`                 | Visual parity against `tests/visual/reference`             |
| `pnpm test:db`                     | pgTAP database tests                                       |
| `pnpm gen:puzzles`                 | Generate and schedule Dailies                              |
| `pnpm validate:dailies`            | Prove every scheduled logic Daily has exactly one solution |

## Layout

```
app/          routes (map, worlds, games, multiplayer, social, /admin, api)
components/   ui, brand (Spuz), game (GameShell), multiplayer, social, admin
games/        one folder per game: logic.ts (generator, solver, grader, verifier), Board.tsx, tests
lib/          supabase, realtime, rewards, rating, audio, haptics, settings
supabase/     migrations, seed, pgTAP tests
scripts/      puzzle generation, validation, 3D pre-render, design capture
tests/        unit, e2e, visual, a11y, load
design/       the design handoff (reference only, not shipped)
docs/         SRS, decisions, progress, operations, QA report
```

## Deploy flow

Work on `feat/*`, `fix/*` or `chore/*`, open a PR into `preview` (staging), verify the preview deploy, then open a PR from `preview` into `main` (production). Both branches are protected and squash-merged.

## Environment variables

See `.env.example`.
