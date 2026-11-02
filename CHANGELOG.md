# Changelog

## 1.9.0 (2 November 2026)

### Fixes

- **Last active is real now.** Opening the app, starting or finishing a game and the online heartbeat (which now also
  runs during games, so friends see "Playing <game>") all update it. Existing players are backfilled from their latest
  game or sign-in.

### For players

- **Games use big screens.** On tablets in landscape, laptops and desktops (900 × 600 and up) every game splits
  into two columns: the board on the left, grown to the height under the top bar (up to 760 px, and 80 % of the
  screen height), and a side panel on the right with whose turn it is, the move list or captured pieces, clue
  lists, words found, the feedback line and the tools. Chess vs the bot at 1280 × 800 goes from a 384 px board to
  624 px; Minicross, Coil, Buried, Rungs and Seven move their clues, word lists and keyboards to the panel. Live
  Board Bay games, bot games, Duels and Party races follow the same layout. Phones and tablets held upright keep
  the single column. Turning a tablet or resizing a window never restarts the game.
- **Leave any game, any way.** Back, the new **Leave game** in the ⋯ menu, the browser or phone back gesture and
  Escape (when nothing else is open) all lead out:
  - Free play and levels leave at once. The puzzle is saved and its game card says **Resume**; opening it again
    carries on with the same puzzle, moves and time. Guided practice and casual games vs the bot leave at once
    too (they are short and start over).
  - A timed scored run that has started (Quickfire, Echo, Flinch, Beat Tap, Gotcha, Dash, Gauntlet) asks once:
    "Leave this round? Your progress here won't count." Keep playing is the default.
  - A live Duel or live Board Bay game asks "Leave the match? Your opponent wins this one." and tells them at once;
    a Party race asks first too ("You'll leave the room."). A Practice-bot Duel leaves without asking.
  - Only these confirms use the back gesture, and a second back always leaves.

### Under the hood

- `components/game/useBoardSize.ts`: `isWide`, `boardBox` and `wideCell` (the two-column rule); `useCellSize` takes
  the row count for tall boards; `fitCell` takes the viewport height. `components/game/ShellAside.tsx` moves board
  content into the side panel on wide screens (a portal, so state is untouched). CSS variant `wide`.
- Leave policy in `lib/game/leave.ts` (pure, unit tested), the shared `useLeave` hook (confirm, one-entry history
  guard, Escape, keepalive leave calls) and `LeaveConfirm` dialog. Duel, Party and Board Bay screens own leaving for
  the whole match; their old leave sheet is gone.
- `POST /api/v1/attempts` takes `resume`: the player's own free-play or level attempt, still open and under 36 hours
  old, comes back with its saved state and time; anything else starts fresh. The client keeps a per-game note
  (`lib/client/resume.ts`) and flushes the last moves with a keepalive save when the page goes away. Abandoned
  attempts are unchanged: never finished, marked abandoned by the daily housekeeping, nothing awarded.

## 1.8.0 (2 November 2026)

### Fixes

- **"Different worlds" quests now count.** The daily "Clear a game in 3 different worlds" and the weekly "all 4
  worlds" step never moved, which also stalled the weekly chain. They now count distinct worlds cleared in the day or week.
- **3D tiles** for Trotro Jam, Emoji Hits and Beat Tap (they had none, so their cards showed a broken image).

### For players

- **Draw It is live.** Everyone now watches the drawer's line appear as it is drawn, smoothly, instead of the whole
  line popping in at pen up. With reduced motion each bit of line shows at once. The finished line the server
  keeps is still what everyone ends up seeing (and what a report captures).
- **XP and Sparks in Draw It and Two Truths.** When a room finishes, everyone still in it earns 5 XP and 1 Spark
  for each round they took part in (drew, wrote, guessed or voted), and first place gets 20 XP and 5 Sparks more.
  The podium shows what you earned. Rooms need 3 or more players to the end, sitting out earns nothing, players
  who leave or are removed get nothing, and 18+ party games pay up to 150 XP a day.

### For admins

- New settings under **18+ party games**: XP and Sparks per round played, the winner bonus XP and Sparks, and the
  daily XP limit for 18+ party games.

### Under the hood

- Migration `20261120000001_adult_party_rewards` (see docs/MIGRATIONS.md): `party_rounds.played` and
  `svc_grant_capped_reward` (service role only), pgTAP `109_adult_party_rewards`.
- Live ink travels peer to peer on the room's realtime channel (event `ink`): batches every 50 ms, whole board
  units with deltas, never stored. Viewers keep only the round drawer's batches.

- **Quickfire answers are checked on our side.** Your board no longer carries the answers: each question's clock
  starts with us when it appears, your tap is marked at once and the right answer shows a moment later. An answer
  that reaches us after the 15 seconds (plus a little for the network) counts as out of time, and the clock keeps
  running if you pause mid-question. If the connection drops, your answer is kept: tap Try again.

### Under the hood

- Quickfire moves to the content-game guess transport: the served board has questions and options only (no sealed
  answer key, no salt), behind an attempt-bound token. The guess route opens and judges each question, keeps both
  on the attempt's move log with the server's time, and finish audits the final state against that log, so a
  forged score fails. The migration `20261120100001_quickfire_server_answers.sql` strips the sealed key from stored
  boards and gives them a content reference. Guided practice, the admin preview and the dev board judge as practice.
- Client code reads `hasLogic` from `games/logic-ids.ts`, and the dev board answers hints and guesses through
  server actions, so the logic registry (and the Quickfire question bank) stays out of client bundles. A unit test
  walks the client import graph to keep it that way.

### Four worlds instead of eight

#### For players

- **The 29 games now live in 4 worlds.** Home shows 4 islands:
  - **Puzzles** (9): Crownfall, Dusk, Sixer, Nine, Weave, Flowline, Pairup, Lost, Trotro Jam.
  - **Words & Quiz** (8): Coil, Rungs, Seven, Minicross, Buried, Remix, Quickfire, Emoji Hits.
  - **Arcade** (7): Echo, Twins, Flinch, Beat Tap, Gotcha, Dash, Gauntlet.
  - **Board Games** (5): Chess, Draughts, Oware, Ludo, Four Up.
- World pages, All games filters and search, How to play, the landing page, leaderboards, the archive, School
  Cup, Duel and Party pickers all follow the 4 worlds. Counts come from the catalogue ("Four worlds to wander").
- Games that changed world keep their look: Flowline's water stays cyan, the trotro stays orange, and Gotcha, Dash
  and Gauntlet keep their red night scene inside Arcade.
- Old links to Line Lane, Shape Shed, Clue Cave and Rage Ridge open the world that took their games.
- **Ranks:** your rank in a world now covers its whole group. If you had a rating in a world that was folded in
  (Line Lane, Shape Shed, Clue Cave or Rage Ridge) and none yet in its group, it carries over.
- **Badges:** Puzzles, Words & Quiz, Arcade and Board Games Explorer replace the old per-world Explorer badges.
  Explorer badges you already earned stay on your profile. Untouched (secret) still counts a Gotcha, Dash or
  Gauntlet course with no deaths.
- **Quests:** world quests name the new worlds, and the weekly "worlds" step asks for all 4 worlds (it asked for 5).
- Classroom mode still hides Gotcha, Dash and Gauntlet.

#### For admins

- Calendar, events and every world filter show the 4 worlds. Seasonal bonus quests set on a folded world now count
  clears in its group.
- Migration `20261121000001_world_groups` (see `docs/MIGRATIONS.md`).

## 1.7.0 (2 November 2026)

### For players

- **Free play uses the new levels too.** Gotcha, Dash and Gauntlet free-play courses now draw from all 64 to 66
  rooms, not only the original 10 to 12: easy courses from the first 30% of the ladder, medium up to 45%, hard 15 to
  65%, expert 35 to 85% and mega from the hardest 45%, always ordered from easier to harder.

### Age from birth month and year

### For players

- **When were you born?** Every new player (guest, Google or email) now gives their birth month and year (never
  the day) straight after choosing how to start, instead of picking an age band. It sets what's on for their age
  and can't be changed later. Under 13: no account is made and nothing is kept.
- Your age group moves up on its own as you get older (from the 1st of the month after your birthday month), and
  every age rule follows it: under-16 privacy (nickname and avatar only, city hidden, friends by invite link or QR),
  Quick Match and Play live from 16, School Cup teachers and the 18+ party modes from 18.
- **Settings** shows your age group (not your birth date), read-only, with "Contact us if this is wrong."
- Players from before are asked once on Home (or from Settings) for their birth month and year. Their age group
  keeps working either way; a birth month and year that would make them older than the group they chose when they
  joined is refused (contact us), and nobody is locked out.

### For admins

- **Correct birth month/year** on a player's page (owner and moderators): a reason is required, the age group and
  rules follow at once, and the audit log keeps the old and new group and the reason (never the date). Only roles
  that can correct it see the birth month and year.

### Operations

- Migration `20261119000001_birth_month_year.sql`: `players.birth_year` and `birth_month`, `age_band_of(year,
month, today)`, a trigger that derives and locks the band, a daily band refresh (`spuzl-age-band-refresh`, 00:03
  GMT) and `svc_admin_set_birth`. See `docs/MIGRATIONS.md`. Apply it before the code deploys.
- `POST /api/v1/profile` takes `birthYear` and `birthMonth` (`ageBand` is ignored); a change is refused with 409
  `age_locked`, under 13 with 403 `too_young`, a profile without them with 422 `birth_required`. `PATCH` refuses
  any age field with 409 `age_locked`.

## 1.6.0 (2 November 2026)

A tighter Grid: 29 games across 8 worlds.

### For players

- **29 games, 8 worlds.** SPUZL now focuses on the games people play most. Trotro Jam (Shape Shed), Emoji Hits
  (Clue Cave) and Beat Tap (Reflex Rink) are now regular games for everyone, no longer behind the new-games
  setting. 32 games are retired: Pixl, Blackout, Tripwire, Light Up, Isles, Quilt, Snug, Shuffle, Reflect,
  Squint, Dead On, Merge, Sums, Equal, Higher or Lower, Market Run, Killer Sums, Quads, Five, Hunch, Pinned,
  Flagged, Penalty King, Flipside, Ricochet, Stacked, Wobble, Grapple, Ghosted, Slip, Flip and Dara.
- **Number Den is gone from the map** (all its games are retired). The map, Library filters, the landing page
  and How to play show the 8 worlds that have games; its Explorer badge stays only if you already earned it.
- Retired games leave every list: Library and search, World pages, the Home Play card ("Games tried x of 29"),
  Duel and Party pickers and random mixes, Ghost Race (Dash only now), School Cup, challenges and the guided first
  play. Old links to them show "not found". Your past clears, XP and badges are kept.
- Every count you see (landing page, welcome, Library search, site title and description, app manifest, How to
  play, share cards) now comes from the live catalogue, so it can't go stale.

### For admins

- Retired games are still in the console, marked **retired**: the Library list, puzzle filters and content desk
  show them, and their old Dailies open read-only. Generating, swapping or scheduling a Daily for one, or editing
  its Library metadata, is refused (`409 game_retired`). The calendar, live-ops gap alert and Daily generation
  skip them.
- Bringing a game back: remove its id from `RETIRED_IDS` in `lib/catalog.ts` and set its `games.status` to
  `live` in a migration. Its code, boards and tests never left.
- Migration `20261116000001_retire_games.sql` adds the `retired` status and sets it for the 32 games; the 3
  promoted games go `live`.

### Under the hood

- `lib/catalog.ts`: `RETIRED_IDS`, `ALL_GAMES` (everything in code), `GAMES` (live only), `WORLDS` (worlds with a
  live game), `GAME_COUNT` / `WORLD_COUNT`, and the gates `playableGame`, `isLiveGame`, `isLiveWorld`,
  `isRetired`. `GAME_BY_ID` still resolves every id, for names on old results.
- The server refuses retired games like unknown ones (404 `unknown_game`): start attempt, guided play, guess,
  play and bot pages, ghost races, challenges, archive, leaderboards, School Cup, presence, metrics.
- `LAB_GAMES` is empty; the lab mechanism and its e2e test stay and switch on with the next lab game.
- Board Bay still lists Flip until its own change lands (`lib/multiplayer/bay.ts` is owned by that work).

### For players

- **Play live against someone new** in chess, draughts, oware, ludo and four up. Pick a game and tap Play live:
  we find another player waiting for the same game (close to your rating once you have one, otherwise first
  come, first served) and open a rated live game with 5 minute clocks on both phones at once. Cancel any time.
  After a minute with nobody around you get "Nobody's free right now" with buttons to invite a friend or play
  the bot. Players who block each other are never paired, and Play live opens at 16, like Duel Quick Match.
  Only the preset emotes are shared during the game.
- **Easier to find:** each board game's card (World page, Library sheet, and the game-over bar after a game vs the
  bot) now has Play live and Challenge a friend next to Play vs bot. The Duel screen and Friends link to Board Bay.
  Relaxed mode hides Play live, because it has clocks.
- **Flip has left Board Bay:** it is no longer offered or accepted for new games. Games already running can finish.

### Operations

- Migration `20261117000001_board_queue.sql` adds the server-only `board_queue` table and `svc_bay_mm_claim`
  (see `docs/MIGRATIONS.md`). New API: `POST`, `GET` and `DELETE /api/v1/bay/queue`.

### For players

- **Levels.** Gotcha, Dash and Gauntlet now have a ladder of 60+ levels each, and Crownfall, Dusk, Sixer, Nine,
  Weave, Flowline, Pairup, Lost and Trotro Jam have endless levels. Open a game and pick **Levels** next to free
  play. Clear a level to open the next one; cleared levels replay any time. Levels start easy and climb to mega
  (bigger boards where the game has them). Your level is on the game card ("Level 12 · Next: 13"), the level map
  shows every level with your best time, and the result bar leads to the next level.
- New Rage Ridge rooms: trolls you have met (fake floors, pop-up spikes, runaway doors) in new combinations,
  plus crumbling bridges over spikes, moving slabs, hidden blocks you must hop under, and low tunnels whose
  ceilings grow teeth. Later levels are longer with tighter timing, and every few tiers ends on a hand-made set
  piece. Every lie still shows itself after your first death.
- A level clear earns what a free-play clear does (same daily cap and settings). A replayed level earns nothing
  extra, and levels don't move world ranks. Guests keep their levels with their account like everything else.

### Under the hood

- Daily and free-play courses still use the original hand-made rooms, so courses are unchanged.
- Rage Ridge rooms are made offline by `scripts/rage-design.ts`, a seeded designer whose every room is proved
  beatable by a bot over the real simulation; the tests replay each stored solution.
- Migration `20261118000001_player_levels.sql` adds `player_levels` and the `level` attempt mode.

## 1.5.1 (2 November 2026)

### For admins

- **No more authenticator app.** Admin sign-in is your password, then a 6-digit code we email you (the same
  Brevo codes players get). A correct code opens the console on that browser for 12 hours. Old authenticator
  factors are removed the first time you verify by email, and every verification is in the audit log
  (`admin.email_code_verified`). Non-admin accounts are refused right after the password; no code is sent to them.
- Migration `20261115000001_admin_email_code.sql` adds the server-only `admin_verified_sessions` table.

## 1.5.0 (2 November 2026)

Sound, motion and haptics everywhere, a logo intro with a swoosh and a thump, and fairer content games.

### For players

- **Logo intro:** the letters drop with gravity and tap as they land; the Z winds up, swooshes in from the right
  and slams into place with a deep thump and a vibration; Spuz pops out. Sound and motion land on the same frame.
- **A new sound kit:** warmer, layered sounds with a little variation so repeats never sound robotic, for taps,
  toggles, placements, clears, errors, hints, rewards, streaks, level ups, countdowns, duels and parties. Sheets
  whoosh open and closed. Turning sound or haptics on in Settings plays a preview.
- **One haptic language:** light for taps, medium for placements, a success pattern for clears, a warning for
  rule breaks and a celebration for level ups (where the phone supports it, and only if haptics are on).
- **Every game board** got a feel pass: placements climb in pitch with your streak, paths hum as they grow, merges
  and flips land on the beat, blocked moves lean instead of shaking, typed letters stay quiet, and each clear plays
  once from the game screen.
- **Motion:** Home hops arc with gravity, results count up smoothly, celebrations land with a thump, welcome steps
  slide the way you're going, and toasts and sheets leave the way they came.
- **Site icon** is a plain file now, so the browser tab and hosts like Vercel show the lemon green Spuz.
- **Content games are harder to game:** a word or quiz puzzle no longer carries its content number. The server
  sends an opaque token instead, good only for your own attempt, the race round you're in or the practice board,
  for a limited time. Nobody can try words on a board outside their attempt, and Penalty King's keeper can't be
  read ahead. Challenges on content games now check guesses on the challenge attempt itself.
- **18+ party filter:** phone numbers spelled out ("zero two four ...", "o2four", "double five") and words or
  contact details typed with look-alike letters (Cyrillic or Greek letters, full-width or styled letters, accents,
  invisible characters, "$" and "!" for letters) are refused like the plain ones.

### For admins

- **Moderation:** reopening or dismissing an actioned 18+ party report lifts the 18+ block it caused, unless
  another actioned party report still justifies one (the block then ends with that report's). The change is in the
  audit log (`player.adult_party_unblock`), and the report page says what happened.

### Operations

- New server secret `GUESS_REF_SECRET` (any long random string) encrypts content-game tokens. Unset, a key derived
  from `SUPABASE_SERVICE_ROLE_KEY` is used and production logs a warning. Clients on an older build get refused
  content-game guesses until they reload.
- Migration `20261114000001_adult_block_reopen.sql` (see `docs/MIGRATIONS.md`).
- `GUESS_REF_SECRET` and `SHARE_CARD_SECRET` are set in Vercel for production and preview.

## 1.4.0 (1 November 2026)

A real landing page, fairer free play, phones that fit, and many admin and multiplayer upgrades.

### For players

- **New landing page** for visitors: a playable Crownfall demo, the nine worlds, how it works and what happens
  with your data.
- **Free play is fairer:** the puzzle's seed never leaves the server, so a modified app can't work out answers.
- **Learned games follow your account:** a new phone skips practice rounds you've already done.
- **Ranked Duels:** if a round's game is new to you, both players get a short rules break and you see its rules.
- **Party:** the host can hand-pick 2 to 8 games for the room.
- **Leagues:** small tiers merge at the weekly reset, so nobody sits in a group of one. You keep your own tier.
- **Phones:** Nine fits a 375 × 667 phone with its tool bar showing, and Nine and Sixer fit 320 × 568.
- **Ghost Race** uses a shared track of the day while Dailies are off.
- **Welcome** says when Google sign-in was cancelled or didn't finish.
- **Settings:** someone who hasn't started yet is no longer shown as signed in; Account offers Google or a start.
- **Switches apply at once:** browsers no longer keep an old copy of game settings or library info.
- **Five's answer list** is owner-approved; Trotro Jam boards have much more variety.

### For admins

- **Players:** every player, guest or signed in, with search, filters and sorting; a page per player (stats,
  attempts, reports, moderation history, inventory, audit); confirmed actions with a reason, each in the audit log:
  reset nickname, Sparks, Streak Freeze, ban or timed ban, revoke ranking, sign out everywhere, and delete with the
  nickname typed. Owners see emails, move Sparks, delete and export CSV; moderators ban and rename; analysts view.
- **Overview** on the admin home: players, guests and signed-in, new and active, sign-in methods and age bands.
- **Every admin table** sorts by its columns and has full paging: first and last, page numbers, 25/50/100 per page,
  jump to a page, and "showing X–Y of Z". Filters stay in the address bar.
- **Solve-check** works for Penalty King, Beat Tap, Higher or Lower, Light Up, Killer Sums and Dara.
- **All admin text** now comes from one copy file.
- **Google Search Console** ownership tag is on the site.

### 18+ party games (off until you turn on `features.adultParty`)

- **18+ party games (behind the switch):** Party adds **Draw It** (one player draws a secret word, the others guess)
  and **Two Truths** (write three statements about yourself, one false; the others pick the lie). Only signed-in
  players whose age band is 18+ see or can join them; guests and under-18s never see them, and the server refuses
  them (403) on every call. A room in one of these modes only ever holds signed-in 18+ players.
  - The host confirms a one-time notice: "Adults only: players may type and draw freely. Report anything abusive."
  - Every statement and guess passes a server filter (rude words, phone numbers, emails, links, handles, "add me
    on ...") and a length limit (statements 80 characters, guesses 30), with a friendly message when refused.
  - Drawings are vector strokes only (preset pens, capped size), no images and no text tool.
  - Every drawing, statement set and guess has a Report button; the host can remove a player, who can't rejoin.
  - Text and drawings are wiped when their round closes; only reports keep a copy.
  - Scoring: Draw It guessers score 200 to 50 by speed and the drawer 50 per correct guesser; Two Truths pays 100
    for spotting the lie and the writer 50 per player fooled.
  - The Draw It word list is family-safe, with Ghanaian everyday items (banku, kente, trotro, jollof and more).

### For admins (18+ party)

- **`features.adultParty`** (Features, off by default) turns the two games on. Their timings and the block length
  are in the new "18+ party games" group (`adultParty.drawSec`, `writeSec`, `voteSec`, `revealSec`, `blockDays`).
- **Moderation:** a **Party content** tab lists reported drawings, statements and guesses with exactly what was
  shown. Mark actioned also keeps the player out of 18+ rooms for `adultParty.blockDays` days (7 by default) and
  removes them from any 18+ room they are in.

## 1.3.0 (1 November 2026)

Google sign-in, a public homepage, a lemon green icon, fairer lab games and many admin and phone-fit fixes.

### For players

- **Continue with Google** on the welcome screen, in Settings → Account and in "Save your streak", with Google's
  official button. A guest who continues with Google keeps their progress (same account).
- **Public homepage:** visitors who aren't signed in see what SPUZL is at spuzl.vercel.app, with Play now and
  Sign in. Signed-in players still go straight to Home. The privacy policy covers Google sign-in.
- **Lemon green Spuz** on the app icon, favicon and home-screen icons.
- **Settings:** a Back button next to the title, and you can change your nickname (live checks; taken names are
  refused).
- **World ranks move in free play**, at half the weight a Daily did, scored against recent clears of the same game
  and difficulty. Replaying the same board does not count.
- **Phone fit:** Light Up, Five, Nine, Rage Ridge and Four Up fit small screens without sideways scroll; boards
  read the real screen width on their first render.
- **New games (still behind the switch):**
  - Killer Sums expert and mega never need a guess; hints teach the 45 rule.
  - Trotro Jam boards generate in well under a second.
  - Five and Emoji Hits only show an answer for your own game, and a shown answer can't count as a clear.
  - Penalty King keeps the keeper's dives on the server.
  - Emoji Hits clues are fact-checked; one song was replaced.

### For admins

- **Free-play economy settings** (Economy group): XP per clear (`free.xpPerClear`, 10), Sparks per clear
  (`free.sparksPerClear`, 5) and the daily XP cap (`free.xpDailyCap`, 300). How to play and Practice show the live
  values.
- **Dusk double-tap window** (`dusk.doubleTapMs`, Games group, 320 ms by default).
- **Filters in the address bar:** puzzle library, moderation, content desk, shop and audit log keep their tabs and
  filters on reload, Back and shared links.
- **Moderation:** tabs show their own counts and open on the first one with something waiting.
- **Event quests** appear in the Quests catalogue (XP and Sparks editable inline). Saving from the Seasonal events
  editor works again.
- **Content desk:** Five and Emoji Hits are in content review and the solve-check; the puzzle preview checks
  guesses on the server.
- **Metrics:** onboarding completion counts each Welcome step and reaching Home; hints count requests and uses;
  tap-to-board only counts Play buttons.
- **Penalty King** clears with machine-regular timing are flagged for review.

### Under the hood

- `SHARE_CARD_SECRET` is documented, with a production warning when it's unset.
- Board Bay colours moved to tokens.
- CI retries Supabase start and falls back to the Docker Hub image mirror.
- Lab game migrations apply on a fresh database.

## 1.2.0 (1 November 2026)

Free play is the only game mode for now, the admin console pages its tables, and ten new games are ready behind a switch.

### For players

- **No Dailies for now.**
  - Every game opens straight into free play, with endless puzzles.
  - All Daily screens, links and wording are gone, including the leaderboards and the archive.
  - Streaks, quests, badges and leagues now count regular clears. Clear one game a day to keep your streak; clear any game in a week to join that week's league.
- **World pages:** each game is one card, with its Challenge and Play vs bot actions inside it.
- **Invites:** Leagues uses the same Share sheet as Friends, Party and Crews.
- **Fixes:**
  - The Quickfire clock starts when you press Start.
  - A resumed Quickfire remembers earlier wrong answers.
  - Buried hints name cells as you see them after Rotate.
  - Chess vs bot lets you choose the promotion piece, shows coordinates and avoids repetition draws.
  - Bot games have their own help.
  - Sheets fade with reduced motion on.
  - Back buttons stay in the app.
  - Crownfall X marks and light-theme patterns are readable.
  - The hint counter only shows in games that have hints.

### For admins

- **Pagination:** every growing admin list pages on the server (10, 25, 50 or 100 rows). The page and page size
  stay in the URL.
- **New switches**, all off by default, all checked on the server:
  - **Dailies** (`features.dailies`)
  - **New games** (`features.newGames`): Five, Emoji Hits, Higher or Lower, Market Run, Penalty King, Beat Tap,
    Trotro Jam, Light Up, Killer Sums and Dara (with a full game vs bot)
  - **Status share cards** (`features.statusCards`)
  - **Seasonal events** (`features.seasonal`), with an Events page in the console, a Home banner and a bonus quest
- The Dailies switch is ready if Dailies come back; the calendar and puzzle tools are unchanged.

## 1.1.0 (1 November 2026)

The frictionless-play pass: faster taps, one consistent game screen, clearer boards and fewer steps.

### For players

- **Sign in or play as a guest** from the first screen, with a simple email code. Guests get a "Save your streak"
  nudge after a few clears that keeps all their progress.
- **Learn as you go:**
  - The first try of every game is a short practice round with free hints that pop up when you pause. It is
    skippable.
  - The start screen offers "Learn a game in 30 seconds", "Browse all 51 games" or "Go to the map".
  - The first clear flows straight into making your Spuz.
  - XP, Sparks, streaks, islands and slips are explained the first time they appear.
- **Faster:**
  - The puzzle starts loading the moment you tap.
  - A board-shaped placeholder shows at once.
  - Home and the Library warm up the next game while you look.
- **One game screen for all 51 games:**
  - one clock
  - a hint counter, with a confirm before the first hint on a Daily
  - Help and Pause
  - a comfort sheet in Pause: patterns, text size, reduced motion, hide timer, sound, haptics
  - the solved board glows for a moment before results
  - "Next in <World>: <Game>" and "Another <Game>" are always named
- **Home:** one Play card with today's progress ring, plus Duel, Party and All games as small chips. More of
  the map shows on phones.
- **All games:**
  - search and filters (Quick, Calm, Competitive, each world)
  - typical play time and a tick for games done today
  - one tap opens a game card with the Daily first
- **Easier and clearer games:**
  - Gentler Daily difficulty through the week.
  - Crownfall: always-on region borders, a higher-contrast palette with colour names, a one-tap patterns
    offer, and hints that explain the next real deduction.
  - Nine and Sixer: box borders, row, column and box highlights, one status line, and a 3 × 3 number pad with
    counts.
  - Dusk: tap for sun, double-tap for moon; transient taps never count as slips.
  - Four Up: whole-column tap targets with a drop preview.
  - Quickfire: answers hidden until Start, one auto-advance, and an end summary.
  - Quads: instant feedback and labelled difficulty colours.
  - Flinch: auto-starts the next round; the go signal is never colour alone.
  - Chess: pieces stay in their squares, readable coordinates, clear move dots.
  - Rage Ridge and Gotcha: no black first frame, a bigger canvas, 64 px controls, and held keys keep moving.
  - Word games: rotate or shuffle the board, and off-theme words count as bonuses.
- **Play together:**
  - Pick a game first, then Duel, Quick Match or host a Party, or pick the mode first as before.
  - Party has Host and Join tabs and offers every race game.
  - Duel round cards last 2 s, then 3-2-1, and the score always matches the rounds.
  - The Practice bot is offered from the start.
  - Ranked games use games you have cleared, and a game you have never cleared shows its rule card first.
  - Full games against a bot (easy, medium, hard) in Four Up, Chess, Draughts, Oware, Ludo and Flip.
- **Invites:** one Share button opens WhatsApp, Snapchat, Instagram, TikTok, Telegram, Facebook, X, Messages or
  Email.
- **Progress:**
  - The lesson counts as today's first clear.
  - Ranks never skip a tier.
  - A starter hat you can afford early.
  - New players join leagues with friends or players near their level, and see an invite card when alone.
- **Low data:** a suggestion on slow connections, and the Daily pack refreshes just after midnight GMT.

### For admins

- **Game settings:** tunables read at runtime, with ranges, help text and an audit entry for every change:
  - hint XP penalty
  - solved hold
  - Duel round card
  - Quickfire and Flinch delays
  - prefetch
  - starter price
  - sign-in prompt threshold
  - league grouping
- **Library:** per-game typical time and filter tags, with export and import (validated, all-or-nothing).
- **Metrics**, with CSV export: tap-to-board p50/p95, onboarding completion, time to first move, hint and
  accidental-hint rates, Duel abandon and bot fallback, Daily completion, share rate.
- Every new endpoint has role checks and tests per role. See `docs/MIGRATIONS.md` for the five migrations.

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
