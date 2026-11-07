/**
 * Party modes. "race" is the original Party Race (puzzles, any age). "draw" (Draw It) and "truths" (Two
 * Truths) are the 18+ party games: free text and drawings between players, so only signed-in adults may
 * create, join or see them, behind the admin switch "features.adultParty". "drawfam" (R2-P5) is Draw It for 16+:
 * preset family-safe words and pick-the-word guessing (no free text at all), behind "party.familyDraw" and only for
 * signed-in players aged 16 and over (lib/party-adult/family.ts; docs/DECISIONS.md PD1 says why not under 16).
 * The server enforces all of it (lib/multiplayer/server/adult.ts); the client only hides what the server would
 * refuse.
 */
export const PARTY_MODES = ["race", "draw", "truths", "drawfam"] as const;
export type PartyMode = (typeof PARTY_MODES)[number];
/** The turn-based party games: everyone takes a turn to draw or write; no puzzle, TV mode or classroom. */
export type TurnMode = Exclude<PartyMode, "race">;
/** The 18+ modes (free text and drawings, adults only). */
export type AdultMode = "draw" | "truths";
export const ADULT_MODES: readonly AdultMode[] = ["draw", "truths"];
export const isAdultMode = (m: unknown): m is AdultMode => m === "draw" || m === "truths";
export const isTurnMode = (m: unknown): m is TurnMode => isAdultMode(m) || m === "drawfam";
export const isFamilyDraw = (m: unknown): m is "drawfam" => m === "drawfam";
/** The kind of round a turn mode plays: family Draw It rounds are Draw It rounds with preset options. */
export const roundModeOf = (m: TurnMode): AdultMode => (m === "drawfam" ? "draw" : m);

/** Rounds in a set: everyone leads once (draws, or writes their statements), up to 8. */
export const roundsFor = (players: number) => Math.max(0, Math.min(8, players));

/** Who leads round `round` (1-based): the starting line-up in seat order, one each. */
export const leadFor = (leads: readonly string[], round: number): string | null => leads[round - 1] ?? null;
