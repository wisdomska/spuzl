import type { GameMeta } from "@/lib/catalog";
import type { QA } from "@/lib/copy/seo";

/**
 * Guides and game lists (/topics/<slug>, /guides/<slug>, /guides): keyword pages for search and AI answers. Every
 * fact here is true in the code: game lists, counts and modes are derived from the catalog and the multiplayer rules
 * (lib/seo/topics.ts) and passed in; the oware rules follow games/oware/engine.ts (Abapa) word for word in meaning.
 * Answer-first on purpose: each page opens with one or two sentences an AI answer can quote. Never names another
 * company's game or product.
 */

/** "A, B and C" */
export const listOf = (xs: readonly string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const names = (gs: readonly GameMeta[]) => listOf(gs.map((g) => g.name));
const games = (n: number) => (n === 1 ? "1 game" : `${n} games`);
/** "9 free logic puzzles", "1 free word game" */
const free = (n: number, one: string, many: string) => `${n} free ${n === 1 ? one : many}`;
/** "Crownfall, Dusk, Spuzdoku and more" (the first few names; "and more" only when some are left out) */
const some = (gs: readonly GameMeta[], n = 3) =>
  gs.length > n
    ? `${gs
        .slice(0, n)
        .map((g) => g.name)
        .join(", ")} and more`
    : names(gs);

export interface TopicLink {
  href: string;
  label: string;
  note?: string;
}

/** One section of a guide: any of paragraphs, a list, numbered steps, game cards, links or a comparison table. */
export interface TopicSection {
  id: string;
  title: string;
  body?: readonly string[];
  points?: readonly string[];
  steps?: readonly string[];
  games?: readonly GameMeta[];
  links?: readonly TopicLink[];
  /** header row first: ["", "A", "B"], then one row per point of comparison */
  table?: readonly (readonly string[])[];
}

/** The shared frame of every guide page. */
export const topicsCopy = {
  crumb: "Guides",
  indexPath: "/guides",
  index: {
    title: "Guides and game lists: free puzzle games | SPUZL",
    description:
      "Guides to SPUZL's free browser games: logic puzzles, sudoku, word games, board games with friends, how to play oware and more.",
    h1: "Guides and game lists",
    answer:
      "Short guides to the free games on SPUZL: lists by type of game, ways to play with friends, and how to play oware, the Ghanaian seed game.",
    topics: "Game lists",
    guides: "Guides",
  },
  answerLabel: "In short",
  gamesTitle: (n: number) => `The ${games(n)}`,
  faqTitle: "Questions",
  relatedTitle: "More guides",
  /** the game page's links to the guides and lists that include it */
  onGamePage: "Guides and lists",
  /** the /games page's row of type pages */
  browseByType: "Browse by type",
  /** footers: the keyword pages most people look for (always served: lib/seo/topics FOOTER_SLUGS) */
  footerTitle: "Guides",
  footer: [
    ["/topics/free-puzzle-games-in-browser", "Free browser games"],
    ["/guides/made-in-ghana", "Made in Ghana"],
    ["/guides", "All guides"],
  ] as const,
  /** the header link on public pages */
  nav: "Guides",
  play: "Play now",
  playNote: "Free. No sign-up, no download.",
  updated: "Facts on this page come from the games themselves and change with them.",
} as const;

/** Short labels for links to each page (footers, the game pages, related guides). */
export const TOPIC_LABELS: Record<string, string> = {
  "free-puzzle-games-in-browser": "Free puzzle games in your browser",
  "logic-puzzles": "Logic puzzles",
  "sudoku-online": "Sudoku online",
  "word-games": "Word games",
  "trivia-quiz-games": "Trivia and quiz games",
  "arcade-games": "Arcade games",
  "board-games-online": "Board games with friends",
  "two-player-games": "2-player games",
  "party-games": "Party games for groups",
  "games-vs-computer": "Games vs the computer",
  "play-oware-online": "How to play oware",
  "made-in-ghana": "Made in Ghana",
  "oware-vs-mancala": "Oware vs mancala",
  "sudoku-6x6-vs-9x9": "Sudoku 6x6 vs 9x9",
  "ludo-online-4-players": "Ludo with 4 players",
  "quick-games-for-short-breaks": "Quick games for short breaks",
};

/** Ways in shared by several pages (true for every game: lib/copy/seo.ts siteFaq). */
const BROWSER_POINTS = [
  "No download: open the site in any web browser and play.",
  "No sign-up: play as a guest after giving your birth month and year. Sign in later with an email code or Google to keep your progress.",
  "Phones, tablets and computers: Android phones, iPhones, tablets, laptops and desktops.",
  "Install it like an app: add SPUZL to your home screen, and puzzles already on screen can be finished offline.",
  "Free for real: no ads, nothing to buy with money, and nobody can pay to win.",
] as const;

const freeQa = (what: string): QA => ({
  q: `Are these ${what} free?`,
  a: "Yes. Every game on SPUZL is free, with no ads and nothing to buy with money. You earn Sparks by playing and spend them on hats for Spuz.",
});
const accountQa: QA = {
  q: "Do I need an account?",
  a: "No. Tap Play, give your birth month and year, and you play as a guest. Sign in later with a 6-digit email code or Google to keep your progress on any device.",
};
const phoneQa = (what: string): QA => ({
  q: `Can I play ${what} on my phone?`,
  a: "Yes. SPUZL runs in the browser on Android phones, iPhones, tablets and computers. Add it to your home screen and it opens like an app.",
});

/** Facts the page builders pass in (all derived from the code). */
export interface HubFacts {
  total: number;
  groups: { label: string; slug: string; games: readonly GameMeta[] }[];
}

export const hubCopy = {
  title: "Free puzzle games in your browser, no download | SPUZL",
  description: (n: number) =>
    `Play ${n} free puzzle, word, arcade and board games in your browser. No download, no sign-up, no ads. Works on phones and laptops.`,
  h1: "Free puzzle games in your browser",
  eyebrow: "No download",
  answer: (n: number) =>
    `SPUZL is a free puzzle games site that runs in any web browser: ${n} short games, from logic grids and sudoku to word games, trivia, arcade runs and board games like oware. No download, no sign-up and no ads.`,
  whyTitle: "Why play in the browser",
  why: BROWSER_POINTS,
  typesTitle: "Games by type",
  startTitle: "Start in 30 seconds",
  start: [
    "Open SPUZL in your browser.",
    "Tap Play and give your birth month and year (SPUZL is for ages 13 and over).",
    "Pick any game. A short practice round with free hints shows you how.",
    "Clear it, then play again: puzzles never run out.",
  ],
  faq: (n: number): QA[] => [
    {
      q: "What are the best free puzzle games to play in a browser?",
      a: `SPUZL has ${n} free browser games in one place: logic puzzles, sudoku, word games, trivia, arcade games and board games. Each one takes a few minutes and needs no download.`,
    },
    freeQa("browser games"),
    accountQa,
    {
      q: "Do the games work offline?",
      a: "Partly. Add SPUZL to your home screen and it opens even with no connection; a puzzle already on your screen can be finished offline and the clear is sent when you are back online. Duels and Party need a connection.",
    },
    phoneQa("these games"),
  ],
} as const;

/** A list page for one type of game. */
export interface TypeCopy {
  title: string;
  description: (gs: readonly GameMeta[]) => string;
  h1: string;
  eyebrow: string;
  answer: (gs: readonly GameMeta[]) => string;
  sections: (gs: readonly GameMeta[]) => TopicSection[];
  faq: (gs: readonly GameMeta[]) => QA[];
}

export const logicCopy: TypeCopy = {
  title: "Free logic puzzles online: play in your browser | SPUZL",
  description: (gs) =>
    `Play ${gs.length} free logic puzzles online: ${some(gs, 4)}. Fresh boards every time, in your browser, no download.`,
  h1: "Free logic puzzles online",
  eyebrow: "Puzzles",
  answer: (gs) =>
    `SPUZL has ${free(gs.length, "logic puzzle", "logic puzzles")} you play in your browser: ${names(gs)}. Every board is generated fresh, so they never run out.`,
  sections: () => [
    {
      id: "how",
      title: "How the puzzles work",
      points: [
        "Free play deals a fresh board every time, as often as you like.",
        "Most puzzles have Easy, Medium, Hard and Expert boards, and levels that get harder in waves.",
        "Stuck? Up to 3 hints a puzzle, each one a safe next step.",
        "Race a friend on the same board in a Duel, or a whole group in a Party room.",
      ],
    },
  ],
  faq: (gs) => [
    {
      q: "What logic puzzles can I play on SPUZL?",
      a: `${names(gs)}. Each one is free in your browser.`,
    },
    ...(gs.some((g) => g.unique)
      ? [
          {
            q: "Do the logic puzzles have one answer?",
            a: `${names(gs.filter((g) => g.unique))} boards are each checked to have exactly one solution before you get them, so you never need to guess.`,
          },
        ]
      : []),
    freeQa("logic puzzles"),
    accountQa,
  ],
};

export const sudokuCopy = {
  title: "Play sudoku online free: 6x6 and 9x9 grids | SPUZL",
  description:
    "Play sudoku online free with Spuzdoku: pick a 6x6 or 9x9 grid, Easy to Expert, with hints and endless levels. No download, no sign-up.",
  h1: "Play sudoku online, free",
  eyebrow: "Spuzdoku",
  answer:
    "Spuzdoku is SPUZL's free online sudoku: pick a 6 × 6 or a 9 × 9 grid before each game, then place every number once in each row, column and box. It runs in your browser with no download.",
  rulesTitle: "Sudoku rules",
  rules: [
    "6 × 6: place 1 to 6 once in every row, every column and every 2 × 3 box.",
    "9 × 9: place 1 to 9 once in every row, every column and every 3 × 3 box.",
    "Every grid has exactly one solution, so you never have to guess.",
  ],
  featuresTitle: "What you get",
  features: (sixMin: string, nineMin: string) => [
    "Free play at Easy, Medium, Hard or Expert, as often as you like.",
    "Levels for each size that never run out, harder in waves, with a boss level every fifth.",
    "Up to 3 hints a puzzle, each one a safe next step.",
    `A 6 × 6 grid takes ${sixMin.toLowerCase()}; a 9 × 9 takes ${nineMin.toLowerCase()}.`,
  ],
  friendsLine: "Race a friend on the same grid in a Duel, best of three, or a whole group in a Party room.",
  faq: (raced: boolean): QA[] => [
    {
      q: "Can I play sudoku online for free?",
      a: "Yes. Spuzdoku on SPUZL is free, with no ads, no download and no sign-up.",
    },
    {
      q: "Is there a smaller sudoku for beginners?",
      a: "Yes. The 6 × 6 grid uses the numbers 1 to 6 and 2 × 3 boxes. It is quicker, and a good way to learn before moving to 9 × 9.",
    },
    {
      q: "Does every sudoku have one solution?",
      a: "Yes. Each grid is checked to have exactly one solution before you get it.",
    },
    ...(raced
      ? [
          {
            q: "Can I play sudoku against a friend?",
            a: "Yes. Duel a friend live on the same Spuzdoku grid, best of three, or open a Party room and race a group.",
          },
        ]
      : []),
    phoneQa("sudoku"),
  ],
} as const;

export const wordCopy: TypeCopy = {
  title: "Free word games online, no download | SPUZL",
  description: (gs) => `Play ${gs.length} free word games online: ${some(gs, 4)}. In your browser, no download, no sign-up.`,
  h1: "Free word games online",
  eyebrow: "Words",
  answer: (gs) =>
    `SPUZL has ${free(gs.length, "word game", "word games")} you play in your browser: ${names(gs)}. Each takes a few minutes, with no download.`,
  sections: () => [
    {
      id: "what",
      title: "What to expect",
      points: [
        "Original puzzles written for SPUZL, with Ghanaian and West African words and themes mixed in with global ones.",
        "Type on your keyboard or tap letters on screen.",
        "Play any time, as often as you like.",
      ],
    },
  ],
  faq: (gs) => [
    { q: "What word games are on SPUZL?", a: `${names(gs)}. All free in your browser.` },
    freeQa("word games"),
    accountQa,
    phoneQa("word games"),
  ],
};

export const quizCopy: TypeCopy = {
  title: "Free trivia and quiz games online | SPUZL",
  description: (gs) => `Play ${gs.length} free trivia and quiz games online: ${some(gs, 4)}. Short timed rounds, no sign-up.`,
  h1: "Free trivia and quiz games online",
  eyebrow: "Quiz",
  answer: (gs) =>
    `SPUZL has ${free(gs.length, "trivia game", "trivia and quiz games")} in your browser: ${names(gs)}. Rounds are short and against the clock.`,
  sections: () => [
    {
      id: "what",
      title: "What to expect",
      points: [
        "Short timed rounds: most quizzes take a minute or two.",
        "Questions on Africa and the world, with a Ghanaian and West African lean.",
        "Score games: the most points wins, and time breaks ties.",
      ],
    },
  ],
  faq: (gs) => [
    { q: "What quiz games are on SPUZL?", a: `${names(gs)}. All free in your browser.` },
    freeQa("quiz games"),
    accountQa,
    phoneQa("quiz games"),
  ],
};

export const arcadeCopy: TypeCopy = {
  title: "Free arcade games in your browser | SPUZL",
  description: (gs) => `Play ${gs.length} free arcade games in your browser: ${some(gs, 4)}. Quick runs, no download.`,
  h1: "Free arcade games in your browser",
  eyebrow: "Arcade",
  answer: (gs) =>
    `SPUZL has ${free(gs.length, "arcade game", "arcade games")} that run in your browser: ${names(gs)}. Quick runs for memory, rhythm and reflexes.`,
  sections: () => [
    {
      id: "what",
      title: "What to expect",
      points: [
        "Runs of a minute or two, made for quick breaks.",
        "Tap to play on a phone. The platform games also work with the arrow keys or a gamepad.",
        "Some arcade games have fast flashing visuals, kept under 3 flashes a second, with a notice before you start.",
      ],
    },
  ],
  faq: (gs) => [
    { q: "What arcade games are on SPUZL?", a: `${names(gs)}. All free in your browser.` },
    freeQa("arcade games"),
    phoneQa("arcade games"),
  ],
};

/** Facts for the friends, two-player, party and computer pages. */
export interface VersusFacts {
  /** Board Bay games that are On (live or one move a day with a friend) */
  bay: readonly GameMeta[];
  /** time-race puzzles that are On and allowed in Duels and Parties */
  races: readonly GameMeta[];
  /** board games with a full game vs Spuzl */
  bots: readonly GameMeta[];
  /** Board Bay games for 3 or 4 players (ludo) */
  bayFour: readonly GameMeta[];
  partyMax: number;
  /** live clock choices per player, "3, 5, 10 or 15" */
  clocks: string;
}

export const boardFriendsCopy = {
  title: "Play board games online with friends, free | SPUZL",
  description: (f: VersusFacts) => `Play ${names(f.bay)} online with friends, free. Play live or one move a day, in your browser.`,
  h1: "Play board games online with friends",
  eyebrow: "Board Bay",
  answer: (f: VersusFacts) =>
    `On SPUZL you can play ${names(f.bay)} online with a friend for free: live with a clock, or one move a day. Send an invite link, and nothing to download.`,
  howTitle: "How to play a friend",
  how: [
    "Open the game and tap Challenge a friend.",
    "Choose live (with a clock) or one move a day.",
    "Send the invite link or code. The game starts when your friend joins.",
  ],
  waysTitle: "Ways to play",
  ways: (f: VersusFacts) => [
    `Live: each player gets a clock (${f.clocks} minutes, depending on the game).`,
    "One move a day: take turns with up to a day per move. A nudge is allowed once your friend has had 12 hours.",
    "Play live: get paired with another player near your level (players 16 and over).",
    ...(f.bayFour.length ? [`${names(f.bayFour)} seats 2 to 4 players.`] : []),
    "No friend around? Play a full game against Spuzl, the computer, at Easy, Medium or Hard.",
  ],
  faq: (f: VersusFacts): QA[] => [
    {
      q: "Which board games can I play online with friends?",
      a: `${names(f.bay)}, free on SPUZL, live or one move a day.`,
    },
    {
      q: "Can I play a board game with a friend who is far away?",
      a: "Yes. Send an invite link. In one-move-a-day games each player has up to a day per move, so you can play across time zones.",
    },
    freeQa("board games"),
    accountQa,
  ],
} as const;

export const twoPlayerCopy = {
  title: "Free 2-player games online: play a friend | SPUZL",
  description: (n: number) =>
    `${n} free 2-player games online: race a friend on the same puzzle, or play board games live or one move a day. In your browser.`,
  h1: "Free 2-player games online",
  eyebrow: "Two players",
  answer: (n: number) =>
    `SPUZL has ${games(n)} you can play against one other person for free in your browser: live puzzle Duels, best of three, and board games played live or one move a day.`,
  duelTitle: "Puzzle Duels",
  duel: "Race a friend live on the same puzzle, best of three. The first to clear wins the round. Invite a friend with a link, or use Quick Match to meet a player.",
  boardTitle: "Board games for two",
  board: "Challenge a friend to a full game, live with a clock or one move a day.",
  faq: (f: VersusFacts): QA[] => [
    {
      q: "What 2-player games can I play online for free?",
      a: `Puzzle Duels in ${names(f.races.slice(0, 5))}${f.races.length > 5 ? " and more" : ""}, and board games: ${names(f.bay)}.`,
    },
    {
      q: "How does a Duel work?",
      a: "You and your opponent get the same puzzle at the same moment. The first to clear wins the round, and the first to win two rounds wins the Duel.",
    },
    freeQa("2-player games"),
    accountQa,
  ],
} as const;

export const partyCopy = {
  title: (max: number) => `Online party games for groups, up to ${max} players | SPUZL`,
  description: (max: number) =>
    `Free online party games for groups: open a room, share the code and race up to ${max} players on the same puzzle. Plus a big-screen TV view.`,
  h1: "Online party games for groups",
  eyebrow: "Party",
  answer: (max: number) =>
    `SPUZL Party rooms let a group race on the same puzzles for free: the host opens a room, shares a code, and up to ${max} players race from their own phones. No download.`,
  howTitle: "How a Party works",
  how: (max: number) => [
    "The host opens a Party room and picks a game or a random mix.",
    `Friends join with the room code on their own phones, up to ${max} players.`,
    "Everyone gets the same puzzle at the same moment and races to clear it.",
    "After the last round, see who won and play again.",
  ],
  extrasTitle: "Good to know",
  extras: (f: VersusFacts) => [
    "Put the room on a TV or laptop with the big-screen view, for parties in one room.",
    ...(f.bayFour.length ? [`With 3 or 4 players, the host can start a live game of ${names(f.bayFour)} instead.`] : []),
    "Rooms with players under 16 use preset chat phrases only.",
  ],
  faq: (max: number): QA[] => [
    {
      q: "How many players can join a Party?",
      a: `Up to ${max} players in one room, each on their own phone.`,
    },
    {
      q: "Do my friends need to download anything?",
      a: "No. They open the link or type the code in their browser and play as a guest.",
    },
    freeQa("party games"),
    {
      q: "Can I put the game on a TV?",
      a: "Yes. Party rooms have a big-screen view you can open on a TV or laptop while everyone plays on their phones.",
    },
  ],
} as const;

export const botCopy = {
  title: "Board games vs the computer, free online | SPUZL",
  description: (f: VersusFacts) => `Play ${names(f.bots)} against the computer for free, at Easy, Medium or Hard. In your browser.`,
  h1: "Play board games against the computer",
  eyebrow: "Vs Spuzl",
  answer: (f: VersusFacts) =>
    `On SPUZL you can play a full game of ${names(f.bots)} against Spuzl, the computer, for free in your browser, at Easy, Medium or Hard.`,
  howTitle: "How it works",
  how: [
    "Open the game and tap Play vs Spuzl.",
    "Choose Easy, Medium or Hard. A new level starts a new game.",
    "Play a full casual game: no XP and nothing ranked. In most games, Undo takes back your last move.",
  ],
  faq: (f: VersusFacts): QA[] => [
    { q: "Which games can I play against the computer?", a: `${names(f.bots)}, each at Easy, Medium or Hard.` },
    {
      q: "Is playing the computer ranked?",
      a: "No. Games against Spuzl are casual: no XP and nothing ranked, so you can practise freely.",
    },
    freeQa("games against the computer"),
    accountQa,
  ],
} as const;

/** Oware: the rules exactly as games/oware/engine.ts plays them (Abapa). */
export const owareRules = {
  board: "Two rows of six pits, four seeds in each: 48 seeds. Your row is the one nearest you.",
  sow: "On your turn, pick up every seed from one of your pits and sow them one by one into the following pits, anticlockwise.",
  lap: "A pit with 12 or more seeds goes all the way round the board and skips the pit it came from.",
  capture:
    "If your last seed lands in one of your rival's pits and makes it 2 or 3, you capture those seeds. Then check the pit before it: if that one also holds 2 or 3, capture it too, and so on along their row.",
  grandSlam: "A move that would capture every seed on your rival's side is played, but captures nothing (the grand slam rule).",
  feed: "If your rival has no seeds, you must make a move that gives them some. If no move can, the game ends and you keep the seeds on your side.",
  win: "The first to capture 25 seeds wins. 24 each is a draw.",
  cycle: "If 100 moves pass with no capture, the game ends and each player keeps the seeds on their side.",
} as const;

export const owareCopy = {
  title: "How to play oware: rules, tips and play online | SPUZL",
  description:
    "Play oware online free and learn the rules: sowing, capturing 2s and 3s, feeding and winning with 25 seeds. Play the computer or a friend.",
  h1: "Play oware online: rules and how to play",
  eyebrow: "Oware guide",
  answer:
    "Oware is a two-player seed-sowing game from Ghana and West Africa, part of the mancala family. You sow seeds anticlockwise round a board of 12 pits and capture your rival's pits that end on 2 or 3; the first to 25 seeds wins. You can play it free on SPUZL against the computer or a friend.",
  whatTitle: "What is oware?",
  what: [
    "Oware is one of the best-known mancala games: board games where you move by sowing seeds from pit to pit. It is played across West Africa and in the Caribbean, under names such as awale, awari and warri.",
    "In Ghana the standard rules are called Abapa. SPUZL plays oware by Abapa rules, the version on this page.",
  ],
  howTitle: "How to play oware, step by step",
  howToName: "How to play oware (Abapa rules)",
  steps: [
    ["Set up", owareRules.board],
    ["Sow", owareRules.sow],
    ["Go round", owareRules.lap],
    ["Capture", owareRules.capture],
    ["Mind the grand slam", owareRules.grandSlam],
    ["Feed your rival", owareRules.feed],
    ["Win", owareRules.win],
  ] as const,
  captureTitle: "The capture rule, in one example",
  capture: [
    "Say your last seed lands in your rival's fourth pit, which held 2 seeds: it now holds 3, so you take those 3. Their third pit held 1 and now holds 2 after your sowing: you take those 2 as well. Their second pit holds 5, so the capture stops there.",
    "You only ever capture on your rival's side, and only a run of 2s and 3s that ends where your last seed fell.",
  ],
  endTitle: "When the game ends",
  end: [owareRules.win, owareRules.feed, owareRules.cycle],
  tipsTitle: "Oware strategy tips",
  tips: [
    "Count before you sow: the number of seeds in a pit tells you exactly where the last one lands.",
    "Look for rival pits holding 1 or 2 seeds. Landing your last seed there makes 2 or 3, ready to capture.",
    "Watch your own pits with 1 or 2 seeds: they are your rival's targets.",
    "A captured run can be long. Line up your sowing to end on the last of several small pits in a row.",
    "Save a big pit. 12 or more seeds go right round the board and can set up a large capture.",
    "Remember the grand slam: taking every seed on their side captures nothing.",
  ],
  playTitle: "Ways to play oware on SPUZL",
  play: (clocks: string, live: boolean, bot: boolean) => [
    "Free play: a mid-game position with you to move. Find the one sow that captures the most seeds.",
    ...(bot ? ["Play Spuzl, the computer: a full game at Easy, Medium or Hard. Undo takes back a move."] : []),
    ...(live
      ? [
          `Play a friend live, with ${clocks} minutes each on the clock.`,
          "Play a friend one move a day: take your turn whenever suits you, with up to a day per move.",
        ]
      : []),
  ],
  mancalaTitle: "Mancala online",
  mancala: [
    "If you are looking for mancala online, oware is a mancala game: two rows of pits, seeds sown one by one, captures on your rival's side.",
    "Some mancala sets at home play other rules, where you sow seeds into your own store at the end of the board. In oware you never sow into a store: captured seeds are simply set aside.",
  ],
  faq: [
    {
      q: "Can I play oware online for free?",
      a: "Yes. SPUZL has oware free in your browser: against Spuzl, the computer, against a friend live or one move a day, and as quick capture puzzles. No download and no sign-up.",
    },
    {
      q: "How many seeds do you need to win oware?",
      a: "25 of the 48 seeds. If both players end with 24, the game is a draw.",
    },
    {
      q: "Which way do you sow in oware?",
      a: "Anticlockwise, one seed per pit, starting with the pit after the one you emptied.",
    },
    {
      q: "Is oware the same as mancala?",
      a: "Oware is a mancala game. Mancala is the name of the whole family of seed-sowing games; oware is one of them, with its own capture rule (2s and 3s on your rival's side).",
    },
    {
      q: "What happens if my rival has no seeds?",
      a: "You must make a move that gives them seeds. If no move can, the game ends and you keep the seeds on your side.",
    },
  ] as QA[],
} as const;

export const owareVsMancalaCopy = {
  title: "Oware vs mancala: what is the difference? | SPUZL",
  description:
    "Oware vs mancala explained: mancala is the family of seed-sowing games, oware is one of them. How the boards, captures and endings differ.",
  h1: "Oware vs mancala: what is the difference?",
  eyebrow: "Comparison",
  answer:
    "Mancala is the name for a whole family of seed-sowing board games; oware is one of them, played in Ghana and across West Africa. So all oware is mancala, but not all mancala is oware: rules differ from game to game.",
  familyTitle: "Mancala is a family",
  family: [
    "Mancala games share one idea: pick up the seeds in a pit and sow them one by one into the next pits. Hundreds of versions are played around the world, with two, three or four rows of pits.",
    "Oware is a two-row game with six pits a side. Its standard rules in Ghana are called Abapa.",
  ],
  tableTitle: "Side by side",
  table: [
    ["", "Oware (Abapa)", "Other mancala games"],
    ["Board", "2 rows of 6 pits, 4 seeds each (48)", "Varies: 2 to 4 rows, many pit counts"],
    ["Stores", "Never sown into: captures are set aside", "Some sets sow into a store at each end"],
    ["Capture", "Last seed makes 2 or 3 in a rival pit", "Varies by game"],
    ["Extra turns", "None", "Some versions give one"],
    ["Win", "25 seeds", "Varies by game"],
  ],
  playTitle: "Try oware",
  play: "SPUZL has oware free in your browser: quick capture puzzles, full games against Spuzl, the computer, and games with a friend.",
  faq: [
    {
      q: "Is oware a mancala game?",
      a: "Yes. Oware is one of the mancala games, the family of board games where you sow seeds from pit to pit.",
    },
    {
      q: "How many pits does an oware board have?",
      a: "12 pits in two rows of six, with 4 seeds in each at the start: 48 seeds in all.",
    },
    {
      q: "Where can I play oware online?",
      a: "On SPUZL, free in your browser, against the computer or a friend.",
    },
  ] as QA[],
} as const;

export const sudokuSizesCopy = {
  title: "Sudoku 6x6 vs 9x9: which size should you play? | SPUZL",
  description:
    "Sudoku 6x6 vs 9x9: the 6x6 grid uses 1 to 6 and 2x3 boxes and plays faster; 9x9 uses 1 to 9 and 3x3 boxes. Play both free in Spuzdoku.",
  h1: "Sudoku 6x6 vs 9x9: which size should you play?",
  eyebrow: "Comparison",
  answer:
    "A 6 × 6 sudoku uses the numbers 1 to 6 with 2 × 3 boxes and is quicker; a 9 × 9 sudoku uses 1 to 9 with 3 × 3 boxes and asks for more steps. Start with 6 × 6 to learn, then move up. Spuzdoku on SPUZL has both, free.",
  table: (sixMin: string, nineMin: string) => [
    ["", "6 × 6", "9 × 9"],
    ["Numbers", "1 to 6", "1 to 9"],
    ["Boxes", "2 × 3 (six boxes)", "3 × 3 (nine boxes)"],
    ["Cells", "36", "81"],
    ["Typical game", sixMin, nineMin],
    ["Best for", "Learning, short breaks", "A longer think"],
  ],
  tableTitle: "Side by side",
  whichTitle: "Which should you pick?",
  which: [
    "New to sudoku: start with 6 × 6 on Easy. The same rules, fewer cells to track.",
    "Five minutes free: 6 × 6 on Hard or Expert is a real test in a short time.",
    "Settling in: 9 × 9 is the classic size, with more room for long chains of logic.",
  ],
  faq: [
    {
      q: "Is 6x6 sudoku easier than 9x9?",
      a: "Usually. It has 36 cells instead of 81 and only six numbers, so there is less to track. A 6 × 6 on Expert can still feel harder than a 9 × 9 on Easy.",
    },
    {
      q: "Are the rules the same?",
      a: "Yes. Every number once in each row, column and box. Only the size of the grid and the boxes changes.",
    },
    {
      q: "Where can I play both sizes free?",
      a: "Spuzdoku on SPUZL: pick 6 × 6 or 9 × 9 before each game, at Easy to Expert, in your browser.",
    },
  ] as QA[],
} as const;

export const ludoCopy = {
  title: "Ludo online with 4 players: how it works | SPUZL",
  description:
    "Play ludo online free with 2 to 4 players: invite friends live or one move a day, start a 4-player game from a Party room, or play the computer.",
  h1: "Play ludo online with 4 players",
  eyebrow: "Ludo",
  answer:
    "SPUZL has free online ludo for 2 to 4 players: invite friends to a live game or one with a move a day, start a four-player game from a Party room, or play Spuzl, the computer. It runs in your browser.",
  rulesTitle: "Ludo rules on SPUZL",
  ways: (clocks: string) => [
    "Challenge friends: pick 2, 3 or 4 players, then live or one move a day, and share the link.",
    `Live games give each player a clock (${clocks} minutes).`,
    "Party room: with 3 or 4 players in the room, the host can start a live ludo game and share its code.",
    "Against Spuzl, the computer: pick 2 to 4 players and Spuzl plays the other colours, at Easy, Medium or Hard.",
    "Play live pairs you with one other player near your level (players 16 and over).",
  ],
  houseTitle: "House rules",
  house: [
    "Before a game you can switch on house rules for everyone at the table:",
    "Back-kick: move back by your roll to take a rival behind you.",
    "Side-kick: take a rival straight across the lane from where you land.",
    "Home-kick: run up a rival's home column on an exact roll to take a piece there.",
  ],
  waysTitle: "Ways to play with 4",
  faq: [
    {
      q: "Can 4 people play ludo online together?",
      a: "Yes. SPUZL's ludo seats 2 to 4 players. Invite friends with a link, or start it from a Party room with 3 or 4 players.",
    },
    {
      q: "Do you need a 6 to start in ludo?",
      a: "Yes. On SPUZL you roll a 6 to bring a piece out, then race all four pieces home.",
    },
    {
      q: "Can I play ludo against the computer?",
      a: "Yes. Play a full game of ludo against Spuzl, the computer, at Easy, Medium or Hard, with 2 to 4 players at the table.",
    },
    freeQa("ludo games"),
  ] as QA[],
} as const;

export const shortBreaksCopy = {
  title: "Quick free puzzle games for short breaks | SPUZL",
  description: (n: number) =>
    `${n} quick free games that take about 2 minutes or less: logic puzzles, word games, quizzes and arcade runs. In your browser, no download.`,
  h1: "Quick puzzle games for short breaks",
  eyebrow: "Two minutes",
  answer: (n: number) =>
    `SPUZL has ${games(n)} that take about two minutes or less, free in your browser: a quick logic grid, a word puzzle, a trivia round or an arcade run. Open, play, done.`,
  whyTitle: "Made for short breaks",
  why: [
    "No download, nothing to install.",
    "Pick up where you like: free play never runs out.",
    "Daily Five: five quick games a day, about 5 minutes in all, the same for everyone.",
    "Grow a streak with one clear a day, with Streak Freezes for busy days.",
  ],
  faq: (n: number): QA[] => [
    {
      q: "What games can I play in two minutes?",
      a: `${games(n)} on SPUZL take about two minutes or less, from logic grids to quizzes and arcade runs.`,
    },
    { q: "What is the Daily Five?", a: "Five quick games picked fresh every day, the same five for everyone, about 5 minutes in all." },
    freeQa("quick games"),
    phoneQa("quick games"),
  ],
} as const;

/** One Ghanaian touch in SPUZL, shown only while its game is On. */
export interface GhanaItem {
  id: string;
  line: string;
}

export const ghanaCopy = {
  title: "Made in Ghana: free puzzle and board games | SPUZL",
  description: (ghanaian: readonly string[]) =>
    `SPUZL is a free puzzle games app made in Ghana, with ${ghanaian.length ? `${listOf(ghanaian)} and ` : ""}word puzzles full of Ghanaian life. Play in your browser.`,
  h1: "Made in Ghana: SPUZL puzzle games",
  eyebrow: "Made in Ghana",
  /** `ghanaian`: the names of the Ghanaian games that are On (Oware, Trotro Jam) */
  answer: (ghanaian: readonly string[]) =>
    `SPUZL is a free puzzle games app designed and developed in Ghana by Senya, for puzzle lovers everywhere. Alongside classic puzzles it has Ghanaian ${ghanaian.length ? `games such as ${listOf(ghanaian)}, and ` : ""}food, places and words in its word and quiz games.`,
  gamesTitle: "Ghanaian and West African games",
  games: {
    oware: "The seed-sowing board game, played by Abapa rules, the standard in Ghana. Play it against the computer or a friend.",
    trotro: "Slide the cars and trucks out of the way until the trotro can drive out of the lorry station.",
    dara: "A West African stone game. Line up exactly three to take a rival stone, against Spuzl, the computer.",
  } as Record<string, string>,
  wordsTitle: "Ghana in the word and quiz games",
  words: {
    quads: "Groups like Ghana regions, Ghanaian dishes, dances and festivals.",
    coil: "Themes such as Ghanaian plates and Around Ghana.",
    minicross: "About 1 grid in 4 has a Ghanaian or West African answer or clue.",
    rungs: "About 1 clue in 5 points at Ghana or West Africa.",
    emojihits: "About half the films, shows and songs are Ghanaian or from elsewhere in Africa.",
    quickfire: "Trivia on Africa and the world, with a Ghanaian and West African lean.",
    twotruths: "A Ghana theme among its rounds.",
  } as Record<string, string>,
  marchTitle: "Independence Day quiz",
  march:
    "Around 6 March, Ghana's Independence Day, SPUZL can run a 6 March event: while it runs, Quickfire plays rounds from 20 Ghana history questions.",
  aboutTitle: "About SPUZL",
  about: [
    "Designed and developed by Senya, in Ghana.",
    "Free, with no ads and nothing to buy with money.",
    "Runs in any browser on phones, tablets and computers, and installs like an app.",
    "SPUZL's terms of use are governed by the laws of Ghana.",
  ],
  /** `ghanaian`: the names of the Ghanaian games that are On */
  faq: (ghanaian: readonly string[]): QA[] => [
    {
      q: "Is SPUZL made in Ghana?",
      a: "Yes. SPUZL is designed and developed in Ghana by Senya, for puzzle lovers everywhere.",
    },
    {
      q: "Which Ghanaian games are on SPUZL?",
      a: `${ghanaian.length ? `${listOf(ghanaian)}. ` : ""}The word and quiz games also carry Ghanaian food, places and words.`,
    },
    {
      q: "Can I play SPUZL outside Ghana?",
      a: "Yes. SPUZL runs in any web browser, anywhere, for free.",
    },
  ],
} as const;
