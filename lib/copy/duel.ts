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
  // R2-02: the entry sheet's two ways to duel, and the game row.
  quick: "Quick Match",
  quickSub: "Ranked. Best of 3.",
  quickRating: "Rating",
  /** R3-06: 13 to 15 year olds only meet players their own age in Quick Match */
  quickTeen: "You only meet players aged 13 to 15.",
  /** the server's answer when an account with no known age band asks for Quick Match */
  quickRefused: "Quick Match needs your age band. Challenge a friend instead.",
  friend: "Challenge a friend",
  friendNamed: (name: string) => `Challenge ${name}`,
  friendSub: "Unranked. Send them a code or link.",
  anyGame: "Any game",
  gameRow: "Game",
  gameRowLabel: (name: string) => `Game: ${name}. Change game`,
  picker: {
    title: "Pick a game",
    body: "Search or filter, then tap a game.",
    searchPlaceholder: (n: number) => `Search ${n} games`,
    any: "Any game",
    anySub: "A different game each round",
    selected: "Selected",
    close: "Close",
    count: (n: number) => (n === 1 ? "1 game" : `${n} games`),
    empty: "No games match. Try another word or filter.",
    showAll: "Show all games",
  },
  roundTitle: (round: number, who: "me" | "them" | "draw", them: string) =>
    who === "draw" ? `Round ${round}: dead level` : who === "me" ? `Round ${round}: you win` : `Round ${round}: ${them} wins`,
  /** the line under a round's result (it used to promise a "Rematch" when the next round was coming) */
  roundLine: (who: "me" | "them" | "draw", margin: number | null) =>
    who === "draw"
      ? "Same tenth, same slips. Nobody scores."
      : who === "me"
        ? margin !== null
          ? `You won by ${margin.toFixed(1)} seconds. They felt it.`
          : "They saw your board land. They felt it."
        : margin !== null
          ? `You lost by ${margin.toFixed(1)} seconds. Next board is yours.`
          : "Close one. Next board is yours.",
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
