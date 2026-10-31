# Changelog

## 1.0.0 (31 October 2026)

First public release at https://spuzl.vercel.app.

### Play

- 51 puzzle, skill and board games across 9 worlds. Every game has a server-checked Daily and unlimited Free play. Logic Dailies are proven to have exactly one solution.
- A daily rollover at 00:00 GMT, a 60-day Daily buffer, the archive, and the tutorial with the first-run flow.
- Server-authoritative play:
  - hints come from the server
  - anti-cheat: human time floor, wall-clock check, replay for action games
  - idempotent rewards
- The offline Daily prefetch and the finish queue keep play working without a connection.

### Progress

- XP and levels, Sparks, streaks with freezes, badges, daily and weekly quests, and weekly leagues.
- Glicko-2 ranks per world, celebrations, and the Shop:
  - skins, hats, titles and board themes
  - streak freezes
  - hint packs, which extend Free play hints

### Together

- Duel: ranked queue, friend link and practice bot.
- Party rooms (2 to 8, with TV view), async challenges and Ghost Race.
- Board Bay: chess, draughts, Oware, Ludo, live and async.
- Friends, presence, crews with weekly Crew Clash, feed and reactions, blocks and reports, School Cup and share cards.

### Operations

- An admin console at `/admin` with TOTP and roles, the content calendar, puzzle preview and solve check, moderation, live ops and an audit log.
- Supabase with row-level security forced on every table. Clients read only; all writes go through the API.
- PWA with an installable app and a service worker.
- Vercel Analytics and Speed Insights.

### Quality

See `docs/QA_REPORT.md`:

- 768 unit, 67 API integration and 112 database tests
- axe accessibility checks on 28 routes
- Lighthouse, visual parity and k6 load results
