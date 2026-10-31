# Architecture notes

A map of the SPUZL codebase for the frictionless-play pass (audit: `docs/SPUZL_UX_Game_Audit.md`).
Paths are relative to the repository root.

## Stack

- Next.js 16 App Router (`proxy.ts` replaces middleware; `params` and `searchParams` are Promises; route types
  come from `next typegen`), React 19, TypeScript strict, Tailwind v4 via the Turbopack loader.
- Motion (`motion/react`) for animation; Phaser 3 (lazy chunk) for the Rage Ridge action games only.
- TanStack Query for client data, Zustand for settings, Zod for every request body.
- Supabase: Postgres with forced RLS, Auth (anonymous guests, email code), Realtime (match channels).
- Vercel (region lhr1, cron) and Supabase eu-west-2. Free tiers.

## Routing (51 pages)

| Area              | Routes                                                                                                                               | Notes                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| First run         | `/intro`, `/welcome`                                                                                                                 | Logo intro, then sign-in or guest, age, start choice, lesson, nickname.                     |
| Tabs (bottom nav) | `/` (Home map), `/leagues`, `/leaderboards`, `/quests`, `/friends`, `/crews`, `/shop`, `/me`, `/settings`, `/archive`, `/school-cup` | `app/(tabs)/layout.tsx` adds the nav. Home and Play are server-gated by `lib/auth/gate.ts`. |
| Play              | `/library`, `/world/[id]`, `/play/[game]?mode=daily\|free\|archive&difficulty=`                                                      | One Play route for all 51 games.                                                            |
| Multiplayer       | `/duel`, `/party`, `/party/[code]`, `/bay`, `/bay/[matchId]`, `/ghost/[game]`, `/challenge/[code]`                                   |                                                                                             |
| Info              | `/(info)/…` privacy, terms, fair play, how to play, contact                                                                          |                                                                                             |
| Admin             | `/admin/login`, `/admin/(console)/…` calendar, puzzles, content, moderation, liveops, flags, shop, schools, team, audit              | TOTP + roles (`lib/admin/roles.ts`).                                                        |
| Dev fixtures      | `/dev/board/[game]`, `/dev/spuz`, `/dev/pwa`                                                                                         | Hidden in production unless `ENABLE_DEV_ROUTES=1`.                                          |

Loading screens: `app/loading.tsx`, `app/(tabs)/loading.tsx`, `app/play/[game]/loading.tsx`, `app/world/[id]/loading.tsx` (`components/ui/PageLoader.tsx`).

## Games

- Catalogue: `lib/catalog.ts` (51 games: id, name, world, engine `dom|phaser|custom`, rule, scoring, `minTimeMs`).
- Per game `games/<id>/`: `logic.ts` (pure `GameLogic`: generate, countSolutions, verify, progress, hint, grade;
  guess games add `checkGuess`), `Board.tsx` (client), optional `content.ts`, `logic.test.ts`.
- Registries: `games/logic-registry.ts` (lazy logic imports) and `games/board-registry.tsx` (lazy boards).
- Shared: `games/_shared/` (guess transport, rotation helper, word list, Clue Cave sealing), `games/types.ts`
  (contracts, `difficultyForDate`).
- Shell: `components/game/GameShell.tsx` is the 6-zone template every board renders inside (header with timer,
  hints, help, pause; title and rule; board slot; feedback line; tool bar; pause overlay). Boards talk to it
  through `BoardApi` (`onMove`, `onSolved`, `feedback`, `ruleBreak`, `announce`, `setControls`, `setClock`).
- Screen around the shell: `components/play/PlayScreen.tsx` (start or resume attempt, autosave, hints, finish,
  results, celebrations, free-play loop, share, challenge links). Results: `components/results/ResultsScreen.tsx`;
  celebrations: `components/celebrate/Celebrations.tsx` (currently full-screen interstitials).
- Rage Ridge: `phaser/RageBoard.tsx` + fixed-step sims in `phaser/sim/` (server replays the input log).
- Board sizing: `components/game/useBoardSize.ts` (`useCellSize`, always fits the viewport).

## Server and data

- API: 107 route handlers under `app/api` (`/api/v1/*` player API, `/api/admin/*`, `/api/cron/*`, `/api/og/*`,
  `/api/games/[game]/guess`). Helpers in `lib/api/server.ts` (`handle`, `requirePlayer`, `body`, `rateLimit`).
- Identity: `lib/supabase/server.ts` `currentUser()` verifies the JWT locally with `getClaims()` (ES256 JWKS),
  cached per request. Service-role client: `lib/supabase/admin.ts`.
- Game service: `lib/game/service.ts` (startAttempt, saveAttempt, hintFor, finishAttempt with anti-cheat
  floor and wall-clock check, rewards, streaks, ratings, badges and quests via `evaluateAfterClear`).
- Server-rendered player data: `lib/server/player-data.ts` (`loadMe`, `loadToday`) hydrates React Query on Home
  and Play.
- Database: `supabase/migrations/*.sql` (14 files). RLS forced everywhere; clients have SELECT only; writes go
  through the API with the service role and `svc_*` security-definer functions. pg_cron jobs: daily rollover,
  league rollover, crew clash settle, Board Bay expiry, admin housekeeping. Tests: `supabase/tests/*.sql` (pgTAP).
- Multiplayer: `lib/multiplayer/server/*` (lobby, match, duel), realtime transport `lib/realtime/*`
  (Supabase Realtime by default; PartyKit/Ably adapters).
- Daily schedule: `lib/game/schedule.ts` + Vercel cron `/api/cron/generate` keeps 60 days ahead.

## Client state and settings

- Settings store: `lib/settings/store.ts` (Zustand + localStorage + account copy): theme, colour-blind mode
  (`cb`, adds patterns), text scale, reduced motion, sound, music, haptics, low data, relaxed (hides timers).
  A boot script applies them before first paint.
- Client API: `lib/client/api.ts` (`useMe`, `useToday`, attempt calls), `lib/client/*` for social/multiplayer.
- Offline: `public/sw.js` (versioned caches), `lib/offline/*` (Daily prefetch, finish queue).

## Copy and i18n

There was no copy or i18n system; strings were inline. `lib/copy/index.ts` now holds player-facing copy per
feature (`copy.signIn`, `copy.welcome`, …). New strings go there; existing inline strings move over as their
screens are touched.

## Admin console

`app/admin/(console)/*` pages backed by `/api/admin/*`; roles in `lib/admin/roles.ts`; every action writes the
audit log (`audit_log`). Feature flags table `feature_flags` (admin Flags page). Runtime tunables live in the
`game_settings` key/value table (`lib/game-settings/*`, admin page "Game settings"), read at runtime with a 30 s cache.

## Tests and tooling

Vitest unit (`*.test.ts`), API integration (`vitest.api.config.mts`, needs a running server), pgTAP, Playwright
(`playwright.config.ts`, `tests/e2e`, `tests/visual`), k6 (`tests/load`). CI: `.github/workflows/ci.yml`
(authorship, checks, database + API, build + bundle budget), `release.yml` (tagging, PR tidy).
