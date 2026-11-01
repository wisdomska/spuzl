/** Player-facing copy for the Settings page (Account sheet). */
export const settingsCopy = {
  account: {
    /** The confirmation email is on its way: the email joins this account once the link is tapped. */
    linkSent: (email: string) => `Check ${email}. Tap the link in the email to finish. Your progress stays put.`,
    /** The project applied the email change at once (no confirmation step), so no email was sent. */
    linkApplied: (email: string) => `Saved. This account now uses ${email}, so your progress is safe. No email needed.`,
  },
} as const;
