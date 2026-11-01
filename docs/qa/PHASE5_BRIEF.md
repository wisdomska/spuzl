# Phase 5 brief: adding a new game (behind "features.newGames")

Read `docs/qa/AGENT_BRIEF.md` first; its rules apply (commits, copy files, tokens, checks, no push).

Every new game:

1. **Catalog:** add a `g(...)` entry with `{ lab: true }` at the END of `LAB_GAMES` in `lib/catalog.ts`. Do not
   add it to `GAMES`. Choose a world that fits. Pick a Phosphor icon that exists in
   `components/ui/icons.generated.ts`, or add one with `node scripts/gen-icons.mjs <icon-name>`.
2. **Logic:** `games/<id>/logic.ts` implements `GameLogic` (`games/types.ts`).
   - `generate(rng, difficulty)` is deterministic per seed.
   - `verify` is what the server runs; `progress` must never leak the solution.
   - `hint` gives one safe next step with a one-sentence reason.
   - Logic puzzles with a unique answer also implement `countSolutions` and must be unique.
   - Content games whose answers must stay on the server use the guess transport (`games/_shared/guess.ts`,
     `generateAt`, `checkGuess`; see `games/quads` or `games/coil`).
   - Register it at the end of `games/logic-registry.ts`.
3. **Board:** `games/<id>/Board.tsx` renders inside `GameShell` through `BoardProps` and `BoardApi`:
   - Call `onMove` and `onSolved`. Report slips through `ruleBreak` or `onMove({ mistake })`.
   - Register tools with `setControls`, including Undo where it makes sense.
   - No second clock: per-round timers are progress bars.
   - Use real buttons and grid cells named "Row r, column c, …", with 44 px targets.
   - It must fit 320 to 414 px wide with no horizontal scroll, honour reduced motion, and use tokens.
   - Register it at the end of `games/board-registry.tsx`.
4. **Library metadata:** add the typical play time to `TYPICAL_SEC` in `lib/games-meta/index.ts`.
5. **Database row:** a migration `supabase/migrations/20261109<NNNNNN>_lab_<id>.sql` (unique timestamp per game,
   using your agent letter in the digits) inserts the `public.games` row(s) with `on conflict (id) do nothing`.
   The columns are `world_id`, `name`, `status`, `phase`, `engine`, `scoring`, `is_unique`, `min_time_ms` and
   `sort`; copy the shape of the rows in `supabase/seed.sql`. Rollback is `delete from public.games where id =
'<id>'` (safe: there are no attempts while the flag is off). Also add the same row to `supabase/seed.sql`
   right after the existing games rows. Apply it locally with psql
   (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`) and insert into
   `supabase_migrations.schema_migrations`.
6. **Seeded test puzzle:** the game opens at `/dev/board/<id>?seed=qa&d=easy`.
   - A unit test (`games/<id>/logic.test.ts`) generates 20+ seeds per difficulty and checks that the solution
     verifies, a wrong state doesn't, the puzzle is unique where it applies, and hints are safe.
   - Add a tap solver to `SOLVERS` in `tests/e2e/harness.ts` if it's a grid game and that's cheap.
7. **Copy:** all player-facing text goes in `lib/copy/<id>.ts`. Keep SPUZL's voice and local Ghanaian flavour
   where it fits. Nothing offensive, no free text between players, nothing that collects personal data.
8. **Before you report:**
   - Run `pnpm typecheck`, `pnpm lint`, `pnpm vitest run` and prettier.
   - Open `/dev/board/<id>` in a dev server in your worktree (`pnpm dev -p <free port 3160-3199>`; install deps
     with `pnpm install --offline` and copy `.env.local` from `/home/user/spuzl/.env.local`).
   - Screenshot it at 375 and 1280.
   - One commit per game: `Phase 5: <Game> (<one line>)`.
