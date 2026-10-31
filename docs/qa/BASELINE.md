# Baseline (before the frictionless-play pass)

Measured 2026-10-31 on a production build (`pnpm build && pnpm start`) of commit `8ec4315` against the local
Supabase stack, with `tests/perf/tap-to-board.spec.ts` (10 runs per journey). "Throttled 4G" is Lighthouse's
slow 4G (150 ms RTT, 1.6 Mbps down, 750 kbps up) plus 4× CPU slowdown, at 375 × 812. Desktop is unthrottled at
1280 × 800. Times are milliseconds from the tap to an interactive board (the board grid visible and enabled),
or to Home's Play card for "Enter The Grid".

| Journey | Desktop p50 | Desktop p95 | 4G p50 | 4G p95 | API calls fired |
| --- | --- | --- | --- | --- | --- |
| Home Play → board | 933 | 993 | 1147 | 1326 | POST /api/v1/attempts |
| Library row → board | 894 | 928 | 1140 | 1290 | POST /api/v1/attempts |
| Results Next → board | 469 | 549 | 805 | 1387 | POST /api/v1/attempts |
| Enter The Grid → Home | 1117 | 1155 | 1386 | 1895 | GET /api/v1/friends, POST /api/v1/profile |

SPZ-01 target: 4G p50 under 700 ms and p95 under 1500 ms for every journey.

Notes
- The audit measured 5 to 16 s on the live site before the loading-screen, prefetch and server-render work
  shipped on 31 October; these numbers are after that work and are the baseline for SPZ-01.
- "Results Next" here is the Daily results screen's Next button (it started free play of the same game).
- Real devices on real networks add DNS, TLS and Vercel cold starts; production numbers will be higher.

## Lighthouse (mobile, simulated slow 4G, signed-in guest)

| Page | Performance | Accessibility | Best practices | SEO | LCP | TBT |
| --- | --- | --- | --- | --- | --- | --- |
| / | 80 | 100 | 96 | 100 | 4.4 s | 240 ms |
| /play/crownfall?mode=free | 84 | 100 | 96 | 100 | 3.9 s | 210 ms |
| /library | 95 | 100 | 96 | 100 | 2.6 s | 150 ms |

Best practices is 96 locally only because `/_vercel/insights` and `/_vercel/speed-insights` 404 outside Vercel.
