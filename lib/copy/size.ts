/** The board-size picker before a game with two sizes (Kente: 6 × 6 or 9 × 9). */
export const sizeCopy = {
  title: (game: string) => `${game}: pick a board`,
  intro: "Same rules, two sizes. You pick each time you start a game.",
  group: "Board size",
  size: (n: number) => `${n}\u00a0×\u00a0${n}`,
  small: "Quick. Numbers 1 to 6, boxes of 2\u00a0×\u00a03.",
  big: "Classic. Numbers 1 to 9, boxes of 3\u00a0×\u00a03.",
  last: "Your last pick",
  back: "Back",
} as const;
