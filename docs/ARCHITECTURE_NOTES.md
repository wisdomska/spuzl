# Architecture notes

A map of the SPUZL codebase, refreshed for round 2 (audit: `docs/SPUZL_UX_Game_Audit_Round2.docx`, converted to
`docs/audit-r2.md`; round 1 audit: `docs/SPUZL_UX_Game_Audit.md`). Paths are relative to the repository root.
Facts checked against the code on 6 Nov 2026 (release 1.33.0).

## Stack

- Next.js 16 App Router (`proxy.ts` replaces middleware; `params` and `searchParams` are Promises; route types
  come from `next typegen`), React 19, TypeScript strict, Tailwind v4 via the Turbopack loader.
- Motion (`motion/react`) for animation; Phaser 3 (lazy chunk) for the action games.
- TanStack Query for client data (default staleTime 30 s, `components/shell/Providers.tsx:18`), Zustand for
  settings, Zod for every request body.
- Supabase: Postgres with forced RLS, Auth (anonymous guests, email code, Google), Realtime (match channels).
- Vercel (region lhr1, cron) and Supabase eu-west-2. Production project `xwpllzwnhrrhybezkbxz`, preview
  `cbwkrkftkkdgagambmfn`.

## Size

| Thing                                  | Count | Where                                                                                                                         |
| -------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------- |
| Pages (`app/**/page.tsx`)              | 59    |                                                                                                                               |
| API route handlers (`app/**/route.ts`) | 141   | `/api/v1/*` player, `/api/admin/*`, `/api/cron/*`, `/api/og/*`                                                                |
| Migrations                             | 60    | `supabase/migrations/*.sql`, indexed with rollback notes in `docs/MIGRATIONS.md`                                              |
| Live games                             | 41    | `GAMES` in `lib/catalog.ts`; `LAB_GAMES` 0 (behind `features.labGames`; the twelve graduated 11 Nov 2026), `RETIRED_GAMES` 21 |
| Visible worlds                         | 4     | Puzzles 15, Words & Quiz 13, Arcade 7, Board Games 6 (`WORLDS`, `lib/catalog.ts`)                                             |

## Routing

| Area              | Routes                                                                                                      | Notes                                                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing           | `/` for visitors (`components/landing/*`, playable demo `TryIt.tsx`)                                        | "Play now" → `/welcome/play` (guest, birth step first, no intro). A solved demo counts as the first clear.                                   |
| First run         | `/intro`, `/welcome`, `/welcome/play`                                                                       | Guest / Google / email, birth month + year, "How do you want to start?", lesson, nickname.                                                   |
| Tabs (bottom nav) | `/` (Home map), `/library`, `/leagues`, `/friends`, `/crews`, `/shop`, `/me`, `/settings`, `/u/[nickname]`… | `app/(tabs)/layout.tsx` adds the nav, `LowDataSuggest` and the Inbox. Server-gated by `lib/auth/gate.ts`.                                    |
| Play              | `/play/[game]?mode=daily\|free\|archive\|level`, `/play/[game]/bot`, `/world/[id]`                          | One Play route for every game; Ludo free play redirects to `/play/ludo/bot`.                                                                 |
| Multiplayer       | `/duel`, `/party`, `/party/[code]`, `/bay`, `/bay/[matchId]`, `/ghost/[game]`, `/challenge/[code]`          | Board Games ("Bay") is turn-based with Play live matchmaking.                                                                                |
| Admin             | `/admin/login`, `/admin/(console)/…`                                                                        | Overview, players, puzzles, content, moderation, liveops, flags, settings, metrics, audit.                                                   |
| Dev fixtures      | `/dev/board/[game]?seed=&d=&state=`, `/dev/spuz`, `/dev/pwa`                                                | Only with `ENABLE_DEV_ROUTES=1` or outside production. Seeded, server-free boards for every game.                                            |
| Test sign-in      | `POST /api/dev/sign-in {email}` (R4-27, E2E only)                                                           | Only with `ENABLE_DEV_ROUTES=1`, never on Vercel production (a bare `next start` also needs `ALLOW_TEST_SIGN_IN=1`); `.test` addresses only. |

## The first-game load path (R2-01)

1. **Home** (`app/(tabs)/page.tsx:13-20`): `requirePlayerPage`, then `loadMe` and `loadToday` on the server, seeded
   into React Query (`["me"]`, `["today"]`) through `HydrationBoundary`.
2. **Continue card** (`components/home/HomeScreen.tsx:66-67,155`, `SidePanel.tsx:42,125`) links to
   `continueHref` (`lib/game/next.ts:33`): ladder games → `?mode=level`, launch games not yet cleared → Daily,
   others → `?mode=free`.
3. **Tap priming** (`lib/client/early-attempt.ts:54`, installed in `Providers.tsx:23`): POSTs `/api/v1/attempts`
   on the click for daily and free links only. `mode=level` links (most Continue taps) are not primed.
4. **Route** `app/play/[game]/page.tsx`: `requireSessionPage` (JWT check only) and `getGameSettings()` (twice,
   30 s in-memory cache). `loading.tsx` shows `ShellSkeleton`. No server data hydration on this route.
5. **Client** `components/play/PlayScreen.tsx`: `useMe` (`/api/v1/me?optional=1`), `usePresence` (POST
   `/api/v1/presence`, then every 60 s), `useToday` (staleTime 15 s), `useGameSettings` (`/api/v1/settings/game`,
   5 min), `useLearnedSync`, then once `me` is in: guided play (`GET /api/v1/guided/<id>`) or `begin()` (primed
   attempt or `startAttempt`). `useTapToBoard` reports `tap_to_board` to `/api/v1/metrics`.
6. **Board** chunk: `next/dynamic` with `ssr: false` per game (`games/board-registry.tsx`), inside
   `components/game/GameShell.tsx`.

`/api/v1/today` call sites: `useToday` in `HomeScreen`, `SidePanel`, `WorldScreen`, `PlayScreen` (one shared key,
so React Query de-duplicates them), plus a direct `fetch` in `lib/offline/register.ts:48` (`prefetchDailies`, 10 s
after load on idle) that bypasses the cache. A cold `/play` load can therefore fetch `/today` twice.

Existing prefetches: `PlayScreen.tsx:119` (world page), `:370` (next game, `perf.prefetch`), `HomeMap.tsx:129`
(worlds), `GameCard.tsx:48`, `app/library/page.tsx:54` (idle), `app/welcome/page.tsx:130`.

## Games

- Catalogue `lib/catalog.ts`: id, name, world, engine, rule, scoring, `minTimeMs` (default 4000 ms, the
  fast-solve floor). `UI_ACCENT` is the one interface colour (lemon green, `var(--accent)`).
- Per game `games/<id>/`: `logic.ts` (pure: generate, countSolutions, verify, progress, hint, grade), `Board.tsx`,
  optional `content.ts`, `logic.test.ts`; board games add `rules.ts` (turn-based rules shared by client and server).
- Registries: `games/logic-registry.ts`, `games/board-registry.tsx`. Bots: `lib/bot/*`.
- Shell: `components/game/GameShell.tsx` (header with one timer, title + level, menu, board slot, feedback line,
  toolbar, pause overlay with Comfort settings). Boards talk to it through `BoardApi`.
- Guided first play (practice rounds): `lib/guided.ts` `needsGuided` = every solo mode (daily, five, free, archive,
  level, bot), never played, not in `localStorage` `spuzl.learned` or `me.learned`, no Daily in progress, not in the
  admin's `practice.disabled`. Taps on a game not learned yet are not primed (`shouldPrime`, gate set in
  `Providers.tsx`). Live rounds: "Practice first" in the Party lobby and friend Duel wait, then a 10 s How it works
  card (`components/multiplayer/practice.tsx`, R2-07, decision PR1).
- Levels: `lib/game/levels.ts`, `lib/client/levels.ts`; "Next level of <game>" on the compact result bar.

## Prompts and banners (R2-04)

| Prompt                    | Where                                                                 | Trigger today                                                                                                                                                                 |
| ------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Notifications ("Turn on") | `components/shell/Inbox.tsx` `AlertsAsk`                              | Signed in, any page but `/play`, `/intro`, `/welcome`, `/admin`; permission "default"; Not now → again in 3 days, max 3 (`spuzl.alertsAsked`). Shows on the first Home visit. |
| Low-data suggestion       | `components/shell/LowDataSuggest.tsx`, `lib/lowdata/suggest.ts:12-33` | After load, low data off, never answered; slow = `saveData`, 2g/3g, or navigation > 4000 ms.                                                                                  |
| Save your streak (guests) | `PlayScreen.tsx:564`, `ResultsScreen.tsx:187`                         | After `guest.signInPromptAfterClears` clears (default 3).                                                                                                                     |
| Event banner              | `components/home/EventBanner.tsx`                                     | `features.seasonal`.                                                                                                                                                          |
| Photosensitivity notice   | `PlayScreen.tsx:470`                                                  | Flagged games.                                                                                                                                                                |

There is no shared prompt queue: two prompts can appear in the same screen visit.

## Multiplayer

- Duel: `components/multiplayer/DuelScreen.tsx`, `duel.tsx`. R3-06: Quick Match is open to every known band, paired
  by pool (`quickMatchPool` in `lib/multiplayer/liveGate.ts`: 13 to 15 only meet 13 to 15; enforced in `pollQueue`,
  `pickOpponent` and `svc_mm_claim`); Board Bay Play live stays 16+ (`canPlayLive`). Game picker is a 3-column
  grid in an inner scroll box `max-h-[180px]` (`duel.tsx:122`). Server: 403 `age_restricted` in
  `lib/multiplayer/server/lobby.ts:47` and `bayQueue.ts:76` (raw `age_band`), while `match.ts:215` uses
  `effectiveBand`: the two should agree (R2-02).
- Party: `components/multiplayer/PartyScreen.tsx`, `party.tsx`. Start → `POST /api/v1/rooms/<code>/start`, which
  sets `round_started_at` 4 s ahead (`lobby.ts:415`, `lib/multiplayer/constants.ts:9`); a countdown number is shown
  (`PartyScreen.tsx:500-509`). Sheets that can be open at round start: `ChatPanel`/`ChatPopup`, `EmoteBar`,
  `RoomSettings`, 18+ `PlayersSheet`. Podium (`party.tsx:899-909`): host sees "Run it back" first, then "Next game".
- Party score races (R3-08): `SCORE_RACE_GAMES` / `isPartyGame` in `lib/multiplayer/games.ts` (settings
  `party.scoreRaces`, `party.scoreRaceSeconds`, lab games via `features.labGames`), scoring and placing in
  `lib/multiplayer/scoreRace.ts`, the per-racer answer log in `match_race_logs` (`raceGuess`, `resolveScoreRace` in
  `lib/multiplayer/server/match.ts`). Start readiness (R3-01): `lib/multiplayer/readiness.ts`, "Start without them"
  seats the unready as spectators (`match_players.sat_out`) until Run it back.
- Party turn modes (`lib/party-adult/modes.ts`): the 18+ Draw It and Two Truths (`features.adultParty`) and Family Draw
  (`drawfam`, R2-P5: Draw It for signed-in 16+ players, preset words, pick from four, `party.familyDraw`). One server
  path (`lib/multiplayer/server/adult.ts`, gate per mode in `requirePartyMode`), one round UI
  (`components/multiplayer/adult-party.tsx`), one report path (snapshot in `reports`, Moderation Party content tab).
- Server: `lib/multiplayer/server/*` (lobby, match, duel, bay, bayQueue, rewards incl. rank from rounds, chat,
  invites, adult); realtime `lib/realtime/*`; push `lib/push/server.ts` + `public/sw.js`.

## Server and data

- API helpers `lib/api/server.ts` (`handle`, `requirePlayer`, `body`, `rateLimit`). Identity: `currentUser()`
  verifies the JWT locally (`getClaims`).
- Game service `lib/game/service.ts`: start/save/finish attempts, anti-cheat (`:467-486` flags under
  `minTimeMs`, client time > wall clock, offline Daily outside its day, game self-checks), rewards, streaks,
  ratings (`updateRating`), badges, quests.
- Account deletion: `lib/server/account-delete.ts` (the one path for players and admins).
- Daily schedule: `features.dailies` is **off** by default (`lib/game-settings/schema.ts:12-17`) and the Play
  page forces free play when off; `lib/game/schedule.ts` `fillSchedule` still fills `dailies` 60 days ahead.
  No "Daily Five" code exists yet (R2-05); `LAUNCH_IDS` (`catalog.ts:846`) is the nearest.

## Client state, settings, copy, tokens

- Settings store `lib/settings/store.ts` (theme, colour-blind patterns, text scale, reduced motion, sound
  effects, music, haptics, low data, relaxed, other-audio mixing; versioned audio defaults).
- Client API `lib/client/api.ts` (`useMe`, `useToday`, attempts), `lib/client/*`.
- Offline: `public/sw.js` (versioned caches + long-lived audio cache), `lib/offline/*`.
- Audio: `lib/audio/*` (recorded ElevenLabs effects with synth fallback, recorded music loops per area).
- Copy: `lib/copy/*.ts`, one file per feature, `en` object in `lib/copy/index.ts`. Some screens (`DuelScreen`,
  `party.tsx`) still have inline strings: they move to `lib/copy` as R2 tickets touch them.
- Tokens: `styles/spuzl-tokens.css`, `styles/tailwind-theme.css`, `styles/spuz.css`.

## Admin console

- Runtime settings: `lib/game-settings/schema.ts` (keys with ranges and help text: `features.*`, `perf.prefetch`,
  `free.*`, `guest.*`, `leagues.*`, `adultParty.*`…), page `app/admin/(console)/settings/page.tsx`, read at runtime
  with a 30 s server cache and `useGameSettings` on the client.
- Feature flags: `app/admin/(console)/flags/page.tsx` (`FlagsPage` in `components/admin/OpsPages.tsx:426`).
- Audit log: `audit()` in `lib/admin/auth.ts:127`; audit page.
- Metrics: `components/admin/MetricsPage.tsx` with CSV export (audited POST `/api/admin/metrics`); client events
  POST `/api/v1/metrics` into `client_metrics` (first-party events only, `lib/analytics/track.ts:45`). Players
  CSV: `app/api/admin/players/export/route.ts`.
- Fast-solve moderation: flagged attempts per player (`lib/admin/players.ts:113`), resolve with
  `svc_admin_resolve_flagged`.

## Tests and tooling

- Vitest unit (`*.test.ts`), API integration (`vitest.api.config.mts`, needs a server), pgTAP
  (`supabase/tests`), Playwright (`playwright.config.ts`: projects mobile/desktop dark, mobile light, `phone-375`,
  `desktop-1280`, `perf`), k6 (`tests/load`). CI `.github/workflows/ci.yml`.
- QA harness `tests/e2e/harness.ts` (see its header): onboarding by age or exact birth year, seeded boards for every
  game, solvers, Duel and Party with several browser contexts, focus keeping, throttling, axe-core.
- Perf: `tests/perf/r2-baseline.spec.ts` (round 2 baseline, any deployment), `tests/perf/tap-to-board.spec.ts`
  (round 1, local stack).
- Test guests: `scripts/qa/delete-test-guests.mjs` deletes the anonymous guests a run created (ids logged by the
  specs). Every run against production must end with it.
