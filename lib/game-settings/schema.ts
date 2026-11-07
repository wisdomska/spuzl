/**
 * Runtime game settings: tunables the admin console can change without a deploy (audit "admin cascade").
 * Each entry has a default, a range and helper text; the server validates every write against this
 * schema, and both the server and the client read values at runtime (never hard-coded copies).
 * Add a setting here, then read it with `getGameSettings()` (server) or `useGameSettings()` (client).
 */
import { GAMES, LAB_GAMES } from "@/lib/catalog";
import { hasLogic } from "@/games/logic-ids";

export type SettingDef =
  | { kind: "int"; label: string; help: string; group: string; default: number; min: number; max: number; unit?: string }
  | { kind: "bool"; label: string; help: string; group: string; default: boolean }
  /** A set of switches picked from `options` (any number of them, none included). */
  | {
      kind: "set";
      label: string;
      help: string;
      group: string;
      default: readonly string[];
      options: readonly { id: string; label: string }[];
    }
  /** One of a fixed list of values (shown as a select). */
  | { kind: "enum"; label: string; help: string; group: string; default: string; options: readonly string[] };

export const SETTINGS = {
  "features.dailies": {
    kind: "bool",
    group: "Features",
    label: "Dailies",
    help: "The shared Daily puzzles, their leaderboards and the archive. Off: free play is the only solo mode and every Daily screen and mention is hidden. The server refuses Daily play while off.",
    default: false,
  },
  "dailyFive.enabled": {
    kind: "bool",
    group: "Daily Five",
    label: "Daily Five",
    help: "Five short shared puzzles a day, the same for everyone: one per world plus a bonus, with a combined score and a share grid. Shows the Daily Five card on Home and the /daily page. Off: both are hidden and the server refuses Daily Five play.",
    default: true,
  },
  "dailyFive.resetHour": {
    kind: "int",
    group: "Daily Five",
    label: "New Daily Five at (GMT hour)",
    help: "The hour, in GMT, when the next Daily Five opens. 0 is midnight GMT. A clear before this hour counts for the previous day's five.",
    default: 0,
    min: 0,
    max: 23,
    unit: "h GMT",
  },
  "dailyFive.difficulty": {
    kind: "enum",
    group: "Daily Five",
    label: "Difficulty",
    help: "The difficulty every Daily Five puzzle is made at. Keep it quick: the five should take about 5 minutes together. Applies to days picked after the change; locked days keep theirs.",
    default: "easy",
    options: ["easy", "medium", "hard"],
  },
  "dailyFive.maxGameSec": {
    kind: "int",
    group: "Daily Five",
    label: "Longest game picked",
    help: "Only games whose typical time (Library page) is at most this are picked automatically. A world with no game this quick uses its quickest game.",
    default: 120,
    min: 30,
    max: 600,
    unit: "s",
  },
  "dailyFive.daysAhead": {
    kind: "int",
    group: "Daily Five",
    label: "Days scheduled ahead",
    help: "How many days ahead the daily job keeps the Daily Five picked and its puzzles made. Unlocked automatic days are re-picked when the rules change.",
    default: 14,
    min: 2,
    max: 60,
    unit: "days",
  },
  "dailyFive.world.logic": {
    kind: "bool",
    group: "Daily Five",
    label: "Puzzles slot",
    help: "One game from Puzzles each day. Off: a bonus game takes the slot, so there are still five.",
    default: true,
  },
  "dailyFive.world.word": {
    kind: "bool",
    group: "Daily Five",
    label: "Words & Quiz slot",
    help: "One game from Words & Quiz each day. Off: a bonus game takes the slot.",
    default: true,
  },
  "dailyFive.world.reflex": {
    kind: "bool",
    group: "Daily Five",
    label: "Arcade slot",
    help: "One game from Arcade each day. Off: a bonus game takes the slot.",
    default: true,
  },
  "dailyFive.world.board": {
    kind: "bool",
    group: "Daily Five",
    label: "Board Games slot",
    help: "One board puzzle from Board Games each day. Off: a bonus game takes the slot.",
    default: true,
  },
  "dailyFive.bonus.logic": {
    kind: "bool",
    group: "Daily Five",
    label: "Bonus pool: Puzzles",
    help: "The bonus game rotates through the worlds switched on here (never a game already in that day's five). All off: every world is in the pool.",
    default: true,
  },
  "dailyFive.bonus.word": {
    kind: "bool",
    group: "Daily Five",
    label: "Bonus pool: Words & Quiz",
    help: "Words & Quiz games can be the bonus game.",
    default: true,
  },
  "dailyFive.bonus.reflex": {
    kind: "bool",
    group: "Daily Five",
    label: "Bonus pool: Arcade",
    help: "Arcade games can be the bonus game.",
    default: true,
  },
  "dailyFive.bonus.board": {
    kind: "bool",
    group: "Daily Five",
    label: "Bonus pool: Board Games",
    help: "Board puzzles can be the bonus game.",
    default: true,
  },
  "features.labGames": {
    kind: "set",
    group: "Features",
    label: "Lab games",
    help: "Games switched on for players while in testing. A ticked game shows in All games and on its world, can be picked for the Daily Five and gets Dailies, and players can open it (practice round, free play, vs the bot). Unticked: it is hidden and the server refuses it like an unknown game. Lab games never go into Duels or Parties. None ticked: players see only the live games.",
    default: [] as readonly string[],
    options: LAB_GAMES.map((g) => ({ id: g.id, label: g.name })),
  },
  "features.statusCards": {
    kind: "bool",
    group: "Features",
    label: "Status share cards",
    help: 'Shows "Share my status" on Me: a card with the player\'s Spuz, nickname, level, streak, favourite world, games tried and rank. Off: the button is hidden and the card links stop working.',
    default: false,
  },
  "features.challenges": {
    kind: "bool",
    group: "Features",
    label: "Friend challenges",
    help: '"Beat my time" links to the exact puzzle of a clear, with a link preview image (game, time, the sender\'s hatted Spuz, "Beat me") and "Send it back" on the result. Links last 7 days. Off: the buttons are hidden, the server refuses new and open challenges, and preview images stop.',
    default: true,
  },
  "features.seasonal": {
    kind: "bool",
    group: "Features",
    label: "Seasonal events",
    help: "Runs the events made on the Seasonal events page: a small Home banner and a bonus quest in Quests, counted from free-play clears, while an event is live. Off: players see no event and the server counts and pays no event quest.",
    default: false,
  },
  "features.adultParty": {
    kind: "bool",
    group: "Features",
    label: "18+ party games (Draw It, Two Truths)",
    help: "Adds Draw It and Two Truths to Party for signed-in players whose age band is 18+. Players type and draw freely, so every line passes the text filter and has a Report button (Moderation, Party content tab). Off: the modes are hidden from everyone and the server refuses them, including rooms already open.",
    default: false,
  },
  "adultParty.drawSec": {
    kind: "int",
    group: "18+ party games",
    label: "Draw It: drawing time",
    help: "How long the drawer has, and the others have to guess, each round.",
    default: 80,
    min: 30,
    max: 180,
    unit: "s",
  },
  "adultParty.writeSec": {
    kind: "int",
    group: "18+ party games",
    label: "Two Truths: writing time",
    help: "How long a player has to write their three statements. Out of time: their turn is skipped.",
    default: 75,
    min: 30,
    max: 180,
    unit: "s",
  },
  "adultParty.voteSec": {
    kind: "int",
    group: "18+ party games",
    label: "Two Truths: voting time",
    help: "How long everyone else has to pick the lie.",
    default: 30,
    min: 10,
    max: 120,
    unit: "s",
  },
  "adultParty.revealSec": {
    kind: "int",
    group: "18+ party games",
    label: "Answer shown for",
    help: "How long the word or the lie stays on screen before the next round.",
    default: 7,
    min: 3,
    max: 30,
    unit: "s",
  },
  "adultParty.blockDays": {
    kind: "int",
    group: "18+ party games",
    label: "Block after an actioned report",
    help: "When a moderator actions a party-content report, the reported player is kept out of 18+ rooms for this many days.",
    default: 7,
    min: 1,
    max: 90,
    unit: "days",
  },
  "adultParty.xpPerRound": {
    kind: "int",
    group: "18+ party games",
    label: "XP per round played",
    help: "XP for each round a player took part in (drew, wrote, guessed or voted), paid when the room finishes. Only players still in the room at the end, in rooms of 3 or more, until the daily cap below.",
    default: 5,
    min: 0,
    max: 50,
    unit: "XP",
  },
  "adultParty.sparksPerRound": {
    kind: "int",
    group: "18+ party games",
    label: "Sparks per round played",
    help: "Sparks for each round a player took part in, paid with the XP while they are under the daily cap.",
    default: 1,
    min: 0,
    max: 20,
    unit: "Sparks",
  },
  "adultParty.winXp": {
    kind: "int",
    group: "18+ party games",
    label: "Winner bonus XP",
    help: "Extra XP for the room's winner (most points; a tie goes to every player sharing first place).",
    default: 20,
    min: 0,
    max: 200,
    unit: "XP",
  },
  "adultParty.winSparks": {
    kind: "int",
    group: "18+ party games",
    label: "Winner bonus Sparks",
    help: "Extra Sparks for the room's winner.",
    default: 5,
    min: 0,
    max: 100,
    unit: "Sparks",
  },
  "adultParty.xpDailyCap": {
    kind: "int",
    group: "18+ party games",
    label: "18+ party XP a day",
    help: "Most XP a player can earn from 18+ party games in one GMT day. The room that reaches it pays what is left; after that, rooms pay no XP or Sparks until tomorrow.",
    default: 150,
    min: 0,
    max: 2000,
    unit: "XP",
  },
  "hints.dailyXpKeptPct": {
    kind: "int",
    group: "Hints",
    label: "Daily XP kept after a hint (%)",
    help: "Share of the Daily XP a player keeps when they used at least one hint. 50 means XP is halved.",
    default: 50,
    min: 0,
    max: 100,
    unit: "%",
  },
  "play.solvedHoldMs": {
    kind: "int",
    group: "Game shell",
    label: "Hold on the solved board",
    help: "How long the solved board stays visible, highlighted, before the results appear.",
    default: 1000,
    min: 300,
    max: 3000,
    unit: "ms",
  },
  "duel.roundResultMs": {
    kind: "int",
    group: "Duel",
    label: "Round result card",
    help: "How long the round result card shows before the next round's 3-2-1 countdown.",
    default: 2000,
    min: 1000,
    max: 5000,
    unit: "ms",
  },
  "party.countdownSeconds": {
    kind: "int",
    group: "Duel and Party",
    label: "Round start countdown",
    help: "The number every Duel round and Party game counts down from before SPUZL! (3 means 3, 2, 1). Each number shows for 0.8 s, then SPUZL! for 1.6 s. Boards stay frozen until the round starts, and the server refuses moves sent before then. Party rounds start half a second after the countdown so slow phones see all of it.",
    default: 3,
    min: 2,
    max: 5,
  },
  "rooms.under16FriendsOnly": {
    kind: "bool",
    group: "Rooms",
    label: "Under-16 hosts: friends only",
    help: "Party rooms and friend duels hosted by a 13 to 15 player only let in the host's accepted friends. Anyone else gets a clear message and can send a request to join that the host approves or declines in the lobby (logged on Join requests). Off: anyone with the code can join, as for older hosts. The server enforces it on every join.",
    default: true,
  },
  "quickfire.autoAdvanceMs": {
    kind: "int",
    group: "Games",
    label: "Quickfire auto-advance",
    help: "Delay after an answer before the next question appears.",
    default: 1500,
    min: 800,
    max: 4000,
    unit: "ms",
  },
  "flinch.autoStartMs": {
    kind: "int",
    group: "Games",
    label: "Flinch next-round delay",
    help: "Delay before the next Flinch round starts on its own (players can tap to skip).",
    default: 1500,
    min: 800,
    max: 4000,
    unit: "ms",
  },
  "dusk.doubleTapMs": {
    kind: "int",
    group: "Games",
    label: "Dusk double-tap window",
    help: "Two taps on one Dusk cell closer together than this make a moon (a double-tap). The cell is judged once this window passes.",
    default: 320,
    min: 200,
    max: 700,
    unit: "ms",
  },
  "perf.prefetch": {
    kind: "bool",
    group: "Performance",
    label: "Prefetch next screens",
    help: "Load the next game and results targets in the background while the player is idle. Turn off only to debug.",
    default: true,
  },
  "shop.starterPrice": {
    kind: "int",
    group: "Economy",
    label: "Starter cosmetic price",
    help: "Sparks price of the starter hat, the first thing a new player can afford.",
    default: 100,
    min: 0,
    max: 1000,
    unit: "Sparks",
  },
  "free.xpPerClear": {
    kind: "int",
    group: "Economy",
    label: "Free play XP per clear",
    help: "XP for each free-play clear, until the daily cap below. Replaying the same board earns nothing.",
    default: 10,
    min: 0,
    max: 100,
    unit: "XP",
  },
  "free.sparksPerClear": {
    kind: "int",
    group: "Economy",
    label: "Free play Sparks per clear",
    help: "Sparks for each free-play clear while the player is under the daily XP cap.",
    default: 5,
    min: 0,
    max: 50,
    unit: "Sparks",
  },
  "free.xpDailyCap": {
    kind: "int",
    group: "Economy",
    label: "Free play XP a day",
    help: "Most XP a player can earn from free play in one GMT day. Once reached, free-play clears give no XP or Sparks until tomorrow.",
    default: 300,
    min: 0,
    max: 5000,
    unit: "XP",
  },
  "guest.signInPromptAfterClears": {
    kind: "int",
    group: "Accounts",
    label: "Guest sign-in prompt after clears",
    help: "After this many clears a guest sees “Save your streak” with one-tap sign-in. 0 turns it off.",
    default: 3,
    min: 0,
    max: 50,
  },
  "prompts.alertsTriggers": {
    kind: "set",
    group: "Prompts",
    label: "Notification ask: triggers",
    help: "The moments that earn the “Know when it's your turn” ask. It never shows cold, on Home or during play. None ticked: it never shows (Settings > Alerts still works).",
    default: ["friend", "invite", "streak"],
    options: [
      { id: "friend", label: "First friend added" },
      { id: "invite", label: "First Duel or Party invite, sent or received" },
      { id: "streak", label: "Streak reached (days below)" },
    ],
  },
  "prompts.alertsCooldownDays": {
    kind: "int",
    group: "Prompts",
    label: "Notification ask: wait after it shows",
    help: "After the ask has shown (Not now, or no answer), it waits at least this long before it can show again, and then only after a new trigger.",
    default: 7,
    min: 1,
    max: 30,
    unit: "days",
  },
  "prompts.alertsStreakDays": {
    kind: "int",
    group: "Prompts",
    label: "Notification ask: streak trigger",
    help: "The streak, in days, that earns the ask while the streak trigger is on.",
    default: 3,
    min: 2,
    max: 14,
    unit: "days",
  },
  "prompts.lowDataThresholdMs": {
    kind: "int",
    group: "Prompts",
    label: "Low-data suggestion: slow load",
    help: "A measured load (the page load, a tap on a link to the next screen, or a tap to a playable board) longer than this counts as slow.",
    default: 4000,
    min: 2000,
    max: 15000,
    unit: "ms",
  },
  "prompts.lowDataSlowLoads": {
    kind: "int",
    group: "Prompts",
    label: "Low-data suggestion: slow loads in a row",
    help: "How many slow loads in a row before low-data mode is suggested (at most once a session). On a connection the browser rates 2G or 3G, one slow load is enough.",
    default: 2,
    min: 1,
    max: 5,
  },
  "practice.disabled": {
    kind: "set",
    group: "Practice rounds",
    label: "Practice round off for",
    help: "Ticked games skip the practice round (the short first try with free hints) from every way in: Continue, Library, links, Daily Five, levels and vs the bot. They also skip the How it works card in Duels and Parties. The server stops serving their practice boards too. None ticked: every game has its practice round.",
    default: [] as readonly string[],
    options: [...GAMES, ...LAB_GAMES].filter((g) => hasLogic(g.id)).map((g) => ({ id: g.id, label: g.name })),
  },
  "leagues.fillWithFriends": {
    kind: "bool",
    group: "Leagues",
    label: "Group new players with friends",
    help: "Place new players in a league with their friends first, then with players near their level.",
    default: true,
  },
  "leagues.minGroup": {
    kind: "int",
    group: "Leagues",
    label: "Smallest league group",
    help: "Below this many players a league is topped up with level-matched players before the week starts.",
    default: 8,
    min: 2,
    max: 30,
  },
} as const satisfies Record<string, SettingDef>;

export type SettingKey = keyof typeof SETTINGS;
export type GameSettings = {
  [K in SettingKey]: (typeof SETTINGS)[K]["default"] extends boolean
    ? boolean
    : (typeof SETTINGS)[K]["default"] extends readonly string[]
      ? readonly string[]
      : (typeof SETTINGS)[K]["default"] extends string
        ? string
        : number;
};
export type SettingValue = number | boolean | string | readonly string[];

export const DEFAULTS = Object.fromEntries(Object.entries(SETTINGS).map(([k, d]) => [k, d.default])) as unknown as GameSettings;

/** Longest list a multi-pick (set) setting can hold through the admin API: at least every option of every set. */
export const SETTING_LIST_MAX = 100;

export const isSettingKey = (k: string): k is SettingKey => k in SETTINGS;

/** Validates one value against its definition; returns an error message or null. */
export function validateSetting(key: string, value: unknown): string | null {
  if (!isSettingKey(key)) return "Unknown setting";
  const d: SettingDef = SETTINGS[key];
  if (d.kind === "bool") return typeof value === "boolean" ? null : "Must be on or off";
  if (d.kind === "set") {
    const ids = d.options.map((o) => o.id);
    if (!Array.isArray(value) || !value.every((v) => typeof v === "string" && ids.includes(v)))
      return `Must be a list of: ${ids.join(", ")}`;
    return new Set(value).size === value.length ? null : "Each option at most once";
  }
  if (d.kind === "enum") return typeof value === "string" && d.options.includes(value) ? null : `Must be one of: ${d.options.join(", ")}`;
  if (typeof value !== "number" || !Number.isInteger(value)) return "Must be a whole number";
  if (value < d.min || value > d.max) return `Must be between ${d.min} and ${d.max}${d.unit ? ` ${d.unit}` : ""}`;
  return null;
}

/** Equal setting values (a set compares as a set, in any order). */
export function sameSetting(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x) => b.includes(x));
  return a === b;
}

/** Stored rows over the defaults; invalid or unknown stored values fall back to the default. */
export function mergeSettings(rows: { key: string; value: unknown }[]): GameSettings {
  const out: Record<string, unknown> = { ...DEFAULTS };
  for (const r of rows) if (isSettingKey(r.key) && validateSetting(r.key, r.value) === null) out[r.key] = r.value;
  return out as GameSettings;
}
