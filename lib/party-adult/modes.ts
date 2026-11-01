/**
 * Party modes. "race" is the original Party Race (puzzles, any age). "draw" (Draw It) and "truths" (Two
 * Truths) are the 18+ party games: free text and drawings between players, so only signed-in adults may
 * create, join or see them, behind the admin switch "features.adultParty". The server enforces all of it
 * (lib/party-adult/server.ts); the client only hides what the server would refuse.
 */
export const PARTY_MODES = ["race", "draw", "truths"] as const;
export type PartyMode = (typeof PARTY_MODES)[number];
export type AdultMode = Exclude<PartyMode, "race">;
export const ADULT_MODES: readonly AdultMode[] = ["draw", "truths"];
export const isAdultMode = (m: unknown): m is AdultMode => m === "draw" || m === "truths";

/** Rounds in a set: everyone leads once (draws, or writes their statements), up to 8. */
export const roundsFor = (players: number) => Math.max(0, Math.min(8, players));

/** Who leads round `round` (1-based): the starting line-up in seat order, one each. */
export const leadFor = (leads: readonly string[], round: number): string | null => leads[round - 1] ?? null;
