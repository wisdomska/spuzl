/** Prompt copy (R2-04): the notification ask. Same voice as `lib/copy/index.ts`: short, warm, plain. */
export const promptsCopy = {
  alerts: {
    label: "Turn on alerts",
    title: "Know when it's your turn",
    /** the line under the title, by what earned the ask */
    body: {
      friend: "You've got a friend on SPUZL now. Get a buzz when they invite you or it's your move, even with SPUZL closed.",
      invite: "Never miss an invite. Get a buzz when a friend challenges you or it's your move, even with SPUZL closed.",
      streak: (days: number) => `${days} days strong! Get a buzz for invites and your turn, even with SPUZL closed.`,
    },
    notNow: "Not now",
    turnOn: "Turn on",
  },
} as const;
