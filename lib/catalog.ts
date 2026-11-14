import { killer } from "@/lib/copy/killer";
import { dara } from "@/lib/copy/dara";

/**
 * The Grid. Source: design Game Boards (icon set + phases) and SRS section 5.
 * The design wins on the list (adds Board Bay); the SRS supplies rules text.
 * Every live game is playable anytime: Daily + endless Free play. `phase` only orders the build and the
 * "new" badge, it never gates play.
 *
 * Retired games (RETIRED_IDS) keep their code, boards and tests so they can come back, but they are out of
 * every player-facing list (GAMES, WORLDS, LAB_GAMES) and the server refuses them like an unknown game
 * (`playableGame`, `lib/game/service.ts`). Counts on screens come from the games that are On
 * (`playerGames(s).length`), or the catalogue (GAME_COUNT, WORLD_COUNT) for static text, never typed by hand.
 * To bring a game back, take its id out of RETIRED_IDS and
 * set its `games.status` to 'live' (or 'testing', so only admins can try it first) in a migration. Every game that is
 * not retired has a runtime state the admin sets on the Games page (On, In testing, Off: `gameState`, `openGame`).
 */
export type WorldId = "logic" | "line" | "shape" | "number" | "word" | "clue" | "reflex" | "rage" | "board";

/**
 * SPUZL's one interface colour (owner's call: lemon green, uniform across the app). Buttons, titles, highlights and
 * the `--world` variable games read all use it; a world's own colour stays only on its map island and game art.
 */
export const UI_ACCENT = "var(--accent)";

export interface World {
  id: WorldId;
  name: string;
  /** CSS var for the fill colour, e.g. var(--w-logic) */
  color: string;
  /** CSS var for world-coloured text on light theme */
  ink: string;
  tagline: string;
  /** Phosphor icon name for the island landmark */
  icon: string;
}

export type Engine = "grid" | "word" | "phaser" | "board" | "custom";
export type Phase = "L" | "M2" | "M3+";

export interface GameMeta {
  id: string;
  name: string;
  world: WorldId;
  /** Phosphor icon (kebab-case, without ph- prefix) used for the 3D tile */
  icon: string;
  phase: Phase;
  engine: Engine;
  /** One-line card description (World view) */
  blurb: string;
  /** One-line rule shown under the title on the game screen */
  rule: string;
  /** Logic puzzles must be proven unique before scheduling */
  unique: boolean;
  /** Scoring: fastest time, or highest score (time breaks ties), or fewest deaths then time */
  scoring: "time" | "score" | "deaths";
  /** Human floor for anti-cheat, ms. Clears faster than this are flagged, not ranked. */
  minTimeMs: number;
  /** Uses human-written content that needs editorial review */
  content?: "human" | "curated";
  /** Has a flashing/fast visual, shows the photosensitivity notice once */
  photosensitive?: boolean;
  /** Offers "Play a full game vs bot" (casual, on the device, no XP): /play/<id>/bot */
  botPlay?: boolean;
  /** Lab game: starts In testing (admins only) until an admin switches it On on the Games page (`DEFAULT_SWITCH`) */
  lab?: boolean;
  /** Retired (RETIRED_IDS): kept in code, hidden from players and refused by the server. Set by the catalog. */
  retired?: boolean;
  /**
   * Another board size of the game named here (owner, 14 Nov 2026: Sixer and Nine are one game, Spuzdoku, 6 × 6 or
   * 9 × 9). Playable, with its own levels and stats, but never listed or counted on its own: players reach it
   * from the size picker (components/play/SizePicker).
   */
  variantOf?: string;
  /**
   * Recently added or brought back (R2-18's `isNew` option on the game, or R2-14's NEW_IDS): the default for the
   * Library's "new" tag (Home's "N new games" card and the New filter); the admin Library page can add or remove
   * the tag per game (games.tags), which wins over this.
   */
  isNew?: boolean;
}

/**
 * Every world the code knows, including ones with no live game left (admin, colours, old results).
 * The owner regrouped the live games into 4 broad worlds (2026-11): Puzzles, Words & Quiz, Arcade and Board Games.
 * They reuse the ids of the worlds they grew from (logic, word, reflex, board), so /world URLs, ratings and badge
 * ids stay put. The other five worlds now hold only retired games, so they stay hidden (WORLDS below).
 * Order here is the order of the Home map and every world list.
 */
export const ALL_WORLDS: World[] = [
  {
    id: "logic",
    name: "Puzzles",
    // Puzzles are blue and Arcade red (owner's call, 2026-11). The --w-* tokens stay as they are because games also
    // use them as palette colours, so only the world-to-token mapping moved.
    color: "var(--w-reflex)",
    ink: "var(--w-reflex-ink)",
    tagline: "Logic grids, paths and sliding jams",
    icon: "puzzle-piece",
  },
  {
    id: "word",
    name: "Words & Quiz",
    color: "var(--w-word)",
    ink: "var(--w-word-ink)",
    tagline: "Word games and quick trivia",
    icon: "chat-circle-text",
  },
  {
    id: "reflex",
    name: "Arcade",
    color: "var(--w-rage)",
    ink: "var(--w-rage-ink)",
    tagline: "Memory, rhythm, reflex and action",
    icon: "game-controller",
  },
  { id: "board", name: "Board Games", color: "var(--w-board)", ink: "var(--w-board-ink)", tagline: "Classic board games", icon: "horse" },
  // Retired worlds: no live game left, so hidden from players. Kept for old results, colours and earned badges.
  { id: "line", name: "Line Lane", color: "var(--w-line)", ink: "var(--w-line-ink)", tagline: "Paths and lines", icon: "path" },
  { id: "shape", name: "Shape Shed", color: "var(--w-shape)", ink: "var(--w-shape-ink)", tagline: "Shapes and space", icon: "cube" },
  { id: "number", name: "Number Den", color: "var(--w-number)", ink: "var(--w-number-ink)", tagline: "Numbers", icon: "hash" },
  {
    id: "clue",
    name: "Clue Cave",
    color: "var(--w-clue)",
    ink: "var(--w-clue-ink)",
    tagline: "Clues and knowledge",
    icon: "magnifying-glass",
  },
  { id: "rage", name: "Rage Ridge", color: "var(--w-rage)", ink: "var(--w-rage-ink)", tagline: "Action and rage", icon: "fire" },
];

const g = (
  id: string,
  name: string,
  world: WorldId,
  icon: string,
  phase: Phase,
  engine: Engine,
  blurb: string,
  rule: string,
  opts: Partial<
    Pick<GameMeta, "unique" | "scoring" | "minTimeMs" | "content" | "photosensitive" | "botPlay" | "lab" | "isNew" | "variantOf">
  > = {},
): GameMeta => ({ id, name, world, icon, phase, engine, blurb, rule, unique: false, scoring: "time", minTimeMs: 4000, ...opts });

/** Every game the code knows, before retirement is applied. Use GAMES / ALL_GAMES below. */
const MAIN_GAMES: GameMeta[] = [
  // Puzzles: logic grids (the old Logic Lab; Killer Sums, Light Up, Pixl and Tripwire graduated from the lab)
  g(
    "crownfall",
    "Crownfall",
    "logic",
    "crown-simple",
    "L",
    "grid",
    "Crowns on coloured regions",
    "One crown per row, column and colour. Crowns never touch, not even corners.",
    { unique: true, minTimeMs: 6000 },
  ),
  g(
    "dusk",
    "Dusk",
    "logic",
    "sun-horizon",
    "L",
    "grid",
    "Suns and moons, balanced rows",
    "Suns and moons. Equal per row and column, never 3 in a line. = means same, × means different.",
    { unique: true, minTimeMs: 8000 },
  ),
  // Spuzdoku (owner, 14 Nov 2026): Sixer and Nine are one game with two board sizes, picked before each game. The ids
  // stay, so levels, stats and saved games carry on; "nine" is the 9 × 9 size and is never listed on its own.
  g(
    "sixer",
    "Spuzdoku",
    "logic",
    "grid-nine",
    "L",
    "grid",
    "Number grid, 6 × 6 or 9 × 9",
    "Every number once in each row, column and box. Pick a 6 × 6 or 9 × 9 board.",
    { unique: true, minTimeMs: 15000 },
  ),
  g(
    "nine",
    "Spuzdoku",
    "logic",
    "number-square-nine",
    "M3+",
    "grid",
    "Number grid, 9 × 9",
    "1 to 9 once in every row, column and 3 × 3 box.",
    { unique: true, minTimeMs: 40000, variantOf: "sixer" },
  ),
  g("killer", killer.title, "logic", "circle-dashed", "M3+", "grid", killer.blurb, killer.rule, {
    unique: true,
    minTimeMs: 15000,
  }),
  g(
    "lightup",
    "Light Up",
    "logic",
    "lamp",
    "M3+",
    "grid",
    "Light every cell with lamps",
    "Light every white cell. No lamp lights another; a number counts lamps beside it.",
    { unique: true, minTimeMs: 8000 },
  ),
  g(
    "pixl",
    "Pixl",
    "logic",
    "checkerboard",
    "M2",
    "grid",
    "Number clues paint a picture",
    "Fill cells so each row and column matches its number clues.",
    { unique: true, minTimeMs: 10000 },
  ),
  g(
    "tripwire",
    "Tripwire",
    "logic",
    "bomb",
    "M3+",
    "grid",
    "No-guess minesweeper",
    "Reveal every safe tile. Numbers count the mines touching a tile.",
    { unique: true, minTimeMs: 8000 },
  ),
  g(
    "blackout",
    "Blackout",
    "logic",
    "lightbulb-filament",
    "M2",
    "grid",
    "Lights out in fewest moves",
    "Tap a tile to flip it and its 4 neighbours. Turn every light off.",
    { minTimeMs: 3000 },
  ),
  // Puzzles: paths and mazes (from Line Lane; isles stays there, retired)
  g(
    "weave",
    "Weave",
    "logic",
    "path",
    "L",
    "grid",
    "One path through every cell",
    "One path through the numbers in order, filling every cell.",
    { unique: true, minTimeMs: 5000 },
  ),
  g("flowline", "Flowline", "logic", "drop", "L", "grid", "Rotate pipes, water every plant", "Rotate pipes so water reaches every plant.", {
    unique: true,
    minTimeMs: 5000,
  }),
  g(
    "isles",
    "Isles",
    "line",
    "circles-three",
    "M3+",
    "grid",
    "Bridges between islands",
    "Join islands with 1 or 2 bridges to match each number. No crossings, all connected.",
    { unique: true, minTimeMs: 10000 },
  ),
  g(
    "pairup",
    "Pairup",
    "logic",
    "link-simple",
    "M2",
    "grid",
    "Join the matching dots",
    "Join matching dots without crossing lines. Fill the whole grid.",
    { unique: true, minTimeMs: 4000 },
  ),
  g("lost", "Lost", "logic", "signpost", "M3+", "grid", "Escape the foggy maze", "Find the exit. The fog lifts as you move.", {
    minTimeMs: 5000,
  }),
  // Shape Shed (retired world); Trotro Jam is a Puzzle
  g(
    "quilt",
    "Quilt",
    "shape",
    "layout",
    "L",
    "grid",
    "Split the grid into rectangles",
    "Split the grid into rectangles. Each holds one number, equal to its area.",
    { unique: true, minTimeMs: 6000 },
  ),
  g(
    "snug",
    "Snug",
    "shape",
    "puzzle-piece",
    "M2",
    "grid",
    "Fit every block in the outline",
    "Fit every block exactly into the outline. Tap a block to rotate it.",
    { unique: false, minTimeMs: 6000 },
  ),
  g(
    "shuffle",
    "Shuffle",
    "shape",
    "arrows-out-cardinal",
    "M3+",
    "grid",
    "Slide tiles to fix the picture",
    "Slide tiles into the gap until the picture is whole.",
    { minTimeMs: 8000 },
  ),
  g(
    "reflect",
    "Reflect",
    "shape",
    "flip-horizontal",
    "M3+",
    "grid",
    "Mirror the pattern",
    "Complete the mirror half of the pattern across the axis.",
    { unique: true, minTimeMs: 4000 },
  ),
  g("squint", "Squint", "shape", "eye", "M3+", "custom", "Spot every difference", "Find every difference between the two pictures.", {
    minTimeMs: 4000,
  }),
  g(
    "trotro",
    "Trotro Jam",
    "logic",
    "bus",
    "M3+",
    "grid",
    "Free the trotro from the station",
    "Slide cars and trucks along their lanes until the trotro can drive out of the exit.",
    { minTimeMs: 5000, isNew: true },
  ),
  // Puzzles: number puzzles (were Number Den), graduated from the lab
  g(
    "market",
    "Market Run",
    "logic",
    "storefront",
    "M3+",
    "custom",
    "Shop Makola to the exact change",
    "Buy 1 to 9 of each item so you bring back the exact change and every rule on the list holds.",
    { unique: true, minTimeMs: 8000 },
  ),
  g(
    "hilo",
    "Higher or Lower",
    "logic",
    "arrows-down-up",
    "M3+",
    "custom",
    "Call the next card",
    "Work out the next card. Higher or lower than this one? Ten calls, three slips and you are out.",
    { scoring: "score", minTimeMs: 6000 },
  ),
  // Number Den (retired world). Market Run and Higher or Lower (above) are Puzzles now.
  g(
    "deadon",
    "Dead On",
    "number",
    "target",
    "L",
    "custom",
    "Hit the target number",
    "Use the numbers once each with + − × ÷ to hit the target.",
    { scoring: "score", minTimeMs: 3000 },
  ),
  g(
    "merge",
    "Merge",
    "number",
    "arrows-merge",
    "M3+",
    "grid",
    "Merge tiles before time runs out",
    "Swipe to merge matching tiles. Build the highest tile in 3 minutes.",
    { scoring: "score", minTimeMs: 0 },
  ),
  g(
    "sums",
    "Sums",
    "number",
    "plus-minus",
    "M2",
    "grid",
    "Runs that add up",
    "Fill 1 to 9 so each run adds to its clue, with no repeats in a run.",
    { unique: true, minTimeMs: 12000 },
  ),
  g(
    "equal",
    "Equal",
    "number",
    "equals",
    "M3+",
    "grid",
    "Make every equation true",
    "Fill the blanks so every row and column equation is true.",
    { unique: true, minTimeMs: 8000 },
  ),
  // Words & Quiz: words (the old Word Woods)
  g(
    "coil",
    "Coil",
    "word",
    "scribble-loop",
    "L",
    "word",
    "Snake out the themed words",
    "Snake through letters to find themed words. Every letter gets used.",
    { content: "human", minTimeMs: 8000 },
  ),
  g(
    "rungs",
    "Rungs",
    "word",
    "ladder",
    "L",
    "word",
    "Climb the one-letter ladder",
    "Answer the clues, then order the words so each changes one letter.",
    { content: "human", minTimeMs: 10000 },
  ),
  g(
    "quads",
    "Quads",
    "word",
    "squares-four",
    "L",
    "word",
    "Four groups of four",
    "Sort 16 words into 4 hidden groups of 4. Four mistakes allowed.",
    { content: "human", minTimeMs: 8000 },
  ),
  g(
    "seven",
    "Seven",
    "word",
    "asterisk",
    "M2",
    "word",
    "Words from seven letters",
    "Make words from the 7 letters. The centre letter is in every word.",
    { content: "curated", scoring: "score", minTimeMs: 0 },
  ),
  g(
    "minicross",
    "Minicross",
    "word",
    "grid-four",
    "L",
    "word",
    "A 5 by 5 crossword",
    "Fill the 5 × 5 grid from the clues. Tap again to switch direction.",
    { content: "human", minTimeMs: 8000 },
  ),
  g(
    "buried",
    "Buried",
    "word",
    "shovel",
    "M3+",
    "word",
    "Word search with a secret",
    "Find every word. Leftover letters spell a secret phrase.",
    { content: "curated", minTimeMs: 8000 },
  ),
  g(
    "remix",
    "Remix",
    "word",
    "shuffle",
    "M3+",
    "word",
    "Unscramble against the clock",
    "Unscramble the word. Three rounds, against the clock.",
    { content: "curated", minTimeMs: 2000 },
  ),
  g(
    "five",
    "Five",
    "word",
    "text-aa",
    "M3+",
    "word",
    "Find the hidden 5-letter word",
    "Guess the 5-letter word in 6 tries. Tiles show right spot, in the word, or not in it.",
    { content: "curated", minTimeMs: 4000 },
  ),
  // Words & Quiz: trivia (from Clue Cave; the rest stays there, retired). Pinned, Flagged and Two Truths and a Lie
  // graduated from the lab.
  g(
    "hunch",
    "Hunch",
    "clue",
    "question",
    "L",
    "custom",
    "Guess the category from clues",
    "Guess the hidden category. Fewer clues, better score.",
    { content: "human", scoring: "score", minTimeMs: 2000 },
  ),
  g("quickfire", "Quickfire", "word", "timer", "M2", "custom", "Five trivia questions, fast", "5 questions, 15 seconds each.", {
    content: "human",
    scoring: "score",
    minTimeMs: 2000,
  }),
  g(
    "emojihits",
    "Emoji Hits",
    "word",
    "smiley",
    "M3+",
    "custom",
    "Name the hit from its emoji",
    "Name the song, film or TV show from the emoji. 5 rounds, 3 tries each.",
    { content: "curated", scoring: "score", minTimeMs: 4000, isNew: true },
  ),
  g(
    "pinned",
    "Pinned",
    "word",
    "map-pin",
    "M3+",
    "custom",
    "Drop the pin on the map",
    "Drop a pin where the landmark is. Closer scores more.",
    { content: "curated", scoring: "score", minTimeMs: 1000 },
  ),
  g(
    "flagged",
    "Flagged",
    "word",
    "flag",
    "M3+",
    "custom",
    "Flags, capitals, currencies",
    "10 fast rounds of flags, capitals and currencies.",
    { content: "curated", scoring: "score", minTimeMs: 3000 },
  ),
  g(
    "twotruths",
    "Two Truths and a Lie",
    "word",
    "seal-question",
    "M3+",
    "custom",
    "Two are true. Spot the lie.",
    "Three statements, two of them true. Tap the lie before the bar runs out.",
    { content: "curated", scoring: "score", minTimeMs: 8000 },
  ),
  // Arcade, in the owner's order (14 Nov 2026): Gotcha, Echo, Flinch, Dash, then Twins (back as one 4 × 4 board).
  // Beat Tap and Penalty King are retired (RETIRED_IDS) and sit after them.
  g(
    "gotcha",
    "Gotcha",
    "reflex",
    "skull",
    "L",
    "phaser",
    "The level is lying to you",
    "Reach the door. Floors lie, ceilings fall, gravity flips and the door runs off. Every room tricks you once.",
    { scoring: "deaths", minTimeMs: 5000, photosensitive: true },
  ),
  g(
    "echo",
    "Echo",
    "reflex",
    "music-notes",
    "L",
    "custom",
    "Repeat the sequence",
    "Watch the pads, then repeat the sequence. It grows every round.",
    { scoring: "score", minTimeMs: 0, photosensitive: true },
  ),
  g(
    "flinch",
    "Flinch",
    "reflex",
    "hand-tap",
    "M3+",
    "custom",
    "Tap the instant it changes",
    "Tap the instant the screen changes. Best of 5. Early taps cost you.",
    { scoring: "score", minTimeMs: 0, photosensitive: true },
  ),
  // Endless runner: one hit ends the run, score = metres (games/dash/logic.ts). Levels set a distance to reach.
  g(
    "dash",
    "Dash",
    "reflex",
    "person-simple-run",
    "L",
    "phaser",
    "Jump, duck, keep running",
    "Spuz runs on its own and speeds up. Jump the crates and gaps, duck the drones. One hit ends the run. Go far.",
    { scoring: "score", minTimeMs: 0, photosensitive: true },
  ),
  g("twins", "Twins", "reflex", "cards", "M2", "custom", "Find every pair", "Flip cards to find every pair in the fewest flips.", {
    scoring: "score",
    minTimeMs: 4000,
  }),
  g(
    "beattap",
    "Beat Tap",
    "reflex",
    "metronome",
    "M3+",
    "custom",
    "Tap on the beat",
    "Tap on every beat of the pattern. Perfect and Good score; extra taps cost points.",
    { scoring: "score", minTimeMs: 0, isNew: true },
  ),
  g(
    "penalty",
    "Penalty King",
    "reflex",
    "soccer-ball",
    "M3+",
    "custom",
    "Five kicks to beat the keeper",
    "Tap once to aim, again for power. Five kicks: most goals wins, then accuracy.",
    { scoring: "score", minTimeMs: 0 },
  ),
  g(
    "flipside",
    "Flipside",
    "rage",
    "arrows-down-up",
    "M2",
    "phaser",
    "Flip gravity to survive",
    "Tap to flip gravity. Run the floor or the ceiling.",
    { scoring: "deaths", minTimeMs: 5000, photosensitive: true },
  ),
  g(
    "ricochet",
    "Ricochet",
    "rage",
    "arrow-bend-up-right",
    "M3+",
    "phaser",
    "Bounce wall to wall",
    "Tap to bounce between walls. Dodge the spikes as it speeds up.",
    { scoring: "score", minTimeMs: 0, photosensitive: true },
  ),
  g(
    "stacked",
    "Stacked",
    "rage",
    "stack",
    "M3+",
    "phaser",
    "Stack the sliding blocks",
    "Tap to drop the block. Overhangs get cut. Build high.",
    { scoring: "score", minTimeMs: 0, photosensitive: true },
  ),
  g(
    "wobble",
    "Wobble",
    "rage",
    "scales",
    "M3+",
    "phaser",
    "Balance across the rope",
    "Tap left and right to keep the walker balanced to the end.",
    { scoring: "deaths", minTimeMs: 5000, photosensitive: true },
  ),
  g("grapple", "Grapple", "rage", "anchor-simple", "M3+", "phaser", "Swing hook to hook", "Hold to grab a hook, release to swing across.", {
    scoring: "deaths",
    minTimeMs: 5000,
    photosensitive: true,
  }),
  g("ghosted", "Ghosted", "rage", "ghost", "M3+", "phaser", "Race a friend's ghost", "Beat your friend's ghost to the flag.", {
    scoring: "deaths",
    minTimeMs: 5000,
    photosensitive: true,
  }),
  g("slip", "Slip", "rage", "sneaker-move", "M3+", "phaser", "Climb with clumsy hands", "Drag to swing and climb the tower. Do not slip.", {
    scoring: "deaths",
    minTimeMs: 5000,
    photosensitive: true,
  }),
  g(
    "gauntlet",
    "Gauntlet",
    "reflex",
    "flag-checkered",
    "M3+",
    "phaser",
    "Ten tiny troll levels",
    "10 tiny troll levels in a row. Fewest deaths wins.",
    { scoring: "deaths", minTimeMs: 10000, photosensitive: true },
  ),
  // Board Games (the old Board Bay)
  g("chess", "Chess", "board", "horse", "L", "board", "Mates to find and live games", "Find the mate. White to move.", {
    unique: true,
    minTimeMs: 1500,
    botPlay: true,
  }),
  g(
    "draughts",
    "Draughts",
    "board",
    "circles-four",
    "L",
    "board",
    "Jump, crown, clear the board",
    "Find the winning sequence. Captures are compulsory.",
    { unique: true, minTimeMs: 1500, botPlay: true },
  ),
  g(
    "oware",
    "Oware",
    "board",
    "dots-nine",
    "L",
    "board",
    "Sow seeds, capture the most",
    "Sow seeds anticlockwise. Capture 2s and 3s on their side.",
    { minTimeMs: 1500, botPlay: true },
  ),
  g(
    "ludo",
    "Ludo",
    "board",
    "dice-six",
    "M2",
    "board",
    "Race four pieces home",
    "Roll a 6 to come out and race all four pieces home. Land on rivals to send them back; two of yours on a square block them.",
    { minTimeMs: 1500, botPlay: true },
  ),
  g(
    "fourup",
    "Four Up",
    "board",
    "circles-three-plus",
    "M2",
    "board",
    "Line up four first",
    "Drop discs. Four in a line, any direction, wins.",
    { unique: true, minTimeMs: 1500, botPlay: true },
  ),
  g("dara", dara.title, "board", "dots-three", "M3+", "board", dara.blurb, dara.rule, {
    unique: true,
    minTimeMs: 1500,
    botPlay: true,
  }),
  g(
    "flip",
    "Flip",
    "board",
    "circle-half",
    "M3+",
    "board",
    "Outflank and flip",
    "Place a disc to outflank and flip your rival's discs. Most discs wins.",
    { minTimeMs: 1500, botPlay: true },
  ),
];

/**
 * Lab games (lab: true): a new game that starts In testing (only signed-in admins can open it) until the admin
 * switches it On from the Games page, which stores the state in `games.status` (see GameSwitch below). Add new games
 * at the END of this list (one block per game); scripts/gen-seed.ts writes their row with status 'testing'.
 * Trotro Jam, Emoji Hits and Beat Tap graduated to the live list (2026-11). The twelve R2-P5 lab games (eleven back
 * from retirement, plus Two Truths and a Lie) graduated on 11 Nov 2026 (migration 20261211300101), so the list is
 * empty for now.
 */
const LAB_LIST: GameMeta[] = [];

/**
 * Retired by the owner (2026-11, 61 to 29 games; Quads came back in R2-14, and eleven came back as lab games in
 * R2-P5, live since 11 Nov 2026: 41 games). Code, boards and tests stay; players never see these and the server answers 404 unknown_game. The admin
 * console lists them, marked retired, read-only for scheduling.
 */
export const RETIRED_IDS: ReadonlySet<string> = new Set([
  // Puzzles (was Logic Lab). Pixl, Tripwire and Light Up came back (R2-P5), now live.
  "blackout",
  // Line Lane
  "isles",
  // Shape Shed
  "quilt",
  "snug",
  "shuffle",
  "reflect",
  "squint",
  // Number Den. Higher or Lower, Market Run and Killer Sums came back (R2-P5), now live.
  "deadon",
  "merge",
  "sums",
  "equal",
  // Clue Cave. Pinned and Flagged came back (R2-P5), now live.
  "hunch",
  // Rage Ridge
  "flipside",
  "ricochet",
  "stacked",
  "wobble",
  "grapple",
  "ghosted",
  "slip",
  // Arcade: Gauntlet was ten Gotcha rooms in a row, so Gotcha covers it. Beat Tap and Penalty King retired by the
  // owner (14 Nov 2026). Twins came back the same day as one 4 × 4 board.
  "gauntlet",
  "beattap",
  "penalty",
  // Puzzles and Words & Quiz, retired by the owner (14 Nov 2026).
  "hilo",
  "killer",
  "lightup",
  "pixl",
  "market",
  "pinned",
  // Board Games (was Board Bay). Dara came back (R2-P5), now live.
  "flip",
]);

/**
 * Games that are new to players (just added, or brought back from retirement). The Home "new games" banner
 * (R2-18) counts the live ones; take an id out once it has had its launch weeks. Retired ids here are ignored.
 */
export const NEW_IDS: ReadonlySet<string> = new Set(["quads"]);

const mark = (x: GameMeta): GameMeta => (RETIRED_IDS.has(x.id) ? { ...x, retired: true } : NEW_IDS.has(x.id) ? { ...x, isNew: true } : x);

/** Every game in code: live, lab and retired. Admin and old-result lookups only; never a player list. */
export const ALL_GAMES: GameMeta[] = [...MAIN_GAMES, ...LAB_LIST].map(mark);
/**
 * Every game that is not retired, whatever its runtime state (On, In testing or Off, `gameState`). Players see only
 * the ones that are On: build player lists with `playerGames(s)`, and counts with `playerGames(s).length`.
 * This full list is for admin screens, static paths (the pages answer 404 for a game that is not On) and options.
 */
export const GAMES: GameMeta[] = ALL_GAMES.filter((x) => !x.retired);
/** Games that start In testing (lab: true) until an admin switches them On. */
export const LAB_GAMES: GameMeta[] = ALL_GAMES.filter((x) => x.lab && !x.retired);
export const RETIRED_GAMES: GameMeta[] = ALL_GAMES.filter((x) => x.retired);
/** Games marked new and not retired: what the Home "new games" banner counts (only the ones that are On). */
export const NEW_GAMES: GameMeta[] = ALL_GAMES.filter((x) => x.isNew && !x.retired);
export const isNewGame = (id: string) => NEW_GAMES.some((g) => g.id === id);
/**
 * Worlds that have a game in code. Players see only the worlds with a game that is On (`playerWorlds`); this static
 * list is for admin screens and static paths.
 */
export const WORLDS: World[] = ALL_WORLDS.filter((w) => GAMES.some((x) => x.world === w.id));
/**
 * The catalogue count: every game that is not retired. Static text that cannot follow the runtime state (the PWA
 * manifest, the offline page) keeps it; anything rendered per request or revalidated counts `playerGames(s).length`.
 */
/** Games players see (a board-size variant such as Spuzdoku 9 × 9 is not counted on its own). */
export const GAME_COUNT = GAMES.filter((g) => !g.variantOf).length;
export const WORLD_COUNT = WORLDS.length;

/**
 * Lookup by id for names, icons and colours, including retired games (old results, admin, Board Bay ids).
 * It is NOT a "can this be played" check: gate on `openGame` (or the server's assertGameOpen) for that.
 */
export const GAME_BY_ID: Record<string, GameMeta> = Object.fromEntries(ALL_GAMES.map((x) => [x.id, x]));
export const isRetired = (id: string) => RETIRED_IDS.has(id);
/**
 * The game when it is in code and not retired (any runtime state), otherwise undefined: unknown and retired ids
 * alike. Whether someone may open it now is `openGame` (or the server's assertGameOpen).
 */
export const playableGame = (id: string | null | undefined): GameMeta | undefined =>
  id && Object.hasOwn(GAME_BY_ID, id) && !RETIRED_IDS.has(id) ? GAME_BY_ID[id] : undefined;
/** A game in code that is not retired (any runtime state). */
export const isLiveGame = (id: string | null | undefined) => !!playableGame(id);
export const isLabGame = (id: string) => playableGame(id)?.lab === true;

/**
 * A game's runtime state, set by an admin on the Games page and stored in `games.status`:
 * - "on" ('live'): everyone can find and play it;
 * - "testing" ('testing'): only signed-in admins can open it, to try it out; players never see it and the server
 *   refuses it like an unknown game;
 * - "off" ('off'): hidden from everyone and refused for everyone.
 * Retired games (RETIRED_IDS) have no runtime state: they are retired in code.
 */
export type GameState = "on" | "testing" | "off";
export const GAME_STATES: readonly GameState[] = ["on", "testing", "off"];
export const isGameState = (v: unknown): v is GameState => typeof v === "string" && (GAME_STATES as readonly string[]).includes(v);

/**
 * The runtime switch every gate reads. It travels with the game settings (`getGameSettings()` / `useGameSettings()`;
 * the server reads it from the `games` table): the games In testing, the games Off, and the games the admin keeps
 * out of Duels and Parties (`games.versus` false). Pass the whole settings object.
 */
export interface GameSwitch {
  readonly "games.testing": readonly string[];
  readonly "games.off": readonly string[];
  readonly "games.noVersus": readonly string[];
}
/** Before the database answers (or when it can't): every game On, except lab games, which start In testing. */
export const DEFAULT_SWITCH: GameSwitch = {
  "games.testing": LAB_GAMES.map((g) => g.id),
  "games.off": [],
  "games.noVersus": [],
};
/** Who is looking: a signed-in admin (any role) may open games In testing. */
export interface Viewer {
  readonly admin?: boolean;
}

/** A game's runtime state; undefined for unknown and retired ids. Off wins over In testing if both somehow hold. */
export function gameState(id: string | null | undefined, s: GameSwitch): GameState | undefined {
  const g = playableGame(id);
  if (!g) return undefined;
  if ((s["games.off"] ?? []).includes(g.id)) return "off";
  if ((s["games.testing"] ?? []).includes(g.id)) return "testing";
  return "on";
}

/**
 * The game when this viewer may open it now: On for everyone, In testing for admins only. Unknown, retired, Off and
 * (for players) In testing ids are all undefined, so every caller answers them alike (404 unknown_game).
 */
export const openGame = (id: string | null | undefined, s: GameSwitch, viewer: Viewer = {}): GameMeta | undefined => {
  const st = gameState(id, s);
  return st === "on" || (st === "testing" && viewer.admin === true) ? GAME_BY_ID[id!] : undefined;
};
/** Every game players can find and play now (On), in catalogue order: Library, worlds, pickers, counts, SEO. */
export const playerGames = (s: GameSwitch, viewer: Viewer = {}): GameMeta[] =>
  GAMES.filter((g) => !g.variantOf && !!openGame(g.id, s, viewer));
/** The On games of one world. */
export const playerGamesInWorld = (w: WorldId, s: GameSwitch, viewer: Viewer = {}) => playerGames(s, viewer).filter((x) => x.world === w);
/** Worlds with at least one game that is On. */
export const playerWorlds = (s: GameSwitch, viewer: Viewer = {}): World[] => {
  const on = playerGames(s, viewer);
  return WORLDS.filter((w) => on.some((g) => g.world === w.id));
};
/** Whether the admin lets this game be played in Duels and Parties ("Can be played in Duels and Parties"). */
export const versusAllowed = (id: string, s: GameSwitch) => !(s["games.noVersus"] ?? []).includes(id);

/** Every world, including empty ones, so old results and CSS colours always resolve. */
export const WORLD_BY_ID: Record<WorldId, World> = Object.fromEntries(ALL_WORLDS.map((w) => [w.id, w])) as Record<WorldId, World>;
/** A world in code with a game that is not retired (players open only the ones `playerWorlds` lists). */
export const isLiveWorld = (id: string | null | undefined) => !!id && WORLDS.some((w) => w.id === id);
/** Every not-retired game of a world, any runtime state (admin and static paths; players: `playerGamesInWorld`). */
export const gamesInWorld = (w: WorldId) => GAMES.filter((x) => x.world === w);

/**
 * Worlds folded into a broader one in the 2026-11 regroup. Their pages redirect to the world that took their live
 * games (app/world/[id]/page.tsx), so old links and bookmarks still land somewhere useful.
 */
export const MERGED_WORLDS: Partial<Record<WorldId, WorldId>> = { line: "logic", shape: "logic", clue: "word", rage: "reflex" };

/**
 * Every game wears its world's colour, so a category reads as one colour everywhere (tiles, shell, share cards).
 * The block stays (empty) because scripts/prerender-3d.mjs reads it to colour the 3D tiles; add a line only for a
 * deliberate exception.
 */
const TONE: Partial<Record<string, WorldId>> = {};
/** The colour family a game wears in play (shell, tiles, share cards): its tone, else its world. */
export const toneOf = (g: GameMeta): WorldId => TONE[g.id] ?? g.world;
/** A game's colours: `color` fill and `ink` for world-coloured text on the light theme. */
export const colourOf = (g: GameMeta): Pick<World, "color" | "ink"> => {
  const w = WORLD_BY_ID[toneOf(g)];
  return { color: w.color, ink: w.ink };
};

/** The live launch Dailies counted by "Today x of N" (design Home), and the designed boards plus Board Bay. */
export const LAUNCH_IDS = GAMES.filter((x) => x.phase === "L" && x.world !== "board").map((x) => x.id);
export const DESIGNED_BOARD_IDS = GAMES.filter((x) => x.phase === "L" || x.world === "board").map((x) => x.id);
