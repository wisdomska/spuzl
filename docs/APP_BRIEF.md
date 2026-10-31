# App build brief (read fully before writing code)

You are a senior engineer on SPUZL: Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 with SPUZL tokens, Supabase (Postgres + RLS + Auth + Realtime). The design handoff is the floor: match it exactly or do better, never worse.

## Read first

- `design/design_handoff_spuzl/README.md` (product rules) and the design file(s) named in your task. Reference screenshots: `tests/visual/reference/*.png` (view them with the Read tool). Exact values live in the `.dc.html` markup (inline styles) and its `class Component` logic.
- `design/design_handoff_spuzl/design/SPUZL Handoff.dc.html`: the motion spec, z-index scale and sound map. Normative.
- `docs/SRS.md`: requirement IDs, rules, API, anti-cheat.
- `node_modules/next/dist/docs/` before using a Next API you have not used here (Next 16: `proxy.ts` replaces middleware, `params` and `searchParams` are Promises, `PageProps<"/route">` and `RouteContext<"/route">` are global helpers).
- `.agents/skills/animate/SKILL.md` before writing motion, `.agents/skills/review-animations/SKILL.md` before finishing UI.

## Conventions (follow exactly)

- **Server is authoritative.** Every write goes through a route handler under `app/api/v1/...` using `handle`, `body` (Zod), `requirePlayer` / `requireUser`, `rateLimit` from `lib/api/server.ts`. Use `supabaseAdmin()` (service role) only after authorising. Clients never write tables directly.
- **Database changes** are new migration files in `supabase/migrations/` using YOUR timestamp prefix (given in your task). Every new table gets RLS enabled and forced, no client write grants, and policies wrapped `(select auth.uid())`. Add pgTAP tests in `supabase/tests/`. Apply locally with `pnpm supabase migration up` (NEVER `supabase db reset` or `db push`: other engineers share the local database). Existing functions: `svc_grant_reward`, `svc_spend_sparks`, `svc_record_daily_clear`, `svc_rate_limit` and others in `supabase/migrations/`.
- **Client data**: TanStack Query hooks; the fetch wrapper is `api()` in `lib/client/api.ts`. Add your hooks in your own files (for example `lib/client/social.ts`), not in `api.ts`.
- **UI**:
  - Primitives: `components/ui/Button.tsx` (toy button), `IconButton`, `Icon` (Phosphor Bold by kebab name, registry in `components/ui/icons.generated.ts`; add missing icon names there), `Skeleton` (no spinners, shown after 300 ms). Brand: `components/brand/Spuz.tsx` (12 moods), `Wordmark`.
  - Shell: tabbed screens live under `app/(tabs)/` (bottom nav + desktop rail); HUD chips are in `components/shell/Hud.tsx`.
  - Colours always via CSS variables (`var(--surface)`, `var(--accent)`, `bg-surface-raised`, `text-muted`), never raw hex for themeable surfaces. Both themes must look right.
  - World colours appear only inside their world. Global chrome is lime. Ink text `#0E0F1A` on world fills.
  - Numbers use the `num` class (Geist Mono, tabular). No em or en dashes in copy. One label per action. Emoji only in emotes and share text. Never colour alone.
  - Layout: 44 px minimum targets, mobile first at 390 × 844, desktop at 1280 (88 px rail, content, 360 px side panel), and TV mode 1280 × 720 where designed.
- **Motion**: Motion (`motion/react`) with full transform strings, or CSS transitions. Transform and opacity only, no ease-in. Curves: `[0.23, 1, 0.32, 1]` (out), `[0.77, 0, 0.175, 1]` (in-out); springs stiffness 600, damping 30 (press) and stiffness 300, damping 12 (party). Celebrations skip on tap. Every animation gets a reduced-motion variant (`useReducedMotion()` or `[data-motion="reduce"]`).
- **Sound and haptics**: `play(name, { step })` from `lib/audio` pairs the sound with its haptic automatically. Use the Handoff map names (tick, pop, buzz, chime, jingle, fanfare, whoosh, swoosh, clink, coins, cheer, drum, horn, sting, bump, emote, hop, clack, capture).
- **Accessibility**: WCAG 2.2 AA in both themes, full keyboard, a polite live region for announcements, labelled controls.
- **Server-only code** imports `"server-only"`. Never import `lib/supabase/admin.ts` into client code.
- **Shared files you may append to, but not otherwise rewrite**: `lib/catalog.ts`, `components/ui/icons.generated.ts`, `app/globals.css` (append a clearly commented section), `docs/DECISIONS.md` (append rows). Anything else shared: describe the change in your final report instead.

## Environment

- Containers restart without warning. If Docker is down: `setsid dockerd >/tmp/dockerd.log 2>&1 &`, wait until `docker info` works, then `pnpm supabase start`. Local env lives in `.env.local` (copy it from the main checkout `/home/user/spuzl/.env.local` if your worktree lacks it). Start your own dev server on your port: `setsid pnpm dev -p <port> > /tmp/dev-<port>.log 2>&1 &`. Never kill processes by broad name patterns; other engineers run dev servers too.
- Sign in during browser tests by completing `/welcome` (age band, tutorial, nickname), or call the API with a Bearer token from `supabase.auth.signInAnonymously()` (see `tests/api/helpers.ts`).
- Keep scratch files in your own subfolder of the session scratchpad.

## Done means

- `pnpm tsc --noEmit`, `pnpm eslint --max-warnings=0 <your dirs>`, `pnpm prettier --check <your files>` and `pnpm vitest run` all pass. Add unit tests for logic and API integration tests (`tests/api/*.test.ts`, run with `pnpm vitest run -c vitest.api.config.mts` against your dev server via `API_BASE=http://localhost:<port>`).
- Every screen you build has been viewed in Playwright at 390 × 844 in dark and light themes (plus 1280 desktop where relevant) and compared with its design reference by eye. Fix anything worse than the design.
- Commit in small Conventional Commits on your branch. NEVER add Co-Authored-By, "Generated with", session links or any mention of Claude, Anthropic or AI anywhere. A hook rejects them.
- Final report: what's done, tests added, design deviations with reasons, what's left, content needing owner review, and shared-file changes you need.
