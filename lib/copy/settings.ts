/** Player-facing copy for the Settings page (Account sheet). */
export const settingsCopy = {
  back: "Back",
  profile: "Profile",
  nickname: {
    row: "Nickname",
    title: "Change your nickname",
    description: "This is how friends, leagues and duels see you.",
    label: "Nickname",
    help: "3 to 16 letters, numbers or _. No real names, no phone numbers.",
    save: "Save nickname",
    saving: "Saving…",
    taken: "That name is taken. Try another.",
    same: "That's already your nickname.",
    failed: "Couldn't save. Check your connection and try again.",
    saved: (name: string) => `You're now ${name}.`,
  },
  account: {
    /** The confirmation email is on its way: the email joins this account once the link is tapped. */
    linkSent: (email: string) => `Check ${email}. Tap the link in the email to finish. Your progress stays put.`,
    /** The project applied the email change at once (no confirmation step), so no email was sent. */
    linkApplied: (email: string) => `Saved. This account now uses ${email}, so your progress is safe. No email needed.`,
  },
} as const;
