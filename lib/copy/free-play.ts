/** Free-play reward wording. The numbers are the live admin settings `free.*`, never hard-coded. */
export const freePlayCopy = {
  howToPlayLead: "Play.",
  howToPlay: (xp: number, sparks: number, cap: number) =>
    `Fresh puzzles that never run out. Each clear earns ${xp} XP and ${sparks} Sparks, up to ${cap} XP a day.`,
  practice: (xp: number, sparks: number) => `Endless fresh puzzles. ${xp} XP and ${sparks} Sparks a clear, never on the boards.`,
} as const;
