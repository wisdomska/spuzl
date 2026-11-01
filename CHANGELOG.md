# Changelog

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
- **Five's answer list** is owner-approved; Trotro Jam boards have much more variety.

### For admins

- **Solve-check** works for Penalty King, Beat Tap, Higher or Lower, Light Up, Killer Sums and Dara.
- **All admin text** now comes from one copy file.
- **Google Search Console** ownership tag is on the site.

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
