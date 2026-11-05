# Changelog

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
