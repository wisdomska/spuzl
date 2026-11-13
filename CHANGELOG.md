# Changelog

## 1.58.0 (13 November 2026)

### Everyone

- **The SPUZL logo intro is back, with its sounds:** it plays when you tap Play now or Sign in on the landing page,
  and once each time you open the app, before Home. Tap to skip. A reload doesn't replay it, and you won't see it
  again right after signing up.
- **A reload keeps you where you are:** the offline helper no longer shows the landing page when a reload is slow.
- **The weekly roundup is one line on Home** ("Your week: 38 games cleared"); tap it for the full week, sharing
  and today's Daily.
- **Party mode** replaces "Classroom mode" (show the race on a big screen while you host). No more school wording.
- The nickname hint is just "3 to 16 letters, numbers or _."

### Behind the scenes

- Google's own sign-in button is ready, so Google's window can name SPUZL's site instead of the sign-in server. It
  switches on once its client ID is set.

## 1.57.0 (13 November 2026)

### Everyone

- **Hard boards fit small phones:** Market Run's hardest board folds its rules into one "Rules" row (tap to read
  them; each shows kept, broken or open) and lists items two a row; Tripwire's hardest board shows whole and zooms in
  on the first tap (drag to move, Zoom to step back), like Light Up; Emoji Hits fits before Start. No scrolling on a
  320 × 568 or 375 × 667 phone.
- **The first-slip tip no longer moves the tools:** the slip shows on its own, then a one-line "Slips only lower
  accuracy." takes its place.
- **Draw It and Two Truths rooms hold up to 8 by default** (everyone takes a turn, so rounds stay short).

### Admin

- **Live connection this month** on the Overview: an estimate of the live messages used against the free plan's 2
  million, turning gold at 75% with a reminder to upgrade.
- **New setting "Most players in Draw It and Two Truths"** (Duels and Parties): 2 to 10, 8 by default, never above
  the Party limit.

### Behind the scenes

- Test runs delete every test player they create, and test names can't trip the nickname filter.
- An unused animation library (Rive) is gone.

## 1.56.0 (13 November 2026)

- **Hover states on desktop:** with a mouse or trackpad, everything you can click now answers the pointer, on the
  landing page, in the app, inside every game and in the admin. Buttons and cards brighten, dark rows and chips get
  a faint wash, text links dim, and board cells and pits show a light inner ring that never moves the board and
  can't be mistaken for a selected, correct or wrong cell. Clickable things show the hand cursor; disabled ones
  don't react. Quick (0.12 s) and only on devices that can hover, so nothing stays highlighted after a tap on a
  phone.

## 1.55.0 (12 November 2026)

- **Your profile in tabs:** under your name and Spuz, Me has Overview (your numbers, rank per world, latest badges),
  Streak (the calendar), Games (your best times) and Badges. Less scrolling; "All badges" opens the Badges tab, and
  the tab stays on reload.
- Tabs across the app (Me, Quests) move with the arrow keys, Home and End.

## 1.54.2 (12 November 2026)

- A game you haven't played on this device starts loading its practice round the moment you tap it.

## 1.54.1 (12 November 2026)

- **Faster on a new phone or browser:** sign-up no longer shares the connection with 55 sound files. Only the 9
  everyday sounds load in the background, after you're in; each other sound loads the first time it's needed (a
  built-in version plays meanwhile). A new game's practice round now starts loading the moment its page opens,
  instead of after your account is checked.

## 1.54.0 (12 November 2026)

### Everyone

- **Games against the bot count on your record:** each finished game (the game, the bot's level, won, lost or drawn,
  and how long it took) is saved to your account and included in your data download. Still no XP, Sparks or rating
  from the bot. Practice rounds stay unsaved.

### Admin

- **A player's board games say who they played:** a new Against column shows "Bot" with its level (Easy, Medium,
  Hard) or the other players by name, each linking to their page. Games against the bot from a game's page now sit
  in the same list, newest first.

## 1.53.0 (12 November 2026)

### Everyone

- **Send feedback without leaving the game:** the game menu's "Send feedback" (was "Report a problem", which opened
  an email or a new tab) opens the feedback form over the board; the clock waits and the message carries the game's
  page. Board Bay has the same button at the top.
- Contact: "Adults can write to us to remove a young player's account" (was "Parents and teachers").

### Admin

- **A player's page in tabs:** Overview (who they are, progress), Games (recent games, ratings, board games),
  Reports (reports about and by them, team actions; the tab shows open reports) and Sparks & league (Sparks history,
  league, items). What needs action and the Actions panel stay in view; the tab is in the address, so links open it.
- Tabs everywhere in the admin move with the arrow keys, Home and End.
- **Activity log:** the "Technical filters" (action code and target) are gone.

## 1.52.0 (12 November 2026)

### Everyone

- **Checkboxes and radio buttons in SPUZL's style,** dark and light: rounded, lime with a tick when on, a dash when
  only some of a list is ticked, a ring and dot for radios (red for "the lie" in Two Truths).
- Search fields get a quiet clear cross, number fields lose the grey arrows, autofilled fields keep the app's
  colours, scrollbars and selected text follow the theme.

### Admin

- **Needs your attention is one row of tiles:** each shows its count and a short label and opens its page; anything
  waiting is gold and comes first, and "All clear" sits in the heading. About a third of the old height.
- **No more "Technical details":** the folded raw ids, setting keys and stored values are gone from Game settings,
  the Activity log, Players, Reports, Feedback, Puzzles, Content and Games.
- Every "More" and "By day" toggle has the app's caret instead of the browser's triangle.
- "Select all" shows a dash when only some players or entries are ticked.

## 1.51.1 (12 November 2026)

- **Landing page links now glide** to How it works, Games and Friends (they still jumped: the smooth-scroll style
  was dropped from the production build, so the glide now runs in script, 0.25 to 0.5 s). Reduced motion jumps.
- **"Accounts and your data" left the landing page.** One footer line keeps what Google's sign-in review needs:
  "Google sign-in uses only your name, email and photo." with the Privacy policy link.

## 1.51.0 (12 November 2026)

### Everyone

- **Smooth, quick motion across SPUZL:** screens and cards rise in, progress bars fill, buttons press, menus grow
  from where you tapped. Nothing takes longer than a blink, and Reduced motion turns it off.
- **Shorter words everywhere:** the landing page, game pages, the app and its prompts say the same in far fewer
  words.
- **Landing page:** the menu links glide to their section; the hero eases in and sections appear as you scroll; a
  Sound on/off switch on the Try it board (remembered on your device).
- **All games:** the four worlds are tabs (Puzzles, Words & Quiz, Arcade, Board Games), each with its own link.
- **Back** on every game page, world page, All games and the info pages.
- **"Frequently Asked"** (was "Good to know"), and the answers open and close smoothly.

### Admin

- Every page, setting and metric explains itself in a line or less; details stay under "More".
- Quick, light motion: button presses, tab and section fades, menu groups that fold.

### Search and AI assistants

- The FAQ now answers what the Daily Five is, playing with friends (Party up to 10, score races, challenge links,
  Board Bay) and keyboard and screen reader play.
- `llms-full.txt` gains a Features list (Daily Five, Duel, Party, Draw It, Challenges and Ghost Races, Board Bay,
  leagues, crews, the Shop, accessibility, offline play, feedback and your data).
- Structured data lists SPUZL's features and accessibility, and each game says how many can play (up to 10 in a
  Party, 2 in a Duel or Board Bay). The landing description mentions Party.

## 1.50.0 (11 November 2026)

### Everyone

- **Party rooms hold up to 10 players** (was 8). Hosts still start at 8 and slide up to the limit.
- **A full room fits the screen:** 9 or 10 seats sit five to a row in the lobby, and in a race with more than five
  players the standings show the top three, you and the player just ahead of you, so the board stays in view.
  "Show all" lists everyone.
- Rooms of 7 or more send each player's progress once a second instead of twice, so big races stay smooth and
  within the live connection's limits.

### Admin

- **New setting "Most players in a Party"** (Game settings, Duels and Parties): 2 to 10, 10 by default. Rooms
  already open keep their size; a lower limit applies to new rooms.

## 1.49.0 (11 November 2026)

### Everyone

- **Dropdowns, date pickers and pop-ups in SPUZL's own style,** in the app and the admin, dark and light: no more
  plain browser menus. Every dropdown opens a list on the app's surface with a lime check on the chosen option,
  keyboard and type-to-find included. Dates open a SPUZL calendar.
- **Every pop-up and sheet shares one look:** dimmed background, title, a close button top right, the main action
  on the right, and focus kept inside while it's open.
- **Birth month is now twelve buttons** (Jan to Dec): one tap, no list to open.
- Admin confirmations (stopping or deleting an event, retiring content, switching off a setting) use the app's own
  dialog with plain words instead of the browser's box.

## 1.48.0 (11 November 2026)

### Admin

- **Turn any game On, In testing or Off from the Games page.** On: everyone plays it. In testing: only your team
  can open it (there's a "Try it" link), and players never see it. Off: hidden from everyone. The server enforces it
  everywhere (the game list, worlds, Daily Five, Duels, Parties, challenges, the website and search listings), and
  switching a game Off or into testing swaps it out of today's and upcoming Daily Five days.
- **Every per-game edit lives on its row:** state, play time, tags, rule and card text, the Daily Five score scale,
  the practice round and "Can be played in Duels and Parties". Filter the list by state, with counts.
- Game counts players see follow the games that are On.
- The Lab games card and the practice-round list left Game settings; the Games page owns them now.

## 1.47.0 (11 November 2026)

### For players

- **41 games, all permanent:** the 12 newest games are regular games now. They count toward Explorer badges, and the
  ones that suit a race can be played in Duels and Party races (Five, Market Run, Light Up, Killer Sums, Tripwire
  and Pixl in time races; Higher or Lower, Penalty King, Pinned, Flagged and Two Truths in score races).
- The landing page, FAQ and search listings say 41 games.

### Admin

- **Game settings as tabs:** one section at a time instead of one long page.
- **Players list:** Player, Email, Account, Joined, Last played and Level first; reviews and status at the end.
- **Shop** sits under Games & content. **"What each role can do"** on Team folds away.
- **Feature switches removed:** nothing in the app read them. Old links open Game settings.
- **Content** uses the full width until you open an item.
- Pagination no longer has the "Page … of … Go" box.

## 1.46.1 (11 November 2026)

### For players

- **All 12 new games are on:** Five, Higher or Lower, Penalty King, Market Run, Light Up, Killer Sums, Dara, Pinned,
  Flagged, Tripwire, Pixl and Two Truths and a Lie, each in its world.
- **They fit every screen** from a 320 × 568 phone to a laptop, with no scrolling. Quickfire fits small phones too.
- **Higher or Lower:** no wrong "slips never end the game" tip, cards show their number once, and the header says
  "Run over" after the third slip.
- **Dara** plays with the arrow keys and Enter.
- Each new game has its own page on the website and appears in How to play.

### Admin

- **Pagination on every long list:** Games, the Family Draw words and a player's history (past games, reports,
  team actions, ratings, board games, Sparks and leagues).

## 1.46.0 (11 November 2026)

The admin, rewritten for people who aren't developers.

### Admin

- **A grouped menu:** Home, Players, Games & content, Shop, Insights and Settings, instead of 18 items in one list.
  Groups fold away, show how many things wait inside, and the whole menu fits a laptop screen. On phones and tablets
  a Menu button opens the same list.
- **Overview is a real home:** what needs your attention first, with a button for each, then today's numbers, the
  last 7 days and your players (guests, saved accounts, age groups) in plain words.
- **Metrics answer an owner's questions:** how many people play, whether they come back, what they play, playing
  together, Sparks and the shop, reports and feedback, and first-time players. Each number says what it means and
  how it compares with the period before. App speed timings moved to a folded technical section.
- **Activity log in sentences:** "Senya switched on Pinned and Flagged", "Automatic: picked the Daily Five for
  Tue 24 Nov". Automatic jobs are hidden unless you ask for them, and hourly reminders fold into one line a day.
- **Game settings in plain words,** in sections with a jump list, values in seconds and words, "Use default" on
  anything changed, and a confirmation before switching off something players use.
- **Players, Reports, Join requests and Feedback** lead with what needs doing. Taking something away from a player
  now asks first and says what will happen.
- **Games, Content, Puzzles, Daily calendar, Daily Five, Events and Shop** say what every state means for players
  and what each button does. The Games page is a compact list that opens to edit.
- Internal ids, setting keys and raw data are folded under "Technical details" everywhere.
- No admin page scrolls sideways on a phone.

## 1.45.1 (11 November 2026)

- **Two Truths** says "Cape Verde", like Flagged.
- **Admin, Lab games:** each game is a card with its tile, world, rule and an on/off switch, with a count of how many
  are on for players. The long explanation folds under "How it works".

## 1.45.0 (10 November 2026)

Every open follow-up the owner approved on 10 November.

### For players

- **Your hat, everywhere:** friends, leaderboards, crews, leagues, chat, invites, Duel, Party seats and the TV, Board
  Bay and your Home ring show each player's Spuz in their hat, and only a hat they bought.
- **Duel:** one clock, the round time, the same for both players, and it no longer steps back a second on a move.
- **Challenges and Ghost Races** start with a short practice round on your first try at a game.
- **Party:** score games (Quickfire, Echo, Beat Tap and more) offer "Host a party" from their game card. A host who
  left the lobby sees join requests on Home and can let people in from there.
- **Five** fits a 320 × 568 phone, and every board re-fits when its screen changes after it loads.
- **Light Up:** on small screens, the first tap zooms in so every cell is easy to hit.
- **Dusk and Nine practice rounds:** the first hint is a real first move.
- **Gotcha and Dash** run smoother on mid-range phones.
- **Free play** gets a share card even with story cards off.
- **Signing up from a game's page** brings you back to that game. Invite links and other entry points go straight to
  the age step instead of replaying the intro, with "Played before? Sign in" there.
- **Linking Google** from "Save your streak" says thank you, as the email path does.
- **Daily Five:** score games earn points from their score. A lab game switched off is swapped out of today's five.
- **18+ party rooms** count toward quests and badges, and stay out of the friends feed.
- **Draw It for 16+** (preset words, pick the word) is on.

### Safety and fair play

- 13 to 15 year olds see "Opens at 16" instead of a Play live button that failed.
- Board Bay invite codes from under-16 hosts work for their friends only.
- Quickfire hands out each question only when it opens.
- Live drawing in Draw It is stamped by the server, so nobody can fake ink for the drawer.
- Party Race XP has a daily cap.
- A hat shows only when the server finds it in the player's Shop inventory.

### Content

- Pinned, Flagged, Pixl and Two Truths are reviewed and fact-checked. Map pins, a Two Truths line and a Pixl
  picture are fixed, and Bulgaria's currency is now the euro.

### For admins

- Rule and card text you edit reaches the practice hints, the Duel cards, How to play, the game pages and llms.txt.
- New on the Content page: "Rebuild upcoming days" after retiring content, approved Quads items joining free play
  in one click, and audited Quads exports.
- Daily Five typical scores per score game, on the Library page.
- Retention counts Board Bay moves. Metrics labels Welcome as the sign-in screen. Birth years start at 13.
- Your data export lists Party join requests you made, and the ones you received (the asker's nickname only).

## 1.44.1 (10 November 2026)

### For players

- **Duel results fit every screen:** the round result keeps its countdown and reactions on screen, and the match
  result keeps Rematch on the bottom edge, from a 320 × 568 phone up to a laptop.
- **Multiplayer screens on a laptop** no longer scroll a little for no reason.
- **Board Bay with a keyboard:** Four Up and Oware are one Tab stop each. The arrow keys move between columns or
  pits, and Enter plays. Every pit takes focus and says when it can't be sown.
- **All games** shows the same list on the first paint as after it, with no flash and no hydration error.
- **Gotcha and Dash:** a long level name no longer pushes the page sideways on a phone.
- Gold badges in Duel use the readable ink in every theme.

## 1.44.0 (9 November 2026)

A full usability pass over every game and the game screen.

### Playing any game

- **Restart asks first** once you have made moves, in the game menu and in bot games. A board you haven't touched
  restarts at once.
- **Keyboard players** see where focus is on board cells, pads and tool buttons.
- A long press on the board no longer selects text or opens the iPhone pop-up menu.
- A game that fails to start offers **Try again**, and says so when you are offline.
- Text and icons on gold are easier to read in both themes and the colour-blind modes.
- **Nine on a laptop with reduced motion:** the board and number pad now fit the screen with no scrolling.

### Puzzles

- **Crownfall:** dragging to paint X marks no longer scrolls the page, and Restart clears every mark.
- **Undo says where you stand:** Dusk, Sixer, Nine, Trotro Jam and Crownfall announce the count after an undo.
- **Weave** names the walls around every cell, so it can be played with a screen reader.
- **Flowline:** with every plant watered, the line says what is left; watered plants get a drop badge.
- **Lost** warns as you near the move limit, and explains why an exit past it can't count.
- **Dusk, Trotro Jam, Weave, Flowline and Pairup** fit short phones without scrolling.
- **Escape** lets go of a traced path in Coil, Buried and Pairup.

### Words & Quiz

- **Minicross:** a full grid with mistakes marks the words to check, without giving away letters.
- **Quads:** running out of mistakes shows the groups you missed.
- **Rungs:** move between rows with the Up and Down keys. A failed check offers Check ladder again instead of
  stopping.
- **Remix:** answer slots fit a 320 px phone, and a check lost to a dropped connection can be sent again.
- **Seven:** pressing Enter twice no longer counts a word twice.
- **Emoji Hits** lists the round's wrong guesses under the answer box.
- **Two Truths and a Lie** keeps the answered round up long enough to read.
- In-game text in word games is never smaller than 14 px.

### Arcade

- **Echo** pauses between rounds. **Flinch and Beat Tap** ignore right and middle clicks.
- **Gotcha and Dash** pause their game loop while the board is covered, and run smoother.

### Board games and friends

- **Chess and draughts:** play with the arrow keys and Enter. The moved piece stays put while the move sends.
  Draughts shows both routes when two captures land on the same square.
- **Draughts, Oware and Four Up** mark the last move and explain a refused tap.
- **Board Bay:** withdraw a draw offer, rows say Your move or Their move, Takeback says why it's off, and Resign or
  a draw with the bot asks first.
- **Duel and Race:** switching tabs no longer brings up the Pause sheet; you get a note when you come back.
  A lost Duel round names the next round.

## 1.43.3 (9 November 2026)

### For visitors

- **Every public page uses the full width:** on wide screens no section sits in a narrower column than the others.
  - Landing: "Accounts and your data" has its heading on the left and the text on the right.
  - Game pages: the rule, how to play, ways to play and questions on the left; Quick facts and Play stay on screen on
    the right.
  - How to play: the basics and the game cards sit in a three-column grid.

## 1.43.2 (9 November 2026)

### For visitors

- **The SPIL card is a proper section again:** a compact bordered card ("From the same studio · Prefer party
  games?") with a Play SPIL button, matching SPIL's own card for SPUZL.
- **Forced dark modes** (Opera GX, Chrome Auto Dark) no longer repaint the landing page: the site now declares its
  own dark and light designs.

## 1.43.1 (9 November 2026)

### For visitors

- The landing page FAQ now fills the page width like the sections around it.

## 1.43.0 (9 November 2026)

### For players and visitors

- **Send us feedback.** A form on Contact (what it's about, an optional email for a reply, your message), reachable
  from Settings, Me and the landing page footer. Or email wisdomska@gmail.com.
- **FAQ as an accordion** on the landing page, How to play and every game page; the teen safety answer is now a list.
- **SPIL, our party game,** has a proper card on the landing page: what it is, ten games, up to 12 players, free.
- **"Designed & Developed by Senya"** links to wisdomska.site from every page's footer, the Library and Settings.

### For admins

- **Feedback** page: every message with its topic and page, mark read or done (audited), CSV export; a "New
  feedback" tile on the Overview. Roles: feedback.read and feedback.write.

### Behind the scenes

- Migration `20261209000201_feedback.sql`. Structured data and llms.txt name Senya as the maker.

## 1.42.1 (9 November 2026)

### Behind the scenes

- The favicon (Spuz) moved to `app/favicon.ico`, the App Router convention, so Vercel shows it as the project
  avatar instead of the framework logo. Browsers see the same icon as before.

## 1.42.0 (8 November 2026)

### For players and visitors

- **A page for every game.** `/games` lists all the games by world, and each game has its own page: what it is, how
  to play, modes, typical time, a short FAQ, related games and a Play button.
- **The front door.** Visitors who aren't signed in (and search engines) get the SPUZL landing page at `/`, with the
  games and an FAQ; players still land straight on their Home.
- **Worlds open to visitors.** A world page shows its games to visitors too.
- **Fair play page corrected:** in-game chat is quick phrases and reactions; typing is only on when everyone in the
  room is 16 or older.

### Search and AI assistants

- Every public page has its own title, description, canonical link and share image; structured data for SPUZL, each
  game, breadcrumbs and FAQs.
- Sitemap lists every page and game; robots welcome search and AI crawlers and keep private pages (rooms, duels,
  profiles, admin) out; `/llms.txt` and `/llms-full.txt` describe SPUZL for AI assistants.
- New pages are announced to Bing and others through IndexNow.

## 1.41.2 (8 November 2026)

### For players

- **Cleaner avatars.** Your Spuz sits on its own, with no tinted square behind it, in the Home level ring and in every
  list; the level ring is now a thin ring round it.
- **Shades fit.** The lenses cover both eyes at every size, so no eye peeks out at the corner on small avatars.

## 1.41.1 (8 November 2026)

### For players

- **World banners wear their world's colour.** Arcade's banner is red, Words & Quiz green, Board Games brown and so on,
  with the world's name in that colour; buttons and status chips stay lime.
- **The gold NEW tag is gone.** New games keep the green "New" pill on their cards.

## 1.41.0 (8 November 2026)

### For players

- **Your Spuz wears your look everywhere.** The skin and hat you pick in the Shop now show wherever Spuz stands for
  you: Home, every results screen and celebration, the game-over card, Daily Five, your Duel seat, and a small Spuz
  on the quick result bar. The hat moves with Spuz (and stays still with reduce motion).
- **Everyone else's too.** Friends, leaderboards and podiums, leagues, crews, chat, Party seats and standings, Duel
  strips, challenges and invites show each player's own Spuz in their skin and hat, instead of a letter.

### Behind the scenes

- Player lists and match views now carry each player's `hat` next to their colour (public cosmetics only).

## 1.40.1 (8 November 2026)

### For players

- **The lab tag now just says NEW.**
- **No more flicker in All games, Home and the worlds.** Game times and switched-on lab games now come from the
  server on the first paint, instead of showing defaults for a moment (Chess said 3 min, then 5 min).

### Behind the scenes

- The streak-at-risk reminder runs hourly from the production database (`pg_cron` job `spuzl-streak-nudge`, secret
  in Vault), since Vercel Hobby allows daily crons only. See docs/OPERATIONS.md.

## 1.40.0 (8 November 2026)

### For players

- **Party Start waits for everyone.** The lobby names who isn't ready yet, Start opens when everyone is, and the
  host can "Start without them": players who weren't ready watch that set and are back in on Run it back.
- **Points games in Party.** Quickfire, Emoji Hits, Seven, Twins, Beat Tap and the switched-on lab games (Two Truths
  and a Lie among them) can be raced in Party: highest points wins, faster finish breaks a tie, scored by the server.
- **Quick Match for 13 to 15.** Players aged 13 to 15 can use Duel Quick Match and are only ever paired with other
  13 to 15 players. Chat for them stays preset phrases only.
- **One Duel clock rule.** Your clock in the Duel strip starts on your first move, like the header timer.
- **Evening streak reminder.** If your streak is at risk, an evening alert reminds you (only with alerts on; a
  "Streak reminders" switch in Settings, and quiet hours are respected).
- **Weekly recap.** Once a week Home shows your last week (clears, best time, streak, rank, Sparks) with a share
  card and a "Play today's Daily" button.
- **New games say so.** Games in testing carry a "NEW" tag.
- **Wide screens fit.** On laptops and desktops the game's side panel fits the screen; no more slight scroll.
- **Home is lighter on phones.** Monitoring, analytics, the inbox connection and the desktop side panel load after
  the page is up.
- **Azonto Steps is gone.**
- **Long button labels fit.** Buttons keep their padding: long labels wrap onto a second line, a single long
  word shrinks a little to fit, and the next-game button reads "Next: Emoji Hits" with its category underneath.

### For admins

- **Content review queue:** approve, edit or retire each entry of a game marked for review; retired entries are
  never dealt to players. Two Truths, Pinned, Flagged and Pixl are in it.
- **Family Draw words** live in the database: add, edit, retire, import and export from the Content page.
- **Overview:** players with alerts on, and players a push reached in the last 30 days, next to the device counts.
- **Metrics:** new "Streak-at-risk nudges" and "Weekly recap" cards with CSV.
- **Settings:** score races (on, round length), streak nudge (on, hour, minimum streak), alert quiet hours, weekly
  recap (on).

### Behind the scenes

- Security: rivals' saved boards in a match are no longer readable through the database API.
- 11 migrations (see docs/MIGRATIONS.md).

## 1.39.0 (8 November 2026)

### For players

- **Two Truths and a Lie is on.** Find the lie among three statements; every round tells you what's true instead.
  All ages, picks only, no typing.
- **Schools and campuses are gone, everywhere.** School and campus leagues, the School Cup (class challenges with a
  teacher's code), the school on your profile, the School leaderboard and the "Top of the Class" badge are removed.
  Nobody had joined a school or a class, so no one loses anything.

### For admins

- The Schools page and the schools permissions are gone from the console, with the league table, its CSV export
  and the school-join count on Metrics; that Metrics card is now "Party TV and streak shields".

### Behind the scenes

- Migrations `20261206000101_remove_school_leagues` and `20261206000201_remove_schools` drop the league and School
  Cup functions, the school tables and columns, the School badge and the School Cup flag.

## 1.38.1 (7 November 2026)

### For players

- **Boards no longer crash with reduce motion on a wide screen.** On a laptop or desktop with reduce motion on,
  some boards (Crownfall among them) could show "This page couldn't load". The board now fits the screen and stays
  put.

### Behind the scenes

- The round 2 QA report is done: `docs/qa/QA_REPORT_R2.md` (ticket matrix, before and after latency, Lighthouse,
  axe, E2E on production and on the seeded boards).
- E2E fixes from the final runs: Party start waits for everyone to be ready, Beat Tap timing is read every frame,
  and the pause check reads the board under Radix's modal.

## 1.38.0 (7 November 2026)

### For players

- **Challenge a friend with a link that looks good.** Sharing "Beat my time" sends a short link whose preview on
  WhatsApp and Instagram shows the game, your time and a "Beat me" card; it says when the challenge runs out.
- **Story cards.** Every clear can be shared as a 9:16 story card with a "Beat me" link.
- **Party on the big screen.** A Party room can be shown on a TV or a classroom projector at `/party/<code>/tv`:
  nicknames, progress and scores only, no chat and no way to play. The host turns it on per room; never for a host
  under 16.
- **A free Streak Freeze for signing in.** A guest who saves their streak by signing in gets one Streak Freeze,
  once.
- **School and campus leagues** (when switched on by the admins): pick your school or campus and see the weekly
  school table.
- **Lab games.** Two Truths and a Lie (all ages, picks only) and Azonto Steps (a dance-memory game with Spuz)
  join the lab games; each opens only when the admins switch it on.
- **Family Draw** for players 16 and over (when switched on): Draw It with a preset word list, guessers pick from
  four words, nobody types. Under-16s are kept out because a drawing can't be checked before others see it.

### For admins

- **Event templates:** seasonal events as drafts (including a 6 March Ghana history quiz), and scheduling from the
  Events page.
- **School league table** with CSV export (audited).
- **Content page:** Two Truths packs (preview, export, import as drafts) and Family Draw words (preview, check).
- **Metrics:** a "Party TV, streak shields and school leagues" card with CSV, plus the round 2 cards (tap warmth,
  first clear, practice rounds, D1 and D7 retention, board game results) now backed by the database.
- **Player detail:** when the sign-in streak shield was granted.

### Behind the scenes

- Pages that read game settings render per request, so switching a lab game on or off applies at once.
- 15 migrations applied to preview and production (see docs/MIGRATIONS.md).

## 1.37.2 (7 November 2026)

### For players

- **Tapping a game shows it at once, from every card.** The game's outline now covers the screen on the very frame
  you tap the Daily Five card, Continue or any other game card on Home. Before, these cards left Home on screen
  for up to half a second while the game loaded.
- **Picking a game for a Duel or Party puts you back where you were.** After you choose a game in the picker,
  keyboard and screen-reader focus returns to the "Game" row instead of jumping to the top of the page.

### Behind the scenes

- E2E specs updated for Library rows being links, Next's route announcer, low-data loads with a service worker,
  and Ctrl-click popups.

## 1.37.1 (7 November 2026)

### For players

- **Losing to the Practice bot says so.** Resigning to it, or being checkmated by it, used to say "It's a draw".
  It now says "You lost", and the result line names the Practice bot as the winner.

## 1.37.0 (7 November 2026)

### For players

- **You'll know when you've won.** When a full game ends (chess, draughts, Ludo and the rest, with a friend, in
  Play live or against the bot), a card fills the screen saying "You won!", "You lost" or "It's a draw", and why:
  checkmate, they resigned, or the clock ran out. It plays the win or loss sound, and wins get confetti. Rematch is
  one tap away, or close the card to look at the final board.
- **The rule is on screen.** Every game shows its one-line rule under the title until your first move, then it lives
  in the game menu.
- **Practice first, wherever you start.** A game's practice round now runs the first time you open it from
  Continue, Levels, Daily Five, the bot or a Duel/Party lobby, not just the Library.
- **The timer waits for you.** It starts on your first move, never during practice, and never shows 00:00 on your
  first puzzle.
- **Pause hides the board.** Pausing always covers the board ("Board hidden").

### For admins

- **New setting** `practice.disabled` turns off a game's practice round.

## 1.36.0 (7 November 2026)

### For players

- **Quads is back.** Find four groups of four in this Connections-style game.
  - The groups get difficulty colours, each labelled Easy, Medium, Hard or Tricky (colour-blind safe).
  - Feedback is quick, including "one away".
  - It has a practice round, and 38 new puzzles with a West African flavour.
- **Straight to playing.** "Play now" on the landing page goes straight to "When were you born?", with no intro
  screen. If you solved the demo on the landing page, it counts as your first clear.
- **Birth year is quicker to enter.** Type four digits on the number pad instead of scrolling a long list, and the
  note explains why it's set once.
- **Beat Tap counts you in.** Four beats before scoring starts, practice never costs points, and the Start tap never
  counts as off-beat. If your sound is off, it offers to turn it on.
- **Trotro Jam:** the selected vehicle lifts and is outlined, the arrows light up, and you can drag or swipe a
  vehicle to move it.
- **Emoji Hits:** practice is pick-the-answer, real rounds are type-the-answer, and the screen says which. The hint
  clears after each round, and the clock starts on Start.
- **Library:** rows are real links, so you can long-press, open in a new tab or share them. Games with levels say
  "Play Level N".
- **Home:** a "new games to try" card opens the Library filtered to New. The Continue card shows a small board
  picture and your level.
- **Shop:** items you can afford are marked.
- **Low-data tip:** it now appears on slow connections where it should.

### For admins

- **Quads puzzle editor** on the Content page, with a preview and JSON pack import and export.
- **"New" tag** on the Library page, which drives Home's "new games" card and the New filter.

## 1.35.0 (6 November 2026)

### For players

- **Daily Five.** Five quick shared puzzles every day: one from each world plus a bonus. Everyone gets the same
  five, they reset at midnight GMT, and they take about five minutes.
  - The card sits above the map on Home, with your progress ring and combined score.
  - Finish all five to share an emoji grid with your friends, and open `/daily` to see today's five.
- **Party rounds start cleanly.** Chat and other sheets close when a game starts, and the same 3-2-1-SPUZL!
  countdown as Duel runs before anyone can move.
  - Results list players in rank order with "You" highlighted.
  - "Next game (2 of 3)" leads until the set ends; "Run it back" leads after the last game.
- **Fewer pop-ups.**
  - SPUZL asks about notifications only after something worth an alert happens: your first friend, a Duel or
    Party invite, or a 3-day streak. It never asks on Home or during a game.
  - The low-data tip only appears after slow loads you actually had.
  - You never get two prompts on one screen.
- **Duel for under-16s.**
  - "Challenge a friend" is the main button and works with "Any game".
  - Quick Match shows "Opens at 16" instead of a greyed-out button.
  - Picking a game opens a full-height list with the Library's search and filters.
- **Friends-only rooms for under-16 hosts.** Only the host's friends can join their Party room or friend duel
  with the code. Anyone else can ask to join, and the host lets them in or says no.

### For admins

- **Daily Five page:** preview, auto-pick or hand-pick each day, lock a day, run the scheduler, and export or
  import the schedule as JSON.
- **Moderation:** a "Daily Five only" filter for fast solves, and a Join requests log for under-16 rooms with CSV
  export.
- **New settings:** Daily Five (on/off, reset hour, difficulty, worlds and bonus pool), countdown length,
  notification triggers and cooldown, low-data thresholds, and under-16 friends-only rooms.
- **Metrics cards with CSV:** Daily Five starts / completions / shares, duels created by age band, Party start to
  first move, and prompt acceptance by trigger.

## 1.34.0 (6 November 2026)

### For players

- **Games open faster, especially the first one.** On a phone connection the first game used to share the
  connection with every sound effect, the music and other pages loading in the background. Now:
  - the game comes first;
  - sounds and music load once you're playing;
  - "Continue" starts fetching your game the moment you tap it;
  - Home quietly gets your next game ready while you look at the map.
- **No more blank wait after a tap.** The game's outline appears on the same frame you tap, then fills in.

### For admins

- Tap-to-board times on the Metrics page should drop. Compare with `docs/qa/BASELINE_R2.md`.

## 1.33.0 (6 November 2026)

### For players

- **One SPUZL colour everywhere.** Buttons, titles, highlights, selections and progress bars use SPUZL's lemon green
  on every screen, in every game category, board games included (no more brown Ludo title or Roll button). A
  category's own colour now shows only on its island on the map and in game art such as the Ludo board.

## 1.32.0 (6 November 2026)

### For players

- **Stacks block everywhere in Ludo.** Two or more of one colour on any square, star and start squares included,
  can't be passed or landed on by anyone else. Only a piece coming out onto its own start square can still go there.
- **Side-kick takes the square.** With Side-kick on, landing across the lane from a lone rival gives you the choice
  "Move + side-kick": the rival goes home and your piece moves onto its square.
- **Back-kick through the side line.** With both Back-kick and Side-kick on, you can move back by your roll and kick
  the rival straight across from there ("Back + side-kick"). The bots use these moves too.

## 1.31.1 (6 November 2026)

### For players

- **Your Ludo colour faces you.** The board turns so your colour's base sits in the bottom-left corner, nearest you,
  in every Ludo game (with friends, Play live, against the bot and the Daily puzzle). Spectators see it as drawn.

## 1.31.0 (6 November 2026)

### For players

- **See how a match moved your rank.** The end of a Duel, and the final podium of a Party, now show what it did to
  your category ranks, e.g. "Puzzles rank +6".
- **Music crossfades.** Moving between areas fades the old track out while the new one fades in.
- **Music and sounds work offline.** Once heard, they are kept on your device, so they start instantly next time.
- **Keep my other audio playing.** A new Settings switch lets your own music or podcast keep playing alongside SPUZL
  (on iPhone the game then follows the silent switch).
- **Play live Ludo with 3 or 4 players.** Pick the table size on the Play live screen; you're seated with players who
  chose the same size and rules. Tables of 3 or 4 are casual (not rated).
- **Ludo free play is a full game against the bot.** "Play" on Ludo opens the bot game with its setup screen; the
  Daily stays the pick-the-best-move puzzle.

## 1.30.1 (5 November 2026)

### For players

- **Sound is on by default.** Sound effects and music are switched back on for everyone once (you can still turn
  them off in Settings or the game menu, and that choice holds). On iPhone, game sound now plays even with the silent
  switch on.
- **Alerts on by default.** Once you're signed in, SPUZL asks to turn on alerts on your first screen outside a game,
  not just on Duel, Party and Friends. "Not now" asks again a few days later, three times at most.

## 1.30.0 (5 November 2026)

### For players

- **New sound effects.** Taps, tiles, wins, chess and draughts pieces, Ludo dice, Oware seeds and the rest are now
  recorded sounds made with ElevenLabs, trimmed and levelled to sit together. They load quietly in the background; until
  they have (and in low-data mode) the old sounds play, so nothing ever waits.

## 1.29.2 (5 November 2026)

### For players

- **Music everywhere.** Home and menus get a funky nu-disco loop, and Logic games a lo-fi hip hop loop with a proper
  drum beat. Every area of SPUZL now has its own recorded track.

## 1.29.1 (5 November 2026)

### For players

- **Music is back, with real recorded tracks.** Duels and Party, Word games, Reflex games and Board games each have
  their own loop, made with ElevenLabs and picked by ear. Home and Logic games stay quiet until their new tracks are
  ready. Settings > Music turns it off.

## 1.29.0 (5 November 2026)

### For players

- **Duels and Parties count towards your rank.** Every round you play against people moves your rating in that
  game's category (Logic, Word, Reflex or Board), at half the weight of a solo puzzle. Winning a round helps, losing
  one costs a little, and rounds against bots never count.
- **Ludo setup before every match.** Playing Ludo against the bot now opens a setup screen first: bot level, 2 to 4
  players, and the house rules (Back-kick, Side-kick, Home-kick). The bots play by the same rules. "Change players or
  rules" is there after each game.
- **Play live Ludo with house rules.** The Play live screen for Ludo shows the house rules too, and pairs you only with
  someone who picked the same rules.
- **Ludo with friends: 2, 3 or 4 players.** Pick how many before you invite; the game starts when that many have
  joined. The new-game sheet now scrolls on short phones so nothing is cut off.

## 1.28.1 (5 November 2026)

### For players

- **You choose the game for every Duel.** The Duel screen starts on "Select game" instead of picking Sixer for you;
  Quick Match and Challenge wait until you pick a game (or Any game).
- **Challenging a friend from your friends list asks which game first.** The sword next to a friend opens
  "Challenge <name>" with the game picker; once you send it, your friend gets the invite on their screen (or as a
  notification) straight away.

## 1.28.0 (5 November 2026)

### For players

- **Ludo house rules.** Starting a Ludo game with friends or the Practice bot, switch on any of:
  - **Back-kick:** move back by your roll to take a rival right behind you.
  - **Side-kick:** land straight across the lane from a rival (same line, other side) and take it.
  - **Home-kick:** on an exact roll, run up a rival's home column and take a piece there (your piece then waits at
    the mouth of that column).
    The rules show above the board and carry over to rematches. Safe squares and blocks still protect. When a piece
    can move two ways, you pick which. Quick Match stays standard.
- **Shake to roll.** Shake your phone to roll the die when it's your turn (or tap the die, or Roll).
- **The die sits in the middle of the board,** turns to face you when it lands, and the face that counts is
  ringed in gold.
- **Names, not colours.** "Ama rolled 4", "Kofi's turn": Ludo says who, not "red".
- **Know your colour.** A chip above the board says "You are Red" (or your colour).
- **Background music is off for now** while the generated tunes are replaced with properly produced tracks.
  Sound effects are unchanged.

## 1.27.1 (5 November 2026)

### For players

- **No more xylophones.** Home, Words & Quiz and Puzzles music play on a warm electric piano instead of marimba
  and bells.

## 1.27.0 (5 November 2026)

### For players

- **New, brighter music for Home and for Duels and Parties.** Home and the menus play a cheerful marimba groove
  over shakers in a major key; Duels and Parties (their lobbies included) play a livelier, bright plucked tune over
  a punchy beat. Game tunes are unchanged.

## 1.26.1 (5 November 2026)

### For players

- The one-time "Know when it's your turn" alerts question now shows up as intended (it checked before your
  account had loaded and then never looked again).

## 1.26.0 (5 November 2026)

### For players

- **Alerts are on by default.** The first time you open Duels, Parties, Board Games or Friends, SPUZL asks once if
  you'd like alerts for your turn, nudges and invites. Say yes and they're on, on this device and every device you
  sign in on that already allowed them (browsers need that one yes; we can't switch them on silently). The Settings
  switch shows on once they are.
- **Take back a friend request.** Requests you sent are listed on the Friends page with a Cancel button, and the
  player's profile shows "Request sent · Cancel".
- **Add friends after a game.** At the end of a Duel, after the last game of a Party and when a board game
  finishes, everyone you played who isn't a friend yet has an Add friend button (Accept if they already asked you,
  Requested if you did; tap that to cancel).
- **Edit your Spuz from your profile.** Your avatar on the profile has a pencil; tap it to change your look in
  the shop.

## 1.25.2 (5 November 2026)

### For players

- **Ludo pieces are discs now, on a board that faces you.** The pieces are turned discs like the draughts ones (each
  with its shape in the middle), and the board sits flat facing you like the draughts board instead of leaning
  away. Tapping a piece works anywhere on it again: the standing pawns rose over the square behind them, so a tap
  on a pawn's head missed.
- **Hints only when you ask.** In real games a hint appears only when you tap Hint. Only the practice round (your
  first try of a game) offers a free hint by itself, and now after 15 seconds without a move instead of 6.

## 1.25.1 (5 November 2026)

### For players

- **Ludo: sixes never cost you the turn.** A third 6 in a row (or a fourth) is just another 6 now: you move and
  roll again, as many times as the dice give you sixes.

## 1.25.0 (5 November 2026)

### For players

- **Ludo plays by Ludo King's rules.** We checked our rules against Ludo King (the most played Ludo) and added
  the one that was missing: **blocks**. Two or more of your pieces on the same plain square form a block, and
  rivals can't land on it or move past it (your own pieces can). Safe squares (the stars and start squares) never
  block. Everything else already matched: a 6 to come out, another roll after a 6, a capture or a piece reaching
  home, a third 6 in a row ends your turn, eight safe squares, and an exact roll to finish. The bot and the Ludo
  puzzles follow the new rule too.

### For the team

- **The admin console stops asking you to sign in again.** A verified admin sign-in now lasts a week of inactivity
  instead of 12 hours from sign-in (every use slides it forward), and the admin session is refreshed on admin page
  loads like the player session, so a page render never has to refresh it without saving it. Current sign-ins
  were extended to the new window.

## 1.24.0 (5 November 2026)

### For players

- **Alerts even with SPUZL closed.** Turn on "Turn and invite alerts" in Settings (or tap the bell on a board game)
  and your phone or computer shows a notification when it's your turn in a board game, when your rival nudges you,
  and when a friend invites you to a Duel, a Party or a board game, even if SPUZL isn't open. Tap it to go straight
  there. With SPUZL open on screen you get the in-app card instead, never both. Switch it off any time in Settings.
  (On iPhone this needs SPUZL added to the Home Screen; that's Apple's rule for web apps.)

## 1.23.0 (4 November 2026)

### For players

- **No word filter in 18+ games.** Two Truths statements, Draw It guesses and the chat in those 18+ rooms take any
  words now. Phone numbers, links and social handles are still blocked (that keeps strangers from being pulled off
  SPUZL), the Report button stays, and everything else (all-ages Parties, Duels, Board Games chat) keeps its filter.

## 1.22.2 (4 November 2026)

### For players

- **You stay signed in.** Some players were signed out and quietly turned into a new guest. The cause was the
  sign-in token being refreshed in the background by link prefetches whose answers the browser threw away; the
  old token, used later, counted as stolen and ended the session. Prefetches no longer touch the session, and the
  token now has a 2-minute grace window for a refresh that crosses another (set in Supabase Auth on preview and
  production). Sessions themselves never time out: you stay signed in until you sign out.

## 1.22.1 (4 November 2026)

### For players

- **The X in a Party room takes you out again.** It removed you from the room but left you looking at an empty
  lobby ("0 of 8 in"). The X in the lobby and Leave on the results screens now take you back to Party, in every
  kind of room (Party Race, Draw It and Two Truths).

## 1.22.0 (4 November 2026)

### For players

- **Skip a round in a Party.** Stuck on a game you don't fancy? Tap "Skip this round" under the race standings
  (it asks once). You score 0 for that game and drop to the bottom of its podium, the round stops waiting for you,
  and you're straight back in for the next game. Everyone sees "Skipped" by your name.
- **Chat messages pop up on screen.** A message from the other players now pops up over the game with a soft
  sound and stays a few seconds (longer for longer messages). Tap it to open the chat. If the instant delivery
  misses one, the app picks it up within a few seconds anyway.
- **Chat in Board Games.** Chess, Draughts, Oware, Ludo and Four Up against people now have the same chat as Duels
  and Parties: quick messages for everyone, typing in 16+ games, the same friendly filter. Open it from Chat in the
  tools or from the reactions.
- **Rematch as often as you like.** After a rematch, the Rematch button now works again at the end of the next game
  too, in Duels and Board Games, game after game.

## 1.21.0 (4 November 2026)

### For players

- **Invite the friends you already have.** When you challenge a friend to a Duel, open a Board Games invite (Ludo,
  Chess and the rest) or wait in a Party room, your friends list is right there, online friends first, each with
  an Invite button. One tap and a card pops up on their screen, wherever they are in SPUZL, with a Join button that
  takes them straight in. The code and link are still there for everyone else.
- Invites only go to accepted friends, never across a block, and only into a game that is yours and still open.

## 1.20.0 (4 November 2026)

### For players

- **Ludo looks like a real board now.** The classic red, green, yellow and blue board, printed with stars on the
  safe squares, arrows on the start squares and the coloured triangles in the middle, in a wooden frame, seen at a
  slight angle. The pieces are turned wooden pawns that stand up off the board (each still carries its shape on top,
  so you never need colour alone to tell players apart).
- **A real die.** Tap the die (or Roll) and it tumbles, bounces and lands on your number. Your rival's rolls tumble
  too, so you see every throw. Same die in the Ludo puzzle.
- **It tells you when it's your turn.** In every board game (Chess, Draughts, Oware, Ludo, Four Up), when the turn
  comes back to you there's a chime and a buzz, and "Your turn" lights up by your name. Anywhere else in SPUZL a card
  pops up with a Play button. In a background tab the title flashes, and if you tap the bell on the game screen
  your browser can send you a notification too.

## 1.19.0 (4 November 2026)

### For players

- **Type in a friend's code to join their Duel.** The Duel screen has a new "Got a friend's code?" button that
  works like joining a Party: type the 4-character code your friend sees on their challenge screen (or got in a
  message) and you're in their duel, no link needed.
- **Any code, any box.** The code box on Duel and the Join tab on Party both take any friend's code, a Duel, a
  Party room or a Board Games invite, and take you to the right place. A code that's closed or wrong says so.

## 1.18.2 (4 November 2026)

### For players

- **Flowline's board no longer shakes when you turn a pipe.** Turning a pipe on the edge of the board swung its
  ends past the board's edge for a moment, which flashed scrollbars and jolted the whole board. The board now clips
  at its edge, and a pipe makes a smooth quarter turn instead of overshooting and springing back.

## 1.18.1 (4 November 2026)

### For players

- **No look-alike Dash levels.** Every Dash level is now a different kind of run: its spikes, gaps, steps, length,
  and whether it has a low spiked roof or floating slabs. Rooms that only repeated an earlier one are gone (Rusty
  Climb's twin Cheeky Hurdle among them), so Dash has 36 levels instead of 41. Nothing else about Dash changed. If
  you'd gone past the new end, the ladder shows as finished.

## 1.18.0 (4 November 2026)

### For players

- **Gotcha is a Level Devil-style rage game now, from Level 1.** Every level is a brand-new room, about three times
  longer than before from the start (around 70 tiles at Level 1, up to about 155 by Level 60, where Level 1 used to be
  24), with hazards close together and six to nine lies spread through each room: floors that fall as you land,
  spikes that pop where you were about to step, walls that spring up in front of you, landings that turn to spikes
  mid-jump, and a door that runs away when you reach it.
- **Tough, never impossible.** Our bot beats every room without dying before it ships, with timing a person can hit:
  every jump in its run still works when pressed a few frames early or late. Pits and spike rows are never wider
  than two tiles, there's always room to land and take off again, and after your first death every trap in the
  room is outlined.
- **60 Gotcha levels**, up from 52, and no two follow the same pattern of tricks.
- Gotcha Dailies and free play use the new rooms too, three to five per course. The old short rooms stay for
  replays of past Dailies.
- The hint now warns about the first trick you'll meet in the room.

## 1.17.0 (3 November 2026)

### For players

- **Gauntlet is retired.** It was ten Gotcha rooms in a row, so Gotcha covers it. Arcade now has 6 games and SPUZL 28. Your Gauntlet results stay on your record. The four Rage Survivor badges move to a Daily Gotcha or Dash with
  that many deaths or fewer; badges you already earned stay earned.
- **Puzzle levels change from one to the next.** Levels used to sit on one difficulty for 7 to 13 levels at a time
  (and on Crownfall, Dusk, Weave, Flowline, Pair Up and Lost, one board size), so a run of levels felt like the same
  puzzle again. Difficulty now moves inside every block of five: two steady levels, a breather, another, then a
  **Boss level** a step harder (and on most games a bigger board). It still climbs overall, and from level 36
  expert and mega blocks take turns. The level sheet marks boss levels. Level numbers you've cleared stay cleared;
  the boards behind uncleared levels are new.
- **Gotcha and Dash levels are all different.** Too many rooms were the same idea again (on Dash, 22 of 64 were
  just spikes on flat ground). Each room is now summed up by what it asks of you (its traps, spikes, gaps and
  ledges) and no kind appears more than twice, never twice in a row. Gotcha has 52 levels and Dash 41; if you'd
  gone past the new end, the ladder shows as finished.

## 1.16.1 (3 November 2026)

### For players

- **The landing page demo fits its card again.** The Try it Crownfall board sized itself from the whole window
  (since game boards grew to fill big screens in 1.10.0), so on a computer it spilled out of its card and on a
  phone the fit-to-screen step shrank it to a postage stamp. It now sizes to the card on every screen.
- **No music on the landing page.** The landing page and the info pages (How to play, Fair play, Privacy, Terms,
  Contact) are quiet; music starts once you're in the app.

## 1.16.0 (3 November 2026)

### For players

- **Background music, everywhere.** Home and the menus play a warm lo-fi track; every game has its own tune in
  its category's sound: calm bells for Puzzles, a light jazzy marimba for Words & Quiz, upbeat chiptune for Arcade,
  kora-style plucks over a West African bell pattern for Board Games, and a driving Versus track in duels and
  parties. Each game's tune keeps its own key, tempo, chords and melody, and every fourth phrase drops back so it
  never drones. It fades in, ducks under big celebrations, pauses when you leave the tab, and stays quiet in Beat
  Tap and Echo (their play is sound) and on the intro.
- **On by default.** Music now plays unless you switch it off in Settings (your choice holds from then on). Low-data
  mode still turns it off.

### Under the hood

- `lib/audio/music.ts`: a generative sequencer (lookahead scheduling on the audio clock; pads built from diatonic
  chords, bass, a lead per style, grooves), seeded per game. `MusicDirector` picks the track from the route.
  Levels checked offline: no clipping, the six styles within 3 dB of each other, well under the sound effects.

## 1.15.1 (3 November 2026)

### For players

- **The streak calendar shows every day you played.** It only counted Dailies, which are switched off, so free
  play, levels, duels and parties left it empty even while the streak grew. Any cleared puzzle (free play, levels,
  archive, Daily) or any game that earned XP (duels, parties) now marks the day as played. Badges, quests and
  league rewards don't count as play.

## 1.15.0 (3 November 2026)

### For players

- **Chat in Duels and Parties.** A Chat button sits under the reactions (in the duel's reaction menu, between
  rounds, on the duel result and in the party lobby). The panel shows the room's messages, the reactions, quick
  phrases (Good luck!, Nice one!, GG, Rematch? and more) and a text box. New messages pop up for a few seconds while
  the panel is closed, with an unread count, and Mute pop-ups quiets them for the match.
- **Kept safe.** Typed messages are checked on the server before anyone sees them: abuse, phone numbers, emails,
  links and handles are refused with a friendly note. A room with any player under 16 uses quick phrases only. No
  chat with the Practice bot. Chat is kept for 7 days.
- **Twice the reactions.** 👏 😮 😅 and 🤝 join 🔥 😂 😤 and GG, everywhere reactions appear (duels, parties, live
  board games).

### Under the hood

- `match_messages` (migration `20261124000001`, applied to preview and production before release), `GET/POST
/api/v1/matches/:id/chat`, `useMatchChat`, `ChatPanel` and `ChatPopup`. Realtime only pings ("chat"); devices
  read messages back from the server, so nothing unfiltered reaches anyone.

## 1.14.1 (3 November 2026)

### For players

- **Find friends by typing.** Friends' search box lists matching players as you type (names starting with what
  you typed first), each with Add, or Accept when they already asked you, Requested or Friends. Under-16s never
  appear (they add friends by invite link or QR).
- **Activity says who you played.** "You beat Tracy 2-1 in a Duel in Coil", "You won a Duel against Tracy in Coil.
  Tracy left early", "Kofi won a Party Race against 4 players, 3 games". Older entries fill in too.
- **The paused duel board shows your game.** While the other player reconnects, the board area shows your round's
  game ("Your Coil board is saved") instead of a coloured tile pattern from another game.

## 1.14.0 (3 November 2026)

### For players

- **A duel card worth sharing.** Share on a duel result now makes a picture card, SPIL style, from your own side:
  a tilted banner (VICTORY!, SO CLOSE, DEAD HEAT, WALKOVER!), both players' Spuz face to face in their own
  colours with a crown for the winner, the score, the three rounds with both times, one award (Clean sweep,
  Comeback, Clutch, Won by forfeit, Dead heat, Pushed them all the way, Rematch incoming), the rating change, the
  head-to-head record and a dare ("Think you can beat me?"). Pick Story (9:16, for Instagram and WhatsApp
  Status) or Square, and Hide names if you'd rather. WhatsApp, X, Instagram, TikTok, Copy and Save as before.
- **Head-to-head record.** Duels keep score between the two of you across every duel: "Head to head: you 3, Tracy
  2" before round one, and a "You 3 – 2 Tracy" row on the result.
- **Share links point at the real site.** Share text and cards said spuzl.gg, which never existed; they now say
  spuzl.vercel.app.

## 1.13.4 (3 November 2026)

### For players

- **Every finished flow has a way home.** A Home button sits in the top-left corner of the duel result, the
  ghost race result, the challenge result and the party podium (going home from a party also leaves the room,
  where Leave goes back to the party lobby), and a finished live board game has Home next to Rematch. The duel
  result's way home used to be visible only to screen readers.
- **Forfeit wins read properly.** A duel won because the other player dropped out or left says "You win" with
  "Forfeit win" as the result, instead of "You win 0-0".

## 1.13.3 (3 November 2026)

### For players

- **Keep playing what you're playing.** After a clear, the big button now continues the same game: "Next level of
  Trotro Jam" for games with levels (every Puzzles game, Gotcha, Dash and Gauntlet), "Another Coil" for the
  rest. The next game in the same category comes second ("Next in Puzzles: Weave"), never a jump back to Crownfall.
- **Continue picks up your latest game.** Home's Continue card (and Continue in the side panel on computers) opens
  the game you played most recently, at your next level when it has levels, instead of always suggesting the
  first Daily. Brand-new players still start on Crownfall.

### Under the hood

- `/api/v1/me` returns `recent` (the latest games started, newest first). `lib/game/next`: `nextInPath` walks
  the current game's own category (it used to restart the Dailies list, which sent every non-Daily game to
  Crownfall), plus `continueGame` and `continueHref`.

## 1.13.2 (3 November 2026)

### For players

- **Promotion picker on the board.** When a pawn reaches the last rank, the choice now opens right on the
  promotion square (as on the big online boards): a column of Queen, Knight, Rook and Bishop running toward the
  middle of the board, over a dimmed board, with a cancel button at the end. It used to sit under the board, where
  it could be cut off the screen. Tapping the dimmed board or pressing Escape puts the pawn back. Same in chess
  puzzles and live games, for both colours.
- **Live chess: tall back-rank pieces are no longer clipped** at the top edge of the board.

## 1.13.1 (3 November 2026)

### Under the hood

- **Sitemap and robots.txt for Google.** `/sitemap.xml` lists the public pages (landing, All games, the four game
  groups, How to play, Fair play, Privacy, Terms, Contact) for Search Console; `/robots.txt` points to it and keeps
  the admin console, the API and per-player or per-match pages (profiles, live games, rooms, invites) out of search.

## 1.13.0 (3 November 2026)

### For players

- **Board games sound like real boards.** Every piece sound is now physically modelled: a short contact transient
  ringing the piece's own resonances (1 to 4 kHz) and the board's (150 to 1000 Hz), with real wood damping, and
  slightly different every time.
  - **Chess:** picking a piece up is a faint felt lift; setting it down is a muted wooden "tok"; a capture is wood
    knocking wood, the taken piece toppling, then the move landing; castling is king then rook; check is a firmer
    placement with a low wood-block knock (it replaces the two electronic beeps).
  - **Draughts:** discs land edge first then slap flat; a jump drops the taken disc on the pile; crowning stacks a
    disc with a small settling rattle.
  - **Oware:** each seed drops into its pit with a real bounce; a capture is a handful of seeds scooped out.
  - **Ludo:** the die bounces and settles (each bounce shorter and softer); tokens hop square by square.
  - **Four Up:** the disc rattles down the column, faster as it falls, and clacks onto the stack.
  - **Puzzles:** placing a tile is a small tuned wooden bar instead of a synth blip, still climbing with your streak;
    sliding blocks (Trotro Jam) knock to a stop.
  - Live Board Bay games play the same sounds for both players' moves.

### Under the hood

- `lib/audio/physical.ts` (modal synthesis: `ring()` modes with T60 decays, `contact()` transients) and
  `lib/audio/boardMoves.ts` (`playBayMove` works out a live move's sound from the board before and after). New
  voices and palette events (`pieceLift`, `piecePlace`, `pieceCapture`, `castle`, `pieceCheck`, `discPlace`,
  `discCapture`, `discCrown`, `seedDrop`, `seedScoop`, `diceRoll`, `tokenStep`, `columnDrop`, `tile`); `clack` and
  `capture` are physical too. Levels checked offline: chess placement centred near 750 Hz with a 35 ms tail, no
  voice clips, the six game demos within 5 dB of each other.

## 1.12.0 (3 November 2026)

### For players

- **Pick your time in live board games.** Play live and live friend games let you choose how long each player gets:
  Chess and Draughts 3, 5, 10, 15 or 30 minutes; Oware 3 to 15; Four Up 3, 5 or 10; Ludo 5, 10 or 15. Play live
  asks first (your last choice is remembered per game) and only pairs you with someone who picked the same time.
  A rematch keeps the time, and the invite page says it ("Live, 10 minutes each"). 24 h per move games are
  unchanged. Ratings stay one per game whatever the time.

### Under the hood

- `CLOCK_MINUTES` / `clockMinutes()` in `lib/multiplayer/bay`; `POST /api/v1/bay` and `/api/v1/bay/queue` take
  `minutes` (anything a game does not offer falls back to its default). Migration `20261123000001` (applied to
  preview and production before release) and pgTAP `111_bay_time_controls`.

## 1.11.3 (3 November 2026)

### For players

- **Big screens get the room.** After a sweep of every main screen at 390, 1326, 1440 and 1920 px wide:
  - Category pages and All games show the games as cards in two columns (three on very wide screens) instead of
    one phone-width list.
  - Quests, Leagues, Profile, Shop, Friends, Crews and Settings use a 760 px column (880 px on very wide screens,
    was 560 px), and the Shop shows four or five items per row.
  - Duel, Party, Your move and sign-up open as a centred card on a computer, instead of a phone column with its
    buttons at the very bottom of the screen.

## 1.11.2 (3 November 2026)

### For players

- **The home map fills the screen.** The category islands grow with the screen instead of staying phone-sized: on a
  tablet or computer the map picks the arrangement that fits best (a 2 × 2 zigzag or a wide wave across the screen)
  and scales the islands up to almost twice their size, keeping room for the Continue bar. Phones keep the zigzag.

## 1.11.1 (3 November 2026)

### For players

- **Puzzles are blue, Arcade is red.** Every Puzzles game (tiles, menus, game screens, share cards) is now blue and
  every Arcade game red, next to green Words & Quiz and brown Board Games. The 3D game tiles are re-rendered and the
  Full Spuzl share strip reads 🟦🟦🟦🟦🟦🟩🟩🟩🟥🟥🟥. Colour-blind modes still swap these hues (tritan shows Puzzles
  violet, protan shows Arcade amber).

### Under the hood

- `lib/catalog` maps Puzzles to `--w-reflex` and Arcade to `--w-rage`. The `--w-*` tokens keep their values because
  games (Pair Up, Merge, Quads, party pens) use them as palette colours. Share card and prerender hex maps follow.

## 1.11.0 (3 November 2026)

### For players

- **Board games are wooden now.** Board Games' colour is walnut brown (was pink) on its tiles, menus, live Board Bay
  and share cards, and the chess and draughts boards are maple and walnut, so the boxwood and ebony pieces sit on a
  wooden board. A picked-up piece's square is gold, and the last move is a soft gold, so both still stand out. The
  oware board, Ludo track and Four Up frame are brown wood too.
- **New draughts pieces.** Boxwood and ebony men with an inlaid ring, matching the chess set. Kings wear a crown and a
  gold ring around the disc, so they stand out at a glance. Same on the puzzle board and in live games.
- **One colour per category.** Every game now wears its category's colour: all Puzzles are purple (Weave, Flowline,
  Pair Up, Lost and Trotro Jam were cyan or orange), all Words & Quiz green (Quickfire and Emoji Hits were red), all
  Arcade blue (Gotcha, Dash and Gauntlet were red), all Board Games brown. The 3D game tiles are re-rendered to match,
  and the Full Spuzl share strip reads 🟪🟪🟪🟪🟪🟩🟩🟩🔷🔷🔷.

### Under the hood

- `lib/catalog` `TONE` is empty (kept for deliberate exceptions; the prerender script reads it). `--w-board` is
  `#b07443`, ink `#7a4a22`; the Board Bay materials (`--bay-well/wood/safe/depth/pit-ink`) are browns.
  `SQUARE` gains `sel`; `draughtsDisc()` in `games/_shared/BayStyles` draws men for both boards.
  `public/3d/icons` and `icons-sm` re-rendered.

## 1.10.3 (3 November 2026)

### For players

- **Boxwood and ebony chess set.** White pieces are now warm boxwood with a soft brown edge and black pieces dark
  ebony, so every piece is easy to tell apart on both square colours (the old white pieces were near-pure white and
  pawns and bishops blurred together). Bishops have a cut in the mitre, so a bishop never reads as a pawn.

### Under the hood

- `spuzl3d.js` `pieces()` takes a set (`PIECE_SET`: material colour, roughness, environment, exposure, and an
  optional soft outline drawn around the solid piece only). Sprite URLs carry `?v=6`.

## 1.10.2 (3 November 2026)

### For players

- **Chess pieces stand in the middle of their squares.** Laid out like the big online boards' 3D sets: the board is
  seen from higher up, every piece's base sits centred in its square, a pawn fills about three quarters of the
  square, and kings, queens and bishops rise into the square behind them as on a real board. The original 3D look
  is back (the 1.10.1 restyle flattened it); only the size and placement changed. The shadow is a soft one straight
  under the base, so it no longer pulls pieces to one side.

### Under the hood

- `spuzl3d.js` `pieces()` v5: renders at 3x with the original materials and lights, measures each piece's outline
  and base, and places it on a shared scale in a 1 x 1.4 square sprite (base centre 50 % across, front rim 10 % above
  the bottom). Board squares no longer clip (`overflow-hidden` removed), the sprite is 140 % of a square tall and
  bottom-anchored, sprite URLs carry `?v=5`.

## 1.10.1 (3 November 2026)

### For players

- **New chess pieces.** The 3D set is rebuilt in the style of the big online boards: chunkier Staunton pieces in
  glossy ivory and lacquered black, each standing in the middle of its square on a soft shadow straight below (they
  sat on the bottom edge with a shadow off to the right before). Every piece is drawn with one camera at one scale,
  so the king fills about 85 % of a square and a pawn reads at a glance, even on a phone. Both knights face left,
  with a proper ear, snout and jaw; the queen has a coronet and the king a bevelled cross. White pieces get a
  hairline edge so they stand out on light squares. Chess, live Board Bay games and the captured-pieces trays all
  use the new set.

### Under the hood

- `design/.../spuzl3d.js` `pieces()` v4: a fixed camera with a view offset puts every base centre at 50 % × 80 % of
  its sprite, instead of bottom-aligning each sprite on its own. Sprites are now 256 px (was 192) and fill the square
  exactly (`inset: 0`, was 115 % and bottom-aligned). Sprite URLs carry `?v=4` so browsers fetch the new set.
  `ONLY_PIECES=1 pnpm prerender:3d` re-renders just the pieces.

## 1.10.0 (2 November 2026)

### For players

- **No on-screen keyboard on a computer.** When the device has a mouse or trackpad (a fine pointer that can hover),
  Rungs and Minicross show one line naming the keys instead (A–Z, Enter, Backspace) and the physical keyboard
  does the typing. **Show keyboard** brings the keys back (for touch laptops; a touch on the screen does it by
  itself) and **Hide keyboard** puts them away; the choice is remembered. Seven, Remix and the quiz games show
  their keys the same way, Emoji Hits puts the cursor in its guess box, and Rage Ridge (Gotcha, Dash, Gauntlet)
  shows "← → to move · Space to jump" instead of the on-screen pad, so the course gets the height. Phones and
  tablets keep their on-screen keys.
- **The board is the hero on big screens.** Boards now fill the height under the top bar (up to 90 % of the screen,
  960 px at most, was 80 % and 760 px) beside a slimmer side panel (320 px under 1280 px wide), with one-line tool
  buttons. On a 1326 × 645 laptop the Rungs ladder grows from 44 px to 65 px rows with 18 px clues; at 1440 × 900
  Chess squares go from 88 to 97 px (118 px on a 1920 × 1080 screen, a 944 px board); Remix tiles from 48 to 112 px; Seven's honeycomb, Echo's pads, Beat Tap,
  Flinch and the Oware pits grow too. Quickfire and Emoji Hits read larger with the answers two by two.
- **First-time practice note is one line.** "First time playing …? Free hints, nothing counts yet." with Skip sits in
  the top bar on big screens and as one slim line on phones, instead of a card that took a panel slot.
- **Phones fit without scrolling.** Rungs uses tighter rows and the compact keyboard under 860 px of height,
  Minicross the compact keyboard (NEXT on the third row), and Minicross, Coil and Buried step their cells down
  until the board, the keys and the tools fit a 375 × 667 screen. Buried's theme moves to the side panel on big
  screens so its grid no longer runs off a laptop screen. Oware pits share the phone width (50 px on a 390 px
  phone, was 48).

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
