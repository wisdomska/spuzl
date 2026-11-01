# QA report: frictionless-play pass (1.1.0)

Date: 1 November 2026. Build: `feat/core-engine`, as a production build (`pnpm build && pnpm start`) against the
local Supabase stack. The same commits are deployed to Vercel preview. This report only claims what was tested.
Environment limits are listed at the end.

## Tickets

| Ticket                                                                                     | Status     | Evidence                                                                                                                                       |
| ------------------------------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1 GameShell (one shell, one timer, header, tools, hint flow, endings, comfort sheet) | Done       | `tests/e2e/shell-contract.spec.ts`: 51 games × 2 viewports pass. Free-play bar: `free-result.spec.ts`                                          |
| SPZ-01 Instant taps                                                                        | Partly met | Latency table below. Skeleton on tap, attempt started at tap, prefetch, cached profile                                                         |
| SPZ-02 Sudoku box borders                                                                  | Done       | Unit tests (box index, status). Screenshots `play-nine`                                                                                        |
| SPZ-03 Duel round transitions                                                              | Done       | 2 s result card (admin `duel.roundResultMs`), then 3-2-1. `roundOutcomes` unit tests. Server rejects wrong-round moves (`multiplayer.test.ts`) |
| SPZ-04 Crownfall readability                                                               | Done       | Palette contrast tests incl. 3 colour-blind simulations on 10 seeded boards. Hint deduction tests. `docs/qa/CROWNFALL_PALETTE.md`              |
| SPZ-05 Lesson counts as first clear                                                        | Done       | API test `flow.test.ts` (streak 1, Today 1). E2E `onboarding.spec.ts`                                                                          |
| SPZ-06 Quickfire                                                                           | Done       | Component and unit tests                                                                                                                       |
| SPZ-07 Tool modes and one clock                                                            | Done       | Contract test (exactly one timer, no second mm:ss). Merge, Rage Ridge, Party rail and Challenge strip clocks removed                           |
| SPZ-08 Dusk input                                                                          | Done       | `tests/unit/board/dusk-input`, input unit tests                                                                                                |
| SPZ-09 Four Up columns                                                                     | Done       | `fourup-columns` component test                                                                                                                |
| SPZ-10 Quads                                                                               | Done       | Fast feedback, labelled colours. Words are now a listbox (axe)                                                                                 |
| SPZ-11 Sixer/Nine status                                                                   | Done       | Status unit tests. Shell shows one feedback line at a time                                                                                     |
| SPZ-12 Duel trust                                                                          | Done       | API test: rules card for a never-cleared game, live queue data only, bot from the start                                                        |
| SPZ-13 Party tabs and game-first flow                                                      | Done       | Picker/API parity unit test. Library, World and Results Challenge sheet                                                                        |
| SPZ-14 Library                                                                             | Done       | `library.spec.ts` (both viewports). Admin metadata API round-trip test                                                                         |
| SPZ-15 Onboarding                                                                          | Done       | `onboarding.spec.ts`. First-time tips                                                                                                          |
| SPZ-16 Home on phones                                                                      | Done       | `home.spec.ts`: map takes at least 70% above the dock at 375 × 812                                                                             |
| SPZ-17 Gotcha and Rage Ridge                                                               | Done       | `tests/unit/rage-input.test.ts`. Browser check at 375 × 812 (canvas 60.1%)                                                                     |
| SPZ-18 Full games vs bot                                                                   | Done       | 39 bot tests (legal moves, tactics, Hard beats Easy, under 300 ms)                                                                             |
| SPZ-19 Starter cosmetic                                                                    | Done       | pgTAP `070_starter_cosmetic`, API test                                                                                                         |
| SPZ-20 Guest safety net                                                                    | Done       | Unit tests (show/hide rule), API test (guest clears)                                                                                           |
| SPZ-21 Leagues                                                                             | Done       | Grouping unit tests, pgTAP `080_league_grouping`                                                                                               |
| SPZ-22 Chess                                                                               | Done       | Screenshots, contrast 6.2:1 / 14:1                                                                                                             |
| SPZ-23 Nine on phones                                                                      | Done       | `fit-cell` tests: 40 px cells at 375 and wider                                                                                                 |
| SPZ-24 Flinch                                                                              | Done       | `flinch-autostart` component test                                                                                                              |
| SPZ-25 Deep links                                                                          | Done       | Back helper unit tests. Duel page renders as a page                                                                                            |
| SPZ-26 Ranks never skip a tier                                                             | Done       | Unit tests                                                                                                                                     |
| SPZ-27 Low-data mode                                                                       | Done       | Unit tests. Decision on next-day packs in `docs/qa/LOW_DATA.md`                                                                                |
| Admin cascade                                                                              | Done       | Settings, Library metadata, Metrics (CSV), role-gate tests for every new route, audit log                                                      |
| Extra requests                                                                             | Done       | Guided first play per game (`guided.spec.ts`). Share sheet for invites (`invite-share.spec.ts`)                                                |

## Tap-to-interactive latency (SPZ-01)

Measured with `tests/perf/tap-to-board.spec.ts`, 10 runs per journey. The page records the tap time and the
first animation frame where the board is on screen and enabled. Before is commit `8ec4315`; after is this build.
Throttling uses Lighthouse slow 4G (150 ms RTT, 1.6 Mbps) with 4× CPU slowdown.

| Profile                 | Journey               | Before p50 / p95 (ms) | After p50 / p95 (ms) | Target (p50 < 700, p95 < 1500) |
| ----------------------- | --------------------- | --------------------- | -------------------- | ------------------------------ |
| Throttled 4G, 375 × 812 | Home Play → board     | 817 / 877             | 713 / 785            | p95 pass, p50 over             |
| Throttled 4G, 375 × 812 | Library row → board   | 844 / 882             | 589 / 650            | pass                           |
| Throttled 4G, 375 × 812 | Results Next → board  | 716 / 958             | 746 / 787            | p95 pass, p50 over             |
| Throttled 4G, 375 × 812 | Enter The Grid → Home | 899 / 952             | 964 / 1018           | p95 pass, p50 over             |
| Desktop 1280            | Home Play → board     | 705 / 720             | 671 / 680            | n/a                            |
| Desktop 1280            | Library row → board   | 697 / 701             | 408 / 427            | n/a                            |
| Desktop 1280            | Results Next → board  | 432 / 485             | 633 / 648            | n/a                            |
| Desktop 1280            | Enter The Grid → Home | 475 / 511             | 500 / 518            | n/a                            |

- **Library row:** the Library now prefetches the top rows and starts the attempt when the card's action is tapped.
- **Results Next:** before, "Next" restarted free play of the same game in place. Now it moves to the next game
  on the path ("Next in Logic Lab: Dusk"), which is a real navigation, so the two numbers measure different
  journeys.
- **Enter The Grid:** this needs two server round trips (save the profile, then render Home with the new
  player), so on 4G it stays near 1 s. The p95 target is met; the p50 target is not.
- **Home Play** is 13 ms over the p50 target. What's left is mostly React rendering the Play screen under 4×
  CPU slowdown. Preloading the board's code at the tap is the next step (see Follow-ups).

## Lighthouse (mobile, simulated slow 4G, signed-in guest)

| Page                      | Before (perf / a11y / best practices / SEO) | After (best of two runs)        |
| ------------------------- | ------------------------------------------- | ------------------------------- |
| /                         | 80 / 100 / 96 / 100                         | 77 / 100 / 96 / 100 (LCP 4.5 s) |
| /play/crownfall?mode=free | 84 / 100 / 96 / 100                         | 84 / 100 / 96 / 100 (LCP 2.5 s) |
| /library                  | 95 / 100 / 96 / 100                         | 91 / 100 / 96 / 100 (LCP 2.8 s) |

- Accessibility is 100 everywhere.
- Performance is under the 90 target on Home and Play. Their LCP and total blocking time are mostly React
  hydration under 4× CPU slowdown (react-dom and the Next runtime account for about 1.4 s of the 2 s scripting).
- Run-to-run variance is large on this shared machine: Home scored 65 to 77 across four runs.
- Best practices is 96 only because `/_vercel/insights` returns 404 outside Vercel.

## Accessibility

- **axe-core** (`tests/e2e/a11y.spec.ts`, WCAG 2.1 A and AA) found **zero serious or critical violations** on
  14 screens at 375 and 1280: Home, Library, Crownfall, Nine, Dusk, Quads, Duel, Party, Friends, Leagues,
  Shop, Me, Settings and Quests.
- **Found and fixed in this pass:**
  - The accessible names of Library rows, islands, the level ring, Shop tiles, the number pad and the Play card
    now contain their visible text (WCAG 2.5.3).
  - The Quads grid had broken roles; the words are now a listbox.
- **Colour-blind checks:** simulations for Crownfall are in unit tests. Quads uses labelled colours, and
  Flinch's go signal also uses shape and text.
- **Reduced motion** is honoured by the new animations: sheets, the page fade, Library rows, the Home ring,
  tips and the guided round.

## Functional runs

- **Unit:** 930 tests pass (`pnpm test`).
- **API integration:** 77 pass, covering the daily loop, the lesson, Duel, Party, social, admin role gates,
  settings, Library metadata and metrics.
- **End to end on the production build** (375 and 1280): 28 pass and 8 are skipped (on-demand screenshot and
  legacy specs). Covered: onboarding, Home, Library, the guided round, free-play results, the invite share
  sheet, offline clear, PWA and admin.
- **Shell contract:** 51 games × 2 viewports = 102 pass (dev server, since fixtures are off in production).
- **CI** on `preview` runs typecheck, lint, format, unit, database plus API, and build plus bundle budget.

## Screenshots

`docs/qa/screens/after/phone-375/` and `docs/qa/screens/after/desktop-1280/` hold welcome, Home, Library,
World, Crownfall, Nine, Dusk, Quads, Four Up, Chess vs bot, Duel, Party, Friends, Leagues, Shop, Me, Quests and
Settings. Flow shots (`library-*`, `home-*`, `onboarding-*`, `guided-*`, `free-result-*`,
`invite-share-*`) are in `docs/qa/screens/after/`.

## Not covered here (environment limits)

- **Browsers:** only Chromium is installed in this environment. Safari iOS, Firefox, Samsung Internet and the
  WhatsApp and Instagram in-app browsers were not run.
- **Real devices and screen readers:** no VoiceOver or TalkBack spot checks were possible. axe and name checks
  stand in for them.
- **Viewports:** 320, 360, 390, 414, 768, 1024, 1440, landscape and 200% zoom were not each run as a full
  matrix. 320, 360 and 414 were spot-checked per ticket (no horizontal scroll), and every E2E runs at 375 and 1280.
- **Live multiplayer:** Duel and Party were tested through the API (two to three players) and the existing
  realtime specs, not with 8 live browser contexts.
- **Production numbers** will be higher than these local ones: real DNS and TLS, Vercel cold starts, and
  Supabase in eu-west-2.

## 1.2.0 integration pass (Dailies off, admin pagination, Phase 5 behind switches)

Run on 1 November 2026 against a production build (`pnpm build`, then `pnpm start` with
`SETTINGS_CACHE_MS=0` so tests can flip settings) and the local Supabase stack. Dailies were off unless a test
switched them on and back.

| Suite                                                                                                                                                                                            | Result      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| Typecheck, lint (0 warnings), Prettier                                                                                                                                                           | Pass        |
| Unit (`pnpm test`)                                                                                                                                                                               | 1,128 pass  |
| API integration (`vitest.api.config.mts`): daily loop, Dailies off, Duel, Party, social, admin role gates for every route, pagination, settings, Library metadata, metrics, events, status cards | 95 pass     |
| Database (pgTAP, `supabase test db`)                                                                                                                                                             | 128 pass    |
| E2E on the production build, 375 and 1280 (`tests/e2e`)                                                                                                                                          | All pass    |
| Shell contract (61 games: the 51 live and the 10 lab games)                                                                                                                                      | 122 pass    |
| Realtime with several browser contexts: two-device Duel best of 3 and leave-mid-match, 8-player Party race with the host leaving, live Board Bay chess                                           | 4 pass      |
| Lab games, switch on then off, repeated 3 times at both viewports                                                                                                                                | 6 of 6 pass |

The E2E suite includes:

- **The full player journey (`journey.spec.ts`).** It goes through first run, the lesson, Home, tips, the guided
  first play, the Library, a real clear, World, Quests, Leagues, Shop, Me, the Friends share sheet, Daily-only
  pages redirecting, Settings, Duel vs the Practice bot and a Party room. It checks every screen for any
  "Daily" wording.
- **The axe scan:** zero serious or critical issues on 14 screens.

Fixed during this pass:

- The API test setup left Dailies switched on; it now restores the previous value.
- The league pgTAP check depended on other test data.
- The Duel realtime spec used the old entry sheet and round copy.
- The admin and flow tests hard-coded port 3000.
- Lab game rows were set to `coming_soon` so nightly jobs ignore them.

Not covered: Safari, Firefox and real devices (only Chromium is installed here), and live play of the new games
by real players while the switch is off in production.

## 1.3.0 integration pass (1 November 2026)

Run against a local production build (`pnpm build && pnpm start`, `SETTINGS_CACHE_MS=0`) on local Supabase with
60 days of generated puzzles.

| Suite                                      | Result                                                                      |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| Typecheck, lint                            | Clean                                                                       |
| Unit (`pnpm vitest run`)                   | 118 files, 1171 tests passed                                                |
| pgTAP (`supabase test db`)                 | 13 files, 143 tests passed                                                  |
| API integration (`vitest.api.config.mts`)  | 6 files, 96 tests passed                                                    |
| E2E, realtime, visual (mobile and desktop) | All passed; skips are the existing ones                                     |
| Google sign-in (production)                | Supabase hands off to Google's sign-in page; client and return URL accepted |
| Public homepage (production)               | `/` without a session shows About; guests and players land on Home          |

Found and fixed in this pass:

- The offline Daily pack still started Daily attempts on Home while Dailies were off (404s in the console).
- The homepage swap to About at first applied to in-app prefetches, which sent a brand-new guest to About after
  onboarding. It now applies only to full page loads with no session cookie.
- Two new migrations shared a version number; one was renumbered (`20261110200001`).

## 1.4.0 integration pass (1 November 2026)

Local production build with `SETTINGS_CACHE_MS=0`, local Supabase with 60 days of generated puzzles.

| Suite                                      | Result                                                        |
| ------------------------------------------ | ------------------------------------------------------------- |
| Typecheck, lint                            | Clean                                                         |
| Unit                                       | 124 files, 1221 tests passed                                  |
| pgTAP                                      | 19 files, 246 tests passed                                    |
| API integration                            | 9 files, 130 tests passed                                     |
| E2E, realtime, visual (mobile and desktop) | All passed after the fixes below; skips are the existing ones |

Found and fixed in this pass:

- Browsers kept serving a stale copy of `/api/v1/settings/game` (Chrome honours stale-while-revalidate), so a
  switched-off feature stayed visible for minutes. Same for `/api/v1/games/meta` (up to an hour). The edge cache now
  uses `CDN-Cache-Control`; browsers revalidate.
- Admin player actions validated the body before the role, so a moderator's delete attempt read as "invalid"
  rather than "forbidden".
- Settings showed "Signed in" with Sign out and Delete account to a visitor with no profile.
- Tests updated for the Ranked Duel rules break and the new admin Overview landing.
