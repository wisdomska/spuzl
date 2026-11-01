# Low-data mode and the offline Daily pack (SPZ-27)

## What low-data mode does

`lowData` in `lib/settings/store.ts` (Settings, "Data and account"). When on:

- no music (`lib/audio`), and the Music switch is disabled in Settings;
- half-size game tiles and share cards (`lib/lowdata/images.ts`);
- fewer confetti pieces (`lib/motion/confetti.ts`) and a lighter Party podium;
- no background downloads: no Daily prefetch, no after-midnight pack, and the service worker's
  background pack is switched off (`instrumentation-client.ts`, `lib/offline/register.ts`).

The browser's Save-Data (`navigator.connection.saveData`) also stops background downloads, without
turning the setting on.

## (a) Suggesting it on a slow connection

`components/shell/LowDataSuggest.tsx`, shown on the tabbed screens (above the bottom nav), never during a
game. After the page has loaded it checks (`lib/lowdata/suggest.ts`, unit tested):

- `navigator.connection.saveData`, or `effectiveType` of `slow-2g`, `2g` or `3g` (Chromium);
- the measured load: Navigation Timing `responseEnd` over 4 s (every browser, including Safari and
  Firefox that lack the Network Information API). Loads served from the HTTP cache don't count.

If any is true, low-data mode is off and the player hasn't answered before, it shows
"Slow connection? Turn on low-data mode" with Turn on / Not now. Either answer is stored in
`localStorage['spuzl.lowDataSuggest']` and it never asks again on that device. If storage is blocked it
doesn't ask (it couldn't remember a "Not now"). It changes the setting on this device only: connection
speed is a property of the device, not the account.

## (b) Offline Daily pack: decision

**Tomorrow's Dailies are not sent early.** The pack for a day is fetched as soon as that GMT day starts.

Why: a Daily is the same puzzle for every player that day, and the Daily leaderboards rank clear time.
Sending tomorrow's puzzles today, even without solutions, leaks the competition:

- these are logic puzzles: the puzzle _is_ its solution (a solver, or just time, gets the answer), so
  "without solutions" protects nothing;
- a player could solve tomorrow's Daily on paper tonight and, at midnight, enter it in seconds. The
  server's checks (`verify`, active time against wall time, offline clears flagged outside their day)
  would all pass, because the moves are real and made on the right day;
- anything on the device can be read from IndexedDB or the Cache Storage; "only playable once the date
  arrives" is a client rule the player controls (device clock, devtools).

The server already enforces this: `POST /api/v1/attempts` pins `mode: "daily"` to today's GMT date, and
nothing else serves Daily puzzle data. No server change was needed.

What we do instead, so a player who goes offline still has the day's Dailies:

1. **App start (existing):** 10 s after load, when idle, today's ready and uncleared launch Dailies are
   started through the service worker, which caches each start response for the GMT day
   (`prefetchDailies`, once per day per device).
2. **Midnight rollover (new):** a tab or installed app that is open over GMT midnight fetches the new
   day's pack 1 to 5 minutes after midnight. The minute is a stable random slot per device so midnight
   isn't a stampede (`lib/offline/daily-pack.ts` `rolloverDelayMs`, unit tested).
3. **Return on a new day (new):** when the tab becomes visible again, or the connection comes back, on a
   GMT day without a pack, it fetches one. Covers phones that slept through midnight.
4. **Background (new, where available):** installed Chromium apps with Periodic Background Sync get a
   `spuzl-daily-pack` sync (about every 12 h, at the browser's discretion). The worker then fetches
   today's pack itself, once per GMT day, so it can be ready even if the app isn't opened before the
   player loses signal. The page tells the worker the game list and whether low-data mode allows it
   (`configureDailyPack`); sign-out deletes that config with the rest of the player's cached data.

Starting an attempt records `started_at`, as the existing prefetch already did. Time is ranked on active
play time, and the server compares it against wall time, so an early start only loosens that bound.

Clears made offline go through the finish queue (`lib/offline/queue.ts`): stored in IndexedDB with the
moment of the clear, posted with `offline: true` when the connection returns, and verified by the server
like any other finish (a clear outside its day is flagged).

`public/sw.js` VERSION is `2026-11-01.1`.

## Checking it by hand

- Suggestion: Chrome devtools, Network throttling "3G" (or "Slow 4G" with a cold cache so the load
  passes 4 s), clear `spuzl.lowDataSuggest`, open `/`.
- Pack: production build (`pnpm build && pnpm start`, or `NEXT_PUBLIC_SW_DEV=1`), sign in, then in
  devtools Application: Cache Storage `spuzl-daily-<today>` holds one entry per Daily. Set the device clock
  just before 00:00 GMT with the app open; a new `spuzl-daily-<tomorrow>` appears a few minutes after.
  Periodic sync: Application > Background services > Periodic background sync, "spuzl-daily-pack".
