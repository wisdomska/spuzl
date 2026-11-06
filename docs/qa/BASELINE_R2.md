# Round 2 baseline

Measured on **6 Nov 2026** against **production** (`https://spuzl.vercel.app`, release 1.33.0) with
`tests/perf/r2-baseline.spec.ts`, 10 runs per journey per profile. Raw data, including the median run's
waterfall for every journey: `docs/qa/perf-r2-baseline.json`.

## How it was measured

- **Profiles:** desktop 1280 × 800 with no throttling; phone 375 × 812 with Lighthouse "slow 4G" (150 ms RTT,
  1.6 Mbit/s down, 750 kbit/s up) and 4× CPU slowdown.
- **Cold:** a fresh browser context (empty HTTP cache, no service worker) signed in as the guest. The first game
  of a session, as on a phone that has just opened SPUZL.
- **Warm:** the same journey again in that context.
- **Tap-to-board:** frame-accurate. The page stamps the tap (first `click`, capture phase) and the first animation
  frame where the board (`role=grid`, `listbox`, the board's canvas or buttons) is on screen and not
  `aria-disabled`.
- **Waterfall:** Resource Timing entries and long tasks (observer registered on every document) between those two
  stamps.
- **Test accounts:** each run onboarded its own guest (20 in all). All 20 were deleted afterwards with
  `scripts/qa/delete-test-guests.mjs`, and production's 9 real players were untouched.
- **Fast-solve flags:** the Next level journey solved one Crownfall level per run at human pace (a 7 s pause),
  so no fast-solve flags were raised.

## Results (milliseconds)

| Journey                           | Desktop p50 | Desktop p95 | 4G phone p50 | 4G phone p95 | R2-01 target             |
| --------------------------------- | ----------: | ----------: | -----------: | -----------: | ------------------------ |
| Home Continue/Play, **cold**      |       2 663 |       4 376 |    **4 658** |    **5 114** | p50 < 1 500, p95 < 2 500 |
| Home Continue/Play, warm          |       1 669 |       2 867 |        1 566 |        1 775 | < 1 200                  |
| Library → card → Play, **cold**   |       1 428 |       2 025 |    **5 034** |    **5 611** | p50 < 1 500, p95 < 2 500 |
| Library → card → Play, warm       |         929 |       1 171 |          966 |        1 315 | < 1 200                  |
| Results "Next level of Crownfall" |         593 |         988 |          604 |          817 | < 1 000 (Protect)        |
| Landing "Play now" → lesson board |       4 689 |       4 762 |        5 061 |        5 242 | (R2-08)                  |

- The first API request after a cold tap starts at p50 **2 718 ms** on the 4G phone and 1 262 ms on desktop
  (warm: 565 and 623 ms).
- Worst single runs: desktop cold Home 8 000 ms, desktop cold Library 6 818 ms.
- The audit's 8.4 s cold load is in our range as an outlier, not as the median, on these profiles. The audit used
  a real mid-range phone, so the 4G-phone column is the one R2-01 must beat.

### Landing "Play now" → first board, step by step (median run)

| Step reached                | Desktop | 4G phone |
| --------------------------- | ------: | -------: |
| Welcome ("Play as guest")   |   3 382 |    3 718 |
| Birth month and year        |   3 616 |    4 093 |
| "How do you want to start?" |   4 096 |    4 738 |
| Lesson board playable       |   4 685 |    5 270 |

Most of it is the `/intro` logo animation (about 3 s) before the welcome screen. Clicks are made the instant each
step appears, so these times are the app's, with no thinking time. R2-08 (landing straight to the birth-date
step) removes the intro and the welcome step from this path.

## Waterfall: Home Continue, cold, 4G phone (median run, 4 658 ms)

| From → to (ms) | What                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 8 → 559        | RSC payload for `/play/crownfall`                                                                                              |
| 185 → 4 235    | **55 sound-effect files** (`/sfx/*.mp3`), three at a time, from the moment the tap unlocks audio                               |
| 540 → 2 720    | Seven JS chunks for the Play route, game shell and board, competing with the sound effects                                     |
| 593 → 3 169    | RSC prefetches started by Home: `/me` (three times), `/shop`, then `/play/dusk`, `/world/logic`, `/world/board`, `/world/word` |
| 2 851 → 3 656  | First API calls: `/presence`, `/me/learned`, `/attempts`, only after the chunks have arrived                                   |
| 2 723          | One long task (64 ms) as the board mounts                                                                                      |
| 3 703 → 4 320  | `/metrics` (tap_to_board)                                                                                                      |

The Library cold run has the same shape. It also starts the 480 KB `/music/logic.mp3` at 145 ms, which downloads
until 4 791 ms, and three more RSC prefetches (`/play/dusk` twice, `/play/nine`) during the tap.

## What the baseline says R2-01 must fix

1. **Audio competes with the first game (introduced in 1.30.0/1.29).** The tap that opens the game is also the
   gesture that unlocks audio, which starts all 55 sound effects and the area's music downloading at once. On 4G
   they take the bandwidth the game chunks need.
   - Fix: load effects and music only after the board is interactive and the network is idle, in priority order,
     and skip them in low-data mode.
2. **No data request until the code arrives.** `/attempts`, `/presence` and `/me/learned` start at about 2.85 s,
   after seven chunks.
   - Continue to a ladder game (`mode=level`) is not primed on tap (`lib/client/early-attempt.ts` covers daily and
     free only).
   - Fix: prime every mode on tap, and preload the Play route and shell chunks during Home idle.
3. **Prefetch storms.** Home and Library start RSC prefetches (`/me` ×3, `/shop`, worlds, other games) that are
   still running when the player taps.
   - Fix: limit idle prefetch to the Continue target and the Play shell, and cancel or defer the rest after a tap.
4. **`/today` twice.**
   - In-window duplicates were not seen: max one `/today` per tap-to-board window, and Home's comes from server
     hydration.
   - The duplicate the audit saw is the offline Daily prefetch (`lib/offline/register.ts:48`). It fetches `/today`
     directly about 10 s after load, bypassing React Query.
   - Fix: one shared in-flight request, cached per GMT day.
5. **Skeleton.**
   - `app/play/[game]/loading.tsx` shows `ShellSkeleton`, but the first frames after a client-side tap stay on Home
     until the RSC payload lands (about 0.5 s on 4G).
   - Fix: show the board skeleton on the tap frame.

## Harness

`tests/e2e/harness.ts` (see its header) adds:

- `onboardGuest(page, { birthYear, birthMonth, age, nickname, guided })`;
- `keepFocus`;
- `seededBoardUrl` and `ALL_SLUGS`;
- `solveSeeded`;
- `guestContext`, `duelFriend(browser)` and `partyRoom(browser, n)` (several browser contexts);
- `runAxe` (serious and critical only);
- `logGuest` / `GUEST_LOG` (`.qa/guests.txt`, outside Playwright's cleared results folder).

Viewports `phone-375` and `desktop-1280` and the throttling profiles were already there. The self-test is
`tests/e2e/harness-r2.spec.ts`; its results are below.

<!-- harness results are appended below -->

### Harness self-test (6 Nov 2026)

Run against a local server (`next dev`, `ENABLE_DEV_ROUTES=1`) on the **preview** database, project `phone-375`.
Result: **7 of 7 passed** (2.4 min).

| Check                                                                          | Result             |
| ------------------------------------------------------------------------------ | ------------------ |
| `onboardGuest({ birthYear })`: 15 → 13-15, 16 → 16-17, 25 → 18+ (`/api/v1/me`) | Pass               |
| `keepFocus`: a board in a background tab stays focused and unpaused            | Pass               |
| Seeded boards: all 28 games open their deterministic puzzle at 375 and 1280 px | Pass (56 of 56)    |
| `solveSeeded("crownfall")` plays the seeded puzzle to the end                  | Pass               |
| `duelFriend`: host's code, guest joins, both in the same duel                  | Pass               |
| `partyRoom(3)`: three players in one room, host sees both guests               | Pass               |
| `runAxe` on Home (WCAG 2.1 AA, serious and critical only)                      | Pass, 0 violations |

The harness itself needed two fixes:

- Quickfire shows only a Start button before play, so "board ready" now also accepts a Start button.
- The solvers now import game logic statically, because Playwright's loader doesn't resolve the `@/` alias for
  runtime `import()`.

The 16 guests these runs created were deleted from the preview database afterwards.

### What the harness does not cover yet

- Tap solvers exist for Crownfall, Trotro Jam, Light Up, Killer Sums and Dara. The other games are covered by the
  seeded-board smoke check only. Solvers get added game by game as R2 tickets touch them, e.g. Beat Tap for R2-10.
- Screenshot diffs use Playwright's `toHaveScreenshot` in `tests/visual`. R2 tickets add their own baselines at
  375 and 1280 px.
- Party with 8 contexts (R2-03) uses the same `partyRoom(browser, 8)`. It was proven here with 3 to keep the run
  short.
