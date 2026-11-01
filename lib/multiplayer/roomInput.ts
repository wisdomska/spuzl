/**
 * Party room request bodies (SPZ-13). The game must be one the Host tab offers (`PARTY_GAME_IDS`, i.e. every
 * race game) or null for a Random mix; anything else is a 400 before the lobby code runs.
 */
import { z } from "zod";
import { PARTY_MAX, PARTY_MIN } from "./constants";
import { isRaceGame } from "./games";
import { PARTY_MODES } from "@/lib/party-adult/modes";

const partyGame = z.string().max(24).refine(isRaceGame, { message: "game_not_raceable" });
const difficulty = z.enum(["easy", "medium", "hard", "expert"]);

export const RoomCreateInput = z.object({
  game: partyGame.nullable().default(null),
  difficulty: difficulty.default("medium"),
  maxPlayers: z.number().int().min(PARTY_MIN).max(PARTY_MAX).default(PARTY_MAX),
  classroom: z.boolean().default(false),
  /** "race" or an 18+ party game ("draw", "truths"); the route runs the age gate for those */
  mode: z.enum(PARTY_MODES).default("race"),
  /** the host confirms the one-time "Adults only" notice */
  adultNotice: z.boolean().default(false),
});

export const RoomSettingsInput = z.object({
  game: partyGame.nullable().optional(),
  difficulty: difficulty.optional(),
});
