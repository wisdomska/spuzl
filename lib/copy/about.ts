import { GAME_COUNT, WORLD_COUNT } from "@/lib/catalog";

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
  lede: "SPUZL is a free puzzle games app. Logic grids, word games, quick reflex runs and classic board games like oware and draughts. Right in your browser, no download.",
  play: "Play now",
  signIn: "Sign in",
  trust: "Play as a guest. Sign in later to keep your streak on any phone.",
  tryIt: {
    label: "Try it",
    game: "Crownfall",
    rules: ["One crown per row and column", "One crown per colour", "Crowns never touch, even corners"],
    hint: "Tap a square twice to place a crown.",
    solved: `Cleared! That's one of ${GAME_COUNT}.`,
    /** R2-08: the demo clear is carried into onboarding as the first clear. */
    counted: "That counts as your first clear. No lesson needed.",
    more: "Play the rest",
  },
  stats: [
    [String(GAME_COUNT), "games"],
    [String(WORLD_COUNT), "worlds"],
    ["Free", "to play"],
  ] as const,
  howEyebrow: "How it works",
  howTitle: "Three taps to your first win.",
  steps: [
    ["Pick.", "Choose any game, any time. New to it? A short practice round with free hints shows you how."],
    ["Play.", "Puzzles never run out. Clear one for XP and Sparks, and spend Sparks on hats for Spuz."],
    ["Keep it going.", "Clear one game a day to grow your streak, earn badges and climb your weekly league."],
  ] as const,
  worldsEyebrow: "The games",
  worldsTitle: `${spelled(WORLD_COUNT)} worlds to wander.`,
  gamesCount: (n: number) => (n === 1 ? "1 game" : `${n} games`),
  friendsEyebrow: "With friends",
  friendsTitle: "Better with your people.",
  friends: [
    ["sword", "Duel", "Race a friend on the same puzzle, best of three, live."],
    ["users-three", "Party", "Open a room, share the code, and race up to eight phones at once."],
    ["trophy", "Leagues", "Join a league of 30 every Monday. The top 7 move up."],
  ] as const,
  accountTitle: "Accounts and your data",
  account: [
    "You can play as a guest with no account. To keep your progress on any phone, sign in with a 6-digit email code or with Google.",
    "With Google sign-in, SPUZL asks Google only for your name, email address and profile picture. We use your email to sign you in and recover your account. We never post for you, read your contacts or sell your data.",
    "You can download or delete your data any time in Settings.",
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
    body: "SPIL is our party game app: ten games you play on your own phones. Start a room, friends join with a code, answer in private and guess each other's score. Free in your browser, no app.",
    cta: "Play SPIL",
    newTab: "(opens in a new tab)",
    url: "https://spil-party.vercel.app",
  },
  ctaTitle: "Your first puzzle takes 30 seconds.",
  ctaBody: "No sign-up, no download. Just tap and play.",
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
