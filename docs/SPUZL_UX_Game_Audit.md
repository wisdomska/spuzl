**UX + GAME DESIGN AUDIT · PLAYTESTED**

**SPUZL**

spuzl.vercel.app, played and reviewed for frictionless play, through the
eyes of players aged 13 to 35

**Prepared for:** WISDOMSKA (Senya)

**Date:** 31 October 2026

**Goal of this audit:** the best possible ease of use and maximum
usability, so players never feel friction between "I want to play" and
playing.

**Played:** onboarding and lesson, Crownfall (daily 9×9 and free play),
Dusk, Quads, Quickfire, Flinch, Four Up, Chess, Nine, Gotcha, a ranked
Duel against the Practice bot (Sixer), Party room, Leagues, Friends,
Shop, Me, Settings and colour-blind mode, on desktop and a 375 px phone
viewport.

**Contents**

**1. Executive summary**

Verdict, top 5 fixes, scorecard

**2. How I played**

Setup, sessions, limits

**3. The friction map**

Every step from opening the link to the second puzzle, timed

**4. What SPUZL gets right**

Protect these

**5. Friction and bugs found in play**

27 issues ranked, with where and how they happen

**6. The zero-friction playbook**

Rules every one of the 51 games should follow

**7. Screen-by-screen recommendations**

Onboarding to Settings

**8. Accessibility and performance**

**9. New features**

Built around ease of use and coming back

**10. New game types**

Twelve games SPUZL does not have yet

**11. Roadmap and metrics**

**12. Final word**

**1. Executive summary**

SPUZL is ambitious and, in many places, beautifully made. Fifty-one tiny
games across nine themed "islands", a Duolingo-style map, a lovable
mascot you colour yourself, daily shared puzzles, duels, party rooms,
leagues, cosmetics and a guest mode that lets you play without signing
up. The first-run lesson is the best part of the product: a 4×4
Crownfall board that ticks each rule off as you satisfy it, a glowing
hint when you are one move from done, and a celebration that says "0:08
on your first ever puzzle. Okay, big brain." That is exactly how to hook
a 13 to 35 year old.

Ease of use is held back by friction that adds up quickly. **Transitions
are slow and silent**: the main "Play" button took 5 to 7 seconds to
respond with no pressed state, and "Next puzzle" took 16 seconds
including a rank-up interstitial. **The game shell is inconsistent
across the 51 games**: two timers on some screens, invisible tool modes,
a hint icon that silently spends a hint, wins that end in a blank
screen. **Some core boards are hard to read**: classic sudoku has no 3×3
box borders, and Crownfall's regions are similar dark hues with no
borders while colour-blind patterns sit off by default in Settings.
**The Duel can swallow your input**: round 2 started underneath my taps
with no transition, and my answers landed on the new board.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Top 5 things to fix first</strong></p>
<p><strong>1. Make every tap feel instant.</strong> Show a pressed state
within 100 ms, prefetch the next screen, and show a skeleton of the game
board while it loads. Target under 1 second from tap to playable
board.</p>
<p><strong>2. One shared game shell for all 51 games.</strong> One
timer, a visible active tool, Help that pauses the clock, one Hint
button, a proper end screen and a clear "Next" that does what it
says.</p>
<p><strong>3. Make every board readable at a glance.</strong> Box
borders in Nine and Sixer, region borders in Crownfall, patterns on by
default (or offered during onboarding), 44 px minimum cells on
phones.</p>
<p><strong>4. Fix the Duel round transition.</strong> Freeze input, show
"Round 1: Bot wins" for 2 seconds, then reveal the next board with a
3-2-1 countdown.</p>
<p><strong>5. Cut onboarding jargon and steps.</strong> Explain XP,
Sparks, streaks and islands only when they first matter; let people
reach the lesson in one tap from the splash.</p></td>
</tr>
</tbody>
</table>

**Scorecard (after playing)**

| **Area**                  | **Score** | **Verdict**                                                                                                                                                         |
|---------------------------|-----------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Concept and breadth       | 9/10      | 51 well-chosen games in nine worlds, with real local flavour (Ghana regions in Quads, Akosombo in trivia, Kente Cap, Oware).                                        |
| Visual design and brand   | 8/10      | Distinct mascot, punchy type, colour-coded worlds. Some palettes are too dark and too similar to read quickly.                                                      |
| First-run experience      | 8.5/10    | The lesson is excellent. Too many concepts and four steps before home.                                                                                              |
| Speed and responsiveness  | 4.5/10    | Hard loads are fast (about 1 s), but in-app transitions of 4 to 16 seconds with no feedback.                                                                        |
| Game shell consistency    | 5/10      | Shared layout is good, but timers, tool states, hints and end screens behave differently across games.                                                              |
| Board readability         | 5.5/10    | Strong ARIA labels and conflict highlighting; no sudoku box borders; similar region colours.                                                                        |
| Multiplayer (Duel, Party) | 6/10      | Great matchmaking transparency and bot fallback; broken round transition; Party offers only 3 games.                                                                |
| Accessibility             | 7.5/10    | Excellent screen-reader labels, photosensitivity warnings, colour-blind patterns, text size, reduced motion, low-data mode. Defaults and discoverability need work. |
| Progression and economy   | 6.5/10    | XP, ranks, leagues, badges and streaks are all there; first reward takes about 14 puzzles; streak messaging contradicts itself.                                     |
| Retention hooks           | 7/10      | Daily set of 15, streaks, leagues, friends, School Cup. Needs a 5-minute daily bundle and shareable results.                                                        |

**2. How I played**

| **Item**             | **Detail**                                                                                                                                                                                                                                                                               |
|----------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Devices              | Desktop browser (800 px wide pane) and a 375 × 812 phone viewport.                                                                                                                                                                                                                       |
| Account              | Fresh guest profile, age band 18 or older, nickname "GridGyal" (one of the suggested names).                                                                                                                                                                                             |
| Played to completion | Crownfall lesson (4×4), Crownfall daily \#214 (9×9), Crownfall free play, Dusk daily and free play, Quads (two groups plus a deliberate wrong guess), Quickfire (all 5 questions, one deliberately wrong), Flinch, Four Up (win in 2), Practice-bot Duel in Sixer.                       |
| Explored             | Library of 51 games, Chess, Nine, Gotcha, Party room creation, Leagues, Friends, Shop with try-on, Me, Settings, colour-blind mode (Deutan).                                                                                                                                             |
| Limits               | I could not bring in a second human player, so Party gameplay and live Duels against people were not tested. I solved Dusk daily \#214 with a script to read the board; SPUZL correctly flagged it ("That was quick, so a moderator will check it"). You may want to clear that attempt. |

**Personas**

| **Persona**           | **What they need from SPUZL**                                                                                                                                 |
|-----------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Ama, 15, SHS student  | Quick games between classes on a mid-range Android with patchy data. Needs instant loading, big tap targets, safe social features, and to brag to classmates. |
| Kwame, 22, university | Wants to beat friends, climb leagues, duel strangers, share results on WhatsApp and X. Hates waiting and losing to bugs.                                      |
| Esi, 31, professional | Plays the daily on the commute in 5 minutes. Wants calm, readable boards, no surprise pop-ups, and progress that survives a phone change.                     |

**3. The friction map**

Every step from opening spuzl.vercel.app to starting a second puzzle, as
it happened. Green is smooth, amber is friction, red is a blocker to
"just play".

| **Step**            | **What happened**                                                                                                                                       | **Time / taps**    | **Feel** |
|---------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------|----------|
| 1\. Splash          | Mascot and logo, "Tiny games. Big brain." Tap to skip.                                                                                                  | About 3 s or 1 tap | Smooth   |
| 2\. Age             | "Akwaaba, Spuzler. How old are you?" Three bands with plain consequences ("No global chat"), plus "I am under 13".                                      | 2 taps             | Smooth   |
| 3\. How to start    | Three choices: Show me how, Pick a game, Jump straight in. Copy uses Crownfall, XP, Sparks, streak, Spuz and Grid before any are explained.             | 1 tap              | Friction |
| 4\. Lesson          | 4×4 Crownfall, rules tick live, glow on the last move. Excellent.                                                                                       | About 10 s         | Smooth   |
| 5\. Celebration     | "First clear! +150 XP, +50 Sparks, 1 streak". CTA "Make it official" does not say what happens next.                                                    | 1 tap              | Friction |
| 6\. Make Spuz yours | Colour plus nickname, with local suggestions (CocoaCrusher, GridGyal, KenteKing).                                                                       | 2 taps             | Smooth   |
| 7\. Enter The Grid  | Button showed a thin loading line for 4 to 8 s.                                                                                                         | 4 to 8 s           | Friction |
| 8\. Home            | Map of 9 islands. Says "Your 1-day streak is sleepy" and "Today 0 of 15 cleared" right after the lesson promised a streak.                              | Read               | Friction |
| 9\. Play Crownfall  | No pressed state; the page changed after 5 to 7 s. I tapped twice thinking it was broken.                                                               | 5 to 7 s           | Blocker  |
| 10\. Daily 9×9      | Readable rules, good ARIA. Dark, similar region colours with no borders; tool mode invisible.                                                           | 45 s               | Friction |
| 11\. Results        | Clear stats, "Faster than 100% of Spuzlers today". Time shows 0:46 in one place and 00:45 in another.                                                   | Read               | Smooth   |
| 12\. Next puzzle    | 16 s until the next board, including a full-screen "Rank up" interstitial. Then more Crownfall, not the next Logic Lab game the home screen pointed to. | 16 s, 2 taps       | Blocker  |

**Total:** about 1 minute 40 seconds and 12 screens from link to a
second puzzle, of which roughly 30 seconds was waiting on blank or
unchanged screens. A world-class target is under 20 seconds to the first
move and under 1 second between puzzles.

**4. What SPUZL gets right**

- **A brilliant first lesson.** The 4×4 Crownfall with live rule ticks
  and a glow hint is a model tutorial: learn by doing, in 10 seconds.

- **Breadth with identity.** 51 games, each with a short, clear one-line
  description ("No-guess minesweeper", "Rotate pipes, water every
  plant").

- **Local flavour that feels authentic.** "Akwaaba", Ghana regions in
  Quads, Akosombo Dam in trivia, Kente Cap in the shop, Oware in Board
  Bay, nickname suggestions like KenteKing.

- **Safety by design.** Age bands with plain-language consequences,
  friends-only defaults for younger players, guest mode with no real
  names or phone numbers.

- **Outstanding accessibility foundations.** Every cell has a
  screen-reader label ("Row 1, column 1, region 1, empty"),
  photosensitivity warnings before flashing games, colour-blind modes
  that add patterns, text size, reduced motion, low-data mode and a
  relaxed mode that hides timers.

- **Clear conflict feedback.** Sixer and Nine hatch conflicting numbers
  in red and say why ("Two 5s in one row").

- **Fair-play system.** Suspiciously fast solves go to moderation
  instead of counting.

- **Transparent matchmaking.** Search time, usual wait and a
  Practice-bot fallback with "No rating on the line".

- **Strong party lobby.** Huge room code, WhatsApp share first, QR,
  emoji reactions, eight seats shown visually.

- **Delightful personalisation.** Your Spuz's colour flows into the main
  Play button; shop items can be tried on before buying.

- **Respectful leave confirmations.** "Leave the duel? Leaving counts as
  a loss." with "Keep playing" as the primary action.

**5. Friction and bugs found in play**

Severity: **High** blocks or frustrates play, **Medium** confuses or
slows players, **Low** is polish.

| **\#** | **Severity** | **What happened**                                                                                                                                                                                                                                                                          | **Where and fix**                                                                                                                                                                  |
|--------|--------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1      | High         | **Slow, silent transitions.** Play Crownfall took 5 to 7 s with no pressed state; Enter The Grid 4 to 8 s; Next puzzle 16 s. Full page loads are fast (about 1 s), so the delay is in client-side data fetching.                                                                           | Home CTA, onboarding, results. Prefetch the next game route and data while the player is on the previous screen; show pressed state under 100 ms and a board skeleton immediately. |
| 2      | High         | **Sudoku boxes are not drawn.** Nine (9×9) and Sixer (6×6) have no thicker borders around the 3×3 / 2×3 boxes.                                                                                                                                                                             | Nine, Sixer. Add 2 px box borders in a lighter tone; this is the single most important visual cue in sudoku.                                                                       |
| 3      | High         | **Duel round switched under my fingers.** When the bot finished round 1, round 2's board replaced mine with no transition; my next taps became wrong answers on the new board. Result: "You DNF" for both rounds.                                                                          | Duel. Freeze input on round end, show a 2 s result card, then a 3-2-1 countdown before the next board.                                                                             |
| 4      | High         | **Hint spent silently.** Tapping the bulb badge in the header used a hint with nothing visible; tapping the Hint button used another. Counter went 3 → 1; results said "with 2 hints" and Daily XP was halved.                                                                             | All puzzle games. Make the header bulb a counter only (not tappable), or have both open the same confirm: "Use a hint? Daily XP is halved."                                        |
| 5      | High         | **Hard-to-read Crownfall regions.** Nine dark, low-saturation colours (two greens, two teals, purple vs navy, maroon vs plum) with no borders. Colour-blind patterns exist but are off and buried in Settings.                                                                             | Crownfall. Draw region borders always; brighten the palette; offer "Patterns on?" in the first Crownfall and in the pause menu.                                                    |
| 6      | Medium       | **Tool mode is invisible.** Crown / Mark X and Sun / Moon buttons change the tap behaviour but never show which is active.                                                                                                                                                                 | Crownfall, Dusk. Selected tool gets a filled accent background and aria-pressed.                                                                                                   |
| 7      | Medium       | **Conflicting timers.** Quickfire, Duel, Flinch and Gotcha show a header timer and a second in-game timer with different values. Crownfall results say 0:46 and 00:45. The timer kept running while Help was open.                                                                         | Game shell. One timer per game type; pause on Help and Pause; round the same way everywhere.                                                                                       |
| 8      | Medium       | **Streak contradiction.** The lesson awarded "1 streak" and "Earns your first streak", then Home said "Your 1-day streak is sleepy" and "Today 0 of 15 cleared".                                                                                                                           | Onboarding and Home. Count the lesson as today's first clear, or do not promise a streak.                                                                                          |
| 9      | Medium       | **"Next puzzle" is ambiguous.** Home pointed to "Logic Lab, 1 of 7, then Dusk", but Next puzzle gave more Crownfall free play (and a smaller 7×7 after a 9×9 daily).                                                                                                                       | Results. Two clear buttons: "Next in Logic Lab: Dusk" (primary) and "Another Crownfall".                                                                                           |
| 10     | Medium       | **Quickfire leaks and lags.** Answer options are visible before Start; previous feedback ("Not quite. It was Brazil.") stays under the next question; the round auto-advances while showing a Next button; free play ends with no score screen, just "Clean. +10 XP" after a wrong answer. | Quickfire. Hide options until Start; clear feedback on advance; one advance model; always show "4/5" summary.                                                                      |
| 11     | Medium       | **Wins end abruptly.** In free play, the winning move cuts to a blank screen saying "Puzzle 2 loading", the header (back, pause) disappears, and no winning line is shown.                                                                                                                 | Four Up, Quickfire, all free play. Hold 1 s on the solved board with a highlight, keep the header, show a compact win bar with "Next".                                             |
| 12     | Medium       | **Four Up needs exact taps.** Tapping a column on an existing disc does nothing; you must hit an empty cell.                                                                                                                                                                               | Four Up. Whole column is the tap target, with a preview disc on hover/press.                                                                                                       |
| 13     | Medium       | **Duel trust gaps.** "Usual wait ~0:12" while nobody came for 31 s; ranked Quick Match drops you into a game you may never have played (Sixer); leaving a bot duel "counts as a loss" despite "No rating on the line"; result says "1-0" but lists two rounds.                             | Duel. Show real queue data or hide it; offer only games the player has cleared; align bot copy; fix score display.                                                                 |
| 14     | Medium       | **Party is thin and mixed.** Only Random mix, Quads, Crownfall and Sixer of 51 games; the "Got a code? Join" field sits inside the host form; "Classroom mode" is unexplained.                                                                                                             | Party. Split Host and Join tabs; open the game list; add a one-line description to Classroom mode.                                                                                 |
| 15     | Medium       | **Library lacks wayfinding.** 51 rows with two buttons each, no search, no filters (quick, calm, competitive), no time estimates, no "done today" ticks; the category chips show a desktop scrollbar.                                                                                      | Library. Search, filters, duration chips, completion state, one primary action per row.                                                                                            |
| 16     | Low          | **Interstitial overload.** A full-screen "Rank up" appeared between results and the next puzzle; it jumped from Thinker to Strategist, skipping Solver; its "Nice" control is not a real button.                                                                                           | Rank up. Show as a toast on the results screen; fix rank calculation; use a button element.                                                                                        |
| 17     | Low          | **Chess board polish.** The black king on e8 overflows the board edge; coordinates are tiny and low-contrast.                                                                                                                                                                              | Chess. Clip pieces to squares; 12 px coordinates at 60 % contrast.                                                                                                                 |
| 18     | Low          | **Quads feedback.** Submissions take about 2 s with all buttons disabled; every solved group is the same green; a screen-reader message read "NORTH lifted. 4 of 4."                                                                                                                       | Quads. Under 600 ms feedback; difficulty colours (yellow, green, blue, purple); clearer announcements.                                                                             |
| 19     | Low          | **Sixer status overlap.** "Two 5s in one row" was drawn on top of "14 of 36 placed", and the placed count ignored my entries.                                                                                                                                                              | Sixer, Nine. One status line at a time; count all filled cells.                                                                                                                    |
| 20     | Low          | **Tap-to-cycle may cost slips.** Dusk cycles sun, moon, empty; reaching moon passes through sun. My results showed many "slips" (needs confirming with a human run).                                                                                                                       | Dusk. Only count a slip when the player leaves a wrong value for more than a moment, or when checked.                                                                              |
| 21     | Low          | **Small targets.** Nine cells are 34 px on a phone; the Hint and Help icons sit side by side in the header.                                                                                                                                                                                | Nine and header. Grow cells to 40 to 44 px (reduce padding) and space header icons 12 px apart.                                                                                    |
| 22     | Low          | **Deep links render oddly.** Opening /duel directly shows the Duel sheet floating over a black page.                                                                                                                                                                                       | Duel, Party. Render Home behind the sheet, or make it a full page.                                                                                                                 |
| 23     | Low          | **Gotcha playfield.** Black frame for about 1 s, a small playfield and lots of unused space below the controls.                                                                                                                                                                            | Rage Ridge games. Larger canvas (fill to 60 % of height), load sprite before showing.                                                                                              |
| 24     | Low          | **Slow first reward.** Cheapest cosmetic costs 300 Sparks; a guest has 100 and earns about 15 per puzzle.                                                                                                                                                                                  | Shop. Starter item at 100 to 150 Sparks, or a free first hat for completing the lesson.                                                                                            |
| 25     | Low          | **Jargon load.** Crownfall, XP, Sparks, Spuz, Grid, islands, slips, Full Spuzl and leagues all appear in the first two minutes.                                                                                                                                                            | Onboarding. Introduce each term the first time it matters, with a one-line tooltip.                                                                                                |
| 26     | Low          | **Lonely Leagues.** One-row table and a lot of empty space when few players are active.                                                                                                                                                                                                    | Leagues. Seed with friends, bots or "players near your level", plus a designed empty state.                                                                                        |
| 27     | Low          | **Home map is cramped on phones.** The fixed bottom stack takes about 35 % of a 375 × 812 screen; only 5 of 9 islands are visible.                                                                                                                                                         | Home. Collapse "Today" and "Play anytime" into the Play card; let the map scroll under a slimmer dock.                                                                             |

**6. The zero-friction playbook**

With 51 games, consistency is the biggest usability lever. These rules
should apply to every game, enforced by one shared game shell component.

| **Rule**              | **Concrete standard**                                                                                                                                             |
|-----------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Instant response      | Every tap shows a visual change within 100 ms. Navigation shows the destination skeleton immediately. No action takes more than 1 s without a progress indicator. |
| One tap to play       | From Home, "Continue" resumes the last unfinished puzzle or starts the next in the path. No modal between tapping Play and seeing the board.                      |
| Board first           | The board is visible and interactive on first paint. Rules sit in one short line above it; full rules in Help.                                                    |
| Visible state         | The active tool, selected cell, remaining hints, mistakes and time are always visible, in the same places in every game.                                          |
| One timer             | One timer in the header. Per-question timers live inside the game card as a bar, never as a second clock. Help and Pause stop the clock.                          |
| Forgiving input       | Generous hit areas (whole column, whole word tile), undo always available, drag-to-mark where it makes sense, no penalty for intermediate states.                 |
| Readable boards       | Region and box borders always drawn; patterns available everywhere; minimum 44 px targets on phones (40 px for 9×9 grids with spacing).                           |
| Clear endings         | Hold on the solved board for 1 s with a highlight, then a results card. Free play gets a compact result bar, never a blank screen.                                |
| Predictable Next      | The primary button always names its destination: "Next: Dusk" or "Another Crownfall".                                                                             |
| Calm interruptions    | Rank ups, badges and quest rewards appear as toasts on the results screen, never as blocking screens between puzzles.                                             |
| Same words everywhere | One glossary: Clear, Slip, Hint, Sparks, XP. No synonyms. Every term has a tooltip the first time it appears.                                                     |

**7. Screen-by-screen recommendations**

Priority: **P0** fix now, **P1** next release, **P2** nice to have.

**7.1 Splash and onboarding**

| **What I saw**                                                                 | **Recommendation**                                                                                                                                                                     | **Priority** | **Persona** |
|--------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------|-------------|
| Splash, age, start choice, lesson, celebration, avatar: 6 screens before Home. | Merge avatar and nickname into the celebration screen ("Claim your first clear: pick a colour and name"). Default to "Show me how" and move the other two options under "Skip lesson". | P1           | All         |
| Start options use unexplained terms.                                           | Plain copy: "Learn a game in 30 seconds", "Browse all 51 games", "Go to the map".                                                                                                      | P1           | Ama         |
| "Make it official" CTA.                                                        | "Save my progress" or "Create my Spuz". Say what happens next.                                                                                                                         | P2           | All         |
| Colour-blind patterns hidden.                                                  | Add one line on the age or avatar screen: "Need colour-blind patterns? Turn on" (toggle).                                                                                              | P1           | All         |

**7.2 Home (the Grid)**

| **What I saw**                                    | **Recommendation**                                                                                                                        | **Priority** | **Persona** |
|---------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|--------------|-------------|
| Play button silent for 5 to 7 s.                  | Pressed state, haptic tick, route prefetch on Home load; board skeleton on tap.                                                           | P0           | All         |
| Streak and daily counters contradict the lesson.  | Count the lesson; if not, change lesson copy to "Your streak starts with today's first daily".                                            | P0           | Esi         |
| Bottom stack covers a third of the map on phones. | One Play card ("Continue: Dusk · Logic Lab 2 of 7") plus small Duel and Party chips; "Today 1 of 15" becomes a progress ring on the card. | P1           | Ama         |
| Islands show "0/7" but not what is inside.        | Long-press or tap an island to preview its games and today's progress.                                                                    | P2           | Kwame       |

**7.3 Library (Play anytime)**

| **What I saw**                          | **Recommendation**                                                                                                          | **Priority** | **Persona** |
|-----------------------------------------|-----------------------------------------------------------------------------------------------------------------------------|--------------|-------------|
| 51 rows, two buttons each, no search.   | Search field at top; filter chips: Quick (under 2 min), Calm, Competitive, Word, Number, Reflex, Board; "Done today" ticks. | P1           | All         |
| Free play vs Daily choice on every row. | One tap opens a game card with Daily (if available) as primary and Free play as secondary.                                  | P1           | All         |
| Desktop scrollbar under chips.          | Hide scrollbar, add edge fade and arrow buttons on desktop.                                                                 | P2           | Esi         |

**7.4 Game shell (all 51 games)**

| **What I saw**                                       | **Recommendation**                                                                                                                     | **Priority** | **Persona** |
|------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|--------------|-------------|
| Header bulb silently uses hints.                     | Counter only, not a button; Hint button confirms the XP cost the first time.                                                           | P0           | All         |
| Two timers in several games; timer runs during Help. | One header timer; pause on Help and Pause.                                                                                             | P0           | All         |
| Tool state invisible.                                | Filled active tool with aria-pressed; long-press on a cell for the secondary action.                                                   | P0           | All         |
| Free-play wins end in blank loading.                 | Solved board held 1 s with highlight; compact result bar with time, XP and "Next".                                                     | P1           | All         |
| Hints are trivial ("Mark it X").                     | Hints should reveal the next logical deduction and explain why in one sentence ("Row 4 can only hold its crown in the orange region"). | P1           | Esi         |

**7.5 Logic and number games**

| **What I saw**                                   | **Recommendation**                                                                                             | **Priority** | **Persona** |
|--------------------------------------------------|----------------------------------------------------------------------------------------------------------------|--------------|-------------|
| Nine and Sixer have no box borders.              | 2 px box borders; highlight the selected cell's row, column and box; highlight all cells with the same number. | P0           | All         |
| Crownfall regions hard to tell apart.            | Region borders always; brighter palette; auto-X neighbours of a placed crown as an option.                     | P0           | All         |
| Nine number pad: 5 + 4 layout.                   | Single row of 9 on wide screens; 3×3 grid on phones; show remaining count per digit.                           | P2           | Esi         |
| Dusk tap cycle passes through sun to reach moon. | Swipe up for sun, down for moon, or tap = sun and double-tap = moon; never count intermediate states as slips. | P1           | All         |

**7.6 Word and trivia**

| **What I saw**                                                       | **Recommendation**                                                                               | **Priority** | **Persona** |
|----------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|--------------|-------------|
| Quads: same colour for every group; slow feedback.                   | Difficulty colours; feedback under 600 ms; "one away" shakes the tiles.                          | P1           | Kwame       |
| Quickfire: options visible before Start; stale feedback; no summary. | Hide options until Start; reset feedback; always end with "4 of 5 · 469 pts" and a share button. | P0           | All         |

**7.7 Reflex, rage and board games**

| **What I saw**                              | **Recommendation**                                                                              | **Priority** | **Persona** |
|---------------------------------------------|-------------------------------------------------------------------------------------------------|--------------|-------------|
| Flinch needs a tap between every round.     | Auto-start the next round after 1.5 s, with a tap to skip the wait.                             | P2           | Kwame       |
| Gotcha: black first frame, small playfield. | Show the level instantly; enlarge canvas; on-screen buttons sized 64 px; keep keyboard support. | P1           | Ama         |
| Four Up needs exact empty-cell taps.        | Whole-column hit area with a drop preview.                                                      | P1           | All         |
| Chess king overflows the board.             | Clip pieces; larger coordinates; show legal-move dots on pick-up.                               | P2           | Esi         |
| Board games are puzzles only.               | Add "Play a full game vs Spuz bot" (easy, medium, hard) alongside daily puzzles.                | P1           | Kwame       |

**7.8 Duel**

| **What I saw**                                                     | **Recommendation**                                                                                  | **Priority** | **Persona** |
|--------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|--------------|-------------|
| Round switch with no transition; inputs spill into the next board. | Input freeze, round result card, 3-2-1 countdown, then next board.                                  | P0           | Kwame       |
| "Usual wait ~0:12" while nobody is online.                         | Hide or base on live data; offer the bot from the start ("Play bot now or keep searching").         | P1           | All         |
| Ranked match in an unfamiliar game.                                | Choose from games the player has cleared at least once; otherwise a 20 s rules card before round 1. | P1           | Kwame       |
| Bot leave copy contradicts "No rating on the line".                | "Leave the practice match?" with no loss wording.                                                   | P2           | All         |

**7.9 Party, Leagues, Friends**

| **What I saw**                                           | **Recommendation**                                                                                                         | **Priority** | **Persona** |
|----------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------|--------------|-------------|
| Party offers 3 of 51 games; join field inside host form. | Host and Join tabs; any game with a party variant; explain Classroom mode in one line.                                     | P1           | Kwame       |
| Leagues: one-player table.                               | Group new players with friends or level-matched players; designed empty state with "Invite 3 friends to fill your league". | P1           | Kwame       |
| Friends: strong invite card and empty state.             | Keep. Add "Add from contacts" via share link only (never read contacts), and show friends' daily results on Home.          | P2           | Ama         |

**7.10 Shop, Me, Settings**

| **What I saw**                                       | **Recommendation**                                                                                             | **Priority** | **Persona** |
|------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|--------------|-------------|
| First cosmetic is ~14 puzzles away.                  | A free starter hat for finishing the lesson; one item at 100 Sparks.                                           | P1           | Ama         |
| Rank-up interstitial blocks flow and skipped a tier. | Toast on results; fix the rank jump.                                                                           | P1           | All         |
| Settings are excellent but hidden.                   | Add a "Comfort" quick sheet from the pause menu: patterns, text size, reduced motion, timer visibility, sound. | P1           | Esi         |
| Guest progress risk.                                 | After the 3rd clear, prompt "Save your streak: sign in with Google or phone" with a 1-tap option.              | P1           | Esi         |

**8. Accessibility and performance**

**Accessibility**

- **Keep:** cell ARIA labels, photosensitivity warnings, colour-blind
  patterns, text size, reduced motion, relaxed mode, keyboard support
  (arrows, space, enter).

- **Fix:** constraint markers in Dusk ("=" and "×") are not included in
  the cells' screen-reader labels, so blind players cannot use them.

- **Fix:** the rank-up "Nice" control and the "Play anytime" row are
  generic elements, not buttons; use real buttons and links.

- **Fix:** colour-only cues remain in places ("Tap when it turns blue");
  pair with shape and motion everywhere.

- **Fix:** minimum 44 px targets on phones for all primary controls;
  Nine cells at 34 px are too small.

**Performance**

- Hard page load measured at about 1 s to load, 0.8 s to first paint,
  which is good.

- Client navigations measured 4 to 16 s. Profile the API calls fired on
  navigation (for example /api/v1/today, /profile, /attempts, /friends),
  cache "today" per day, and prefetch the next game's data and code when
  Home renders.

- Low-data mode is a great idea for Ghanaian mobile data; make it
  auto-suggest when the connection is slow (Network Information API) and
  preload fewer assets.

- Add an installable PWA with offline daily puzzles so the daily
  survives a dead zone on the trotro.

**9. New features**

Each feature is chosen to remove friction or give 13 to 35 year olds a
reason to come back.

**9.1 Continue card**

**What:** One card on Home that always resumes the last unfinished
puzzle or starts the next in your path, with a live board thumbnail.

**Why it matters:** Removes every decision between opening the app and
playing. The single biggest ease-of-use win.

**9.2 Daily Five**

**What:** A curated 5-minute bundle each day: one logic, one word, one
number, one reflex, one trivia. One combined score and an emoji share
grid for WhatsApp Status and X.

**Why it matters:** "15 dailies" is a lot for a commute. A short bundle
with a shareable result is the Wordle formula, and sharing is free
acquisition.

**9.3 Interactive first-play for every game**

**What:** The first time you open any of the 51 games, a 20-second
guided mini-board like the Crownfall lesson, instead of a rules
paragraph.

**Why it matters:** The lesson is SPUZL's best moment; repeat it for
every game so nobody bounces off an unfamiliar ruleset.

**9.4 Async duels and ghost races**

**What:** Challenge a friend to the same puzzle; they play whenever they
can and you see their ghost progress. Already hinted by "Ghosted".

**Why it matters:** Real-time duels fail when few people are online (I
waited 31 s for nobody). Async keeps competition alive at any player
count.

**9.5 School and campus leagues**

**What:** Opt-in leagues by SHS, university or workplace, building on
"School Cup", with weekly trophies and a shareable leaderboard card.

**Why it matters:** Identity and rivalry drive 13 to 25 engagement; it
also fills the empty leagues problem.

**9.6 Story and Status share cards**

**What:** Auto-generated 9:16 cards after any clear: time, percentile,
Spuz with hat, and a challenge link.

**Why it matters:** Turns every win into an invite.

**9.7 Comfort sheet in pause**

**What:** Patterns, text size, reduced motion, hide timer, sound and
haptics, available inside every game.

**Why it matters:** Usability settings only help if people find them at
the moment they need them.

**9.8 Smart difficulty**

**What:** Free play adapts difficulty to recent solve times (never
dropping from 9×9 to 7×7 abruptly), with an explicit Easy, Medium, Hard
picker.

**Why it matters:** Keeps players in flow; avoids boredom and rage
quits.

**9.9 Offline and low-data packs**

**What:** Download tomorrow's dailies on Wi-Fi; play offline; sync
results later.

**Why it matters:** Patchy data is a daily reality for many of your
players.

**9.10 Seasonal events**

**What:** Limited events: Detty December, exam season brain sprints,
AFCON trivia week, Valentine's word pack, Independence Day (6 March)
Ghana quiz.

**Why it matters:** Fresh reasons to return and strong local relevance.

**10. New game types**

Twelve games that are not already among the 51, chosen for youth appeal,
quick sessions and easy controls. Each lists the island it fits.

| **Game**        | **Island**  | **How it plays**                                                                                                                      | **Effort** | **Appeal** |
|-----------------|-------------|---------------------------------------------------------------------------------------------------------------------------------------|------------|------------|
| Five            | Word Woods  | Guess a five-letter word in six tries, with coloured feedback. The one daily word game every youth audience knows; currently missing. | Low        | Very high  |
| Trotro Jam      | Shape Shed  | Slide trotros and taxis out of a crowded station (Rush Hour style). Local, visual, one-finger drag.                                   | Medium     | High       |
| Penalty King    | Reflex Rink | Swipe to aim and curve penalties past a keeper; then dive as keeper. 60-second rounds, perfect for duels.                             | Medium     | Very high  |
| Higher or Lower | Clue Cave   | Which is bigger: population, followers, price, stadium capacity? Streak until you miss. Endless, shareable.                           | Low        | Very high  |
| Emoji Hits      | Clue Cave   | Guess the song, film or Afrobeats hit from an emoji string (titles only, no lyrics).                                                  | Low        | High       |
| Killer Sums     | Number Den  | Sudoku with caged sums, using the existing Nine engine.                                                                               | Low        | Medium     |
| Light Up        | Logic Lab   | Place bulbs to light every cell (Akari). Clean rules, great for 5-minute play.                                                        | Low        | Medium     |
| Market Run      | Reflex Rink | Memorise a Makola shopping list, then tap the right items as they scroll past. Memory and speed.                                      | Medium     | High       |
| Beat Tap        | Reflex Rink | Tap to the rhythm of short original Afrobeats-style loops. Rhythm games are hugely popular with teens.                                | Medium     | Very high  |
| Dara            | Board Bay   | Traditional West African alignment strategy game: place, then move to make lines of three. Play vs bot or friend.                     | Medium     | Medium     |
| Draw It         | Party       | One player draws a word, others guess on their phones. Turns Party into a real social night.                                          | High       | Very high  |
| Two Truths      | Party       | Each player writes two truths and a lie; the room votes. Pure social fun, no skill barrier.                                           | Medium     | High       |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Build order</strong></p>
<p><strong>First:</strong> Five and Higher or Lower (low effort, highest
daily appeal).</p>
<p><strong>Next:</strong> Penalty King and Beat Tap (signature youth
games, great for duels and share clips).</p>
<p><strong>Then:</strong> Draw It and Two Truths (make Party worth
opening), Trotro Jam (distinctly local).</p>
<p><strong>Later:</strong> Killer Sums, Light Up, Market Run, Emoji
Hits, Dara.</p></td>
</tr>
</tbody>
</table>

**11. Roadmap and metrics**

| **Phase**         | **What to ship**                                                                                                                                                                                                              |
|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| This week         | Pressed states and route prefetch (target under 1 s tap-to-board) · sudoku box borders · Duel round transition · hint bulb fix · single timer and pause-on-Help · streak copy fix · Quickfire option leak and stale feedback. |
| Next 2 to 4 weeks | Shared game shell (tool state, endings, named Next) · Crownfall borders and patterns prompt · Library search and filters · Continue card · rank-up as toast · starter cosmetic · Party host/join split.                       |
| 1 to 2 months     | Daily Five with share grid · interactive first-play for every game · async duels · Five and Higher or Lower · comfort sheet · sign-in nudge after 3rd clear.                                                                  |
| 3 to 6 months     | School and campus leagues · offline packs and PWA · Penalty King, Beat Tap, Draw It, Two Truths · seasonal events.                                                                                                            |

**Metrics to watch**

- **Time to first move** for new players (target under 20 s from link).

- **Tap-to-board latency** (p50 under 700 ms, p95 under 1.5 s).

- **Onboarding completion** (splash to first daily clear).

- **Daily completion** (share of active players who finish at least one
  daily) and Daily Five completion once launched.

- **Hint usage per puzzle** and accidental hints (header bulb taps).

- **Duel abandon rate** and bot fallback rate.

- **D1, D7, D30 retention** and streak length distribution.

- **Share rate** per clear.

**12. Final word**

SPUZL already has what most game hubs never get right: a huge, varied
catalogue with real local character, a lovable mascot, safety built in
from the first screen, and accessibility foundations many big studios
lack. The friction is not in the ideas, it is in the seams: waiting with
no feedback, games that each behave slightly differently, boards that
are harder to read than they should be, and a duel that can take your
input away.

Make every tap feel instant, give all 51 games one consistent shell,
draw the lines that make boards readable, and fix the duel transition.
Then add the Continue card and Daily Five. Do that, and SPUZL becomes
the app young people open without thinking, every single day.
