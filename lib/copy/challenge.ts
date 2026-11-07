/** Challenge copy. */
export const challengeCopy = {
  /** Ghost Race opened for a game without one: names the live tracks ("Dash", "Dash and Gauntlet"). */
  ghostTracks: (names: string[]) =>
    `Ghost Races run on ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : (names[0] ?? "Rage Ridge")}.`,
  /** Ghost strip: one clock per game (the header); the strip says how the race stands in words. */
  ahead: "On pace",
  behind: "Past their time",
  /** The challenge card image (link preview and story card). */
  card: {
    who: (nick: string) => `${nick}'s time`,
    dare: "Beat me",
    alt: (nick: string, game: string, time: string) => `${nick} challenges you to beat ${time} on ${game}. SPUZL.`,
  },
  /** /challenge/<code> page title and description, for link previews. */
  meta: {
    title: (nick: string, game: string, time: string) => `Beat ${nick}'s ${time} on ${game}`,
    description: (nick: string) => `${nick} played this exact puzzle on SPUZL. Same board, ghost timer on. Can you go faster?`,
    fallbackTitle: "Challenge",
    fallbackDescription: "A friend dared you on SPUZL. Same puzzle, beat their time.",
  },
  /** Share texts. */
  share: {
    mine: (time: string, game: string) => `Beat my ${time} on ${game} 😤`,
    back: (time: string) => `Your turn. Beat ${time} on SPUZL 😤`,
    raced: (won: boolean, nick: string, game: string) => `${won ? "I beat" : "I raced"} ${nick} on ${game} 👻`,
    fromResult: (game: string) => `Beat my ${game} time on SPUZL`,
    copied: "Link copied.",
    linkFailed: "Couldn't make the link.",
  },
  /** Time left on a challenge, on its card (links last 7 days). */
  endsIn: (days: number) => (days <= 1 ? "Ends today. Go now." : `Ends in ${days} days`),
  expiredTitle: "This challenge ran out",
  expiredBody: (days: number) => `Challenges last ${days} days. Ask for a fresh link.`,
  missingTitle: "No challenge here",
  missingBody: "That link doesn't open a challenge. Check it, or ask your friend to send it again.",
  offTitle: "Challenges are resting",
  offBody: "Friend challenges are switched off for now. Try a free game instead.",
  backHome: "Back to The Grid",
} as const;
