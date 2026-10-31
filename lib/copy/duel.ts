/** Duel copy (SPZ-03, SPZ-12). */
export const duelCopy = {
  roundTitle: (round: number, who: "me" | "them" | "draw", them: string) =>
    who === "draw" ? `Round ${round}: dead level` : who === "me" ? `Round ${round}: you win` : `Round ${round}: ${them} wins`,
  nextRound: "Next round",
  decider: "Decider",
  nextRoundLabel: (decider: boolean) => (decider ? "Decider coming up" : "Next round coming up"),
} as const;
