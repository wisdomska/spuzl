# SPUZL – Software Requirements Specification

Oct 30, 2026 · @𝖘𝖊𝖓𝖞𝖆

## 1. Introduction

SPUZL is a free, mobile-first web app of 45 daily puzzle and skill games across 8 themed "worlds", wrapped in a game-like layer of XP, ranks, streaks, leagues and constant, purposeful animation. This SRS defines everything a team needs to design, build, test, launch and run it.

### 1.1 Document control

| Field          | Value                                    |
|----------------|------------------------------------------|
| Product        | SPUZL (pronounced "spuzzle")             |
| Document       | Software Requirements Specification      |
| Version        | 1.0 draft                                |
| Owner          | Product Owner: WISDOMSKA (SENYA)         |
| Sister product | SPIL (party game, spil-party.vercel.app) |
| Status         | Draft for team review                    |

### 1.2 Purpose

- One source of truth for product, brand, game rules, gamification, architecture and quality.

- Testable requirements with IDs (FR-*, NFR-*) traceable to tickets and tests.

- A clear MVP (v1.0) and what follows in later releases.

### 1.3 Scope

**v1.0 (MVP, public launch)**

- 15 launch games across all 8 worlds, including all 8 LinkedIn-style mechanics.

- Daily mode (same puzzles for everyone, reset 00:00 GMT), Practice mode, Archive (last 7 days free).

- Gamification: XP, levels, ranks, daily streaks, Sparks currency, 40 badges, daily quests, weekly leagues.

- Guest play with no signup; optional account to sync progress.

- Friends, friend leaderboards, school and city leaderboards, share cards.

- Full animated brand identity: mascot, world map, motion system, sound and haptics.

- Admin console for content, puzzles, users, reports and live-ops.

**v1.1 to v1.3**

- Remaining 30 games (2 to 3 per month).

- Duel mode (live 1v1), Speed Run, Weekly Mega, Seasons and Season Pass.

- SPUZL+ subscription and cosmetics shop (Paystack, Stripe).

- Level editor for action games, PWA install and push notifications.

**Out of scope (v1.x)**: native app-store apps, real-money prizes, open chat between players.

### 1.4 Definitions

| Term    | Meaning                                                    |
|---------|------------------------------------------------------------|
| Spuzler | A SPUZL player                                             |
| Spuz    | The mascot, a small squishy puzzle-piece creature          |
| World   | One of 8 themed game categories shown on the world map     |
| Daily   | The day's puzzle for a game; identical for every player    |
| Clear   | Completing a puzzle or level successfully                  |
| XP      | Experience points; drive levels                            |
| Rank    | Long-term skill tier, from Rookie to Legend                |
| League  | Weekly competition group of 30 players                     |
| Sparks  | Soft in-game currency earned by playing                    |
| Streak  | Consecutive days with at least one Daily clear             |
| Seed    | Number that generates a puzzle deterministically           |
| Juice   | Game-feel feedback: motion, sound, haptics on every action |
| MoSCoW  | Must, Should, Could, Won't priorities                      |

### 1.5 References

- SPIL SRS and Technical Specification (shared stack and conventions).

- WCAG 2.2 AA; Ghana Data Protection Act 2012 (Act 843); Nigeria Data Protection Act 2023; GDPR basics; COPPA-style care for under-16 users.

- Emil Kowalski's design-engineering skills (npx skills add emilkowalski/skill), the required motion standard for this product.

- Classic public-domain puzzle families: Star Battle, Binairo/Takuzu, Numberlink, Shikaku, Hashiwokakero, Nonogram, Kakuro, Sudoku, Minesweeper, Lights Out.

## 2. Product overview

SPUZL gives young people one place for a few minutes of daily brain and skill games, then makes coming back every day feel like progressing in a game. The habit hook is the Daily; the social hook is friend and school leaderboards; the delight is the animation and feel of every tap.

### 2.1 Vision and goals (first 6 months)

- **Vision:** the daily game ritual for West African youth, then the world.

- **Goal 1:** 50,000 registered or guest players with at least one clear.

- **Goal 2:** Day-7 retention of 25% or more; Day-30 of 12% or more.

- **Goal 3:** average 3 or more Dailies cleared per active player per day.

- **Goal 4:** 20% of daily clears shared (share card or link).

- **Goal 5:** run on free tiers until revenue starts.

### 2.2 Problem

Daily puzzle games (LinkedIn Games, NYT Games) are scattered across professional or paid apps, feel plain, and ignore young African audiences. Rage and skill browser games are fun but have no daily ritual, progress or social layer. SPUZL combines both, with a single brand and progression.

### 2.3 Audience and personas

| Persona                    | Age   | Context                               | What they want                                                |
|----------------------------|-------|---------------------------------------|---------------------------------------------------------------|
| Kwame, JHS/SHS student     | 13–17 | Phone shared at home, limited data    | Quick fun, beat friends and classmates, no ads that trick him |
| Akosua, university student | 18–24 | Lectures, hostel, WhatsApp and TikTok | Streaks, badges, a rank to flex, shareable results            |
| Kojo, young professional   | 25–35 | Commute, breaks at work               | 5-minute brain warm-up, clean design, leagues with colleagues |
| Teacher / club lead        | 25–45 | Runs a class or campus club           | School leaderboard, safe content, weekly challenge            |

Primary markets: Ghana, Nigeria, wider English-speaking Africa, diaspora. Minimum age 13.

### 2.4 Platforms

- Mobile web first (Android Chrome, Samsung Internet, iOS Safari), installable PWA; desktop web supported.

- Design baseline: 360×800 screen, 3 GB RAM Android, 3G network.

- Portrait for all games; action games also support landscape on desktop.

- Touch, mouse and keyboard controls for every game.

### 2.5 Constraints

- \$0 hosting until revenue: Vercel Hobby + Supabase Free (move to paid plans before taking payments; Vercel Hobby is non-commercial).

- Total JS for a game route under 200 KB gzipped (action games may lazy-load the game engine, up to 450 KB).

- All commits and attributions to WISDOMSKA (SENYA); no AI co-author lines anywhere.

- Puzzle mechanics may be inspired by classic and LinkedIn-style games, but names, art, layouts and text must be original.

### 2.6 Assumptions and dependencies

- Most sessions are 3 to 10 minutes; peak usage 6–9 am and 7–11 pm GMT.

- Logic puzzles are generated by algorithm; word and trivia content needs human writers.

- Dependencies: Vercel, Supabase, GitHub, Sentry, PostHog, Cloudflare Turnstile, a word-list licence (or open lists), Paystack (v1.2).

## 3. Gamified brand identity

SPUZL should feel like opening a game console, not a website: a living mascot, a world map to travel, and motion, sound and haptic feedback on every meaningful action. "Gamified" here means **filled with purposeful animation**, built to Emil Kowalski's design-engineering standard (npx skills add emilkowalski/skill).

### 3.1 Name and meaning

- **SPUZL**, always written in capitals as the logo, "Spuzl" in running text. Pronounced *spuzzle*.

- Meaning: a twist on *puzzle* with an extra S for **S**kill, **S**peed and **S**treaks.

- Players are **Spuzlers**. Finishing a puzzle is a **clear**. A day with all Dailies cleared is a **Full Spuzl**.

- Tagline: **"Tiny games. Big brain."** Secondary: "Clear today. Flex tomorrow."

### 3.2 Mascot: Spuz

Spuz is a small, squishy puzzle-piece creature with one tab on its head that wobbles like a hair tuft, big round eyes and stubby feet. Spuz is the player's buddy, guide and hype-man.

| State    | When it shows                    | Animation                                                         |
|----------|----------------------------------|-------------------------------------------------------------------|
| Idle     | Home, menus                      | Slow breathing squash and stretch, blinks every 3–6 s, tuft sways |
| Wave     | First launch, sign-in            | Hops, waves, says hi                                              |
| Thinking | Puzzle loading, hint requested   | Taps chin, tuft spins                                             |
| Cheer    | Puzzle cleared                   | Jumps, confetti burst from tuft                                   |
| Proud    | New personal best, rank up       | Puffs chest, sparkle                                              |
| Fire     | Streak 7+ days                   | Tuft becomes a flame, stays lit on Home                           |
| Sleepy   | Streak at risk after 8 pm        | Yawns, "Zzz", nudges the player to play                           |
| Squish   | Failure or death in action games | Flattens like a pancake, pops back                                |
| Rage     | Rage Ridge world                 | Red cheeks, steam from tuft                                       |
| Shocked  | Near miss, surprise trap         | Eyes pop, jumps back                                              |
| Sad      | Streak lost                      | Droops, then offers a Streak Freeze                               |
| Party    | League promotion, season end     | Dances with party hat                                             |

- Built in **Rive** as one state machine (inputs: mood, intensity, look-at x/y), so Spuz reacts live and eyes follow the cursor/finger. Fallback: static SVG poses.

- Spuz appears on Home, results, empty states, errors, loading, onboarding and share cards. Never on top of a puzzle while the player is solving.

- Spuz skins (cosmetics): colours, hats, glasses, world-themed outfits.

### 3.3 Brand world: The Grid

The games live on **The Grid**, a floating archipelago of 8 islands. Each island is a **world** with its own colour, landmark, ambient animation and music loop. The Home screen is an animated, scrollable world map where Spuz hops between islands.

| World       | Game type           | Colour (dark theme) | Landmark and ambient motion                      |
|-------------|---------------------|---------------------|--------------------------------------------------|
| Logic Lab   | Rule grids          | Violet \#8B7CFF     | Bubbling flasks, gear turning                    |
| Line Lane   | Paths and lines     | Cyan \#2FD3E0       | Neon tracks with light pulses running along them |
| Shape Shed  | Shapes and space    | Orange \#FF8A3D     | Blocks stacking and tumbling                     |
| Number Den  | Numbers             | Yellow \#FFD23F     | Digits floating and ticking like an odometer     |
| Word Woods  | Words               | Green \#3DDC84      | Letter-leaves falling from trees                 |
| Clue Cave   | Clues and knowledge | Coral \#FF6B6B      | Torch flicker, glowing question marks            |
| Reflex Rink | Memory and reflex   | Blue \#4D8BFF       | Lights blinking in sequence                      |
| Rage Ridge  | Action and rage     | Red \#FF3B3B        | Spikes popping up, crumbling ledges              |

### 3.4 Personality and voice

- **Personality:** playful, cheeky, encouraging, a bit competitive. Never mean, never preachy.

- **Voice:** short lines, second person, game slang, light West African flavour without caricature.

- Examples:

  - Clear: "Clean. 1:12, no hints. Who taught you?"

  - Fail in Rage Ridge: "Death number 47. Spuz believes in you. Mostly."

  - Streak risk: "Your 12-day streak is sleepy. One clear wakes it up."

  - Rank up: "Rookie no more. Welcome to Thinker."

  - Hint: "A tiny push. No shame."

  - Empty friends list: "No rivals yet. Send a link, start beef."

- No em or en dashes in UI copy. One label per action ("Play", "Share", "Continue").

### 3.5 Logo and icon

- **Wordmark:** SPUZL in Unbounded Black, tight tracking. The **Z** is drawn as a zigzag with a puzzle-tab notch, and is the only letter in the brand accent.

- **Logo animation (2.2 s, once per app open):** letters drop in one by one with squash-and-stretch, the Z snaps into place like a puzzle piece with a click sound, then Spuz pops out from behind the wordmark and waves.

- **App icon:** Spuz's face on a Spuz Lime rounded square; tuft breaks the frame. Variants for seasons.

- **Favicon / small sizes:** the Z mark alone.

### 3.6 Colour

One brand accent, eight world colours, neutral surfaces. Tokens defined as CSS variables for dark (default) and light themes.

| Token              | Dark (default) | Light    | Use                          |
|--------------------|----------------|----------|------------------------------|
| bg                 | \#0E0F1A       | \#F5F6FA | App background               |
| surface            | \#171929       | \#FFFFFF | Cards, sheets                |
| surface-raised     | \#20233A       | \#EEF0F6 | Puzzle boards, inputs        |
| line               | \#2B2F4A       | \#D8DCE8 | Dividers                     |
| text               | \#F4F5FB       | \#12131D | Main text                    |
| text-muted         | \#A2A6C2       | \#5A5E78 | Secondary text               |
| accent (Spuz Lime) | \#B8F23A       | \#4E8A00 | Primary buttons, XP, the Z   |
| on-accent          | \#0E0F1A       | \#FFFFFF | Text on accent               |
| gold               | \#FFC93C       | \#A86F00 | Rewards, Sparks, rank badges |
| danger             | \#FF5A5F       | \#C62828 | Errors, lost streak          |

Rules: world colours appear only inside their world (tiles, puzzle accents, headers); everything global uses the accent. Every text and control pair meets WCAG AA in both themes (CI contrast check).

### 3.7 Typography

- **Display:** Unbounded (700–900): titles, scores, level-ups, world names.

- **UI and body:** Geist (400–600), minimum 16 px on mobile.

- **Numbers and timers:** Geist Mono with tabular figures, so counters never jitter.

- All fonts self-hosted via next/font; display font subset to Latin to save data.

### 3.8 Iconography and illustration

- Icons: Phosphor (Bold weight), one family only.

- Game icons: custom flat illustrations, one per game, in the world colour, with a 2-frame idle animation (e.g. Crownfall's crown bounces).

- Badges: hexagonal medallions, 4 tiers (bronze, silver, gold, prism), each with an unlock animation.

### 3.9 Motion system (the core of the gamified feel)

Every screen and interaction has motion that communicates something: feedback, progress, reward or state change. Motion is built and reviewed with Emil Kowalski's skills, which the team (and Claude Code) must install: npx skills add emilkowalski/skill. Use animate to build each animation, find-animation-opportunities per screen, review-animations before every merge, animation-performance for frame drops, mobile-native for phone feel and break-ui for worst-case data.

**Rules (non-negotiable)**

1.  Animate transform and opacity (and clip-path where needed) only; never width, height, top or left.

2.  Entrances use ease-out curves; on-screen movement uses ease-in-out; never ease-in for anything the user waits on.

3.  UI feedback 120–250 ms; celebrations 400–1,200 ms and always skippable with a tap.

4.  Gestures (drag, swipe, pinch, flick) follow the finger 1:1 and release with springs; every animation is interruptible.

5.  Actions repeated many times in a puzzle (placing a crown, typing a letter) get instant feedback of 120 ms or less, never long animations.

6.  prefers-reduced-motion: keep fades and colour, drop movement, shake and parallax; celebrations become a simple fade with the same information.

7.  60 fps on the baseline Android phone; any animation that drops frames is fixed or removed.

8.  Haptics (Vibration API where supported) and sound always pair with the visual, never replace it.

**Motion catalogue ("juice")**

| Moment                      | Motion                                                                                                          | Sound                                    | Haptic       |
|-----------------------------|-----------------------------------------------------------------------------------------------------------------|------------------------------------------|--------------|
| Tap any button              | Press scale 0.96, spring back                                                                                   | Soft tick                                | 8 ms         |
| Place a piece / fill a cell | Cell pops 1.0 → 1.08 → 1.0 in 140 ms                                                                            | Pitch rises with streak of correct moves | 6 ms         |
| Rule broken                 | Offending cells flash danger and shake 3 times (6 px)                                                           | Low buzz                                 | 20 ms double |
| Line drawn (Weave, Pairup)  | Line extends with the finger, glowing head, trail fades                                                         | Rising synth                             | none         |
| Word found                  | Letters lift, fly to word list, chime per letter                                                                | Ascending notes                          | 10 ms        |
| Puzzle cleared              | Board pulses, tiles flip to world colour in a wave from last move, confetti from Spuz, timer counts up to final | Win jingle (1 s)                         | 30-10-30 ms  |
| XP gain                     | Numbers fly from board to XP bar, bar fills with a sweep, sparkles at the tip                                   | Coin-like ticks                          | none         |
| Level up                    | Screen dims, ring bursts, level number flips like a slot reel, Spuz Proud                                       | Fanfare                                  | 50 ms        |
| Streak +1                   | Flame on Home grows, number flips, embers float                                                                 | Whoosh                                   | 15 ms        |
| Streak lost                 | Flame shrinks to smoke, Spuz Sad, Freeze offer slides up                                                        | Soft fail                                | none         |
| Badge unlock                | Medallion drops, spins 360 on Y axis, shine sweep, tier colour burst                                            | Clink                                    | 25 ms        |
| Sparks earned               | Sparks arc to the wallet in a stream, wallet bounces                                                            | Coin ticks                               | none         |
| League promotion            | Player row lifts out of the table, flies up, new league emblem slams in                                         | Crowd cheer                              | 40 ms        |
| Death (Rage Ridge)          | Character squishes, pixel burst, death counter bumps, instant respawn in 300 ms                                 | Splat                                    | 15 ms        |
| Hint                        | Spuz Thinking, highlighted cell glows and breathes twice                                                        | Twinkle                                  | none         |
| World travel (map)          | Camera pans with ease-in-out, Spuz hops island to island along a dotted path                                    | Hops                                     | none         |
| Screen change               | Shared-element transitions (tile expands into the game)                                                         | none                                     | none         |
| Loading                     | Skeleton shapes plus Spuz Thinking; no spinners                                                                 | none                                     | none         |

**Tools:** Motion (motion/react) for UI, Rive for the mascot and badges, Phaser 3 for action-game rendering, CSS for simple keyframes, canvas-confetti (or a light custom canvas) for celebrations.

### 3.10 Sound and haptics

- An original SFX pack of about 40 sounds (UI, puzzle, reward, fail, action) and one 60-second music loop per world.

- Defaults: sound effects on, music off, haptics on; toggles in the top bar and settings; sound auto-mutes when the device is silent where detectable.

- All audio under 400 KB total for v1.0, loaded after first interaction.

### 3.11 Share cards

- Spoiler-free result shared as text plus image: SPUZL \#84 · Crownfall · 1:12 🔥12 followed by a coloured emoji grid of moves or hints.

- Image card (1080×1920 and 1080×1080): world colour background, Spuz pose matching the result, time, streak flame, rank badge, link.

- "Full Spuzl" card when all Dailies are cleared: all 15 game icons lit up.

### 3.12 Do and don't

- **Do:** let motion explain what happened; keep the board calm while solving; reward every clear.

- **Don't:** use autoplay video, flashing above 3 Hz, fake urgency timers to sell, or animations that block input.

## 4. Gamification system

Progress in SPUZL comes from skill and consistency, never from money: XP, levels, ranks, streaks, leagues and badges are earned only by playing. Sparks (soft currency) buy cosmetics and streak freezes, never advantages in scored play.

<img src="media/image1.png" style="width:6in;height:3.21428in" alt="SPUZL core loop · 5 steps" />

SPUZL core loop · 5 steps

Every clear feeds visible progress; sharing and leagues add social pressure; the streak is the reinforcing link that brings the player back the next day.

### 4.1 XP

| Action                                     | XP                                |
|--------------------------------------------|-----------------------------------|
| Clear a Daily                              | 50 base                           |
| No-hint bonus                              | +25                               |
| Speed bonus (faster than the day's median) | +10 to +40 (scaled)               |
| Perfect (no mistakes or deaths)            | +20                               |
| First clear of a new game ever             | +100                              |
| Full Spuzl (all Dailies cleared)           | +150                              |
| Practice clear                             | 10 (cap 300 XP/day from Practice) |
| Daily quest complete                       | 30 to 80                          |
| Win a Duel                                 | 40 (loss: 10)                     |

- XP from hints-used clears is halved. Archive clears earn 50% XP.

- Anti-farming: duplicate Practice seeds earn 0 XP; server validates every award.

### 4.2 Levels

- Level n needs 100 × n^1.4 XP (rounded to 10); level 1 to 2 = 100 XP, level 10 to 11 = about 2,510 XP.

- No cap. Every level gives 20 Sparks; every 5th level unlocks a cosmetic (Spuz hat, board theme, title).

- Level shown as a number in a hex badge on the avatar, with a progress ring.

### 4.3 Ranks (long-term skill)

Rank reflects skill, using a rating (Glicko-2 style) per world, averaged into an overall rank. Each rank has 3 divisions (III, II, I).

| Rank       | Overall rating | Emblem     |
|------------|----------------|------------|
| Rookie     | below 1,000    | Pebble     |
| Thinker    | 1,000–1,199    | Spark      |
| Solver     | 1,200–1,399    | Gear       |
| Strategist | 1,400–1,599    | Compass    |
| Mastermind | 1,600–1,799    | Crown      |
| Legend     | 1,800+         | Prism Spuz |

- Rating updates after each Daily and Duel based on time and accuracy relative to all players that day.

- Rank-ups play the Level-up style celebration with the new emblem.

- Per-world ranks shown on each island.

### 4.4 Weekly leagues

- Every Monday 00:00 GMT, active players are placed in groups of 30 with similar activity.

- League points = XP earned in the week.

- Top 7 promote, bottom 5 demote, others stay.

- League ladder: Bronze Block, Silver Gear, Gold Crown, Neon Prism, Cosmic Spuz.

- Results ceremony on first open after the week ends (row fly-up animation, rewards in Sparks).

### 4.5 Streaks

- A streak day = at least one Daily cleared between 00:00 and 23:59 GMT (player's local display, GMT logic).

- Milestones: 3, 7, 14, 30, 50, 100, 365 days (badge, Sparks, flame upgrade: orange, blue, purple, prism).

- **Streak Freeze:** protects one missed day; hold up to 2; earned every 7-day streak or bought for 200 Sparks.

- **Streak Repair:** within 48 hours, restore a lost streak of 7+ days by clearing 3 Dailies (no payment).

- Reminder at 19:00 local time if no clear yet (push in v1.2; in-app banner in v1.0).

### 4.6 Sparks (soft currency)

| Earn          | Sparks         |
|---------------|----------------|
| Daily clear   | 5              |
| Full Spuzl    | 25             |
| Level up      | 20             |
| Quest         | 10–30          |
| League reward | 20–150         |
| Badge         | 10–100 by tier |

| Spend                  | Sparks                                                |
|------------------------|-------------------------------------------------------|
| Streak Freeze          | 200                                                   |
| Spuz skin / hat        | 150–800                                               |
| Board theme            | 300–1,000                                             |
| Practice hint pack (5) | 50 (hints never usable in ranked Dailies for full XP) |

No Sparks for money in v1.0. In v1.2, SPUZL+ subscribers get a 1.5× Sparks multiplier (cosmetic economy only).

### 4.7 Badges (40 at launch)

Badge families, each with bronze, silver, gold and prism tiers:

- **World Explorer:** clear every game in a world (8 badges).

- **Streak:** 7, 30, 100, 365 days.

- **Speed Demon:** beat the global median by 50% in any 10, 50, 200 Dailies.

- **Clean Hands:** no-hint clears 10, 50, 250.

- **Full Spuzl:** 1, 10, 50, 100 days.

- **Rage Survivor:** clear Gauntlet with 100, 50, 20, 5 deaths or fewer.

- **Social:** add 5 friends, beat a friend 10 times, top your school board.

- **Night Owl / Early Bird:** clears after midnight or before 6 am (local).

- **Secret badges** (6): hidden until unlocked, e.g. solving a puzzle in under 10 seconds.

### 4.8 Quests

- 3 daily quests (e.g. "Clear 2 Word Woods games", "Beat a friend's time", "Clear without hints") refresh at 00:00 GMT.

- 1 weekly quest chain of 5 steps with a bigger reward.

- Quests are always achievable in under 15 minutes total.

### 4.9 Seasons (v1.1)

- 8-week seasons with a theme (e.g. Detty December, Exam Season, Afcon fever).

- Free track: 30 tiers of rewards from XP. SPUZL+ track adds cosmetic rewards only.

- Season-limited badges and Spuz outfits.

### 4.10 Leaderboards

- Per game per day: global, country, city, school, friends.

- Ranking: fastest valid time; ties broken by fewer hints, then fewer mistakes, then earlier finish.

- All-time boards for streaks, levels and badges.

- Players under 16 appear with nickname and avatar only; schools shown only if a teacher or student verified the school code.

### 4.11 Fair play and wellbeing

- No loot boxes, no gambling mechanics, no paid advantages on leaderboards.

- Daily cap on ranked play: each Daily once (retries are Practice).

- Optional "Take a break" reminder after 45 minutes of continuous play.

## 5. Game catalogue

SPUZL ships 45 games in 8 worlds: 15 at launch (L), 8 in month 2 (M2), and the remaining 22 rolled out from month 3 at 2 to 3 per month (M3+). Games marked ★ use a LinkedIn-style mechanic with SPUZL's own name, art and rules text.

**Common rules for every game**

- One Daily per game per day, identical for all players (shared seed), resetting at 00:00 GMT.

- Daily difficulty rotates: Mon easy, Tue–Thu medium, Fri hard, Sat expert, Sun "Weekly Mega" (larger).

- Score for leaderboards = time to clear; hints and mistakes shown next to the time and used as tie-breakers.

- Every game has: 20-second animated tutorial on first open, undo (logic games), up to 3 hints, pause, sound/haptic toggles, and a results screen with share card.

- Logic puzzles must have exactly one solution, verified by a solver before publishing.

### 5.1 Logic Lab: rule grids (violet)

| \#  | Game        | How to play                                                                                                              | Controls                                          | Content                                                       | Phase |
|-----|-------------|--------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------|---------------------------------------------------------------|-------|
| 1   | Crownfall ★ | Place one crown in every row, column and colour region; crowns cannot touch, even diagonally                             | Tap cycles empty → X → crown; drag to mark many X | Generated 6×6 to 10×10                                        | L     |
| 2   | Dusk ★      | Fill the grid with suns and moons: equal counts per row and column, never 3 in a row; = and × signs force same/different | Tap cycles sun → moon → empty                     | Generated 6×6                                                 | L     |
| 3   | Sixer ★     | 6×6 sudoku: 1–6 once per row, column and 2×3 box                                                                         | Tap cell, tap number; notes mode                  | Generated                                                     | L     |
| 4   | Nine        | Classic 9×9 sudoku, 4 difficulties                                                                                       | Same as Sixer                                     | Generated                                                     | M3+   |
| 5   | Pixl        | Nonogram: row and column number clues reveal a picture                                                                   | Tap fill, long-press X, drag to paint             | Generated from hand-drawn pixel art (unique-solution checked) | M2    |
| 6   | Blackout    | Tap a tile to flip it and its 4 neighbours; turn all lights off in fewest moves                                          | Tap                                               | Generated (solvable), par moves shown                         | M2    |
| 7   | Tripwire    | Minesweeper with a fixed daily board; first tap always safe                                                              | Tap reveal, long-press flag                       | Generated, no-guess boards only                               | M3+   |

### 5.2 Line Lane: paths and lines (cyan)

| \#  | Game     | How to play                                                                                          | Controls                                   | Content              | Phase |
|-----|----------|------------------------------------------------------------------------------------------------------|--------------------------------------------|----------------------|-------|
| 8   | Weave ★  | Draw one continuous path through numbers 1, 2, 3… in order, filling every cell; walls block movement | Drag to draw, drag back to undo            | Generated 6×6 to 8×8 | L     |
| 9   | Flowline | Rotate pipe tiles so water flows from source to every tap                                            | Tap to rotate                              | Generated            | L     |
| 10  | Isles    | Connect islands with 1 or 2 bridges so each island has its number; all connected; no crossings       | Drag between islands; tap bridge to toggle | Generated            | M3+   |
| 11  | Pairup   | Join matching colour dots without lines crossing; fill the grid                                      | Drag                                       | Generated            | M2    |
| 12  | Lost     | Escape a daily maze; fog reveals as you move                                                         | Swipe or arrows                            | Generated            | M3+   |

### 5.3 Shape Shed: shapes and space (orange)

| \#  | Game    | How to play                                                                                                           | Controls                        | Content                            | Phase |
|-----|---------|-----------------------------------------------------------------------------------------------------------------------|---------------------------------|------------------------------------|-------|
| 13  | Quilt ★ | Split the grid into rectangles; each contains exactly one clue showing its area (and shape hint); no gaps or overlaps | Drag a rectangle; tap to remove | Generated (Shikaku family)         | L     |
| 14  | Snug    | Fit all given blocks exactly into the outline                                                                         | Drag, tap to rotate             | Generated                          | M2    |
| 15  | Shuffle | Slide tiles to rebuild the picture                                                                                    | Swipe or tap tile               | Generated from art library         | M3+   |
| 16  | Reflect | Complete the mirror half of a pattern across the axis                                                                 | Tap cells                       | Generated                          | M3+   |
| 17  | Squint  | Find all differences between two images                                                                               | Tap                             | Curated image pairs (original art) | M3+   |

### 5.4 Number Den: numbers (yellow)

| \#  | Game    | How to play                                                                               | Controls                     | Content                                          | Phase |
|-----|---------|-------------------------------------------------------------------------------------------|------------------------------|--------------------------------------------------|-------|
| 18  | Dead On | Use 6 numbers once each with + − × ÷ to hit a target                                      | Tap number, operator, number | Generated, solvable, scored by distance and time | L     |
| 19  | Merge   | 2048-style: merge tiles to the highest tile in 3 minutes, same seeded spawns for everyone | Swipe                        | Seeded                                           | M3+   |
| 20  | Sums    | Kakuro: fill 1–9 so runs add to clues, no repeats per run                                 | Tap cell, number pad         | Generated                                        | M2    |
| 21  | Equal   | Fill blanks so every row and column equation is true                                      | Drag digits/operators        | Generated                                        | M3+   |

### 5.5 Word Woods: words (green)

| \#  | Game      | How to play                                                                                                 | Controls                      | Content                           | Phase |
|-----|-----------|-------------------------------------------------------------------------------------------------------------|-------------------------------|-----------------------------------|-------|
| 22  | Coil ★    | Snake through a letter grid to find themed words that together use every letter                             | Drag through adjacent letters | Hand-made, tool-assisted          | L     |
| 23  | Rungs ★   | Answer 5 trivia clues, order the answers so each differs by one letter, then solve the top and bottom words | Type, drag to reorder         | Hand-written                      | L     |
| 24  | Quads     | Sort 16 words into 4 hidden groups of 4; 4 mistakes allowed                                                 | Tap 4, submit                 | Hand-written                      | L     |
| 25  | Seven     | Make words from 7 letters; centre letter required; find the "Spuzl word" using all 7                        | Tap letters                   | Generated from word list, curated | M2    |
| 26  | Minicross | 5×5 crossword                                                                                               | Type, tap to switch direction | Hand-written                      | L     |
| 27  | Buried    | Word search; leftover letters spell a secret phrase                                                         | Drag                          | Tool-assisted                     | M3+   |
| 28  | Remix     | Unscramble the day's word against the clock, 3 rounds                                                       | Tap letters                   | Curated list                      | M3+   |

### 5.6 Clue Cave: clues and knowledge (coral)

| \#  | Game      | How to play                                                                               | Controls                 | Content                    | Phase |
|-----|-----------|-------------------------------------------------------------------------------------------|--------------------------|----------------------------|-------|
| 29  | Hunch ★   | Guess the hidden category from up to 5 clues revealed one at a time; fewer clues = better | Type guess (fuzzy match) | Hand-written               | L     |
| 30  | Quickfire | 5 daily trivia questions, 15 s each (news, sport, music, Africa, science)                 | Tap answer               | Hand-written, fact-checked | M2    |
| 31  | Pinned    | See a landmark photo, drop a pin on the map; score by distance                            | Tap/drag map             | Licensed or own photos     | M3+   |
| 32  | Flagged   | 10 rapid rounds of flags, capitals, currencies                                            | Tap                      | Public data                | M3+   |

### 5.7 Reflex Rink: memory and reflex (blue)

| \#  | Game   | How to play                                                           | Controls | Content        | Phase |
|-----|--------|-----------------------------------------------------------------------|----------|----------------|-------|
| 33  | Echo   | Repeat a growing sequence of colours and sounds                       | Tap pads | Seeded         | L     |
| 34  | Twins  | Flip cards to find all pairs in fewest flips                          | Tap      | Seeded         | M2    |
| 35  | Flinch | Tap the instant the screen changes; best of 5, false starts penalised | Tap      | Seeded timings | M3+   |

### 5.8 Rage Ridge: action and rage (red)

Action games run on Phaser 3, use hand-designed levels, and score by deaths then time. Each has a daily course of 3 to 10 short levels.

| \#  | Game     | How to play                                                                        | Controls                        | Content                              | Phase |
|-----|----------|------------------------------------------------------------------------------------|---------------------------------|--------------------------------------|-------|
| 36  | Gotcha   | Troll platformer: floors drop, spikes appear, the exit runs away; learn the tricks | Left/right/jump (buttons, keys) | Hand-designed levels + trap scripts  | L     |
| 37  | Dash     | Auto-runner; tap to jump; daily course                                             | Tap / space                     | Hand-designed segments, seeded order | L     |
| 38  | Flipside | Flip gravity to run on floor or ceiling                                            | Tap                             | Hand-designed                        | M3+   |
| 39  | Ricochet | Bounce between walls, dodge spikes, speed rises                                    | Tap                             | Seeded                               | M3+   |
| 40  | Stacked  | Drop sliding blocks; overhangs are cut; build highest                              | Tap                             | Seeded speeds                        | M3+   |
| 41  | Wobble   | Keep a tightrope walker balanced to the end                                        | Tap left/right                  | Seeded wind                          | M3+   |
| 42  | Grapple  | Swing hook to hook across gaps                                                     | Hold and release                | Hand-designed                        | M3+   |
| 43  | Ghosted  | Race your friend's best-run ghost on today's track                                 | Left/right/jump                 | Hand-designed                        | M3+   |
| 44  | Slip     | Climb a tower with clumsy physics controls                                         | Drag to swing                   | Hand-designed                        | M3+   |
| 45  | Gauntlet | 10 tiny troll levels in a row, same for everyone; fewest deaths wins               | Left/right/jump                 | Hand-designed, new weekly            | M3+   |

### 5.9 Launch line-up summary

- **Launch (15):** Crownfall, Dusk, Sixer, Weave, Flowline, Quilt, Dead On, Coil, Rungs, Quads, Minicross, Hunch, Echo, Gotcha, Dash.

- **Month 2 (8):** Pixl, Blackout, Pairup, Snug, Sums, Seven, Quickfire, Twins.

- **Month 3+ (22):** Nine, Tripwire, Isles, Lost, Shuffle, Reflect, Squint, Merge, Equal, Buried, Remix, Pinned, Flagged, Flinch, Flipside, Ricochet, Stacked, Wobble, Grapple, Ghosted, Slip, Gauntlet.

## 6. Play modes

The Daily is the heart of SPUZL; every other mode feeds practice, competition or catch-up around it.

| Mode            | What it is                                                                        | Ranked?          | Rewards                                       | Phase                      |
|-----------------|-----------------------------------------------------------------------------------|------------------|-----------------------------------------------|----------------------------|
| Daily           | One puzzle per game per day, same for everyone, one ranked attempt                | Yes              | Full XP, Sparks, rating, leaderboards, streak | v1.0                       |
| Practice        | Unlimited generated puzzles per game, any difficulty                              | No               | 10 XP each, capped at 300 XP/day              | v1.0                       |
| Archive         | Replay past Dailies; last 7 days free, older with SPUZL+                          | No               | 50% XP, no rating                             | v1.0 (7 days), v1.2 (full) |
| Full Spuzl run  | Guided queue that plays all of today's Dailies in a row with a running total time | Yes (each Daily) | +150 XP, card                                 | v1.0                       |
| Duel            | Live 1v1: both players get the same new puzzle; first to clear wins; best of 3    | Duel rating      | 40 XP win, 10 XP loss                         | v1.1                       |
| Async challenge | Send a friend a link to beat your time on a specific puzzle                       | No               | Bragging rights, badge progress               | v1.0                       |
| Speed Run       | 3 random games back to back; total time                                           | Separate board   | XP by placing                                 | v1.1                       |
| Weekly Mega     | One large, hard puzzle every Sunday, open 7 days                                  | Weekly board     | Large XP, badge                               | v1.1                       |
| School Cup      | Teacher-run weekly competition for a verified school on chosen games              | School board     | Badge, Sparks                                 | v1.2                       |

**Rules shared by all modes**

- A Daily can be paused and resumed on the same device within the day; timer stops while the app is hidden.

- Abandoning a Duel counts as a loss; reconnect window 20 seconds.

- Practice and Archive never affect leaderboards, ratings or streaks.

## 7. Functional requirements

All "Must" items are required for the v1.0 launch. Each ID maps to tickets and tests.

### 7.1 Accounts and identity (AC)

| ID       | Requirement                                                                                                    | Priority |
|----------|----------------------------------------------------------------------------------------------------------------|----------|
| FR-AC-01 | Players can play immediately as guests; an anonymous session is created on first clear.                        | Must     |
| FR-AC-02 | First open asks only for age band (13–15, 16–17, 18+); under 13 cannot continue.                               | Must     |
| FR-AC-03 | Guests choose a nickname (3–16 chars, filtered) and a Spuz colour as avatar.                                   | Must     |
| FR-AC-04 | Optional account (Google, Apple, email magic link, or username + password) merges guest progress without loss. | Must     |
| FR-AC-05 | Players can export and delete all their data from settings.                                                    | Must     |
| FR-AC-06 | Players can link to a school using a school code (verified by a teacher account).                              | Should   |

### 7.2 Home and world map (HM)

| ID       | Requirement                                                                                                                                     | Priority |
|----------|-------------------------------------------------------------------------------------------------------------------------------------------------|----------|
| FR-HM-01 | Home shows the animated world map with 8 islands, Spuz, streak flame, level ring, Sparks and today's progress (x of 15).                        | Must     |
| FR-HM-02 | Tapping an island zooms into that world (shared-element transition) and lists its games with today's status (new, in progress, cleared + time). | Must     |
| FR-HM-03 | A "Play next" button always starts the next uncleared Daily.                                                                                    | Must     |
| FR-HM-04 | Locked or coming-soon games show a teaser card with release date.                                                                               | Should   |
| FR-HM-05 | A list view toggle shows all games as a grid for faster access.                                                                                 | Must     |

### 7.3 Gameplay core (GP)

| ID       | Requirement                                                                                           | Priority |
|----------|-------------------------------------------------------------------------------------------------------|----------|
| FR-GP-01 | Every game loads its Daily from the server by date and game; puzzle data is the same for all players. | Must     |
| FR-GP-02 | Timer starts on first interaction, pauses when hidden, and is validated server-side.                  | Must     |
| FR-GP-03 | Logic games support undo, redo, reset, notes where relevant, and up to 3 hints.                       | Must     |
| FR-GP-04 | Rule violations are highlighted instantly with motion and colour plus an icon (never colour alone).   | Must     |
| FR-GP-05 | Progress auto-saves locally every move and to the server every 10 seconds.                            | Must     |
| FR-GP-06 | Each game has an interactive 20-second tutorial on first play, replayable from the help button.       | Must     |
| FR-GP-07 | Action games support touch buttons, keyboard and gamepad (Gamepad API).                               | Should   |
| FR-GP-08 | Clear is verified by the server (solution check or replay validation) before rewards are granted.     | Must     |

### 7.4 Results and sharing (RS)

| ID       | Requirement                                                                                                         | Priority |
|----------|---------------------------------------------------------------------------------------------------------------------|----------|
| FR-RS-01 | Results screen shows time, hints, mistakes/deaths, percentile vs. today's players, XP and Sparks earned (animated). | Must     |
| FR-RS-02 | Shows friend comparison and "beat my time" challenge link.                                                          | Must     |
| FR-RS-03 | Generates spoiler-free text share and image card (9:16 and 1:1).                                                    | Must     |
| FR-RS-04 | Native share sheet with WhatsApp, Instagram, X, TikTok, copy; download fallback.                                    | Must     |

### 7.5 Progression (PG)

| ID       | Requirement                                                                                       | Priority     |
|----------|---------------------------------------------------------------------------------------------------|--------------|
| FR-PG-01 | XP, levels, ranks, streaks, Sparks, badges and quests work as defined in Section 4.               | Must         |
| FR-PG-02 | All rewards are calculated server-side; client shows them with animation after confirmation.      | Must         |
| FR-PG-03 | Profile shows level, rank per world, streak, badges, stats per game (best time, average, clears). | Must         |
| FR-PG-04 | Weekly leagues with promotion and demotion.                                                       | Must         |
| FR-PG-05 | Seasons and season pass.                                                                          | Could (v1.1) |

### 7.6 Social (SO)

| ID       | Requirement                                                                      | Priority |
|----------|----------------------------------------------------------------------------------|----------|
| FR-SO-01 | Add friends by invite link, QR, or username.                                     | Must     |
| FR-SO-02 | Friends leaderboard per game per day and overall.                                | Must     |
| FR-SO-03 | Friend activity feed ("Ama cleared Crownfall in 0:58"), privacy setting to hide. | Should   |
| FR-SO-04 | No free-text chat; only preset reactions (🔥, 😂, GG) on friend results.         | Must     |
| FR-SO-05 | Block and report players.                                                        | Must     |

### 7.7 Notifications (NT)

| ID       | Requirement                                                                            | Priority      |
|----------|----------------------------------------------------------------------------------------|---------------|
| FR-NT-01 | In-app banners for streak at risk, new games, league results.                          | Must          |
| FR-NT-02 | Web push (opt-in) for daily reminder at chosen time, max 1 per day plus league result. | Should (v1.2) |

### 7.8 Settings and accessibility (ST)

| ID       | Requirement                                                                                                  | Priority |
|----------|--------------------------------------------------------------------------------------------------------------|----------|
| FR-ST-01 | Theme (dark default, light, system), sound, music, haptics, reduced motion, colour-blind palettes (3 modes). | Must     |
| FR-ST-02 | Font size scale (100–130%).                                                                                  | Should   |
| FR-ST-03 | Low-data mode: no music, lighter animations, smaller images.                                                 | Must     |

### 7.9 Admin and live-ops (AD)

| ID       | Requirement                                                                      | Priority |
|----------|----------------------------------------------------------------------------------|----------|
| FR-AD-01 | Admin console at /admin with roles (owner, content editor, moderator, analyst).  | Must     |
| FR-AD-02 | Schedule Dailies per game per date; preview, solve-check and lock 7+ days ahead. | Must     |
| FR-AD-03 | Write and review word and trivia content with a two-person approval flow.        | Must     |
| FR-AD-04 | Manage badges, quests, seasons, cosmetics and Sparks prices.                     | Must     |
| FR-AD-05 | Moderate nicknames and reports; ban or reset players; review flagged scores.     | Must     |
| FR-AD-06 | Dashboard: DAU, clears per game, retention, streak distribution, crash rate.     | Should   |
| FR-AD-07 | Feature flags and emergency "Daily swap" if a puzzle is broken.                  | Must     |
| FR-AD-08 | Audit log of every admin action.                                                 | Must     |

## 8. UX: screens, flows and accessibility

A new player must be inside their first puzzle within 20 seconds of opening SPUZL, with no signup, and must feel rewarded within the first 2 minutes.

### 8.1 First-run flow

1.  Logo animation (2.2 s, skippable) with Spuz waving.

2.  Age band picker (3 big buttons) and a one-line privacy note.

3.  Spuz says "Let's warm up" and opens an easy Crownfall tutorial puzzle.

4.  Clear celebration, first XP and badge ("First Clear"), level 1 → 2 animation.

5.  Nickname and Spuz colour picker, then the world map with today's 15 Dailies.

6.  Soft prompt to save progress (account) after the 3rd clear or day 2, never before.

### 8.2 Screen inventory

| \#  | Screen                              | Key elements                                                               | States                                                      |
|-----|-------------------------------------|----------------------------------------------------------------------------|-------------------------------------------------------------|
| 1   | Splash / logo                       | Animated wordmark, Spuz                                                    | First run, returning                                        |
| 2   | Onboarding                          | Age band, tutorial puzzle, nickname, avatar                                | Under-13 block                                              |
| 3   | Home: world map                     | 8 islands, Spuz, streak, level ring, Sparks, "Play next", today's progress | Morning, evening (streak at risk), all cleared (Full Spuzl) |
| 4   | World view                          | Game tiles with status and times, world rank                               | New, in progress, cleared, coming soon                      |
| 5   | Game screen                         | Top bar (back, timer, hints, help, sound), board, controls                 | Tutorial, playing, paused, offline, error                   |
| 6   | Results                             | Time, percentile, XP/Sparks animation, friends, share, next game           | New best, first clear, hint-used                            |
| 7   | Level-up / rank-up / badge overlays | Full-screen celebration, skippable                                         | Reduced-motion variant                                      |
| 8   | Leaderboards                        | Tabs: friends, school, city, country, global; per game, per day            | Empty, loading, you in list                                 |
| 9   | League                              | 30-player table, countdown, promotion/demotion zones                       | Week end ceremony                                           |
| 10  | Profile                             | Avatar, level, ranks per world, streak calendar, badges, stats             | Own, friend (public subset)                                 |
| 11  | Badges                              | Grid by family with tiers and progress                                     | Locked, secret                                              |
| 12  | Quests                              | 3 daily, weekly chain, timers                                              | Claimable                                                   |
| 13  | Shop (Sparks)                       | Spuz skins, board themes, freezes                                          | Not enough Sparks                                           |
| 14  | Friends                             | Invite link, QR, requests, list, challenges                                | Empty                                                       |
| 15  | Settings                            | Theme, sound, motion, colour-blind, data, account, privacy                 | —                                                           |
| 16  | Practice and Archive                | Game picker, difficulty, past dates                                        | Locked older dates                                          |
| 17  | Duel lobby (v1.1)                   | Matchmaking, opponent card, countdown                                      | Searching, found, timeout                                   |
| 18  | Static pages                        | How to play, Privacy, Terms, Fair play, Contact                            | —                                                           |
| 19  | Admin (/admin)                      | Content calendar, editors, moderation, dashboards                          | —                                                           |

### 8.3 Layout and navigation

- Bottom tab bar (mobile): Play (map), Leagues, Profile, Shop. Friends and settings from the top bar.

- Desktop: left rail navigation; game board centred at max 560 px; side panel for leaderboard.

- Game screens hide the tab bar; one-thumb reach for all controls; board never covered by overlays while playing.

### 8.4 Accessibility (WCAG 2.2 AA)

- Contrast AA in both themes; colour-blind modes swap world and state colours and add patterns/icons.

- Every logic game fully playable by keyboard (arrow keys + Space/Enter) and screen reader with cell announcements ("Row 3, column 4, crown, conflicts with row 3, column 6").

- Touch targets at least 44 × 44 px; cells scale with board size, minimum 36 px with zoom.

- Reduced motion respected everywhere (Section 3.9); no flashing above 3 Hz; Flinch and action games show a photosensitivity notice.

- Timers can be hidden ("Relaxed mode": still ranked by clear, time hidden from player until results).

## 9. Content and puzzle generation pipeline

About 30 of the 45 games are generated by code, so SPUZL never runs out; the rest (words, trivia, action levels) need human-made content on a schedule at least 14 days ahead.

### 9.1 Generated puzzles

1.  **Generator** (TypeScript, one module per game) creates a candidate from a seed and difficulty.

2.  **Solver** proves there is exactly one solution (logic games) or that it is solvable (Blackout, Dead On, Merge seeds).

3.  **Grader** scores difficulty from the solving techniques required (e.g. Crownfall: forced cells, region pairs, contradiction depth) and from playtest time data once live.

4.  **Library:** accepted puzzles stored with seed, difficulty score and solution hash; 365+ per game prepared before launch.

5.  **Scheduler** assigns Dailies per date following the weekly difficulty curve; admin can preview and swap.

Generators run as offline scripts (GitHub Actions, weekly) and write to the database; nothing heavy runs on page load.

### 9.2 Human-made content

| Game                     | Content per day      | Who writes                    | Review                       |
|--------------------------|----------------------|-------------------------------|------------------------------|
| Coil                     | 1 themed grid        | Content editor + tool         | Second editor                |
| Rungs                    | 7 words + clues      | Writer                        | Fact-check + editor          |
| Quads                    | 16 words, 4 groups   | Writer                        | Playtest by 2 people         |
| Minicross                | 5×5 grid + clues     | Writer (tool-assisted fill)   | Editor                       |
| Hunch                    | 1 category + 5 clues | Writer                        | Editor                       |
| Quickfire                | 5 questions          | Writer                        | Fact-check with source link  |
| Squint, Pinned, Pixl art | Images               | Illustrator / licensed photos | Licence check                |
| Rage Ridge               | Levels               | Level designer                | Playtest, death-count target |

- Content style guide: global-first with about 20% African and Ghanaian references; no politics, religion insults, adult themes or brand trademarks in answers.

- Word lists: open-licence English lists (e.g. SCOWL/ENABLE-derived) with an offensive-word filter and a curated "answer" list.

- Buffer: at least 14 days of approved content per game at all times; admin alerts below 7 days.

### 9.3 Action level design

- Levels built in a JSON level format (tiles, traps, triggers, timings) with an in-house editor (admin only in v1.0, public in v1.3).

- Each level has target metrics from playtests: median deaths 3–15 for Gotcha, completion rate 40–80%.

- Troll traps must be fair on second attempt: always telegraphed after the first death (no unavoidable deaths).

## 10. Architecture and tech stack

SPUZL reuses SPIL's proven free-tier stack: one React/Next.js app on Vercel, Supabase for data, auth and realtime, and Phaser only inside action-game routes. All scoring and rewards are decided on the server.

<img src="media/image2.png" style="width:6in;height:3.84821in" alt="SPUZL system architecture · Vercel + Supabase" />

SPUZL system architecture · Vercel + Supabase

Puzzles are generated offline by GitHub Actions and stored in Postgres; players fetch the day's puzzle through the API and submit clears for server verification; realtime is only used for duels and friend activity.

### 10.1 Stack

| Layer           | Choice                                                               | Notes                                                               |
|-----------------|----------------------------------------------------------------------|---------------------------------------------------------------------|
| UI framework    | React 19 + Next.js (App Router), TypeScript strict                   | Server components for map, lists, profile; client islands for games |
| Styling         | Tailwind CSS v4 + CSS variable tokens                                | Dark default, light, colour-blind palettes                          |
| UI primitives   | Radix UI                                                             | Dialogs, sheets, tabs, toggles                                      |
| Animation       | Motion (motion/react), Rive (mascot, badges), CSS keyframes          | Built and reviewed with emilkowalski/skill                          |
| Game engine     | Phaser 3 for Rage Ridge; canvas/SVG + React for logic and word games | Lazy-loaded per game                                                |
| Audio           | Howler.js (or Web Audio wrapper)                                     | Sprite sheet of SFX                                                 |
| State           | TanStack Query (server), Zustand (game state, undo stacks)           |                                                                     |
| Validation      | Zod                                                                  | Shared client/server                                                |
| Backend         | Supabase: Postgres, Auth, Realtime, Storage                          | RLS on every table                                                  |
| Images          | @vercel/og for share cards                                           |                                                                     |
| PWA             | Next PWA manifest + service worker (Serwist)                         | Offline shell, cached puzzles for today                             |
| Monitoring      | Sentry, PostHog, Vercel Analytics                                    | Free tiers                                                          |
| Bot protection  | Cloudflare Turnstile                                                 | On account creation and high-value endpoints                        |
| Payments (v1.2) | Paystack (GHS, NGN, mobile money), Stripe                            |                                                                     |
| Testing         | Vitest, Playwright, pgTAP                                            |                                                                     |

### 10.2 Key design decisions

- **Server-authoritative rewards:** the client sends moves or a final board plus timing events; the server re-checks the solution, validates time against move timestamps, then grants XP, Sparks and rating.

- **Deterministic puzzles:** each Daily is stored, not generated on the fly, so every player gets exactly the same puzzle.

- **Offline-friendly:** today's Dailies are prefetched; clears made offline are queued and submitted when back online (still ranked if timestamps validate).

- **Code-split per game:** each game is its own dynamic import; the world map loads under 150 KB of JS.

- **Daily rollover:** a cron at 00:00 GMT closes the day, finalises leaderboards, updates ratings and streaks, and opens the next Dailies.

### 10.3 Hosting

- Vercel project and domain to be confirmed (proposal: **spuzl.vercel.app**, later a custom domain such as spuzl.app or playspuzl.com).

- Supabase: two projects (production and preview) on the Free plan, with a keep-alive ping; upgrade to Pro before monetisation or above roughly 10k daily players.

## 11. Data model

Core Postgres tables (UUID keys, timestamps in UTC). Every table has Row Level Security; players read only their own private data and public leaderboard views.

| Table                            | Key fields                                                                                                                                                                               | Purpose                         |
|----------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------|
| players                          | id, auth_user_id, nickname, age_band, avatar (colour, skin, hat), country, city, school_id, level, xp, sparks, created_at                                                                | Profile and wallet              |
| worlds                           | id (logic_lab, line_lane…), name, colour, sort                                                                                                                                           | 8 worlds                        |
| games                            | id (crownfall…), world_id, name, status (live, coming_soon, hidden), phase, engine (grid, word, phaser), min_version                                                                     | 45 games                        |
| puzzles                          | id, game_id, seed, difficulty, data (jsonb), solution_hash, source (generated, human), status (draft, approved, scheduled)                                                               | Puzzle library                  |
| dailies                          | date, game_id, puzzle_id, published_at                                                                                                                                                   | Schedule (unique date + game)   |
| attempts                         | id, player_id, daily_date, game_id, mode, started_at, finished_at, time_ms, hints, mistakes, deaths, moves (jsonb, compressed), status (in_progress, cleared, failed, flagged), verified | Every play                      |
| daily_results                    | date, game_id, player_id, time_ms, rank_global, percentile                                                                                                                               | Materialised per day for boards |
| ratings                          | player_id, world_id, rating, deviation, volatility, updated_at                                                                                                                           | Glicko-2 per world              |
| streaks                          | player_id, current, best, last_clear_date, freezes_held                                                                                                                                  | Streak state                    |
| xp_ledger                        | id, player_id, source, amount, ref_id, created_at                                                                                                                                        | Append-only XP history          |
| sparks_ledger                    | id, player_id, source, amount, ref_id, created_at                                                                                                                                        | Append-only currency history    |
| badges / player_badges           | badge id, family, tier, rule (jsonb) / player_id, badge_id, earned_at                                                                                                                    | Achievements                    |
| quests / player_quests           | id, type, goal (jsonb), reward / player_id, quest_id, progress, claimed_at                                                                                                               | Daily and weekly quests         |
| leagues / league_members         | id, tier, week_start / league_id, player_id, points, result                                                                                                                              | Weekly leagues                  |
| friendships                      | player_id, friend_id, status, created_at                                                                                                                                                 | Friends                         |
| schools                          | id, name, city, country, code, verified_by                                                                                                                                               | School boards                   |
| cosmetics / inventory            | id, type, price_sparks, rarity / player_id, cosmetic_id, equipped                                                                                                                        | Shop                            |
| duels (v1.1)                     | id, puzzle_ids, player_a, player_b, status, winner                                                                                                                                       | Live 1v1                        |
| reports                          | id, reporter_id, target_type, target_id, reason, status                                                                                                                                  | Moderation                      |
| content_items                    | id, game_id, payload (jsonb), author_id, reviewer_id, status                                                                                                                             | Human-written content           |
| feature_flags, audit_log, admins | standard                                                                                                                                                                                 | Ops                             |

- Leaderboard views are public but expose only nickname, avatar, country, school (if allowed) and time.

- Ledgers are append-only; balances are derived and cached on players.

- Moves are stored compressed for replay verification and anti-cheat; deleted after 90 days except for flagged attempts.

## 12. API, realtime duels and anti-cheat

All writes go through versioned route handlers under /api/v1, validated with Zod and rate-limited; reads that RLS allows can go directly to Supabase.

### 12.1 Main endpoints

| Method   | Path                                 | Purpose                                                            |
|----------|--------------------------------------|--------------------------------------------------------------------|
| GET      | /today                               | Today's Dailies for all live games, player status per game         |
| GET      | /games/:id/daily?date=               | Puzzle data (no solution) for a date                               |
| POST     | /attempts                            | Start an attempt (returns attempt id, server start time)           |
| PATCH    | /attempts/:id                        | Autosave moves (every 10 s or on pause)                            |
| POST     | /attempts/:id/finish                 | Submit final state + move log; server verifies and returns rewards |
| POST     | /attempts/:id/hint                   | Request a hint (server returns one safe deduction)                 |
| GET      | /leaderboards/:game?date=&scope=     | Friends, school, city, country, global                             |
| GET      | /me                                  | Profile, level, streak, wallet, ranks                              |
| GET/POST | /quests, /quests/:id/claim           | Quests                                                             |
| GET      | /leagues/current                     | League table                                                       |
| POST     | /friends/invite, /friends/:id/accept | Social                                                             |
| POST     | /shop/buy                            | Spend Sparks                                                       |
| GET      | /practice/:game?difficulty=          | Fresh practice puzzle                                              |
| POST     | /reports                             | Report a player or content                                         |
| \*       | /admin/\*                            | Admin APIs (role-checked)                                          |

### 12.2 Realtime (v1.1 duels)

- Private Supabase Realtime channel per duel; both players receive the same puzzle at a server-set start time with a 3-2-1 countdown.

- Progress signals (percent complete) are broadcast every 2 seconds; the server confirms the first verified clear as winner.

- Matchmaking queue by duel rating and region; bot fallback after 20 seconds (clearly labelled "Practice bot").

### 12.3 Anti-cheat and fair play

- Solutions never sent to the client before a clear; hints are computed server-side one step at a time.

- Times validated against server start/finish and move timestamps; impossible solve speeds (below per-game human floor) are flagged, not ranked.

- Move logs replayed server-side for top-100 global results and all flagged attempts.

- Rate limits: 1 ranked attempt per game per day; 60 practice puzzles/hour; account creation protected by Turnstile.

- Action games: client sends input log + seed; server re-simulates key levels (deterministic physics step) for top results.

- Flagged results hidden from boards until a moderator clears them; repeat offenders lose ranking access.

## 13. Monetisation

v1.0 is free with no ads, to build the habit. From v1.2, revenue comes from an optional subscription and cosmetics; nothing paid ever improves a ranked score.

| Stream                  | What players get                                                                                             | Indicative price                                   | Phase           |
|-------------------------|--------------------------------------------------------------------------------------------------------------|----------------------------------------------------|-----------------|
| SPUZL+ subscription     | Full Archive, unlimited Practice hints, season pass premium track, 1.5× Sparks, exclusive Spuz skins, no ads | GHS 25 / NGN 2,000 / \$2.99 per month; yearly −40% | v1.2            |
| Cosmetic packs          | Spuz outfits, board themes, card frames                                                                      | GHS 10–40                                          | v1.2            |
| Light ads               | One optional rewarded ad for 1 extra Practice hint or 20 Sparks; never in Dailies, never for under-16s       | Ad network revenue                                 | v1.3 (optional) |
| School and club plans   | Private leagues, teacher dashboard, weekly class challenge                                                   | Per school per term                                | v1.3            |
| Sponsored worlds/events | Branded seasonal event (e.g. exam season quiz) with original content                                         | Negotiated                                         | Later           |

- Payments through Paystack (mobile money and cards) for GHS/NGN; Stripe for other currencies.

- Prices shown in local currency; refunds through support within 14 days.

- Under-18s see a parent notice on purchase screens; no purchase prompts during gameplay.

## 14. Non-functional requirements

SPUZL must feel instant and smooth on a budget Android phone over 3G; every target below is measured in CI or monitoring.

| ID          | Area            | Requirement                                                                                           | Measured by                                      |
|-------------|-----------------|-------------------------------------------------------------------------------------------------------|--------------------------------------------------|
| NFR-PF-01   | Performance     | World map: LCP under 2.5 s, INP under 200 ms, CLS under 0.1 (Moto G class, Fast 3G)                   | Lighthouse CI, Speed Insights                    |
| NFR-PF-02   | Performance     | Game opens (tap tile to playable board) under 1.5 s on 4G, 3 s on 3G with prefetch                    | Playwright timing                                |
| NFR-PF-03   | Performance     | Input to visual feedback under 50 ms in all logic games                                               | Performance traces                               |
| NFR-PF-04   | Performance     | 60 fps for all UI animation and action games on baseline device; no long tasks over 50 ms during play | Chrome trace, animation-performance skill review |
| NFR-PF-05   | Size            | Initial JS under 150 KB gz for map; per-game chunk under 80 KB (Phaser games under 450 KB lazy)       | Bundle budget in CI                              |
| NFR-SC-01   | Scale           | 10,000 daily players on free tiers; 100,000 after plan upgrades with no code changes                  | k6 load test                                     |
| NFR-AV-01   | Availability    | 99.5% monthly; Dailies playable offline once prefetched                                               | Uptime monitor                                   |
| NFR-RL-01   | Reliability     | Daily rollover completes within 5 minutes after 00:00 GMT with zero missing Dailies                   | Cron monitor, alert                              |
| NFR-CO-01   | Correctness     | 100% of scheduled logic Dailies have exactly one solution                                             | Solver check in CI                               |
| NFR-AC-01   | Accessibility   | WCAG 2.2 AA; full keyboard and screen-reader play for logic and word games                            | axe + manual audit                               |
| NFR-MO-01   | Motion quality  | Every animation passes review-animations from emilkowalski/skill before merge                         | PR checklist                                     |
| NFR-DA-01   | Data use        | Under 2 MB to play all 15 Dailies after first load; low-data mode under 1 MB                          | Network logs                                     |
| NFR-MA-01   | Maintainability | TypeScript strict; 90% unit coverage on generators, solvers, scoring and rewards                      | CI coverage                                      |
| NFR-CS-01   | Cost            | \$0/month hosting until revenue; alerts at 80% of any free quota                                      | Weekly review                                    |
| NFR-I18N-01 | Localisation    | All copy in translation files; French and Pidgin-ready                                                | Code review                                      |

## 15. Security, privacy, safety and legal

SPUZL serves players from age 13, so it collects the minimum data, has no open chat, and treats under-18 accounts with extra care.

### 15.1 Security

- RLS on every table, tested with pgTAP; service-role key only on the server.

- Zod validation and rate limits on every endpoint; Turnstile on sign-up and high-value actions.

- Strict CSP, HSTS, X-Frame-Options DENY, secure cookies; dependency scanning (Dependabot) and secret scanning in CI.

- Admin accounts require email + password + TOTP 2FA; every admin action audited.

### 15.2 Privacy

| Data                            | Purpose                  | Retention                  |
|---------------------------------|--------------------------|----------------------------|
| Age band (not birthdate)        | Content and safety rules | Account lifetime           |
| Nickname, avatar                | Profile, boards          | Account lifetime           |
| Email (optional)                | Login, recovery          | Account lifetime           |
| City, country (from IP, coarse) | Local boards             | Account lifetime, editable |
| School (optional, verified)     | School boards            | Until removed              |
| Attempts and move logs          | Scores, anti-cheat       | Logs 90 days; results kept |
| Analytics events                | Product improvement      | Anonymous, 12 months       |

- Guests can delete everything with one tap; accounts can export (JSON) and delete within 30 days.

- Under-16s: no city on public boards, friend requests only via invite link/QR, push off by default.

- Cookie/analytics consent where required; no third-party ad tracking in v1.x.

### 15.3 Safety

- No free text between players; preset reactions only.

- Nickname filter (multi-language profanity list) plus report and moderation queue (24-hour SLA).

- Content guidelines forbid sexual, hateful, political or violent material; trivia avoids sensitive tragedies.

- Photosensitivity warnings on Flinch and action games; "Take a break" reminder.

### 15.4 Legal and IP

- Game mechanics (Star Battle, Binairo, Numberlink, Shikaku, sudoku, nonograms, etc.) are classic puzzle types; SPUZL uses its own names, art, rules text and layouts and must not copy LinkedIn's or NYT's names, graphics or puzzles.

- Run trademark searches for SPUZL (WIPO, USPTO, Ghana Registrar-General) before launch; note nearby marks "Puzl" and "Puzld" (puzzle apps) and decide on stylisation to stay distinct.

- Privacy Policy and Terms compliant with Ghana Act 843, Nigeria NDPA 2023 and GDPR basics; lawyer review before launch.

- Licences tracked for word lists, fonts (OFL), sounds and photos.

## 16. Analytics and KPIs

The north-star metric is **Daily clears per day**: it captures habit (players returning), breadth (games played) and quality (puzzles finished).

| KPI                      | Definition                               | Target (month 3)                |
|--------------------------|------------------------------------------|---------------------------------|
| Daily clears             | Verified Daily clears per day            | 25,000                          |
| DAU / MAU                | Stickiness                               | 30%+                            |
| D1 / D7 / D30 retention  | Players returning                        | 45% / 25% / 12%                 |
| Clears per active player | Average Dailies cleared per day          | 3+                              |
| Full Spuzl rate          | Players clearing all Dailies             | 5%+ of DAU                      |
| Streak 7+ share          | Active players with 7+ day streak        | 20%+                            |
| Share rate               | Clears that are shared                   | 20%                             |
| Tutorial completion      | First-run players who clear the tutorial | 85%+                            |
| Game health              | Per-game abandon rate                    | Under 25% (flag any game above) |
| Crash-free sessions      | Sentry                                   | 99.5%+                          |

**Key events:** app_open, onboarding_step, game_open, attempt_start, hint_used, mistake, death, attempt_clear, attempt_abandon, results_view, share, level_up, rank_up, badge_unlock, streak_change, league_result, quest_claim, shop_view, purchase, friend_add, challenge_sent.

**Dashboards:** first-run funnel, per-game difficulty (median time, abandon, hint rate), retention cohorts, streak distribution, league health, animation performance (dropped frames per screen).

## 17. Testing and QA

Every puzzle that reaches players must be provably correct, and every game must feel right on a budget phone; QA owns both the automated gates and real-device playtests.

| Level             | Tool                                          | What is covered                                                                                                                             | Gate                            |
|-------------------|-----------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------|
| Unit              | Vitest                                        | Generators, solvers, graders, scoring, XP/Sparks/rating maths, streak and league rules                                                      | 90% coverage on these modules   |
| Puzzle validation | Custom CLI                                    | Every scheduled Daily: unique solution, difficulty in band, solution hash matches                                                           | 100% pass before scheduling     |
| Component         | Testing Library                               | Boards, controls, overlays, accessibility labels                                                                                            | All pass                        |
| API integration   | Vitest + local Supabase                       | Every endpoint, reward idempotency, rate limits, anti-cheat flags                                                                           | All pass                        |
| Database          | pgTAP                                         | RLS policies, ledgers append-only, rollover function                                                                                        | All pass                        |
| E2E               | Playwright (mobile + desktop)                 | First run, play and clear each launch game with a scripted solution, share, friends, league week rollover (time-travel), offline clear sync | Smoke on every PR, full nightly |
| Visual            | Playwright screenshots                        | Every screen, both themes, colour-blind modes                                                                                               | No unreviewed diffs             |
| Motion            | emilkowalski/skill review-animations + manual | Curves, durations, interruptibility, reduced motion                                                                                         | Reviewer sign-off               |
| Performance       | Lighthouse CI, Chrome traces, k6              | Budgets in Section 14                                                                                                                       | Budgets met                     |
| Accessibility     | axe + screen-reader runs                      | WCAG 2.2 AA                                                                                                                                 | Zero serious issues             |
| Edge data         | emilkowalski/skill break-ui                   | Long nicknames, huge streaks, empty boards, 0 friends                                                                                       | No broken layouts               |
| Playtests         | 20 players aged 13–35 per new game            | Fun, clarity, difficulty curve, troll fairness                                                                                              | Median rating 4/5+              |

**Release blockers:** wrong or multiple-solution Daily, lost progress, wrong rewards, data leak, rollover failure, crash rate above 1%.

## 18. Team roles and DevOps

SPUZL needs a product owner, design, engineering, content and QA from day one; in a small team, one person can hold several roles, but every responsibility below needs a named owner.

### 18.1 Roles

| Role                      | Owns                         | Key tasks                                                           |
|---------------------------|------------------------------|---------------------------------------------------------------------|
| Product Owner (WISDOMSKA) | Vision, priorities, live-ops | Backlog, release sign-off, KPI review, season themes                |
| Game Designer             | Rules and fun                | Game rules, difficulty curves, XP/economy tuning, playtests         |
| UI/UX + Motion Designer   | Look and feel                | Figma, design tokens, mascot states, motion specs, world map        |
| Illustrator / Animator    | Brand assets                 | Spuz in Rive, game icons, badges, world art, share cards            |
| Sound Designer (contract) | Audio                        | SFX pack, world loops                                               |
| Frontend Engineer(s)      | App and games                | React screens, game boards, Phaser games, animation, PWA            |
| Backend Engineer          | Data and rules               | Supabase schema, RLS, API, rewards, rollover, anti-cheat            |
| Puzzle Engineer           | Generators                   | Generators, solvers, graders, validation CLI                        |
| Content Editor(s)         | Words and trivia             | Writing, fact-checking, scheduling 14+ days ahead                   |
| QA Engineer               | Quality                      | Automation, device lab, playtests, release QA                       |
| Community / Growth        | Players                      | TikTok/IG, school ambassadors, Discord/WhatsApp community, feedback |
| Moderator (part-time)     | Safety                       | Reports, nicknames, flagged scores                                  |

### 18.2 DevOps

- GitHub repo with main (production) and preview (staging), protected branches, PR reviews, Conventional Commits; all authorship WISDOMSKA (SENYA), no AI co-author trailers (enforced by commit-msg hook and CI).

- CI (GitHub Actions): typecheck, lint, unit, pgTAP, puzzle validation, build with bundle budgets, Playwright smoke, Lighthouse, then Vercel preview deploy.

- Scheduled workflows: weekly puzzle generation, daily keep-alive ping, nightly full E2E, content-buffer check (alert below 7 days).

- Environments: local (Supabase CLI), preview (Vercel preview + Supabase preview project), production.

- Monitoring: Sentry alerts (error rate over 1%), rollover job alert, uptime monitor, free-tier usage alert at 80%.

- Feature flags for every new game and event; emergency "swap Daily" runbook.

## 19. Release plan

The MVP launches publicly in week 13 with 15 games; new games then ship every few weeks, with SPUZL+ and payments in v1.2 once the daily habit is proven.

<img src="media/image3.png" style="width:6in;height:6.27678in" alt="SPUZL roadmap · 6 sprints, 3 gates, launch in week 13" />

SPUZL roadmap · 6 sprints, 3 gates, launch in week 13

Weeks assume a team of 4 to 6; a solo builder should plan roughly double. Later releases: v1.2 (SPUZL+, shop, push, full Archive), v1.3 (schools plan, level editor, more languages).

### 19.1 Launch checklist

- [ ] 60 days of approved Dailies for all 15 games, all solver-verified

- [ ] Motion review passed for every screen (emilkowalski/skill review-animations)

- [ ] Performance and accessibility budgets met on the baseline Android phone

- [ ] Privacy Policy, Terms, Fair Play page live; trademark search done

- [ ] Monitoring, rollover alerts and runbooks live

- [ ] 20 launch TikTok/Reels videos (rage deaths, Full Spuzl reveals) and 10 school ambassadors briefed

## 20. Risks, acceptance criteria and open questions

The biggest risks are a broken Daily (trust), too many games diluting quality, and heavy animation hurting performance on budget phones; each has a mitigation before launch.

### 20.1 Risks

| Risk                                 | Likelihood | Impact | Mitigation                                                                    | Owner           |
|--------------------------------------|------------|--------|-------------------------------------------------------------------------------|-----------------|
| A Daily has two solutions or none    | Medium     | High   | Solver gate in CI, 60-day buffer, emergency swap                              | Puzzle Engineer |
| Scope: 45 games is a lot             | High       | High   | Launch 15, ship 2–3/month, kill games with poor playtests                     | PO              |
| Animation slows budget phones        | Medium     | High   | Transform/opacity only, budgets, low-data mode, animation-performance reviews | Frontend        |
| Name conflict near "Puzl"/"Puzld"    | Low–Medium | Medium | Trademark search, distinct stylisation and mascot                             | PO / Legal      |
| Content runs out (words, trivia)     | Medium     | High   | 14-day minimum buffer, alerts, 2+ writers                                     | Content         |
| Cheating ruins boards                | Medium     | Medium | Server verification, replay checks, flags                                     | Backend         |
| Free tiers exceeded on a viral spike | Medium     | Medium | Usage alerts, cached Dailies, upgrade plan ready                              | DevOps          |
| Under-18 safety issues               | Low        | High   | No chat, filters, moderation, age rules                                       | Moderator       |
| Too similar to LinkedIn/NYT games    | Medium     | Medium | Original names, art, rules text; no copied puzzles                            | Design          |

### 20.2 MVP acceptance criteria

- [ ] All Must requirements pass their tests

- [ ] 15 launch games playable on mobile and desktop, keyboard and touch

- [ ] Every launch-window Daily verified unique and graded

- [ ] Rewards, streaks, leagues and rollover verified over a simulated 14 days

- [ ] Motion catalogue (Section 3.9) implemented and signed off

- [ ] Budgets for performance, accessibility and data met

- [ ] Beta: 200 players, D1 retention 40%+, average rating 4/5+

### 20.3 Open questions

| \#  | Question                                                                   | Owner             |
|-----|----------------------------------------------------------------------------|-------------------|
| 1   | Final domain: spuzl.vercel.app now, which custom domain later?             | PO                |
| 2   | SPUZL as its own app, or a SPIL family brand (shared account)?             | PO                |
| 3   | Rive vs Lottie for Spuz (Rive recommended for live reactions)              | Design / Frontend |
| 4   | Daily reset at 00:00 GMT for everyone, or local midnight per region later? | PO                |
| 5   | Which word-list licence and trivia sources?                                | Content           |
| 6   | Final SPUZL+ pricing after beta                                            | PO / Growth       |
