/** Duel copy (SPZ-03, SPZ-12). */
export const duelCopy = {
  // SPZ-25: /duel is a page with its own Back (to the Grid when opened from a link).
  entryTitle: "Duel",
  back: "Back",
  roundTitle: (round: number, who: "me" | "them" | "draw", them: string) =>
    who === "draw" ? `Round ${round}: dead level` : who === "me" ? `Round ${round}: you win` : `Round ${round}: ${them} wins`,
  nextRound: "Next round",
  decider: "Decider",
  nextRoundLabel: (decider: boolean) => (decider ? "Decider coming up" : "Next round coming up"),
  searchingNow: (n: number) => (n === 1 ? "1 other searching" : `${n} others searching`),
  searching: "searching",
  botNow: "Play the Practice bot now",
  botHint: "No rating on the line. Your search stops.",
  botLate: "Nobody yet. Warm up with the Practice bot. No rating on the line.",
  rulesTitle: (game: string) => `New to ${game}? Here's the rule`,
  rulesBody: "Ranked duels count. Take a moment with the rule before you race.",
  rulesReady: "I'm ready, find a rival",
  rulesAuto: "Search starts on its own",
  leaveTitleBot: "Leave the practice?",
  leaveBodyBot: "It's only practice. Nothing is lost.",
  leaveConfirmBot: "Leave",
  leftBot: "You left the practice. Nothing lost.",
} as const;
