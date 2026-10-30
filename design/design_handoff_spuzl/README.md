# Handoff: SPUZL (complete game interface)

## Overview
SPUZL is a mobile-first web app of 51 puzzle, skill and classic board games across 9 themed worlds ("The Grid"). Every game is **playable anytime**: each has one shared **Daily** (resets 00:00 GMT, counts for streaks, leaderboards and "Full Spuzl") plus endless **Free play** (never runs out, no leaderboard). Multiplayer is first-class: live Duels, Party Races (2 to 8), async challenges, Ghost Races, weekly Leagues, Crews and School Cup. A squishy puzzle-piece mascot, **Spuz**, reacts to everything.

Audience: 13 to 35, Ghana and West Africa first. Primary device: mid-range Android, 360 × 800, often on 3G. Target stack: **Next.js (App Router) + React + Tailwind v4 + Radix + Motion (motion/react) + Rive + Phaser 3**. The full product spec is included: `SPUZL - Software Requirements Specification.docx`.

## About the Design Files
Everything in `design/` is a **design reference built in HTML**: prototypes showing intended look, copy and behaviour. It is **not production code to copy**. Recreate these designs in the Next.js/React codebase using its own patterns (Tailwind v4 utilities, Radix primitives, Motion for animation, Phaser for action games, Rive for the mascot).

Each `*.dc.html` file opens directly in a browser (it loads `support.js`, a small runtime that renders `{{ }}` template holes from the `class Component` logic at the bottom of each file). Read the template markup for layout and inline styles (exact values), and the logic class for data, state and behaviour.

## Fidelity
**High fidelity.** Final colours, type, spacing, radii, copy, states and motion. Recreate them closely. Known stand-ins are listed under *Assets*.

## Files (open in this order)
| File | What it is |
|---|---|
| `design/SPUZL Prototype.dc.html` | **Clickable prototype**, 6 flows: (a) first run, (b) Daily clear + celebration chain, (c) live Duel, (d) Party Race, (e) Board Bay chess Daily, (f) Play anytime. Real puzzle logic, synth sound, haptics. Best source for behaviour. |
| `design/SPUZL Art Direction.dc.html` | Brand, wordmark, app icon, logo-intro timing, Spuz 12 moods + **Rive rig spec**, the 9 islands, colour tokens, AA adjustments, colour-blind palettes, type, motion principles. |
| `design/SPUZL Handoff.dc.html` | **Motion spec for every animation** (duration, curve, delay, properties, sound, haptic, reduced-motion), breakpoints, z-index, sound map, and the "rules an engineer could get wrong". Treat as normative. |
| `design/SPUZL Solo Screens.dc.html` | Splash, Home map (evening, streak at risk), World view, Game screen (Crownfall rule-broken), Results, Level up. |
| `design/SPUZL Multiplayer.dc.html` | Duel matchmaking, versus + countdown, in-match, match end; Party lobby, race, podium; League table; TV mode 1280 × 720. |
| `design/SPUZL Onboarding and Overlays.dc.html` | Onboarding (4 steps), rank up, badge, streak milestone, streak lost + Freeze, Full Spuzl, pause + offline; Duel entry, round end, disconnect/left/draw; async challenge card + ghost result; create room; Ghost Race HUD; league ceremony. |
| `design/SPUZL Game Boards.dc.html` | 15 launch boards with empty / in-progress / rule-broken / cleared states, reusable 6-zone board template, all 51 game icons (3D). |
| `design/SPUZL Board Games.dc.html` | World 9 **Board Bay**: chess (Daily + live Duel), draughts, oware, ludo, four up, flip, async "Your move" inbox, rules. |
| `design/SPUZL Social and Meta.dc.html` | Leaderboards, profile (own + friend), quests + claim, shop with try-on, friends, feed + report, crew + crew clash, settings, archive, School Cup teacher setup + TV class board. |
| `design/SPUZL Components.dc.html` | Component library in all states (default, hover, pressed, focus, disabled, loading, error). |
| `design/SPUZL States Share Light Desktop.dc.html` | Empty / loading / error / offline, share cards (1080×1920, 1080×1080) + emoji-grid text, light theme, desktop 1280. |
| `design/SPUZL Admin.dc.html` | /admin: content calendar, puzzle preview, moderation queue, live ops. |
| `design/Spuz.dc.html` | Mascot reference with all 12 moods (props: mood, size, color, lookX, lookY, still). Build the real one in Rive from the rig spec. |
| `design/Icon3D.dc.html`, `design/spuzl3d.js` | Live 3D asset renderer (three.js): Staunton chess pieces and extruded 3D game icons. |
| `design/spuzl-audio.js` | Synthesised SFX kit + Vibration API haptic map, ready to port as-is. |
| `tokens/spuzl-tokens.css`, `tokens/tailwind-theme.css` | **Use these directly.** CSS variables (dark default, `[data-theme=light]`, `[data-cb=protan|deutan|tritan]`) + Tailwind v4 `@theme`. |

## Product rules (must hold everywhere)
- **Play anytime.** Every game always has a Free play entry. The Daily is just today's shared puzzle. Home shows "Play anytime · 51 games, no limit" above the Play row. A Free play clear gives +10 XP and +5 Sparks and goes straight to the next puzzle; it never touches leaderboards or streaks.
- World colours appear **only inside their world**. All global chrome (nav, XP, wallet, primary CTA) uses lime `--accent`.
- Text on any world-colour fill is ink `#0E0F1A`, never white. On light theme, use `--w-*-ink` tokens for world-coloured text.
- Never rely on colour alone. Every mark has a glyph; broken cells get the hatch `--rule-hatch`; league zones carry arrow icons; Ludo colours each carry a shape.
- Numbers use Geist Mono with `font-variant-numeric: tabular-nums`.
- No spinners. Loading = skeletons in the final layout + Spuz Thinking, shown only after 300 ms.
- **Duels never show the opponent's board** (puzzle games). Board Bay games show the shared board.
- Copy: no em or en dashes, one label per action, emoji only in emotes and share text.
- Spuz never covers an active board.

## Screens / Views
Every screen is a 390 × 844 mobile frame unless noted. Exact layout values are inline in the files. Patterns repeat:

- **Top bar** (games): 44 × 44 icon buttons (r 14, `#20233A`): back, centred timer pill (`#171929`, Geist Mono 600 22px), hint (gold icon, count badge), help, pause. Padding 52px 12px 8px (status-bar safe area).
- **Title row**: game name Unbounded 900 24px in world colour, right meta Geist Mono 500 14px `--text-muted`, `white-space:nowrap`.
- **Board slot**: square, cell = floor((min(vw,420) − 32 − gaps) / cols), min 44px, board padding 6–8px on `#0A0B12`, r 20, 2px `--line` ring.
- **Feedback line**: min-height 48, r 16, never overlays the board. Danger state = `#2A1520` bg + 2px `#FF5A5F` inset ring + warning icon.
- **Controls row**: buttons 60–64px tall, r 18–20, toy depth `box-shadow: 0 5–6px 0 <darker>`; pressed = translateY(5px) + 1px shadow.
- **Bottom nav**: 80px, 5 items (Grid, Leagues, Friends, Shop, Me), active lime.
- **Home map**: dotted grid bg (`radial-gradient(#22253C 1.5px …) 24px`), floating islands (ellipse top + tapered underside + landmark block), each bobbing 5–6 s ease-in-out. Spuz stands on the current island. Top HUD: level ring (conic progress), streak chip, Sparks chip. Bottom stack: streak-risk card (evening), "Play anytime" bar, Today x of 15, Play / Duel / Party.
- **Desktop 1280**: 88px left rail, content, 360px right panel (see States/Share/Light/Desktop file).
- **TV mode 1280 × 720**: text ≥ 26px, rows 80px.

Full per-screen detail: open the corresponding file. Every screen has a `data-screen-label`.

## Interactions & Behavior
See `SPUZL Handoff.dc.html` → Motion spec (25 moments, each with duration, curve, delay, properties, sound, haptic, reduced-motion variant). Key curves:
- `--ease-out: cubic-bezier(.23,1,.32,1)` entrances; `--ease-in-out: cubic-bezier(.77,0,.175,1)` on-screen moves; **never ease-in**.
- Springs: press `stiffness 600, damping 30`; party `stiffness 300, damping 12`.
- Repeated moves ≤ 140 ms (cell pop 1 → 1.08 → 1). Celebrations 400–1,200 ms, always skippable by tap.
- Transform and opacity only (progress bars = `scaleX` with left origin; reorders = translateY slots of 34px).
- Reduced motion: keep fades and colour, drop movement, shake and parallax.

Prototype logic worth porting directly (see the `class Component` in `SPUZL Prototype.dc.html`):
- `analyze(cells, pz)`: Crownfall validation (row, column, region, touching), and which rule message to show.
- `variant(i)`: 8 symmetries × base puzzles for endless free play (replace with a server generator + solver later).
- `chLegal()`: legal moves for the chess puzzles; `CH_PUZ` mate-in-1 set.
- Duel opponent and race bots are simulated with timers; replace with realtime (WebSocket / Supabase Realtime / Ably). The server validates progress = correct placements / total.

## State Management
Per session: `screen`, `flow`; player: `nick`, `color` (Spuz skin), `level`, `xp`, `streak`, `sparks`, `cleared`; game: `mode` (`tutorial | daily | free | duel | race`), `cells`, `hist` (undo), `t0`, `doneAt`, `hintsUsed`, `slips`, `freeN`, `chessN`; duel: `round`, `me`, `them`, `opp` (0–100), `oppMiss`, `oppDone`; party: `lobby[]` (ready), `bots[]` (progress, finish), `place`; settings: `sfx`, `haptics` (persisted to `localStorage['spuzl.audio']`), theme, colour-blind mode, reduced motion, relaxed mode, low-data mode.
Data: Daily seed per game per day (00:00 GMT), leaderboards by friends/crew/school/city/country/global, league table (30 players, top 7 up, bottom 5 down), async moves (24 h, nudge at 12 h).

## Design Tokens
Use `tokens/spuzl-tokens.css` as the source of truth. Summary (dark / light):
- bg `#0E0F1A / #F5F6FA`, surface `#171929 / #FFFFFF`, surface-raised `#20233A / #EEF0F6`, line `#2B2F4A / #D8DCE8`, text `#F4F5FB / #12131D`, muted `#A2A6C2 / #5A5E78`
- accent `#B8F23A / #437A00` (light darkened from #4E8A00 for AA), on-accent `#0E0F1A / #FFFFFF`, gold `#FFC93C / #8F5E00` (light darkened from #A86F00), danger `#FF5A5F / #C62828`, freeze `#6FB6FF`
- Worlds (fill / ink): Logic Lab `#8B7CFF/#5B4BD6`, Line Lane `#2FD3E0/#0B7F8A`, Shape Shed `#FF8A3D/#B4520F`, Number Den `#FFD23F/#8A6A00`, Word Woods `#3DDC84/#167A45`, Clue Cave `#FF6B6B/#B83232`, Reflex Rink `#4D8BFF/#1F5BD6`, Rage Ridge `#FF3B3B/#B81E1E`, Board Bay `#F27ADB/#A3348F`
- Podium `#FFC93C / #D7DAE8 / #E09A5C`; tiers bronze `#C08A4A`, silver `#C9CCDD`, gold `#FFC93C`, prism `#B8F23A`
- Type: Unbounded 700–900 (display), Geist 400–600 (UI, min 16px on mobile), Geist Mono (numbers). Icons: Phosphor Bold.
- Spacing 4pt: 4, 8, 12, 16, 20, 24, 32, 40, 48. Radius: cell 10, chip 12, icon 14, control 16, button 20, card 24, sheet 32.
- Elevation = toy depth (solid offset shadow), not blur. Focus ring: `0 0 0 3px surface, 0 0 0 6px text`.
- z-index: board 0, hud 10, strip 20, dock 30, sheet 40, overlay 50, toast 60, celebration 70, system 80.
- Breakpoints: xs < 400, sm 400–767, md 768–1023, lg ≥ 1024; TV mode 1280 × 720.

## Accessibility (non-negotiable)
WCAG 2.2 AA in both themes; 44 × 44 targets; boards are `role="grid"` with full keyboard (arrows, Space cycles mark, Enter confirms) and announcements (row, column, region, mark, rule break via polite live region); reduced-motion variant for every animation; flashing ≤ 3 Hz (Echo and Rage Ridge capped at 2 Hz) + photosensitivity notice before action games; Relaxed mode hides timers and race strips.

## Assets
- **Fonts**: Unbounded, Geist, Geist Mono (Google Fonts; self-host via `next/font`, subset display font to Latin).
- **UI icons**: Phosphor Bold (`@phosphor-icons/react`, weight="bold").
- **Game icons (3D)**: rendered at runtime by `spuzl3d.js` → `icon(name, color)` (Phosphor bold SVG extruded and bevelled on a glossy rounded tile, three.js r160). **For production, pre-render to PNG/WebP at build time** (or replace with commissioned illustrations) instead of rendering on the client.
- **Chess pieces (3D)**: `spuzl3d.js` → `pieces()` builds lathe-turned Staunton pieces (matte ivory / matte ebony, soft shadow). Pre-render 12 sprites at 2× and ship as static assets, or use a GLB set with React Three Fiber if you want a rotatable board.
- **Spuz**: `Spuz.dc.html` is a CSS reference. Build `spuz.riv` from the rig spec (layers, bones, state machine `SpuzBrain` with inputs `mood 0..11`, `intensity`, `lookAtX`, `lookAtY`), with a static SVG per mood for low-data mode.
- **Sound + haptics**: `spuzl-audio.js` synthesises about 24 SFX with WebAudio (0 KB of audio files) and maps Vibration API patterns. Port it as is, or replace it with recorded SFX under 400 KB total. iOS Safari has no Vibration API; on iOS, haptics are visual only.
- **Images**: none required; all art is CSS / runtime 3D. Share cards are layouts. Generate them server-side (for example `@vercel/og`).

## Not yet designed / to build
- Light theme and desktop for every screen (only key screens are shown; tokens cover the rest).
- Real Rive file, recorded SFX (optional), commissioned game illustrations (optional; 3D renderer is the fallback).
- Board Bay Duel and Party flows in the prototype (designed in the Board Games file; only the Chess Daily and free play are clickable).
- A "Next puzzle" button on Results that leads into free play (the rule is in the Handoff file).
- Backend: puzzle generators + uniqueness solvers per game, realtime match service, anti-cheat, moderation.
