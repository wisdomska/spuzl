/**
 * The duel share card, seen from one player's side (like SPIL's per-player cards): who won, the score, the
 * rounds, one award and the rating change. Pure: lib/share/cards.ts fills it from database rows, never from the
 * query string (only `anon`, which hides both names, comes from the link).
 */
export type DuelOutcome = "win" | "loss" | "draw";

export interface DuelSide {
  name: string;
  color: string;
  rounds: number;
}

export interface DuelRound {
  n: number;
  /** my time and theirs (ms), null when that player did not finish */
  me: number | null;
  them: number | null;
  /** who took the round: true me, false them, null nobody */
  mine: boolean | null;
}

export interface DuelAward {
  /** a Phosphor icon name (components/ui/icons.generated.ts) */
  icon: string;
  title: string;
  sub: string;
}

export interface DuelShareModel {
  outcome: DuelOutcome;
  forfeit: boolean;
  me: DuelSide;
  them: DuelSide;
  gameName: string;
  rounds: DuelRound[];
  ratingDelta: number | null;
  award: DuelAward;
  /** all-time record against this rival, this duel included */
  h2h: { me: number; them: number } | null;
  banner: string;
  alt: string;
}

export interface DuelShareInput {
  me: DuelSide;
  them: DuelSide;
  winner: "me" | "them" | null;
  /** the match ended because a player dropped out or left */
  forfeit: boolean;
  gameName: string;
  rounds: DuelRound[];
  ratingBefore: number | null;
  ratingAfter: number | null;
  /** hide both names on the card */
  anon?: boolean;
  h2h?: { me: number; them: number } | null;
}

/** One award per card, from how the duel went. */
export function duelAward(i: Pick<DuelShareInput, "winner" | "forfeit" | "rounds" | "them" | "me">): DuelAward {
  const them = i.them.name;
  if (i.forfeit && i.winner === "me") return { icon: "flag", title: "Won by forfeit", sub: `${them} left before the end` };
  if (i.winner === null) return { icon: "scales", title: "Dead heat", sub: "Nothing between you" };
  const first = i.rounds.find((r) => r.n === 1);
  if (i.winner === "me") {
    if (i.them.rounds === 0) return { icon: "crown", title: "Clean sweep", sub: "Didn't drop a round" };
    if (first?.mine === false) return { icon: "fire", title: "Comeback", sub: "Down a round, won the duel" };
    return { icon: "lightning", title: "Clutch", sub: "Took the decider" };
  }
  if (i.me.rounds > 0) return { icon: "sword", title: "Pushed them all the way", sub: "One round from the win" };
  return { icon: "arrow-bend-up-right", title: "Rematch incoming", sub: `${them} won this one` };
}

export function duelShareModel(i: DuelShareInput): DuelShareModel {
  const me = i.anon ? { ...i.me, name: "Me" } : i.me;
  const them = i.anon ? { ...i.them, name: "Rival" } : i.them;
  const outcome: DuelOutcome = i.winner === "me" ? "win" : i.winner === "them" ? "loss" : "draw";
  const award = duelAward({ ...i, me, them });
  const banner =
    i.forfeit && outcome === "win" ? "WALKOVER!" : outcome === "win" ? "VICTORY!" : outcome === "draw" ? "DEAD HEAT" : "SO CLOSE";
  const rated = i.ratingBefore !== null && i.ratingAfter !== null;
  return {
    outcome,
    forfeit: i.forfeit,
    me,
    them,
    gameName: i.gameName,
    rounds: i.rounds,
    ratingDelta: rated ? Math.round(i.ratingAfter! - i.ratingBefore!) : null,
    award,
    h2h: i.h2h && i.h2h.me + i.h2h.them > 1 ? i.h2h : null,
    banner,
    alt:
      outcome === "draw"
        ? `SPUZL Duel draw, ${me.rounds} all, ${i.gameName}`
        : `SPUZL Duel ${outcome === "win" ? "win" : "loss"}, ${me.rounds} to ${them.rounds}, ${i.gameName}. ${award.title}.`,
  };
}

/** A sample for the design route and tests. */
export const SAMPLE_DUEL: DuelShareModel = duelShareModel({
  me: { name: "Ama_K", color: "#B8F23A", rounds: 2 },
  them: { name: "Tunde", color: "#FF8A3D", rounds: 1 },
  winner: "me",
  forfeit: false,
  gameName: "Sixer",
  rounds: [
    { n: 1, me: 48_200, them: 41_900, mine: false },
    { n: 2, me: 37_400, them: 45_100, mine: true },
    { n: 3, me: 33_800, them: 39_600, mine: true },
  ],
  ratingBefore: 1420,
  ratingAfter: 1438,
});
