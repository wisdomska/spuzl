# Decisions

Design wins for UI, UX, game list and product rules. SRS wins for backend rules, security and budgets.

| # | Decision | Why |
|---|---|---|
| 1 | 51 games in 9 worlds (Board Bay added), per the design catalogue in `lib/catalog.ts`. The SRS lists 45 in 8. | Design wins on the game list. |
| 2 | Every game is playable anytime (Daily + Free play). Phases (L, M2, M3+) only order the build. | Design product rule "Play anytime". |
| 3 | `cacheComponents` is off in `next.config.ts`. | Simpler data model for authenticated, per-player game routes. Edge caching of Dailies uses route-level headers instead. |
| 4 | Spuz is a React + CSS component (`components/brand/Spuz.tsx`), a 1:1 port of `Spuz.dc.html`, not a `.riv` file. | A Rive binary can't be authored without the Rive editor. The component honours the SpuzBrain contract (mood 0..11, lookAt -1..1, still). Low-data and reduced motion render the static pose per mood. |
| 5 | Global prefixed CSS (`styles/spuz.css`) instead of CSS Modules. | The template's Tailwind Turbopack loader processes every `.css` file and strips module hashing and `:global()`. |
| 6 | Region palette extended to 10 colours (`--reg-0..9`), first 6 exactly from the design, plus light-theme pastels and colour-blind patterns per region. | Crownfall goes up to 10 × 10 on Sundays (Weekly Mega). The design only shows 6 regions. |
| 7 | Board cell formula uses 6 px of padding, so a 390 px phone gets the designed 56 px cells. | Matches the drawn frame exactly. |
| 8 | Handoff sound names (`tick_soft`, `buzz_low`, ...) alias the kit names in `spuzl-audio.js`. Added `synth`, `jump`, `land` and `spike` for Line Lane and Rage Ridge. | The Handoff sound map lists them; the kit didn't have them. |
| 9 | Every sound dispatches a `spuzl:fx` event and every haptic a `spuzl:haptic` event. | Lets E2E assert the animation + sound + haptic pairing without real audio. |
| 10 | Daily numbering starts at #1 on 2026-04-01, so the designed "Daily #214" lands on 2026-10-31. | Keeps the design's copy plausible. |
