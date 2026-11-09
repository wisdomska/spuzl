import { GAME_COUNT, WORLDS, WORLD_COUNT, type GameMeta, type WorldId } from "@/lib/catalog";
import { PARTY_MAX } from "@/lib/multiplayer/constants";
import { aboutCopy } from "@/lib/copy/about";

/**
 * Public, search-facing copy (SEO and GEO): the game pages (/games, /games/<id>), the visitor landing page's
 * catalogue and FAQ, public world pages, page titles and descriptions, and llms.txt. Every fact here is true in
 * the code (catalog, levels, multiplayer rules, age rules); counts come from the catalog, never typed by hand.
 * Answer-shaped on purpose: a short definition first, then facts in lists, so search and AI answers can quote it.
 */

const list = (xs: readonly string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
/** "Puzzles, Words & Quiz, Arcade and Board Games" */
export const worldNames = list(WORLDS.map((w) => w.name));

/** The kind of game, as people search for it, per world (used when a game has no entry of its own). */
const WORLD_KIND: Record<WorldId, string> = {
  logic: "logic puzzle",
  word: "word game",
  reflex: "arcade game",
  board: "board game",
  line: "puzzle",
  shape: "puzzle",
  number: "number puzzle",
  clue: "quiz",
  rage: "arcade game",
};

/** Schema.org genres per world (VideoGame.genre). */
export const WORLD_GENRES: Record<WorldId, string[]> = {
  logic: ["Puzzle", "Logic"],
  word: ["Word", "Trivia"],
  reflex: ["Arcade", "Action"],
  board: ["Board game", "Strategy"],
  line: ["Puzzle"],
  shape: ["Puzzle"],
  number: ["Puzzle"],
  clue: ["Trivia"],
  rage: ["Arcade"],
};

/**
 * Per game: `kind` (what people search for, used in the title) and `where` (the rest of the definition sentence
 * "<Game> is a free online <kind> where you ..."), both read straight from the game's rule in lib/catalog.ts.
 */
export const GAME_SEO: Record<string, { kind: string; where: string }> = {
  crownfall: {
    kind: "logic puzzle",
    where: "place one crown in each row, column and coloured region, with no two crowns touching, not even at corners",
  },
  dusk: {
    kind: "logic puzzle",
    where: "fill the grid with suns and moons, an equal number in every row and column and never three in a line",
  },
  sixer: { kind: "6x6 sudoku", where: "place the numbers 1 to 6 once in every row, every column and every 2 by 3 box" },
  nine: { kind: "sudoku", where: "place the numbers 1 to 9 once in every row, every column and every 3 by 3 box" },
  weave: { kind: "path puzzle", where: "draw one path through the numbers in order that fills every cell of the grid" },
  flowline: { kind: "pipe puzzle", where: "rotate the pipes until water reaches every plant" },
  pairup: { kind: "dot puzzle", where: "join matching dots with lines that never cross, and fill the whole grid" },
  lost: { kind: "maze game", where: "find the exit of a foggy maze, and the fog lifts as you move" },
  trotro: { kind: "sliding block puzzle", where: "slide cars and trucks along their lanes until the trotro can drive out of the exit" },
  coil: { kind: "word search", where: "snake through the letters to find the themed words, and every letter gets used" },
  rungs: { kind: "word ladder", where: "answer the clues, then order the words so each one changes a single letter" },
  quads: { kind: "word puzzle", where: "sort 16 words into 4 hidden groups of 4, with four mistakes allowed" },
  seven: { kind: "spelling game", where: "make words from 7 letters, and the centre letter is in every word" },
  minicross: { kind: "mini crossword", where: "fill a 5 by 5 crossword grid from the clues" },
  buried: { kind: "word search", where: "find every hidden word, and the leftover letters spell a secret phrase" },
  remix: { kind: "word scramble", where: "unscramble the word in three rounds, against the clock" },
  quickfire: { kind: "trivia quiz", where: "answer 5 trivia questions with 15 seconds for each" },
  emojihits: { kind: "emoji quiz", where: "name the song, film or TV show from its emoji, over 5 rounds with 3 tries each" },
  echo: { kind: "memory game", where: "watch the pads light up, then repeat the sequence, and it grows every round" },
  twins: { kind: "memory game", where: "flip cards to find every pair in the fewest flips" },
  flinch: { kind: "reaction game", where: "tap the instant the screen changes, best of 5, and early taps cost you" },
  beattap: { kind: "rhythm game", where: "tap on every beat of the pattern, and extra taps cost points" },
  gotcha: { kind: "platformer", where: "reach the exit while floors drop, spikes pop, walls spring up and the door runs away" },
  dash: { kind: "runner game", where: "tap to jump and clear the course" },
  chess: { kind: "chess puzzle", where: "find the checkmate with White to move, or play a full game against the bot or a friend" },
  draughts: {
    kind: "draughts game",
    where: "find the winning moves, with compulsory captures, or play a full game against the bot or a friend",
  },
  oware: { kind: "board game", where: "sow seeds anticlockwise and capture the 2s and 3s on your rival's side" },
  ludo: { kind: "ludo game", where: "roll a 6 to bring a piece out, then race all four pieces home" },
  fourup: { kind: "four in a row game", where: "drop discs and win by lining up four in any direction" },
};

export const kindOf = (g: GameMeta) => GAME_SEO[g.id]?.kind ?? WORLD_KIND[g.world];
/** "Crownfall is a free online logic puzzle where you place one crown ..." */
export const definitionOf = (g: GameMeta) =>
  GAME_SEO[g.id]
    ? `${g.name} is a free online ${GAME_SEO[g.id].kind} where you ${GAME_SEO[g.id].where}.`
    : `${g.name} is a free online ${kindOf(g)}. ${g.rule}`;

/** How each kind of game is controlled (also on How to play). */
export const CONTROLS: Record<GameMeta["engine"], string> = {
  grid: "Tap a cell to cycle its marks, drag to mark several. Keyboard: arrows move, Space cycles, Enter confirms.",
  word: "Tap letters or type on your keyboard. Backspace removes the last letter.",
  phaser: "Use the on-screen buttons, the arrow keys or a gamepad.",
  board: "Tap a piece, then tap where it goes. Legal moves light up.",
  custom: "Follow the buttons on screen. Everything also works with a keyboard.",
};

/** How each kind of game is ranked (also on How to play). */
export const SCORING: Record<GameMeta["scoring"], string> = {
  time: "Fastest clear wins. Fewer hints, then fewer mistakes, break ties.",
  score: "Highest score wins. Time breaks ties.",
  deaths: "Fewest deaths wins, then time.",
};

export const PHOTOSENSITIVE = "Has fast flashing visuals, kept under 3 flashes a second. You'll see a notice before you start.";

/** Safety facts for players aged 13 to 15 (lib/age, lib/social, lib/multiplayer/liveGate, chat and room rules). */
export const SAFETY = {
  minAge: "SPUZL is for players aged 13 and over. Everyone gives a birth month and year before playing.",
  teen: [
    "Chat is quick preset phrases only in any room with a player under 16.",
    "They add friends only by invite link or QR code.",
    "Rooms they host let in their friends; anyone else needs their yes first.",
    "Duel Quick Match only ever pairs them with other 13 to 15 players.",
    "Live board games with strangers are for players 16 and over.",
    "Their city and country never show to other players.",
  ],
} as const;

/** One question and answer. */
/** One question and answer; `points` (optional) follow the answer as a list. */
export type QA = { q: string; a: string; points?: readonly string[] };

/** The answer as one plain paragraph (structured data and plain text): the answer, then each point. */
export const qaText = ({ a, points }: QA) => (points?.length ? `${a} ${points.join(" ")}` : a);

/** The site-wide FAQ (landing page, How to play, llms-full.txt). */
export const SITE_FAQ: QA[] = [
  {
    q: "What is SPUZL?",
    a: `SPUZL is a free puzzle games app that runs in your web browser. It has ${GAME_COUNT} short games in ${WORLD_COUNT} worlds: ${worldNames}. Logic grids, word games, quick arcade runs and classic board games like oware and draughts, made in Ghana for puzzle lovers everywhere.`,
  },
  {
    q: "Is SPUZL free?",
    a: "Yes. Every game is free to play, there is nothing to download and nothing to buy with money. There are no ads. You earn Sparks by playing and spend them on hats for Spuz, and nobody can pay to win.",
  },
  {
    q: "Do I need an account to play?",
    a: "No. Tap Play now, tell us your birth month and year, and you play as a guest. To keep your progress on any phone, sign in later with a 6-digit email code or with Google.",
  },
  {
    q: "Can I play with friends?",
    a: `Yes. Duel a friend live on the same puzzle, best of three. Open a Party room, share the code and race up to ${PARTY_MAX} phones at once. Challenge a friend to chess, draughts, oware, ludo or Four Up. Every Monday you also join a weekly league of 30 players.`,
  },
  {
    q: "Is SPUZL safe for teens?",
    a: `${SAFETY.minAge} For players aged 13 to 15:`,
    points: SAFETY.teen,
  },
  {
    q: "How many games are on SPUZL?",
    a: `${GAME_COUNT} games in ${WORLD_COUNT} worlds: ${worldNames}. Every game can be played any time, as often as you like.`,
  },
  {
    q: "Does SPUZL work on phones and offline?",
    a: "Yes. SPUZL works in the browser on Android phones, iPhones, tablets and computers. Add it to your home screen and it opens like an app, even with no connection. A puzzle already on your screen can be finished offline, and the clear is sent when you are back online. Duels and Party need a connection.",
  },
];

/** Page titles and descriptions (titles under 60 characters, descriptions under 155). */
export const seoMeta = {
  landing: { title: aboutCopy.metaTitle, description: aboutCopy.metaDescription },
  games: {
    title: `All ${GAME_COUNT} free online puzzle games | SPUZL`,
    description: `Every SPUZL game in one list: logic puzzles, sudoku, word games, trivia, arcade and board games like oware and ludo. All free in your browser.`,
  },
  library: {
    title: "All games: search and filter | SPUZL",
    description: `Search all ${GAME_COUNT} SPUZL games by name, world, length or mood. Quick games, calm puzzles and competitive games, free in your browser.`,
  },
  howToPlay: {
    title: "How to play SPUZL: rules for every game",
    description: `The rules of all ${GAME_COUNT} SPUZL games, plus how free play, hints, streaks and weekly leagues work. Free puzzle games in your browser.`,
  },
  fairPlay: {
    title: "Fair play on SPUZL: honest boards, kind games",
    description:
      "How SPUZL checks every clear on the server, keeps the leaderboards honest, and keeps the game friendly. Nobody can pay to win.",
  },
  privacy: {
    title: "Privacy policy | SPUZL",
    description:
      "What SPUZL collects, why, how long we keep it, and how to download or delete your data. No ads and no selling of your data.",
  },
  terms: {
    title: "Terms of use | SPUZL",
    description:
      "The rules for using SPUZL, the free puzzle games app: who can play, your account, playing fair and kind, and our content.",
  },
  contact: {
    title: "Contact SPUZL: help and support",
    description: "Get help with SPUZL, report a problem or a player, or ask about your data.",
  },
  world: (name: string, tagline: string, n: number) => ({
    title: `${name}: ${n} free online games | SPUZL`,
    description: `${tagline}. Play ${n} free ${name} games on SPUZL in your browser, with endless fresh puzzles. No download, no sign-up.`,
  }),
} as const;

/** The game catalogue (/games) and the game pages (/games/<id>). */
export const gamesCopy = {
  nav: { home: "SPUZL home", games: "Games", how: "How to play", play: "Play", breadcrumb: "Breadcrumb", footer: "Footer" },
  indexTitle: "All SPUZL games",
  indexLede: `SPUZL has ${GAME_COUNT} free online games in ${WORLD_COUNT} worlds: ${worldNames}. Every one plays in your browser on a phone or a computer, any time, as often as you like.`,
  indexPoints: [
    "Free to play, no download and no ads.",
    "No sign-up needed: play as a guest, sign in later to keep your streak.",
    "Most games take one to three minutes.",
  ],
  worldCount: (n: number) => (n === 1 ? "1 game" : `${n} games`),
  allGames: "All games",
  /** Under the game list on a world page */
  seeAll: "See every SPUZL game",
  cta: (game: string) => `Play ${game} free`,
  ctaNote: "No sign-up needed. Play as a guest.",
  ctaTitle: (game: string) => `Ready for ${game}?`,
  /** foot of the game's link preview */
  ogFoot: "Free · no download · spuzl.vercel.app",
  ruleTitle: "The rule",
  howTitle: (game: string) => `How to play ${game}`,
  howSteps: (g: GameMeta) => [
    `Open ${g.name} on SPUZL in any browser. No download.`,
    "First time? Most games start with a short practice round with free hints. Nothing counts yet.",
    g.rule,
    CONTROLS[g.engine],
    ...(g.engine === "grid" ? ["Stuck? Use up to 3 hints on a puzzle. Each one shows a single safe next step."] : []),
    SCORING[g.scoring],
  ],
  factsTitle: "Quick facts",
  facts: {
    world: "World",
    time: "Typical time",
    timeValue: (label: string) => (label.startsWith("Under") ? label : `About ${label}`),
    scoring: "Scoring",
    levels: "Levels",
    levelsPool: (n: number) => `${n} levels, unlocked one at a time`,
    levelsEndless: "Endless, harder in waves, a boss level every fifth",
    difficulty: "Difficulty",
    difficultyValue: "Easy, Medium, Hard or Expert in free play",
    price: "Price",
    priceValue: "Free",
    plays: "Plays on",
    playsValue: "Any web browser: phone, tablet or computer",
  },
  modesTitle: "Ways to play",
  modes: {
    free: (g: GameMeta) =>
      g.id === "ludo" ? "Free play: a full game of Ludo against the bot." : "Free play: play any time, as often as you like.",
    levelsPool: (n: number) => `Levels: ${n} hand-picked levels that unlock one at a time.`,
    levelsEndless: "Levels: an endless ladder that gets harder in waves, with a boss level every fifth level.",
    duel: "Duel: race a friend live on the same puzzle, best of three.",
    party: `Party: open a room, share the code and race up to ${PARTY_MAX} players at once.`,
    bay: "Challenge a friend: play a full game live, or take turns with up to a day per move.",
    bot: "Play the bot: a full casual game against the computer at Easy, Medium or Hard.",
  },
  faqTitle: (game: string) => `${game} questions`,
  faq: {
    free: (g: GameMeta) => ({
      q: `Is ${g.name} free to play?`,
      a: `Yes. ${g.name} is free on SPUZL, with no download and no ads. Nobody can pay to win.`,
    }),
    time: (g: GameMeta, label: string) => ({
      q: `How long does a game of ${g.name} take?`,
      a: `${label.startsWith("Under") ? label : `About ${label}`} for most players. Free play never runs out, so you can play again straight away.`,
    }),
    account: (g: GameMeta) => ({
      q: `Do I need an account to play ${g.name}?`,
      a: "No. Tap Play, give your birth month and year, and you play as a guest. Sign in later with an email code or Google to keep your progress on any phone.",
    }),
    levelsPool: (g: GameMeta, n: number) => ({
      q: `How many levels does ${g.name} have?`,
      a: `${n} hand-picked levels. Each one unlocks when you clear the one before, and you can replay any level you have cleared.`,
    }),
    levelsEndless: (g: GameMeta) => ({
      q: `How many levels does ${g.name} have?`,
      a: "The levels never run out. They get harder in waves of five, and every fifth level is a tougher boss level. Each level is the same board for everyone.",
    }),
    friendsRace: (g: GameMeta) => ({
      q: `Can I play ${g.name} with friends?`,
      a: `Yes. Duel a friend live on the same ${g.name} puzzle, best of three, or open a Party room and race up to ${PARTY_MAX} players at once.`,
    }),
    friendsBay: (g: GameMeta) => ({
      q: `Can I play ${g.name} against a friend?`,
      a: `Yes. Challenge a friend to a full game of ${g.name}, live or one move at a time. You can also play the bot at Easy, Medium or Hard.`,
    }),
    phone: (g: GameMeta) => ({
      q: `Can I play ${g.name} on my phone?`,
      a: `Yes. ${g.name} runs in the browser on Android phones, iPhones, tablets and computers. Add SPUZL to your home screen and it opens like an app.`,
    }),
  },
  moreTitle: (world: string) => `More ${world} games`,
  photosensitive: PHOTOSENSITIVE,
  worldsLink: (world: string) => `All ${world} games`,
} as const;

/** How to play: the FAQ and the link from each game to its page. */
export const howToPlaySeoCopy = {
  crumb: "How to play",
  faqTitle: "Questions people ask",
  more: (game: string) => `All about ${game}`,
} as const;

/** The visitor landing page's extra sections (catalogue and FAQ). */
export const landingSeoCopy = {
  catalogueTitle: `All ${GAME_COUNT} games, one tap away.`,
  catalogueMore: "See every game",
  faqEyebrow: "Questions",
  faqTitle: "Good to know.",
} as const;

/** Public world pages (visitors and crawlers). */
export const worldSeoCopy = {
  lede: (name: string, tagline: string, n: number) =>
    `${name} is a world of ${n} free online games on SPUZL: ${tagline.toLowerCase()}. Play any of them in your browser, as often as you like.`,
  gamesTitle: (name: string) => `${name} games`,
  otherWorlds: "Other worlds",
  play: "Play now",
} as const;

/** llms.txt summary line (the blockquote). */
export const llmsSummary = `SPUZL is a free puzzle games web app (PWA) with ${GAME_COUNT} short games in ${WORLD_COUNT} worlds (${worldNames}): logic grids, sudoku, word games, trivia, arcade runs and board games like oware, draughts and ludo. Play in any browser as a guest, duel friends, race in Party rooms and climb weekly leagues. Made in Ghana, for players aged 13 and over.`;

/** The site's default link preview (app/opengraph-image.tsx). */
export const siteOgCopy = {
  alt: "SPUZL: free puzzle games in your browser",
  title: "Tiny puzzles. Big brain energy.",
  line: `${GAME_COUNT} free puzzle, word, arcade and board games. Play in your browser and duel your friends.`,
  foot: "Free · no download · spuzl.vercel.app",
} as const;
