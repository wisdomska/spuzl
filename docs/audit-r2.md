**UX + GAME DESIGN AUDIT · PLAYTESTED · ROUND 2**

**SPUZL**

spuzl.vercel.app, replayed one week later and reviewed for frictionless
play, through the eyes of players aged 13 to 35

**Prepared for:** WISDOMSKA (Senya)

**Date:** 6 November 2026 (previous audit: 31 October 2026)

**Goal:** the best ease of use and maximum usability, so players never
feel friction between "I want to play" and playing.

**Played this time:** new landing page, guest onboarding as a
25-year-old and as a 15-year-old, Crownfall lesson, Dusk levels 1 and 2,
Trotro Jam, Nine, Emoji Hits, Beat Tap, a live 2-player Party race, a
live friend Duel in Sixer, Library, game cards, Leagues, Friends, Shop
and the pause Comfort sheet.

**Contents**

**1. Executive summary**

Verdict, what changed, top 5 to fix now, scorecard

**2. How I played**

Two players, two ages, what I could and could not test

**3. One week of progress**

Every finding from 31 October and where it stands

**4. The friction map, round 2**

Timed, from landing page to second puzzle

**5. What SPUZL now gets right**

**6. Remaining and new issues**

17 issues ranked, with where and how they happen

**7. Screen-by-screen recommendations**

**8. Catalogue strategy**

51 to 28 games, and the missing daily

**9. New features**

**10. New game types**

**11. Roadmap and metrics**

**12. Final word**

**1. Executive summary**

SPUZL has changed more in one week than most products change in a
quarter. A real landing page with a playable demo, a birth-date age
gate, plain-language onboarding, a "Continue" card on Home, a searchable
and filterable library, a game card for every title, practice rounds
with free hints for first-timers, a consistent game shell with one
timer, a pause menu with comfort settings, readable boards (region
borders and patterns by default, sudoku box borders), named "Next level"
buttons, countdowns and result cards in duels, a much better Party
setup, preset-only chat, teen-appropriate social limits, and a 100-Spark
starter item. Most of the 27 issues I raised on 31 October are fixed or
clearly improved.

**What still stands between a young player and instant play:** the very
first game load (8.4 s from tap to board in Chrome, versus 1.2 s once
warm), a pile-up of prompts in the first minutes (notifications,
low-data mode), a duel screen that looks broken to under-16s, a chat
sheet that covers the party board when a race starts, and practice
rounds that still penalise mistakes (Beat Tap). Strategically, the move
from 51 to 28 games was sensible, but **the shared daily puzzle
disappeared with it**, and that was SPUZL's best reason to come back
every day.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Top 5 things to fix now</strong></p>
<p><strong>1. Make the first game load as fast as the second.</strong>
Cold tap-to-board is 8.4 s; warm is 1.2 s. Preload the game shell and
the first game's code on Home, start data requests on tap (not after
render), and remove the idle gap before /today (which is also called
twice).</p>
<p><strong>2. Bring back a shared daily.</strong> A "Daily Five" (one
game per world plus a bonus) with a shareable result grid gives players
a reason to open SPUZL tomorrow.</p>
<p><strong>3. Fix the under-16 Duel screen.</strong> Hide or mute Quick
Match for under-16s and make "Challenge a friend" the primary button;
replace the tiny inner-scrolling game list with a full sheet.</p>
<p><strong>4. Clean up the Party start.</strong> Close any open sheet
(Chat) when a round starts, add the same 3-2-1 countdown Duel has, and
make "Next game" primary until the set is over.</p>
<p><strong>5. One prompt at a time, at the right moment.</strong> Ask
for notifications after the first duel invite or friend add, and only
suggest low-data mode on genuinely slow connections.</p></td>
</tr>
</tbody>
</table>

**Scorecard: 31 October vs 6 November**

| **Area**                 | **31 Oct** | **6 Nov** | **Why**                                                                                                        |
| ------------------------ | ---------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| Concept and breadth      | 9          | 8.5       | Tighter 28-game catalogue in 4 worlds; lost some strong formats (Quads, Pinned, Flagged) and the shared daily. |
| Visual design and brand  | 8          | 8.5       | Cleaner shell, brighter boards, podium and countdown moments.                                                  |
| First-run experience     | 8.5        | 9         | Landing demo, plain choices, merged avatar step, practice rounds. One redundant guest screen.                  |
| Speed and responsiveness | 4.5        | 6.5       | Warm loads 0.6 to 1.2 s; cold first game still 6 to 8 s.                                                       |
| Game shell consistency   | 5          | 8         | One timer, hint count on the Hint button, named Next, comfort pause. Small timer quirks remain.                |
| Board readability        | 5.5        | 8.5       | Borders and patterns by default, sudoku boxes, remaining-digit counts.                                         |
| Multiplayer              | 6          | 8         | Countdowns, result cards, reconnection handling, preset chat. Party start and teen Duel screen need work.      |
| Accessibility            | 7.5        | 8.5       | Richer screen-reader labels (constraints, colour names, cars). One unnamed button; rules hidden visually.      |
| Progression and economy  | 6.5        | 7.5       | Starter item at 100 Sparks, named levels, leagues empty state.                                                 |
| Retention hooks          | 7          | 6         | Streaks and leagues remain, but no shared daily or share card.                                                 |

**2. How I played**

| **Item**      | **Detail**                                                                                                                                                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Player 1      | "GridGyal", born June 2001 (25), guest, in the desktop app browser.                                                                                                                                                                                                        |
| Player 2      | "KenteKing", born March 2011 (15), guest, in Google Chrome.                                                                                                                                                                                                                |
| Played        | Crownfall lesson; Dusk levels 1 and 2; Trotro Jam practice (solved at par, 10 moves); Nine practice; Emoji Hits practice (4 of 5, 561 pts); Beat Tap practice; a 2-player Party race in Crownfall (host 15, guest 25); a friend Duel in Sixer, round 1 to the result card. |
| Explored      | Landing page, Library and game cards, Leagues, Friends, Duel options for under-16s, Shop, pause Comfort sheet, notification and low-data prompts.                                                                                                                          |
| Timings       | Taken in Google Chrome on desktop broadband using in-page timers. The app's own browser pane stopped redrawing part-way (my window was covered), so I did not count any blank screens or timings from that period.                                                         |
| Not re-tested | Phone-sized layouts, Quickfire, Four Up, Chess, Gotcha and the ranked Quick Match for adults. Findings from 31 October on those still apply unless the code changed.                                                                                                       |

**3. One week of progress**

Every issue from the 31 October audit, with what I saw on 6 November.

| **\#** | **31 October finding**               | **Status**    | **What I saw on 6 November**                                                                                           |
| ------ | ------------------------------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1      | Slow, silent transitions (5 to 16 s) | Improved      | Next level 0.56 s; warm tap-to-board 1.16 s. Cold first game still 8.4 s in Chrome.                                    |
| 2      | No sudoku box borders                | Fixed         | Clear 3×3 borders in Nine, plus a remaining count on each digit.                                                       |
| 3      | Duel round switched under my fingers | Fixed         | 3-2-1 "SPUZL!" countdown, "Round 1: you win" card, input not applied during the switch.                                |
| 4      | Header bulb spent hints silently     | Fixed         | Hint count lives on the Hint button only.                                                                              |
| 5      | Hard-to-read Crownfall regions       | Fixed         | Thick region borders and patterns on by default.                                                                       |
| 6      | Invisible tool mode                  | Not re-tested | Toolbar still has Sun/Moon and Crown/Mark X; active state not checked.                                                 |
| 7      | Conflicting timers                   | Mostly fixed  | One header timer. Quirks: "00:00 on your first ever puzzle", timer running before Start in Emoji Hits.                 |
| 8      | Streak contradiction after lesson    | Fixed         | Home shows streak 1, no "sleepy" message.                                                                              |
| 9      | "Next puzzle" ambiguous              | Fixed         | "Level 1 cleared! · Next level: 2 · All levels".                                                                       |
| 10     | Quickfire leaks and lags             | Not re-tested | Could not load it in the throttled browser; Emoji Hits uses the improved pattern (options after Start, clean summary). |
| 11     | Abrupt wins                          | Fixed         | Solved board held with a highlight, then a compact result sheet.                                                       |
| 12     | Four Up needs exact taps             | Not re-tested |                                                                                                                        |
| 13     | Duel trust gaps                      | Improved      | Clear age copy ("Opens at 16"), reconnection handling. Under-16 screen hierarchy is confusing (see issue 3).           |
| 14     | Party thin and mixed                 | Fixed         | Host/Join tabs, all puzzle and word games, "Pick several games", Classroom mode explained.                             |
| 15     | Library lacks wayfinding             | Fixed         | Search, Quick/Calm/Competitive and world filters, minutes per game, played ticks, one action per row.                  |
| 16     | Rank-up interstitial                 | Not seen      | No blocking interstitial appeared in my run.                                                                           |
| 17     | Chess king overflow                  | Not re-tested |                                                                                                                        |
| 18     | Quads feedback                       | Removed       | Quads is no longer in the catalogue.                                                                                   |
| 19     | Sixer status overlap                 | Not seen      | No overlap seen in the duel.                                                                                           |
| 20     | Dusk tap-cycle slips                 | Fixed         | Tap = sun, double-tap = moon, tap again to clear.                                                                      |
| 21     | Small targets                        | Improved      | Nine cells larger on desktop; phone not re-measured.                                                                   |
| 22     | Deep links render oddly              | Improved      | Party and duel links open clean join screens.                                                                          |
| 23     | Gotcha playfield                     | Not re-tested |                                                                                                                        |
| 24     | Slow first reward                    | Fixed         | "Sprout Beanie" starter item at 100 Sparks.                                                                            |
| 25     | Jargon load                          | Improved      | "Learn a game in 30 seconds", "Browse all 28 games", "Go to the map".                                                  |
| 26     | Lonely Leagues                       | Fixed         | "Clear 1 game to join this week's league" plus Bring a friend.                                                         |
| 27     | Cramped Home on phones               | Improved      | Continue card plus Duel, Party, All games chips; 4 worlds instead of 9.                                                |

**Score:** 12 fixed, 7 improved or mostly fixed, 1 removed along with
its game, 2 not seen in this run, 5 not re-tested.

**4. The friction map, round 2**

From the landing page to a second puzzle, as a new 15-year-old in
Chrome.

| **Step**                  | **What happened**                                                                                                  | **Time / taps** | **Feel** |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------- | -------- |
| 1\. Landing               | Clear promise, playable 4×4 demo, worlds, how it works, privacy summary.                                           | Read            | Smooth   |
| 2\. Play now              | Opens a second "Ready to play?" screen with Play as guest / Google / email, the same choice the landing just made. | 1 tap           | Friction |
| 3\. Birth date            | Month and year selects. Year list starts at 2026, so you scroll back 15 to 25 years. "Can't change this later".    | 3 taps          | Friction |
| 4\. How to start          | Plain choices. I picked "Go to the map".                                                                           | 1 tap           | Smooth   |
| 5\. Make Spuz yours       | Colour plus suggested names; CTA names the destination.                                                            | 2 taps          | Smooth   |
| 6\. Home                  | Loaded in 3.7 s; a notification permission prompt immediately covered the Play card.                               | 3.7 s, 1 tap    | Friction |
| 7\. Play Crownfall (cold) | 8.4 s from tap to playable board.                                                                                  | 8.4 s           | Blocker  |
| 8\. Play again (warm)     | 1.16 s from tap to board.                                                                                          | 1.2 s           | Smooth   |
| 9\. Next level            | 0.56 s.                                                                                                            | 0.6 s           | Smooth   |

**Total:** about 35 seconds and 7 screens from landing to a first board
for someone who skips the lesson, down from about 1 minute 40 seconds
and 12 screens last week. The cold first load is now the single biggest
gap.

**5. What SPUZL now gets right**

- **A landing page that sells by doing.** The 4×4 Crownfall demo on the
  landing page is the right first impression.

- **Practice rounds for first-timers.** "First time playing Trotro Jam?
  Free hints, nothing counts yet." followed by "You've got it! That's
  the whole idea. Now for real." is exactly how to teach 28 different
  rule sets.

- **A calm, consistent game shell.** Back, title and level, one timer, a
  menu, a toolbar with the hint count on the Hint button.

- **Comfort settings where they are needed.** Pause now offers How to
  play, colour-blind patterns, text size, reduced motion, hide timer,
  sound and haptics, and blurs the board.

- **Readable boards by default.** Region borders and patterns in
  Crownfall; 3×3 boxes and remaining-digit counts in Nine.

- **Named, fast progression.** "Next level: 2" in half a second keeps
  players in flow.

- **Multiplayer that feels fair.** Countdown, round result cards,
  "KenteKing passed you. Swoosh." live toasts, a podium at the end of a
  party round, and graceful reconnection ("Your clock is paused. If
  they're not back in 20 s, the round is yours.").

- **Safety that fits the age.** Birth date gate, invite-only friends and
  no Quick Match under 16, preset-only chat ("Quick messages only in
  this room").

- **Excellent screen-reader labelling.** Cars in Trotro Jam ("the red
  car F, slides up and down"), Dusk constraints ("is opposite to the
  cell to the left"), colour names for Crownfall regions.

- **Local content done well.** Trotro Jam is a genuinely Ghanaian twist
  on a classic; Emoji Hits mixes global titles with "Sweet Mother",
  "Water No Get Enemy" and "Things We Do for Love", and accepts close
  spellings.

**6. Remaining and new issues**

Severity: **High** blocks or frustrates play, **Medium** confuses or
slows, **Low** is polish.

| **\#** | **Severity** | **What happened**                                                                                                                                                                                                                                          | **Where and fix**                                                                                                                                                                     |
| ------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | High         | **Cold first game is slow.** 8.4 s from tapping Play Crownfall to a playable board in Chrome; the first API calls only started about 7.6 s after the tap. Warm loads take 1.2 s. In another trace /api/v1/today was requested twice.                       | First game from Home, Library and Continue. Preload the game shell and first-game code on Home idle, fire data requests on tap, de-duplicate /today, show a board skeleton instantly. |
| 2      | High         | **No shared daily.** Dailies are gone; "Clear one game a day" now means any game. There is no common puzzle to compare, share or talk about.                                                                                                               | Home and Library. Add a Daily Five (see section 9) with a share grid.                                                                                                                 |
| 3      | High         | **Under-16 Duel screen looks broken.** "Quick Match" is the bright primary button but says "Opens at 16"; "Challenge a friend", the option that works, looks greyed out until a game is picked. The game list is a small box that scrolls inside the page. | Duel. For under-16s: hide Quick Match (or show it muted with a lock), make Challenge a friend primary, default the game to "Any game", and open game choice as a full sheet.          |
| 4      | High         | **Party round starts under an open sheet.** The Chat sheet stayed open over half the board when the host started the race. No countdown before Party rounds.                                                                                               | Party. Close all sheets on round start; reuse Duel's 3-2-1 countdown.                                                                                                                 |
| 5      | Medium       | **Prompt pile-up.** A notification permission prompt covered the Play card on first arrival at Home; a low-data prompt appeared on desktop broadband in the Shop.                                                                                          | Ask for notifications after the first friend add or duel invite; base the low-data prompt on measured slow loads, never more than once per session.                                   |
| 6      | Medium       | **"Run it back" is primary mid-set.** After game 1 of 3 the highlighted button replays the same game; "Next game" (continue the set) is secondary.                                                                                                         | Party results. "Next game (2 of 3)" primary until the set ends; "Run it back" afterwards.                                                                                             |
| 7      | Medium       | **Rules not visible on the board screen.** The one-line rule is now screen-reader-only; sighted players only see the input hint. Dusk opened from Continue without a practice round.                                                                       | All games. Show the one-line rule under the title until the first move, and give every game its practice round regardless of entry point.                                             |
| 8      | Medium       | **Redundant onboarding step.** Landing "Play now" leads to a second "Ready to play?" with the same guest / Google / email choice.                                                                                                                          | Onboarding. From the landing CTA go straight to birth date; keep sign-in links on the landing.                                                                                        |
| 9      | Medium       | **Birth year list starts at 2026.** Users scroll past 15 to 25 years; a 100-year list on a phone is slow.                                                                                                                                                  | Age gate. Start the list at the youngest allowed year, or use a numeric year field with a stepper.                                                                                    |
| 10     | Medium       | **Beat Tap practice punishes.** Early taps in the practice round cost "Minus 50"; there is no count-in; sound is off by default in a rhythm game.                                                                                                          | Beat Tap. 4-beat count-in, no penalties in practice, suggest turning sound on.                                                                                                        |
| 11     | Medium       | **Trotro Jam selection feedback.** Tapping a vehicle showed no visible selected state and the arrow pad still looked disabled; with a mouse, my taps did not select in this run (verify on touch).                                                         | Trotro Jam. Clear selected outline and lift; enable arrows visually on selection; let a swipe on the vehicle move it.                                                                 |
| 12     | Medium       | **Library rows are buttons, not links.** Games cannot be long-pressed, opened in a new tab or shared by URL from the list; rows also animate in one by one, slowing scanning.                                                                              | Library. Use links to /play/\<game\>; show all rows at once (animate only the first paint).                                                                                           |
| 13     | Low          | **Timer quirks.** "00:00 on your first ever puzzle"; Emoji Hits timer ran before Start; practice rounds show a timer.                                                                                                                                      | Shell. Start on first move; hide timer in practice.                                                                                                                                   |
| 14     | Low          | **Pause copy vs reality.** "Board hidden while paused" while the board was still visible behind the sheet in one state.                                                                                                                                    | Pause. Always blur, or change the copy.                                                                                                                                               |
| 15     | Low          | **Emoji Hits practice shows two input methods.** Options and a typing box together, while the hint only mentions typing; the hint stays after the round ends.                                                                                              | Emoji Hits. Choose one per mode; clear the hint on completion.                                                                                                                        |
| 16     | Low          | **Unnamed button.** The birth-date Continue button has no accessible name.                                                                                                                                                                                 | Age gate. Add a visible text label to the button element.                                                                                                                             |
| 17     | Low          | **Adults can join an under-16 host's party by code.** Chat is preset-only, which limits risk.                                                                                                                                                              | Party. For hosts under 16, offer "Friends only" rooms or host approval for joiners.                                                                                                   |

**7. Screen-by-screen recommendations**

Priority: **P0** fix now, **P1** next release, **P2** nice to have.

**7.1 Landing and onboarding**

| **What I saw**                                             | **Recommendation**                                                                                      | **Priority** | **Persona** |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------ | ----------- |
| Landing "Play now" leads to a second guest/sign-in screen. | Landing CTA goes straight to birth date. Keep "Sign in" in the landing header.                          | P1           | All         |
| Landing demo is not carried over.                          | If the visitor solves the landing demo, count it as their first clear and skip the lesson.              | P1           | Ama         |
| Birth year list starts at 2026.                            | Start at the youngest allowed year (for example 2013) and use a large wheel or numeric field on phones. | P1           | All         |
| "You can't change this later" in red-flag tone.            | Keep the rule; soften the copy: "This sets what's on for your age. Ask a parent if you're not sure."    | P2           | Ama         |

**7.2 Home**

| **What I saw**                                             | **Recommendation**                                           | **Priority** | **Persona** |
| ---------------------------------------------------------- | ------------------------------------------------------------ | ------------ | ----------- |
| Notification prompt on first arrival covers the Play card. | Ask after the first friend add, duel invite or 3-day streak. | P0           | All         |
| "3 new games" banner is good.                              | Keep; make it tap through to a filtered Library ("New").     | P2           | Kwame       |
| Continue card works well.                                  | Add a tiny board thumbnail and the level name on the card.   | P2           | Esi         |

**7.3 Library and game cards**

| **What I saw**                                                       | **Recommendation**                                                                                     | **Priority** | **Persona** |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------ | ----------- |
| Rows are buttons, not links; rows animate in one by one.             | Real links to /play/\<game\>; render all rows immediately.                                             | P1           | All         |
| Card shows "Play" and "Levels" plus "Start at Level 1 · All levels". | "Play" resumes your next level and says which ("Play Level 3"); "All levels" is a secondary text link. | P1           | All         |
| Emoji Hits icon missing in the card header.                          | Fix the asset.                                                                                         | P2           | All         |

**7.4 Game shell**

| **What I saw**                                                 | **Recommendation**                                                                           | **Priority** | **Persona** |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------ | ----------- |
| Rule text is screen-reader-only.                               | Show the one-line rule under the title until the first move, then collapse it into the menu. | P1           | Ama         |
| Practice depends on entry point (Dusk from Continue had none). | Practice round on the first open of any game, from any entry.                                | P1           | All         |
| Timer starts before play or shows 00:00 after a win.           | Start on first move; hide in practice; never report 00:00 on a solved puzzle.                | P2           | All         |
| Pause copy says the board is hidden while it is visible.       | Always blur on pause.                                                                        | P2           | All         |

**7.5 Games**

| **What I saw**                                                 | **Recommendation**                                                             | **Priority** | **Persona** |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------ | ----------- |
| Trotro Jam: no visible selected vehicle; arrows look disabled. | Selected outline and lift; arrows light up; swipe on a vehicle moves it.       | P1           | All         |
| Beat Tap: penalties in practice, no count-in, sound off.       | 4-beat count-in; practice never deducts; prompt "Turn sound on for this one?". | P1           | Kwame       |
| Emoji Hits: two input methods in practice.                     | Options in practice, typing in the real round; say so on screen.               | P2           | Ama         |

**7.6 Duel and Party**

| **What I saw**                                                 | **Recommendation**                                                           | **Priority** | **Persona** |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------ | ----------- |
| Under-16 Duel: disabled Quick Match is the primary button.     | Challenge a friend primary; Quick Match hidden or locked with "Opens at 16". | P0           | Ama         |
| Game picker is a small inner-scrolling box.                    | Full-height sheet with search and the same filters as the Library.           | P1           | All         |
| Chat sheet stays open when a party round starts; no countdown. | Close sheets on start; 3-2-1 countdown like Duel.                            | P0           | Kwame       |
| "Run it back" primary after game 1 of 3.                       | "Next game (2 of 3)" primary until the set ends.                             | P1           | Kwame       |
| Guest result list shows self first even when 2nd.              | Always order by rank; highlight "You".                                       | P2           | All         |
| Under-16 host rooms open to anyone with the code.              | "Friends only" or host-approves-joiners for under-16 hosts.                  | P1           | Ama         |

**7.7 Shop, Leagues, Settings**

| **What I saw**                   | **Recommendation**                                                  | **Priority** | **Persona** |
| -------------------------------- | ------------------------------------------------------------------- | ------------ | ----------- |
| Low-data prompt on fast desktop. | Trigger only after measured slow loads on mobile; once per session. | P1           | Esi         |
| Leagues empty state is clear.    | Add a progress chip on Home: "1 clear to join this week's league".  | P2           | Kwame       |
| Starter item at 100 Sparks.      | Keep; show "You can afford this" badges in the Shop.                | P2           | Ama         |

**8. Catalogue strategy**

Going from 51 games in 9 worlds to 28 in 4 was the right call for ease
of use: fewer choices, clearer worlds, and every game can now get a
practice round. Two things were lost along the way.

**The shared daily**

Dailies were SPUZL's ritual: everyone gets the same puzzle, and you
compare times with friends. Without them, a streak just means "play
anything", which is easy to forget. Bring back a **Daily Five**: one
puzzle, one word or quiz, one arcade, one board challenge and one
rotating bonus, the same for everyone, done in about 5 minutes, with an
emoji share grid.

**Formats worth bringing back**

| **Game**         | **Why it earned its place**                                                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Quads            | Connections-style grouping is one of the most shared daily formats among 16 to 35s, and your Ghana-regions puzzle was a highlight last week. |
| Pinned / Flagged | Geography and flags are easy, social and great for party rounds.                                                                             |
| Tripwire         | No-guess minesweeper is a calm, well-loved logic format.                                                                                     |
| Pixl             | Picture logic (nonograms) has a loyal, long-session audience.                                                                                |

Bring them back one at a time, each with a practice round, and use the
"3 new games" banner on Home to announce them.

**9. New features**

Features already shipped since last week (Continue card, practice
rounds, comfort pause, low-data mode, starter item) are not repeated
here.

**9.1 Daily Five with share grid**

**What:** Five short shared puzzles a day across the four worlds, one
combined score, and an emoji grid for WhatsApp Status, Snapchat and X.

**Why it matters:** A daily ritual and free word of mouth; restores the
reason to come back tomorrow.

**9.2 Instant first load**

**What:** Preload the game shell and the most likely next game on Home;
skeleton boards; one data call on tap.

**Why it matters:** The first impression is now the slowest moment.
Making it instant protects every other improvement.

**9.3 Async friend challenges**

**What:** Send a friend the exact puzzle you just solved; they play when
they can; both see each other's time and moves.

**Why it matters:** Live duels need both people online; async keeps
rivalry alive at any hour.

**9.4 School and campus leagues**

**What:** Opt-in leagues by SHS, university or workplace, with weekly
trophies (builds on School Cup).

**Why it matters:** Identity and bragging rights drive 13 to 25
engagement.

**9.5 Share cards after any clear**

**What:** A 9:16 card with time, level, your Spuz in its hat and a "Beat
me" link.

**Why it matters:** Every win becomes an invite.

**9.6 Streak shield and reminders**

**What:** One free streak freeze per week for guests who sign in; a
gentle evening reminder only if the player opted in.

**Why it matters:** Protects habits without nagging.

**9.7 Party for the big screen**

**What:** Classroom mode already exists; add a TV/laptop "spectator"
view for parties at home, with live progress bars and the podium.

**Why it matters:** Makes SPUZL a living-room and classroom event, not
just a phone app.

**9.8 Seasonal events**

**What:** Detty December, exam-season brain sprints, AFCON week (Emoji
Hits and Quickfire packs), Independence Day quiz on 6 March.

**Why it matters:** Fresh reasons to return with strong local relevance.

**10. New game types**

Trotro Jam, Emoji Hits and Beat Tap from my last list are now in. These
are the next candidates, chosen for youth appeal, short sessions and
simple controls.

| **Game**        | **World**    | **How it plays**                                                                                              | **Effort** | **Appeal** |
| --------------- | ------------ | ------------------------------------------------------------------------------------------------------------- | ---------- | ---------- |
| Five            | Words & Quiz | Guess a five-letter word in six tries with coloured feedback. The daily word game every young audience knows. | Low        | Very high  |
| Higher or Lower | Words & Quiz | Which is bigger: population, followers, price, stadium capacity? Streak until you miss.                       | Low        | Very high  |
| Penalty King    | Arcade       | Swipe to aim and curve penalties; then dive as keeper. 60-second rounds, perfect for duels.                   | Medium     | Very high  |
| Draw It         | Party        | One player draws a word, everyone else guesses on their phones.                                               | High       | Very high  |
| Two Truths      | Party        | Each player writes two truths and a lie; the room votes. Preset prompts for under-16s.                        | Medium     | High       |
| Market Run      | Arcade       | Memorise a Makola shopping list, then tap the right items as they scroll past.                                | Medium     | High       |
| Light Up        | Puzzles      | Place bulbs to light every cell (Akari). Clean rules, great for 5 minutes.                                    | Low        | Medium     |
| Killer Sums     | Puzzles      | Sudoku with caged sums, using the Nine engine.                                                                | Low        | Medium     |
| Dara            | Board Games  | West African strategy game: place, then move to make lines of three. Play a bot or a friend.                  | Medium     | Medium     |
| Azonto Steps    | Arcade       | Copy a growing sequence of dance-move arrows (Echo meets rhythm), with a short original beat.                 | Medium     | High       |

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<tbody>
<tr class="odd">
<td><p><strong>Build order</strong></p>
<p><strong>First:</strong> Daily Five (using existing games), then Five
and Higher or Lower.</p>
<p><strong>Next:</strong> Penalty King and Draw It.</p>
<p><strong>Then:</strong> Two Truths, Market Run, Azonto Steps.</p>
<p><strong>Later:</strong> Light Up, Killer Sums, Dara.</p></td>
</tr>
</tbody>
</table>

**11. Roadmap and metrics**

| **Phase**    | **What to ship**                                                                                                                                                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| This week    | Cold-load fix (preload, early data, single /today) · under-16 Duel hierarchy · close sheets and countdown on Party start · notification prompt timing · low-data prompt threshold · "Next game" primary mid-set · accessible name on Continue. |
| Next 2 weeks | Daily Five with share grid · visible one-line rules · practice round from every entry point · Trotro Jam selection feedback · Beat Tap count-in · Library links and instant rows · onboarding shortcut from landing.                           |
| Next month   | Async friend challenges · share cards · Quads back · Five and Higher or Lower · friends-only rooms for under-16 hosts.                                                                                                                         |
| Later        | School and campus leagues · big-screen party view · Penalty King, Draw It, Two Truths · seasonal events.                                                                                                                                       |

**Metrics to watch**

- **Cold tap-to-board** for the first game of a session (target under
  1.5 s on 4G).

- **Landing to first clear** for new players (target under 45 s).

- **Practice completion rate** per game, and drop-off between practice
  and first real level.

- **Prompt acceptance** for notifications and low-data mode, by when
  they were shown.

- **Party start-to-first-move time** and sets completed per room.

- **Duel creation rate for under-16s** after the hierarchy fix.

- **D1 and D7 retention**, before and after Daily Five.

**12. Final word**

A week ago SPUZL was a brilliant idea held back by friction in the
seams. Today most of those seams are closed: the shell is consistent,
boards are readable, multiplayer feels fair, and first-timers are taught
by playing. The remaining work is narrower and very achievable: make the
first load as fast as the rest, stop interrupting new players with
prompts, fix the duel screen for younger players and the party start,
and give everyone a shared reason to come back each morning with a Daily
Five.

Do that, and SPUZL will feel effortless from the first tap, which is
exactly what young players expect from the games they keep.
