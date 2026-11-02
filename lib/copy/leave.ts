/** Leaving a game: the game menu entry and the one light confirm where leaving costs something. */
export const leaveCopy = {
  /** game menu entry */
  menu: "Leave game",
  /** a timed scored run (Quickfire, Echo, Flinch, Beat Tap, the action courses) */
  run: {
    title: "Leave this round?",
    body: "Your progress here won't count.",
    keep: "Keep playing",
    leave: "Leave",
  },
  /** a live match against a person (Duel, a live Board Bay game) */
  match: {
    title: "Leave the match?",
    body: "Your opponent wins this one.",
    keep: "Keep playing",
    leave: "Leave match",
  },
  /** a Party race */
  party: {
    title: "Leave the match?",
    body: "You'll leave the room.",
    keep: "Keep playing",
    leave: "Leave room",
  },
  /** the leave call failed (offline): the player still leaves, the server settles it when they are gone */
  failed: "Couldn't tell the server. You're out; the match settles on its own.",
} as const;
