/**
 * Runtime game settings: tunables the admin console can change without a deploy (audit "admin cascade").
 * Each entry has a default, a range and helper text; the server validates every write against this
 * schema, and both the server and the client read values at runtime (never hard-coded copies).
 * Add a setting here, then read it with `getGameSettings()` (server) or `useGameSettings()` (client).
 * Labels and help are written for a non-technical owner: what it does and what players notice, in plain words.
 */
import { DEFAULT_SWITCH, GAMES, type GameSwitch } from "@/lib/catalog";
import { hasLogic } from "@/games/logic-ids";

/** Game settings sections, in page order, each with one line on what it covers. */
export const SETTING_GROUPS = [
  { name: "Features for players", about: "Whole features, on or off for everyone." },
  { name: "Daily Five", about: "Five quick puzzles a day, for everyone." },
  { name: "Rewards: XP and Sparks", about: "Solo XP and Sparks, and the starter price." },
  { name: "Duels and Parties", about: "Countdowns, score games, rewards and who joins." },
  {
    name: "Party games for older players",
    about: "Draw It and Two Truths, 16+ and 18+ only.",
  },
  { name: "Reminders and notifications", about: "When reminders go out and alerts are asked." },
  { name: "Tips and prompts", about: "Suggestions shown at the right moment." },
  { name: "Practice rounds", about: "The first try with free hints." },
  { name: "Leagues", about: "How weekly groups are made." },
  { name: "Game timing", about: "Tested defaults. Change only to fix a complaint." },
  { name: "Technical", about: "Leave as they are unless a developer asks." },
] as const;
export type SettingGroup = (typeof SETTING_GROUPS)[number]["name"];

/** Shared by every kind: an owner-facing name, one short line of help, optional longer "more" text and a section. */
interface SettingText {
  /** Plain name shown to admins. */
  label: string;
  /** One short line: what it does. */
  help: string;
  /** Optional longer detail, folded under "More" on Game settings. */
  more?: string;
  /** Section on Game settings (one of SETTING_GROUPS). */
  group: SettingGroup;
  /**
   * Edited somewhere else, not on Game settings: "games" is the Games page (one switch on each game's row). The key
   * stays the storage and the server validates it the same way.
   */
  editedOn?: "games";
}

export type SettingDef =
  | (SettingText & {
      kind: "int";
      default: number;
      min: number;
      max: number;
      unit?: string;
      /** What a unit-less number counts, in words ("clears", "players"). */
      noun?: string;
    })
  | (SettingText & { kind: "bool"; default: boolean })
  /** A set of switches picked from `options` (any number of them, none included). */
  | (SettingText & {
      kind: "set";
      default: readonly string[];
      options: readonly { id: string; label: string }[];
    })
  /** One of a fixed list of values (shown as a select). */
  | (SettingText & { kind: "enum"; default: string; options: readonly string[] });

const FEATURES = "Features for players";
const FIVE = "Daily Five";
const REWARDS = "Rewards: XP and Sparks";
const PARTY = "Duels and Parties";
const OLDER = "Party games for older players";
const REMIND = "Reminders and notifications";
const TIPS = "Tips and prompts";
const PRACTICE = "Practice rounds";
const LEAGUES = "Leagues";
const TIMING = "Game timing";
const TECH = "Technical";

export const SETTINGS = {
  "features.dailies": {
    kind: "bool",
    group: FEATURES,
    label: "Daily puzzles (one per game)",
    help: "A daily puzzle per game, with leaderboards and an archive.",
    more: "Off: free play only. Daily screens are hidden and refused.",
    default: false,
  },
  "dailyFive.enabled": {
    kind: "bool",
    group: FIVE,
    label: "Daily Five",
    help: "Five quick puzzles a day, the same for everyone.",
    more: "One game per world plus a bonus. Off: hidden on Home and refused.",
    default: true,
  },
  "dailyFive.resetHour": {
    kind: "int",
    group: FIVE,
    label: "New Daily Five starts at",
    help: "Hour (GMT) the next five opens. 0 is midnight.",
    more: "Clears before this hour count for the previous day.",
    default: 0,
    min: 0,
    max: 23,
    unit: "h GMT",
  },
  "dailyFive.difficulty": {
    kind: "enum",
    group: FIVE,
    label: "Difficulty",
    help: "How hard each puzzle is. Aim for 5 minutes in all.",
    more: "Applies to newly picked days. Locked days keep theirs.",
    default: "easy",
    options: ["easy", "medium", "hard"],
  },
  "dailyFive.maxGameSec": {
    kind: "int",
    group: FIVE,
    label: "Longest game it can pick",
    help: "Only games this quick or quicker are picked.",
    more: "Usual times are on the Games page. A world with none uses its quickest.",
    default: 120,
    min: 30,
    max: 600,
    unit: "s",
  },
  "dailyFive.daysAhead": {
    kind: "int",
    group: FIVE,
    label: "Days planned ahead",
    help: "How far ahead days are picked.",
    more: "Unlocked automatic days are picked again when these rules change.",
    default: 14,
    min: 2,
    max: 60,
    unit: "days",
  },
  "dailyFive.world.logic": {
    kind: "bool",
    group: FIVE,
    label: "Include a Puzzles game",
    help: "One game from the Puzzles world each day.",
    more: "Off: a bonus game fills the gap.",
    default: true,
  },
  "dailyFive.world.word": {
    kind: "bool",
    group: FIVE,
    label: "Include a Words & Quiz game",
    help: "One game from the Words & Quiz world each day.",
    more: "Off: a bonus game fills the gap.",
    default: true,
  },
  "dailyFive.world.reflex": {
    kind: "bool",
    group: FIVE,
    label: "Include an Arcade game",
    help: "One game from the Arcade world each day.",
    more: "Off: a bonus game fills the gap.",
    default: true,
  },
  "dailyFive.world.board": {
    kind: "bool",
    group: FIVE,
    label: "Include a Board Games puzzle",
    help: "One board puzzle from the Board Games world each day.",
    more: "Off: a bonus game fills the gap.",
    default: true,
  },
  "dailyFive.bonus.logic": {
    kind: "bool",
    group: FIVE,
    label: "Bonus game can be from Puzzles",
    help: "The bonus game rotates between the worlds ticked here.",
    more: "Never a repeat. All off: any world.",
    default: true,
  },
  "dailyFive.bonus.word": {
    kind: "bool",
    group: FIVE,
    label: "Bonus game can be from Words & Quiz",
    help: "Words & Quiz games can be the bonus game.",
    default: true,
  },
  "dailyFive.bonus.reflex": {
    kind: "bool",
    group: FIVE,
    label: "Bonus game can be from Arcade",
    help: "Arcade games can be the bonus game.",
    default: true,
  },
  "dailyFive.bonus.board": {
    kind: "bool",
    group: FIVE,
    label: "Bonus game can be from Board Games",
    help: "Board puzzles can be the bonus game.",
    default: true,
  },
  "features.statusCards": {
    kind: "bool",
    group: FEATURES,
    label: "Share my status card",
    help: "Players share a status card from Me.",
    more: "Off: the button hides and old links stop working.",
    default: false,
  },
  "features.challenges": {
    kind: "bool",
    group: FEATURES,
    label: "Friend challenges",
    help: '"Beat my time" links with the exact puzzle.',
    more: "Links last 7 days. Off: buttons hide and open challenges are refused.",
    default: true,
  },
  "features.storyCards": {
    kind: "bool",
    group: FEATURES,
    label: "Story cards for sharing",
    help: "Tall share pictures for WhatsApp Status and stories.",
    more: "Needs Friend challenges. Off: the older Daily cards are used.",
    default: true,
  },
  "features.partyTv": {
    kind: "bool",
    group: PARTY,
    label: "Party on a big screen",
    help: "Watch-only Party view for a projector or TV.",
    more: "Anyone with the code can watch; no chat or play. Never for hosts under 16. Off: refused.",
    default: true,
  },
  "features.streakShield": {
    kind: "bool",
    group: FEATURES,
    label: "Free streak shield for signing in",
    help: "Guests who save their account get a free Streak Freeze.",
    more: "Once per account; none if they hold 2. Off: none given.",
    default: true,
  },
  "features.seasonal": {
    kind: "bool",
    group: FEATURES,
    label: "Seasonal events",
    help: "Runs Events-page events: Home banner and bonus quest.",
    more: "Off: no events shown and no event quests counted.",
    default: true,
  },
  "features.adultParty": {
    kind: "bool",
    group: OLDER,
    label: "Draw It and Two Truths for 18+",
    help: "Draw It and Two Truths in Party, 18+ signed in.",
    more: "Free typing is word-filtered and reportable. Off: hidden and refused, even in open rooms.",
    default: false,
  },
  "party.familyDraw": {
    kind: "bool",
    group: OLDER,
    label: "Draw It for 16+ (safe word list, no typing)",
    help: "Family-safe Draw It in Party, 16+ signed in.",
    more: "Safe word list; guessers pick, nobody types. Drawings can be reported. Off: hidden and refused.",
    default: false,
  },
  "adultParty.drawSec": {
    kind: "int",
    group: OLDER,
    label: "Draw It: time to draw",
    help: "Time to draw and guess each round.",
    default: 80,
    min: 30,
    max: 180,
    unit: "s",
  },
  "adultParty.writeSec": {
    kind: "int",
    group: OLDER,
    label: "Two Truths: time to write",
    help: "Time to write three statements. Late turns are skipped.",
    default: 75,
    min: 30,
    max: 180,
    unit: "s",
  },
  "adultParty.voteSec": {
    kind: "int",
    group: OLDER,
    label: "Two Truths: time to vote",
    help: "Time for everyone else to pick the lie.",
    default: 30,
    min: 10,
    max: 120,
    unit: "s",
  },
  "adultParty.revealSec": {
    kind: "int",
    group: OLDER,
    label: "Answer stays on screen for",
    help: "How long the answer shows before the next round.",
    default: 7,
    min: 3,
    max: 30,
    unit: "s",
  },
  "adultParty.blockDays": {
    kind: "int",
    group: OLDER,
    label: "Keep a reported player out for",
    help: "How long an upheld report keeps a player out.",
    default: 7,
    min: 1,
    max: 90,
    unit: "days",
  },
  "adultParty.xpPerRound": {
    kind: "int",
    group: OLDER,
    label: "XP for each round played",
    help: "XP per round played, paid when the room ends.",
    more: "Only for players still there, in rooms of 3 or more, under the daily limit.",
    default: 5,
    min: 0,
    max: 50,
    unit: "XP",
  },
  "adultParty.sparksPerRound": {
    kind: "int",
    group: OLDER,
    label: "Sparks for each round played",
    help: "Sparks per round played, under the daily limit.",
    default: 1,
    min: 0,
    max: 20,
    unit: "Sparks",
  },
  "adultParty.winXp": {
    kind: "int",
    group: OLDER,
    label: "Winner's extra XP",
    help: "Extra XP for the winner. Ties share it.",
    default: 20,
    min: 0,
    max: 200,
    unit: "XP",
  },
  "adultParty.winSparks": {
    kind: "int",
    group: OLDER,
    label: "Winner's extra Sparks",
    help: "Extra Sparks for the room's winner.",
    default: 5,
    min: 0,
    max: 100,
    unit: "Sparks",
  },
  "adultParty.xpDailyCap": {
    kind: "int",
    group: OLDER,
    label: "Most XP a day from these games",
    help: "Most XP a day from these games (GMT).",
    more: "After the limit, rooms pay nothing until the next day.",
    default: 150,
    min: 0,
    max: 2000,
    unit: "XP",
  },
  "hints.dailyXpKeptPct": {
    kind: "int",
    group: REWARDS,
    label: "Daily XP kept after using a hint",
    help: "Share of Daily XP kept after a hint. 50% halves it.",
    default: 50,
    min: 0,
    max: 100,
    unit: "%",
  },
  "play.solvedHoldMs": {
    kind: "int",
    group: TIMING,
    label: "Pause on the solved board",
    help: "How long the solved board shows before results.",
    default: 1000,
    min: 300,
    max: 3000,
    unit: "ms",
  },
  "duel.roundResultMs": {
    kind: "int",
    group: PARTY,
    label: "Duel: round result shown for",
    help: "How long a round result shows.",
    default: 2000,
    min: 1000,
    max: 5000,
    unit: "ms",
  },
  "party.countdownSeconds": {
    kind: "int",
    group: PARTY,
    label: "Countdown before each round",
    help: "Count before each Duel or Party round (3 = 3, 2, 1).",
    more: "Boards stay frozen until it ends; early moves are refused.",
    default: 3,
    min: 2,
    max: 5,
  },
  "party.maxPlayers": {
    kind: "int",
    group: PARTY,
    label: "Most players in a Party",
    help: "Biggest Party room. Hosts pick any size up to this.",
    more: "10 is the most the live connection handles smoothly. Open rooms keep their size.",
    default: 10,
    min: 2,
    max: 10,
    noun: "players",
  },
  "party.maxPlayersTurns": {
    kind: "int",
    group: PARTY,
    label: "Most players in Draw It and Two Truths",
    help: "Everyone takes a turn, so smaller rooms keep rounds short.",
    more: "Never more than the Party limit above. Open rooms keep their size.",
    default: 8,
    min: 2,
    max: 10,
    noun: "players",
  },
  "party.scoreRaces": {
    kind: "bool",
    group: PARTY,
    label: "Score games in Party",
    help: "Hosts can pick score games like Quickfire. Most points wins.",
    more: "Ties go to the faster finish. Never in Duels. Off: removed and refused.",
    default: true,
  },
  "party.scoreRaceSeconds": {
    kind: "int",
    group: PARTY,
    label: "Score game time limit",
    help: "Longest a Party score game can run.",
    more: "Anyone still playing is scored on what they did.",
    default: 180,
    min: 60,
    max: 600,
    unit: "s",
  },
  "party.winXp": {
    kind: "int",
    group: PARTY,
    label: "Party winner XP",
    help: "XP for a Party set's winner. Counts toward the daily limit.",
    default: 30,
    min: 0,
    max: 200,
    unit: "XP",
  },
  "party.playXp": {
    kind: "int",
    group: PARTY,
    label: "Party player XP",
    help: "XP for everyone else still there. Counts toward the daily limit.",
    default: 10,
    min: 0,
    max: 100,
    unit: "XP",
  },
  "party.xpDailyCap": {
    kind: "int",
    group: PARTY,
    label: "Most Party XP a day",
    help: "Most Party XP a day (GMT).",
    more: "After it, sets pay no XP until the next day. 16+ and 18+ games have their own limit.",
    default: 150,
    min: 0,
    max: 2000,
    unit: "XP",
  },
  "rooms.under16FriendsOnly": {
    kind: "bool",
    group: PARTY,
    label: "Younger hosts (13 to 15): friends only",
    help: "Rooms hosted by 13 to 15s let in friends only.",
    more: "Others can ask to join; the host decides (see Join requests). Off: anyone with the code joins.",
    default: true,
  },
  "quickfire.autoAdvanceMs": {
    kind: "int",
    group: TIMING,
    label: "Quickfire: pause between questions",
    help: "Wait after an answer before the next question.",
    default: 1500,
    min: 800,
    max: 4000,
    unit: "ms",
  },
  "flinch.autoStartMs": {
    kind: "int",
    group: TIMING,
    label: "Flinch: pause between rounds",
    help: "Wait before the next round. Players can tap to skip.",
    default: 1500,
    min: 800,
    max: 4000,
    unit: "ms",
  },
  "dusk.doubleTapMs": {
    kind: "int",
    group: TIMING,
    label: "Dusk: double-tap speed",
    help: "Taps closer than this count as a double-tap.",
    more: "The square is judged after this time.",
    default: 320,
    min: 200,
    max: 700,
    unit: "ms",
  },
  "perf.prefetch": {
    kind: "bool",
    group: TECH,
    label: "Load the next screen early",
    help: "Loads next screens early so they open faster. Leave on.",
    more: "Switch off only if a developer asks.",
    default: true,
  },
  "shop.starterPrice": {
    kind: "int",
    group: REWARDS,
    label: "Starter hat price",
    help: "The first shop item a new player can afford.",
    default: 100,
    min: 0,
    max: 1000,
    unit: "Sparks",
  },
  "free.xpPerClear": {
    kind: "int",
    group: REWARDS,
    label: "XP for each free-play clear",
    help: "XP per free-play clear, under the daily limit.",
    more: "Replaying a board earns nothing.",
    default: 10,
    min: 0,
    max: 100,
    unit: "XP",
  },
  "free.sparksPerClear": {
    kind: "int",
    group: REWARDS,
    label: "Sparks for each free-play clear",
    help: "Sparks per free-play clear, under the daily limit.",
    default: 5,
    min: 0,
    max: 50,
    unit: "Sparks",
  },
  "free.xpDailyCap": {
    kind: "int",
    group: REWARDS,
    label: "Most free-play XP a day",
    help: "Most free-play XP a day (GMT).",
    more: "After it, clears pay nothing until the next day.",
    default: 300,
    min: 0,
    max: 5000,
    unit: "XP",
  },
  "guest.signInPromptAfterClears": {
    kind: "int",
    group: TIPS,
    label: "Ask guests to save their account after",
    help: "Clears before a guest sees “Save your streak”. 0 is off.",
    default: 3,
    min: 0,
    max: 50,
    noun: "clears",
  },
  "prompts.alertsTriggers": {
    kind: "set",
    group: REMIND,
    label: "When to ask about notifications",
    help: "Moments that trigger the alerts question.",
    more: "Never out of the blue. None ticked: never asked.",
    default: ["friend", "invite", "streak"],
    options: [
      { id: "friend", label: "First friend added" },
      { id: "invite", label: "First Duel or Party invite, sent or received" },
      { id: "streak", label: "Streak reached (days below)" },
    ],
  },
  "prompts.alertsCooldownDays": {
    kind: "int",
    group: REMIND,
    label: "Wait before asking again",
    help: "Gap before the alerts question can show again.",
    default: 7,
    min: 1,
    max: 30,
    unit: "days",
  },
  "prompts.alertsStreakDays": {
    kind: "int",
    group: REMIND,
    label: "Streak that earns the question",
    help: "Streak length that triggers the question, if ticked.",
    default: 3,
    min: 2,
    max: 14,
    unit: "days",
  },
  "prompts.lowDataThresholdMs": {
    kind: "int",
    group: TIPS,
    label: "Low-data tip: a load is slow after",
    help: "A load slower than this counts as slow.",
    more: "Measured on first load, screen taps and board opens.",
    default: 4000,
    min: 2000,
    max: 15000,
    unit: "ms",
  },
  "prompts.lowDataSlowLoads": {
    kind: "int",
    group: TIPS,
    label: "Low-data tip: slow loads in a row",
    help: "Slow loads in a row before suggesting low-data mode.",
    more: "On 2G or 3G, one is enough. At most once a visit.",
    default: 2,
    min: 1,
    max: 5,
    noun: "slow loads",
  },
  "weeklyRecap.enabled": {
    kind: "bool",
    group: FEATURES,
    label: "Weekly recap",
    help: "A Home card each week summing up the last one.",
    more: "Off: the card and its share picture are hidden.",
    default: true,
  },
  "streakNudge.enabled": {
    kind: "bool",
    group: REMIND,
    label: "Streak reminder",
    help: "Evening alert when a streak is about to end.",
    more: "At most once a day, never in quiet hours. Off: none sent.",
    default: true,
  },
  "streakNudge.hour": {
    kind: "int",
    group: REMIND,
    label: "Streak reminder: send at",
    help: "Player's local time (GMT if unknown).",
    more: "Keep it before quiet hours start.",
    default: 19,
    min: 12,
    max: 22,
    unit: "h local",
  },
  "streakNudge.minStreak": {
    kind: "int",
    group: REMIND,
    label: "Streak reminder: shortest streak",
    help: "Only streaks this long or longer get one.",
    default: 2,
    min: 2,
    max: 30,
    unit: "days",
  },
  "alerts.quietStart": {
    kind: "int",
    group: REMIND,
    label: "Quiet hours start",
    help: "No reminders from this local time. Friend alerts still arrive.",
    more: "Same as the end time: no quiet hours.",
    default: 22,
    min: 0,
    max: 23,
    unit: "h local",
  },
  "alerts.quietEnd": {
    kind: "int",
    group: REMIND,
    label: "Quiet hours end",
    help: "Reminders may go out again from this time.",
    default: 8,
    min: 0,
    max: 23,
    unit: "h local",
  },
  "alerts.quietStartUnder16": {
    kind: "int",
    group: REMIND,
    label: "Quiet hours start for 13 to 15 year olds",
    help: "Earlier quiet hours for 13 to 15s.",
    default: 21,
    min: 0,
    max: 23,
    unit: "h local",
  },
  "practice.disabled": {
    kind: "set",
    group: PRACTICE,
    label: "Games that skip the practice round",
    help: "Ticked games skip the first try with free hints.",
    editedOn: "games",
    more: "Skipped everywhere, Duels and Parties included. None ticked: every game has practice.",
    default: [] as readonly string[],
    options: GAMES.filter((g) => hasLogic(g.id)).map((g) => ({ id: g.id, label: g.name })),
  },
  "leagues.fillWithFriends": {
    kind: "bool",
    group: LEAGUES,
    label: "Put new players with their friends",
    help: "New players join friends first, then similar levels.",
    default: true,
  },
  "leagues.minGroup": {
    kind: "int",
    group: LEAGUES,
    label: "Smallest league",
    help: "Smaller leagues are topped up with similar players.",
    default: 8,
    min: 2,
    max: 30,
    noun: "players",
  },
} as const satisfies Record<string, SettingDef>;

export type SettingKey = keyof typeof SETTINGS;
/**
 * The settings every reader gets: the stored tunables over their defaults, plus the games' runtime switch (On, In
 * testing, Off and the Duels and Parties opt-out: GameSwitch in lib/catalog.ts). The switch is not a setting key: the
 * server reads it from the `games` table (getGameSettings) and the Games page changes it.
 */
export type GameSettings = SchemaSettings & GameSwitch;
type SchemaSettings = {
  [K in SettingKey]: (typeof SETTINGS)[K]["default"] extends boolean
    ? boolean
    : (typeof SETTINGS)[K]["default"] extends readonly string[]
      ? readonly string[]
      : (typeof SETTINGS)[K]["default"] extends string
        ? string
        : number;
};
export type SettingValue = number | boolean | string | readonly string[];

export const DEFAULTS = {
  ...Object.fromEntries(Object.entries(SETTINGS).map(([k, d]) => [k, d.default])),
  ...DEFAULT_SWITCH,
} as unknown as GameSettings;

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
  return out as unknown as GameSettings;
}
