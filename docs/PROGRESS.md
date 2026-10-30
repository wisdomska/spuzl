# Progress

## Milestone 1: Foundation (in progress)
- Next.js 16 App Router, TypeScript strict, Tailwind v4 with the SPUZL tokens imported unchanged.
- Fonts: Unbounded, Geist and Geist Mono via next/font. Theme, colour-blind modes, text scale and reduced motion are applied before first paint.
- Audio (`lib/audio`) and haptics (`lib/haptics`) ported from `spuzl-audio.js`, with an iOS visual fallback.
- Spuz with all 12 moods. Reference captures of all 90 design frames are in `tests/visual/reference`.
- Game contract (`games/types.ts`), catalogue of 51 games, seeded RNG, the 6-zone GameShell and a pause sheet.
- Crownfall: generator, uniqueness solver, grader, verifier, hints, board and 10 unit tests (all pass).

## Skills
Emil Kowalski's skills were installed with `npx skills add` (into `.agents/skills`). The taste, frontend-design, webapp-testing, Vercel and Supabase skills were cloned from their repos into `.claude/skills`, because the CLI prompt hangs non-interactively.

## Blocked on owner
- The GitHub repo can't be created from the cloud session: its proxy blocks the repo-creation APIs. The owner creates `wisdomska/spuzl` (public, empty).
- A Supabase access token is needed for the hosted projects. Local development uses the Supabase CLI and Docker.
