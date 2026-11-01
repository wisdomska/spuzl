/**
 * Runtime game settings: tunables the admin console can change without a deploy (audit "admin cascade").
 * Each entry has a default, a range and helper text; the server validates every write against this
 * schema, and both the server and the client read values at runtime (never hard-coded copies).
 * Add a setting here, then read it with `getGameSettings()` (server) or `useGameSettings()` (client).
 */
export type SettingDef =
  | { kind: "int"; label: string; help: string; group: string; default: number; min: number; max: number; unit?: string }
  | { kind: "bool"; label: string; help: string; group: string; default: boolean };

export const SETTINGS = {
  "features.dailies": {
    kind: "bool",
    group: "Features",
    label: "Dailies",
    help: "The shared Daily puzzles, their leaderboards and the archive. Off: free play is the only solo mode and every Daily screen and mention is hidden. The server refuses Daily play while off.",
    default: false,
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
  "guest.signInPromptAfterClears": {
    kind: "int",
    group: "Accounts",
    label: "Guest sign-in prompt after clears",
    help: "After this many clears a guest sees “Save your streak” with one-tap sign-in. 0 turns it off.",
    default: 3,
    min: 0,
    max: 50,
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
export type GameSettings = { [K in SettingKey]: (typeof SETTINGS)[K]["default"] extends boolean ? boolean : number };

export const DEFAULTS = Object.fromEntries(Object.entries(SETTINGS).map(([k, d]) => [k, d.default])) as GameSettings;

export const isSettingKey = (k: string): k is SettingKey => k in SETTINGS;

/** Validates one value against its definition; returns an error message or null. */
export function validateSetting(key: string, value: unknown): string | null {
  if (!isSettingKey(key)) return "Unknown setting";
  const d: SettingDef = SETTINGS[key];
  if (d.kind === "bool") return typeof value === "boolean" ? null : "Must be on or off";
  if (typeof value !== "number" || !Number.isInteger(value)) return "Must be a whole number";
  if (value < d.min || value > d.max) return `Must be between ${d.min} and ${d.max}${d.unit ? ` ${d.unit}` : ""}`;
  return null;
}

/** Stored rows over the defaults; invalid or unknown stored values fall back to the default. */
export function mergeSettings(rows: { key: string; value: unknown }[]): GameSettings {
  const out: Record<string, unknown> = { ...DEFAULTS };
  for (const r of rows) if (isSettingKey(r.key) && validateSetting(r.key, r.value) === null) out[r.key] = r.value;
  return out as GameSettings;
}
