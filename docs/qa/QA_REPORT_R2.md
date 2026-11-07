# SPUZL round 2: QA report

Release under test: **1.38.1** (production, spuzl.vercel.app, 7 November 2026), built on 1.34.0 to 1.38.0.
Source audit: `docs/audit-r2.md`. Baseline: `docs/qa/BASELINE_R2.md`. Admin cascade: `docs/qa/ADMIN_CASCADE_R2.md`.

## Summary

- All 19 round 2 tickets (R2-01 to R2-19) and the Phase 5 features are released. All 15 outstanding migrations are
  applied to preview and production.
- **Instant first load (R2-01) meets every target on production:**
  - cold game on a 4G phone: 4 658 → 1 103 ms p50;
  - Library → Play, cold, 4G phone: 5 034 → 1 223 ms p50;
  - landing → first board, 4G phone: 5 061 → 1 257 ms p50.
- **CI on 1.38.0 is green:**
  - typecheck, lint, format and unit: 1 766 tests;
  - pgTAP and API integration (every suite, including the Phase 5 and admin-route tests);
  - build and bundle budget.
- **Lighthouse on production:** 100 in all four categories on desktop; mobile performance 91 to 98, and 100 in the
  other three.
- **E2E:**
  - On production (desktop 1280, one worker), every spec that can run against a deployment passes, except one that
    needs a test-controlled admin setting (note 3).
  - The seeded-board specs pass on a local dev server: 42 of 42.
- **QA found and fixed three product bugs:**
  - in 1.37.2, the tap skeleton never showed for Next `<Link>` game cards;
  - in 1.37.2, picker focus was lost after choosing a game;
  - in 1.38.1, with reduce motion on at desktop widths, a board could crash ("This page couldn't load") in an endless
    height-fit loop.
- **Test guests:** every guest created by these runs was deleted (production: 73 + 42 + 104; preview: 18). Real players are
  untouched: the cleanup script only removes anonymous accounts with no email, from the ids each run logged.

## Ticket matrix

| Ticket | What                                                           | Release | Unit/API | E2E                    | Result |
| ------ | -------------------------------------------------------------- | ------- | -------- | ---------------------- | ------ |
| R2-01  | Instant first load: skeleton on tap, board first, audio after  | 1.34.0  | yes      | production             | pass   |
| R2-02  | Under-16 Duel: full-height game picker, keyboard, focus return | 1.35.0  | yes      | production             | pass   |
| R2-03  | Party round start: countdown, chat closed, board frozen        | 1.35.0  | yes      | production (8 players) | pass   |
| R2-04  | Prompt timing and one prompt queue (alerts, low data)          | 1.35.0  | yes      | production             | pass ¹ |
| R2-05  | Daily Five with share grid                                     | 1.35.0  | yes      | production             | pass   |
| R2-06  | Visible rules before the first move, every mode                | 1.37.0  | yes      | local (dev board)      | pass ² |
| R2-07  | Practice round from every entry                                | 1.37.0  | yes      | production             | pass   |
| R2-08  | Onboarding shortcut (landing demo)                             | 1.36.0  | yes      | production             | pass   |
| R2-09  | Birth month and year input, validation                         | 1.36.0  | yes      | production             | pass   |
| R2-10  | Beat Tap count-in, no penalty in practice, sound prompt        | 1.36.0  | yes      | local (dev board)      | pass ² |
| R2-11  | Trotro Jam selected state, drag, swipe, keyboard               | 1.36.0  | yes      | local (dev board)      | pass ² |
| R2-12  | Library rows are links; Play Level N; Emoji Hits tile          | 1.36.0  | yes      | production             | pass   |
| R2-13  | Friends-only rooms for under-16 hosts                          | 1.35.0  | yes      | production             | pass   |
| R2-14  | Quads back as a word game                                      | 1.36.0  | yes      | local (dev board)      | pass ² |
| R2-15  | Timers start on the first move                                 | 1.37.0  | yes      | local (dev board)      | pass ² |
| R2-16  | Pause hides the board; menu holds the clock                    | 1.37.0  | yes      | local (dev board)      | pass ² |
| R2-17  | Emoji Hits: one input per mode, hint cleared, clock on Start   | 1.36.0  | yes      | local (dev board)      | pass ² |
| R2-18  | Home new-games card; Continue thumb and level                  | 1.36.0  | yes      | production             | pass   |
| R2-19  | Shop marks what you can afford                                 | 1.36.0  | yes      | needs local DB         | ³      |
| P5     | Challenge links, story cards, Party TV                         | 1.38.0  | yes      | production             | pass   |
| P5     | Streak shield for guests who sign in                           | 1.38.0  | yes      | needs a test setting   | ³      |
| P5     | School leagues, event templates, lab games, Family Draw        | 1.38.0  | yes      | off by default ⁴       | API    |
| ADMIN  | Admin cascade (settings, audit, roles, Metrics with CSV)       | 1.37.0+ | yes      | admin specs (local)    | API    |
| —      | Game-over card (chess, draughts, Ludo, Oware, bot)             | 1.37.1  | yes      | —                      | unit   |

1. **R2-04 slow 3G.** The "slow 3G" low-data test now skips itself when the deployment loads under the threshold. On
   production, pages load in 1.2 to 2.0 s on emulated slow 3G, below the 4 000 ms threshold, so the suggestion
   rightly stays away. The rule itself is covered by the synthetic slow-load tests, which pass.
2. **Specs on the seeded board.** These specs open seeded boards at `/dev/board`, which production does not serve.
   They were run on a local dev server against the preview database; see "Local run" below.
3. **Specs that change state the test controls.** These need a database the test runner controls:
   - R2-19 sets a guest's Sparks through local `psql`;
   - the streak-shield spec lowers the admin setting `guest.signInPromptAfterClears` for the run.

   Against production, the helper writes to the local database instead, so production settings are never touched
   (checked after the run). The behaviour is covered by API tests in CI.

4. **Off by default.** These features stay off until an admin switches them on. Their API tests run in CI, with
   the setting switched on for the test.

## Before and after: tap to playable board

Production, Playwright with 10 runs per journey:

- Desktop runs at 1280 × 800.
- "4G phone" is a Pixel-class viewport with 4G throttling and 4× CPU slowdown.
- Cold means a fresh context: empty cache, no service worker.

Baseline is 6 November 19:18 GMT (1.33); after is 7 November 21:30 GMT (1.37.2, the same code paths as 1.38.0).

| Journey (ms)                     |   Desktop p50 |   Desktop p95 |      4G phone p50 |      4G phone p95 | Target                   |
| -------------------------------- | ------------: | ------------: | ----------------: | ----------------: | ------------------------ |
| Home Continue, **cold**          |   2 663 → 926 | 4 376 → 1 166 | **4 658 → 1 103** | **5 114 → 1 499** | p50 < 1 500, p95 < 2 500 |
| Home Continue, warm              | 1 669 → 1 016 | 2 867 → 1 078 |       1 566 → 926 |     1 775 → 1 105 | < 1 200                  |
| Library → card → Play, **cold**  | 1 428 → 1 200 | 2 025 → 1 276 | **5 034 → 1 223** | **5 611 → 1 495** | p50 < 1 500, p95 < 2 500 |
| Library → card → Play, warm      |     929 → 860 | 1 171 → 1 147 |       966 → 1 000 |     1 315 → 1 186 | < 1 200                  |
| Results "Next level"             |     593 → 530 |     988 → 789 |         604 → 546 |         817 → 797 | < 1 000 (protect)        |
| Landing "Play now" → first board |   4 689 → 939 |   4 762 → 945 | **5 061 → 1 257** | **5 242 → 1 365** | (R2-08)                  |

Raw data: `docs/qa/perf-r2-baseline.json` and `docs/qa/perf-r2-after-final.json` (requests in the tap-to-board
waterfall, long tasks). On cold Home taps, `/api/v1/today` is now called at most once (0 on Home, 1 from the
Library card).

## Lighthouse (production, 1.38.0)

| Page       | Form factor | Performance | Accessibility | Best practices | SEO | LCP   | TBT    | CLS   |
| ---------- | ----------- | ----------: | ------------: | -------------: | --: | ----- | ------ | ----- |
| `/`        | mobile      |          91 |           100 |            100 | 100 | 1.5 s | 390 ms | 0     |
| `/`        | desktop     |         100 |           100 |            100 | 100 | 0.6 s | 0 ms   | 0.003 |
| `/library` | mobile      |          96 |           100 |            100 | 100 | 1.9 s | 210 ms | 0     |
| `/library` | desktop     |         100 |           100 |            100 | 100 | 0.5 s | 10 ms  | 0     |
| `/welcome` | mobile      |          98 |           100 |            100 | 100 | 1.5 s | 160 ms | 0     |
| `/welcome` | desktop     |         100 |           100 |            100 | 100 | 0.4 s | 10 ms  | 0     |

Lighthouse 12.2.1, run signed out (these routes then render the welcome flow).

## Accessibility (axe)

Axe runs inside the E2E specs (`runAxe` in `tests/e2e/harness.ts`) on the screens each ticket changed:

- birth input and its error (R2-09);
- Library list and cards (R2-12);
- the Duel picker (R2-02);
- Quads in colour-blind mode (R2-14);
- the pause cover (R2-16);
- the Party TV view.

Every axe check in the passing specs returned no violations.

## Production E2E runs

1. **Before fixes** (desktop 1280, 2 workers): 48 passed, 53 failed. The failures fell into four groups:
   - **Seeded-board specs:** need `/dev/board`, which production does not serve.
   - **Shop spec:** needs local `psql`.
   - **Test updates:**
     - Library rows are links now;
     - Next's route announcer is a second `alert`;
     - the Ctrl-click popup URL was read before navigation;
     - a Continue card below the fold;
     - two SVGs in the thumb;
     - a service worker answering page loads;
     - the measured client-side navigation ending a synthetic slow run.
   - **Two product bugs, fixed in 1.37.2:**
     - TapSkeleton listened in the bubble phase and skipped "cancelled" clicks, but Next `<Link>` always cancels
       the browser's navigation. So no game card on Home showed the skeleton.
     - The Duel and Party game picker is not a Radix trigger, so focus fell to the page body on close.
2. **1.38.0, all production-safe specs** (2 workers): 55 passed, 8 failed.
3. **The 8 failures again, one worker:** 16 passed, 3 failed.
   - The others were load flakiness from running two workers.
   - Of the three: Party TV was a test bug (its `<main>` is 0 × 0 around a fixed frame); the streak shield needs
     its test setting (note 3); and slow 3G is note 1. All three tests were updated.

## Local run (seeded-board specs)

Run with `pnpm exec next dev -p 3100` against the preview database, desktop-1280 project, one worker, one spec file
at a time. A production build cannot run in this container (`next build` is killed by its memory limit).

| Spec  | Tests | Result     | Notes                                                                                                                               |
| ----- | ----: | ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| R2-06 |     7 | all passed | The Party test now waits for "2 of 2 ready" before Start (the room rightly refused a start while a player was still getting ready). |
| R2-10 |     5 | all passed | Beat 1 is watched every frame, and the practice feedback line is read once React has drawn it.                                      |
| R2-11 |     6 | all passed |                                                                                                                                     |
| R2-14 |     6 | all passed | Includes axe on Quads in colour-blind mode.                                                                                         |
| R2-15 |     7 | all passed |                                                                                                                                     |
| R2-16 |     7 | all passed | The board-centre check skips the sheet animating in, and Radix's `pointer-events: none` on `<body>` is undone and then restored.    |
| R2-17 |     4 | all passed |                                                                                                                                     |

**A product bug found here, fixed in 1.38.1.** With reduce motion on, at 1280 and 1440 px, the Crownfall board threw
"Maximum update depth exceeded" and showed "This page couldn't load". The two-column shell's side panel was 5 px
taller than the screen, and `useFitHeight` kept shrinking the board to fix an overflow the board wasn't causing,
over 50 synchronous updates in a row.

`useFitHeight` now does two things:

- It stops when a shrink doesn't reduce the overflow: it undoes that step and leaves the board alone until the
  viewport changes.
- It never grows back past a size that overflowed.

After the fix, Crownfall, Nine and Dusk all render at 375, 1280 and 1440 px, with and without reduced motion. Unit
tests cover the new cap in `tests/unit/game/fit-cell.test.ts`.

## Phase 4 survey (375 and 1280 px)

`tests/e2e/r2-phase4.spec.ts`, screenshots in `docs/qa/screens/r2/phase4/`:

- **Gotcha:** the sideways scroll at 375 px did not reproduce on 1.36 and later.
- **Chess:** pieces rising above their squares is by design (the 3D set).
- **Quickfire:** options stay hidden until Start. The earlier failures were test issues.
- **Four Up:** a column tap drops in that column. The earlier failures were test issues.

## Screenshots

`docs/qa/screens/r2/` holds each ticket's screens at 375 and 1280 px, plus the Phase 5 screens (`p5-*`). They
come from the runs above: production for production specs, local for seeded-board specs.

## Known limits and follow-ups

- **A production build cannot run in this QA container.** `next build` is killed by the container's memory
  limit, so seeded-board specs use the dev server.
- **Specs that set state through local `psql` or the local admin helper** (R2-19, the streak shield) need a local
  Supabase stack. CI runs their API equivalents.
- **Admin E2E specs** (`tests/e2e/admin/*`) sign in with TOTP and run against a local stack.
- **Remaining follow-ups** are in `docs/qa/FOLLOW_UPS.md` under "Round 2":
  - a score-based Party race;
  - Family Draw words in the database;
  - Azonto dance art;
  - a distinct-player count for push devices.
