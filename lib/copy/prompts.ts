/** Prompt copy (R2-04): the notification ask. Same voice as `lib/copy/index.ts`: short, warm, plain. */
export const promptsCopy = {
  alerts: {
    label: "Turn on alerts",
    title: "Know when it's your turn",
    /** the line under the title, by what earned the ask */
    body: {
      friend: "Get a buzz when a friend invites you or it's your move.",
      invite: "Never miss an invite or your move.",
      streak: (days: number) => `${days} days strong! Get a buzz for invites and your turn.`,
    },
    notNow: "Not now",
    turnOn: "Turn on",
  },
} as const;
