import { GAME_COUNT, WORLD_COUNT } from "@/lib/catalog";
import { PARTY_MAX } from "@/lib/multiplayer/constants";

/** "Eight" for 8: the worlds headline spells small counts out; larger ones stay digits. */
const SPELLED = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
const spelled = (n: number) => SPELLED[n] ?? String(n);

/**
 * Public landing page (what signed-out visitors and Google's reviewers see at "/").
 * Game and world counts come from the catalog (live games only), never typed by hand.
 */
export const aboutCopy = {
  /** Search title and description of "/" (under 60 and 155 characters; lib/copy/seo.ts seoMeta.landing) */
  metaTitle: `SPUZL: ${GAME_COUNT} free puzzle games to play online`,
  metaDescription: `Play ${GAME_COUNT} free puzzle, word, arcade and board games in your browser. No download, no sign-up. Duel friends and climb weekly leagues.`,
  name: "SPUZL",
  nav: { how: "How it works", worlds: "Games", friends: "Friends", signIn: "Sign in", play: "Play" },
  eyebrow: `${GAME_COUNT} free games · ${WORLD_COUNT} worlds`,
  headline: ["Tiny puzzles.", "Big brain"],
  headlineAccent: "energy.",
  lede: "Logic grids, word games, arcade runs and board games like oware. Free in your browser, no download.",
  play: "Play now",
  signIn: "Sign in",
  trust: "Play as a guest. Sign in later to keep your streak.",
  tryIt: {
    label: "Try it",
    game: "Crownfall",
    rules: ["One crown per row and column", "One crown per colour", "Crowns never touch, even corners"],
    hint: "Tap a square twice for a crown.",
    solved: `Cleared! That's one of ${GAME_COUNT}.`,
    /** R2-08: the demo clear is carried into onboarding as the first clear. */
    counted: "It counts as your first clear.",
    more: "Play the rest",
    /** R6: the sound switch on the demo card (music stays off on the landing page) */
    sound: "Sound",
    soundOn: "Sound on",
    soundOff: "Sound off",
  },
  stats: [
    [String(GAME_COUNT), "games"],
    [String(WORLD_COUNT), "worlds"],
    ["Free", "to play"],
  ] as const,
  howEyebrow: "How it works",
  howTitle: "Three taps to your first win.",
  steps: [
    ["Pick.", "Any game, any time. A quick practice round shows you how."],
    ["Play.", "Puzzles never run out. Clear one for XP and Sparks."],
    ["Keep it going.", "Clear one a day to grow your streak and climb your league."],
  ] as const,
  worldsEyebrow: "The games",
  worldsTitle: `${spelled(WORLD_COUNT)} worlds to wander.`,
  gamesCount: (n: number) => (n === 1 ? "1 game" : `${n} games`),
  /**
   * The counts on the landing page itself, for the games that are On now (the page is rebuilt hourly and at once after
   * an admin changes a game's state). The static keys above keep the catalogue count for text that can't follow.
   */
  counted: (games: number, worlds: number) => ({
    eyebrow: `${games} free games · ${worlds} worlds`,
    stats: [
      [String(games), "games"],
      [String(worlds), "worlds"],
      ["Free", "to play"],
    ] as const,
    worldsTitle: `${spelled(worlds)} worlds to wander.`,
  }),
  friendsEyebrow: "With friends",
  friendsTitle: "Better with your people.",
  friends: [
    ["sword", "Duel", "Race a friend live on the same puzzle."],
    ["users-three", "Party", `Share a code. Race up to ${PARTY_MAX} phones at once.`],
    ["trophy", "Leagues", "A new league of 30 every Monday. Top 7 move up."],
  ] as const,
  accountTitle: "Accounts and your data",
  account: [
    "Play as a guest, no account needed. To keep your progress on any phone, sign in with an email code or Google.",
    "With Google, SPUZL gets only your name, email address and profile picture. We use your email to sign you in and recover your account. We never post for you, read your contacts or sell your data.",
    "Download or delete your data any time in Settings.",
  ] as const,
  privacy: "Privacy policy",
  terms: "Terms of use",
  /**
   * R4-01: the sister app card, mirroring SPIL's own "Also by Senya" section. Facts only from the owner's SPIL
   * launch copy; don't add claims here that SPIL itself doesn't make.
   */
  spil: {
    eyebrow: "From the same studio",
    title: "Prefer party games?",
    body: "SPIL is our party game app: ten games you play on your own phones. Friends join with a code. Free in your browser.",
    cta: "Play SPIL",
    newTab: "(opens in a new tab)",
    url: "https://spil-party.vercel.app",
  },
  ctaTitle: "Your first puzzle takes 30 seconds.",
  ctaBody: "No sign-up, no download.",
  credit: "Designed & Developed by Senya",
  creditUrl: "https://wisdomska.site",
  made: "Made in Ghana for puzzle lovers everywhere.",
  footer: [
    ["/how-to-play", "How to play"],
    ["/fair-play", "Fair play"],
    ["/privacy", "Privacy"],
    ["/terms", "Terms"],
    ["/contact", "Contact"],
    // R4-02: the feedback form on /contact, noting the visitor came from the landing page
    ["/contact?from=/", "Feedback"],
  ] as const,
} as const;
