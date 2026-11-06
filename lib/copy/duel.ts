/** Duel copy (SPZ-03, SPZ-12). */
export const duelCopy = {
  // SPZ-25: /duel is a page with its own Back (to the Grid when opened from a link).
  entryTitle: "Duel",
  /** under the round-start countdown */
  roundOf: (round: number, of: number) => `Round ${round} of ${of}`,
  /** entering a code a friend sent (any code: a Duel, a Party room or a Board Games invite) */
  code: {
    open: "Got a friend's code?",
    openSub: "Type it in to join their duel.",
    heading: "Got a friend's code?",
    body: "Type the 4-character code from their screen or message.",
    label: "Friend's code",
    placeholder: "ABCD",
    cta: "Join",
    bad: "Codes are 4 letters and numbers, no 0, O, 1 or I.",
    missing: "No open duel, room or game has that code. Check it with your friend.",
    failed: "Couldn't check that code. Try again.",
  },
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
  // A ranked round of a game new to someone starts with a rules break (same card, inside the match).
  rulesMatchBody: "New game this round. Read the rule; the countdown starts on its own.",
  rulesMatchAuto: "Countdown starts on its own",
  rulesMatchReady: "Got it",
  rivalReading: (name: string) => `${name} is reading the rule for this game`,
  leftBot: "You left the practice. Nothing lost.",
} as const;
