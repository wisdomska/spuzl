# Progress

Status on 31 October 2026: feature-complete release candidate on `feat/core-engine` (PR into `preview`).

## Done

- **Foundation:**
  - Next.js 16 App Router, TypeScript strict, Tailwind v4 with the SPUZL tokens.
  - Fonts, themes, colour-blind modes, text scale and reduced motion are applied before first paint.
  - Audio and haptics.
  - CI: authorship, checks, database and build.
- **Brand:** Spuz in all 12 moods and the logo intro.
- **Core engine:**
  - Supabase schema with forced RLS; all writes go through `/api/v1` with the service role.
  - Anonymous guests.
  - Server-authoritative attempts and anti-cheat.
  - Idempotent reward ledgers and Glicko-2 ratings.
  - Daily rollover and buffer generation (pg_cron plus Vercel cron).
- **Games:** all 51 across 9 worlds, with generators, uniqueness checks, verifiers, hints and boards (Phaser for action games).
- **Gamification:** XP and levels, Sparks, streaks with freezes, badges, quests, leagues, ranks and celebrations.
- **Multiplayer:** Duel (queue, friend, bot), Party rooms, async challenges, Ghost Race, Board Bay (live and async) and School Cup.
- **Social:** friends, presence, crews, feed and reactions, blocks, reports and profiles.
- **Share:** share cards, Daily share text and challenge links.
- **Admin:** console at `/admin` with TOTP, calendar, preview, moderation, live ops and the team.
- **PWA:** service worker, offline Dailies, an offline finish queue and an install prompt.
- **QA:** see `docs/QA_REPORT.md`.

## Release steps left

1. Owner: remove the auto-appended footer from the PR body (the Authorship check reads it), then merge the PR into `preview`.
2. Open and merge `preview` → `main` (production deploy).
3. Bootstrap the owner admin (`POST /api/admin/bootstrap` or `scripts/bootstrap-owner.mts`) and verify `/admin`.
4. Tag `v1.0.0`.
