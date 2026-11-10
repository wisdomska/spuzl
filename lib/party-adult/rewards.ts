/**
 * XP and Sparks for the 18+ party games (Draw It, Two Truths). Room points decide the podium; on top of that,
 * when a room finishes, the server pays each player (lib/multiplayer/server/rewards.ts `finalizeAdult`):
 *
 * - per round they took part in: `adultParty.xpPerRound` XP and `adultParty.sparksPerRound` Sparks. Taking
 *   part means drawing at least one stroke or writing the statements as the round's lead, or guessing or
 *   voting otherwise (sitting idle earns nothing);
 * - the winner (first place; a tie shares it) also gets `adultParty.winXp` and `adultParty.winSparks`;
 * - nothing for players who left or were removed before the end, spectators, or anyone gone silent;
 * - nothing at all in rooms where fewer than ADULT_REWARD_MIN_PLAYERS played to the end (anti-farming);
 * - XP up to `adultParty.xpDailyCap` a GMT day across all 18+ rooms, Sparks only while under it
 *   (svc_grant_capped_reward enforces the cap atomically);
 * - once per player per room set (ledger source "party_adult", ref "<match id>:<set>").
 *
 * Owner decision Q: an 18+ room's winners also count toward quests ("Win 2 Duels or Races") and the Party win badge
 * (`adultRoomCredit` in lib/multiplayer/server/rewards.ts), but nothing from these rooms reaches the friends feed.
 */

export const ADULT_REWARD_MIN_PLAYERS = 3;
export const ADULT_REWARD_SOURCE = "party_adult";

export interface AdultEconomy {
  xpPerRound: number;
  sparksPerRound: number;
  winXp: number;
  winSparks: number;
  xpDailyCap: number;
}

export const adultRewardRef = (matchId: string, setNo: number) => `${matchId}:${setNo}`;

/**
 * Who took part in a round: its lead when they drew (at least one stroke) or wrote the statements, and
 * everyone else who guessed or voted. The lead never counts twice and nobody outside the line-up counts.
 */
export function playedIn(r: {
  leadId: string | null;
  mode: "draw" | "truths";
  strokes: number;
  wrote: boolean;
  acted: readonly string[];
  lineUp: readonly string[];
}): string[] {
  const out = new Set<string>();
  if (r.leadId && (r.mode === "draw" ? r.strokes > 0 : r.wrote)) out.add(r.leadId);
  for (const id of r.acted) out.add(id);
  return [...out].filter((id) => r.lineUp.includes(id)).slice(0, 8);
}

export interface AdultFinisher {
  id: string;
  /** rounds this player took part in */
  rounds: number;
  place: number | null;
}

/**
 * What each eligible player is owed before the daily cap (the database applies the cap). `finishers` are the
 * players still in the room at the end; an empty result means the room pays nothing.
 */
export function adultRewards(
  finishers: readonly AdultFinisher[],
  e: AdultEconomy,
): { id: string; xp: number; sparks: number; won: boolean }[] {
  if (finishers.length < ADULT_REWARD_MIN_PLAYERS) return [];
  const n = (v: number) => Math.max(0, Math.floor(v));
  return finishers
    .map((f) => {
      const rounds = n(f.rounds);
      const won = f.place === 1 && rounds > 0;
      return {
        id: f.id,
        won,
        xp: rounds * n(e.xpPerRound) + (won ? n(e.winXp) : 0),
        sparks: rounds * n(e.sparksPerRound) + (won ? n(e.winSparks) : 0),
      };
    })
    .filter((r) => r.xp > 0 || r.sparks > 0);
}
