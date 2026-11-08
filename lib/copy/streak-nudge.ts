/**
 * Streak-at-risk nudge (R3-09): the evening push and its switch in Settings > Alerts. Same voice as
 * `lib/copy/index.ts`: short, warm, plain, a little local.
 */
export const streakNudgeCopy = {
  push: {
    title: (days: number) => `Your ${days}-day streak needs you`,
    /** the streak ends at midnight GMT unless they clear a board */
    body: (days: number) => `Your ${days}-day streak ends at midnight. One quick game keeps it.`,
    /** they hold a Streak Freeze: it would cover tonight, but playing keeps the Freeze */
    bodyFreeze: (days: number) =>
      `Your ${days}-day streak needs a game before midnight. A Freeze can cover you, but one quick game keeps it, chale.`,
  },
  settings: {
    label: "Streak reminders",
    hint: "One evening buzz when your streak is about to end",
    failed: "Couldn't save that. Check your connection and try again.",
  },
} as const;
