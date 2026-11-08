/**
 * Weekly recap (R3-10): last week's card on Home, its share text and the share image's alt text. Same voice as
 * `lib/copy/index.ts`: short, warm, plain, a little local.
 */
export const weeklyRecapCopy = {
  label: "Your week on SPUZL",
  title: "Your week, chale!",
  /** "2 Nov to 8 Nov" */
  range: (from: string, to: string) => `${from} to ${to}`,
  cleared: (n: number) => (n === 1 ? "1 game cleared" : `${n} games cleared`),
  clearedLabel: "Cleared",
  best: "Best time",
  bestValue: (time: string, game: string) => `${time} in ${game}`,
  streak: "Streak",
  streakValue: (days: number) => (days === 1 ? "1 day" : `${days} days`),
  streakNone: "Fresh start",
  league: "League",
  leagueValue: {
    promoted: (tier: string) => `Up to ${tier}`,
    demoted: (tier: string) => `Down to ${tier}`,
    stayed: (tier: string) => `Held ${tier}`,
  },
  leagueRank: (place: string) => `${place} place`,
  sparks: "Sparks earned",
  sparksValue: (n: string) => `+${n}`,
  /** under the big number on the card */
  bigLine: (n: number) => (n === 1 ? "game cleared" : "games cleared"),
  share: "Share my week",
  play: "Play today's Daily",
  playAll: "Play a game",
  dismiss: "Close the weekly recap",
  sheetTitle: "Share your week",
  previewAlt: "Your week on SPUZL card",
  /** share text: no link to a player, only the game */
  shareText: (cleared: number, url: string) =>
    `My week on SPUZL: ${cleared === 1 ? "1 game" : `${cleared} games`} cleared. Come and play: ${url}`,
  /** the image's alt text */
  alt: (cleared: number) => `My week on SPUZL: ${cleared === 1 ? "1 game" : `${cleared} games`} cleared`,
  cardKicker: "My week on SPUZL",
} as const;
