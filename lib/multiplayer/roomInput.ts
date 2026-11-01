/**
 * Party room request bodies (SPZ-13). The game must be one the Host tab offers (`PARTY_GAME_IDS`, i.e. every
 * race game) or null for a Random mix; anything else is a 400 before the lobby code runs. `games` is a host's
 * hand-picked list (2 to 8 different race games); when set it wins over `game`.
 */
import { z } from "zod";
import { PARTY_MAX, PARTY_MIN, PARTY_PICK_MAX, PARTY_PICK_MIN } from "./constants";
import { isRaceGame } from "./games";

const partyGame = z.string().max(24).refine(isRaceGame, { message: "game_not_raceable" });
const difficulty = z.enum(["easy", "medium", "hard", "expert"]);
const partyPicks = z
  .array(partyGame)
  .min(PARTY_PICK_MIN)
  .max(PARTY_PICK_MAX)
  .refine((g) => new Set(g).size === g.length, { message: "duplicate_game" });

export const RoomCreateInput = z.object({
  game: partyGame.nullable().default(null),
  games: partyPicks.nullable().default(null),
  difficulty: difficulty.default("medium"),
  maxPlayers: z.number().int().min(PARTY_MIN).max(PARTY_MAX).default(PARTY_MAX),
  classroom: z.boolean().default(false),
});

export const RoomSettingsInput = z.object({
  game: partyGame.nullable().optional(),
  games: partyPicks.nullable().optional(),
  difficulty: difficulty.optional(),
});
