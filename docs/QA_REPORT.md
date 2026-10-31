# QA report

Release candidate on `feat/core-engine`, tested 31 October 2026. Local runs used a production build (`pnpm build && pnpm start`) against the local Supabase stack, all on one 4-vCPU container.

## Summary

| Area                                      | Result                                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Unit tests (Vitest)                       | 768 passed, about 98% line coverage on `games/`                                                           |
| API integration (`vitest.api.config.mts`) | 64 passed                                                                                                 |
| Database (pgTAP, `supabase test db`)      | 108 passed in 8 files: RLS, grants, service functions, multiplayer, admin                                 |
| All 51 games                              | Smoke test: every game loads, accepts input and verifies on the server                                    |
| Daily loop e2e                            | Intro, onboarding, Daily clear, results, celebrations, free play: no console errors                       |
| Accessibility (axe-core)                  | 0 serious or critical issues across 28 routes, in dark, light, desktop, colour-blind and large-text modes |
| Visual parity (`pnpm test:visual`)        | 11 of 11 screens beside their design frames; no horizontal overflow, no errors                            |
| Reduced motion                            | 0 running animations on intro, Home, World, Play, Quests and Profile                                      |
| Worst-case data (320 and 390 px)          | No overflow after fixes (see below)                                                                       |
| Security                                  | No server secrets in client bundles; RLS forced on every table; clients have SELECT only                  |
| Load (k6, local)                          | See "Load" below: holds at half the target on one box; Vercel scales out                                  |

## Lighthouse (mobile, simulated slow 4G)

| Page                        | Performance | Accessibility | Best practices | SEO | LCP   |
| --------------------------- | ----------- | ------------- | -------------- | --- | ----- |
| /intro (first visit)        | 95          | 100           | 96*            | 100 | 3.0 s |
| /privacy                    | 95          | 100           | 96*            | 100 | 2.5 s |
| /world/logic                | 90          | 100           | 96*            | 100 | 3.4 s |
| / (signed in)               | 83          | 100           | 96*            | 100 | 3.7 s |
| /play/crownfall (signed in) | 90          | 100           | 96*            | 100 | 2.6 s |
| /leagues (signed in)        | 76          | 100           | 96*            | 100 | 4.2 s |

\* The only best-practices failure is the 404 for `/_vercel/insights` and `/_vercel/speed-insights`, which exist only on Vercel. On the deployed site this category is 100.

Scores vary by about ±8 between runs on the shared container. Real-user Core Web Vitals come from Vercel Speed Insights after launch.

Changes made during this pass:

- First-run visitors are redirected on the server, so they never download Home or Play.
- The Supabase client loads lazily, outside the first-screen bundle.
- Home and Play render with server-loaded player data, through React Query hydration.
- The Play loading frame shows the real title and rule text.
- The Dailies prefetch waits until well after load and is skipped on low data or Save-Data.
- The intro letters paint on the first frame.
- Every screen has a page title.
- `vibrate()` is no longer called before the first tap.
- JWTs are verified locally with `getClaims()`. The hosted projects sign with ES256, so API calls make no Auth round trip.

Performance (initial JS): react-dom alone is 72 KB gzipped, and the Next runtime and Motion add about 39 and 48 KB more. Phaser (347 KB gzipped) loads only for action games.

## Load (k6)

Script: `tests/load/daily-and-rooms.js`. Players are minted locally with `tests/load/mint-players.mjs`. Each Daily player opens Home, clears today's Crownfall Daily (server-verified), then browses boards, quests and leagues and starts four free-play puzzles. Each room has four players who create, join and ready up, then race with progress ticks and finish.

| Run                                   | Requests/s | Failed | p95 read | p95 write | Daily finish p95 |
| ------------------------------------- | ---------- | ------ | -------- | --------- | ---------------- |
| 150 players and 25 rooms (250 people) | 58         | 0.09%  | 1.3 s    | 2.1 s     | 5.3 s            |
| 300 players and 50 rooms (500 people) | 69         | 2.0%   | 9.0 s    | 10.6 s    | 16 s             |
| 50 rooms alone                        | —          | 0%     | —        | —         | —                |

The local box saturates at about 60–70 requests per second. That box runs the app, k6 and eleven Supabase containers on 4 vCPUs, and the failures are the local gateway dropping connections ("other side closed"). Production differs: Vercel functions scale out, and Supabase runs in eu-west-2, next to the lhr1 functions (about 1–3 ms per query).

The first limit in production will be the Supabase free tier's shared compute. Watch database CPU in the Supabase dashboard; `docs/OPERATIONS.md` says when to upgrade. A Daily clear makes about 20 sequential queries (rewards, streak, percentile, rating, badges and quests). Batching them into one database function is the main lever if finish latency grows.

## Fixed during QA

- **Play at 320 px:** the header and 7-wide boards overflowed by 24 px. The timer pill now compacts, and below 360 px the cell floor is 36 px (WCAG 2.5.8 minimum: 24 px).
- **Home at 320 px:** "Play Crownfall" wrapped out of its button. The side buttons narrow and the subtitle hides below 360 px.
- **World hero:** an inline `background` hid the dot grid.
- **Shop preview:** the dot grid was invisible on the surface colour.
- **Missing titles:** `/intro` had no `<title>`, and most tab screens used the generic default.
- **Console noise:** a 401 from the `/me` probe on first run, a prefetch 401 and blocked `vibrate()` calls.

## Known gaps (not blocking release)

- **Clue Cave:** answers ship to the client scrambled, not hidden. An answer-reveal endpoint would close this.
- **Rage Ridge:** the shell timer and the simulation clock can differ by a few hundred ms.
- **Custom word content:** the guess route should look up puzzles by id, so that admin-scheduled custom word content verifies.
- **Board themes:** equipped board themes are not yet applied to boards.
- **Crew Clash:** winners are not written at week end.
- **Deep links:** `/duel?friend=` and `/party?crew=` are not handled yet.
- **Hint packs:** the hint-pack purchase route does not spend hints yet.
- **Shop catalogue:** it has fewer hats than the design frame (art needed).
- **Google sign-in:** it needs the Google provider enabled in Supabase (owner step).
