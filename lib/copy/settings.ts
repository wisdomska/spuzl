/** Player-facing copy for the Settings page (Account sheet). */
export const settingsCopy = {
  back: "Back",
  profile: "Profile",
  nickname: {
    row: "Nickname",
    title: "Change your nickname",
    description: "What friends and rivals see.",
    label: "Nickname",
    help: "3 to 16 letters, numbers or _. No real names, no phone numbers.",
    save: "Save nickname",
    saving: "Saving…",
    taken: "That name is taken. Try another.",
    same: "That's already your nickname.",
    failed: "Couldn't save. Try again.",
    saved: (name: string) => `You're now ${name}.`,
  },
  account: {
    checking: "Checking your account…",
    /** A visitor with no profile yet (they haven't started playing). */
    notStarted: "Not started yet. Play as a guest, or sign in to save progress.",
    start: "Play as a guest or sign in with email",
    notStartedShort: "Not started",
    /** The confirmation email is on its way: the email joins this account once the link is tapped. */
    linkSent: (email: string) => `Check ${email} and tap the link. Progress stays put.`,
    /** The project applied the email change at once (no confirmation step), so no email was sent. */
    linkApplied: (email: string) => `Saved. This account now uses ${email}.`,
  },
} as const;
