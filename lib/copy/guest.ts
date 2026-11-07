/** Guest safety net (SPZ-20): the "Save your streak" prompt shown to guests after a few clears. */
export const guestCopy = {
  title: "Save your streak",
  body: (clears: number) =>
    `${clears} clear${clears === 1 ? "" : "s"} so far. Add your email so your streak, Sparks and friends are safe on any phone.`,
  save: "Save it",
  notNow: "Not now",
  dismissAria: "Dismiss save your streak",
  sheetTitle: "Save your streak",
  sheetBody: "We'll email you a code. Everything you've played stays on this account.",
  saved: "Saved. Your progress is now on your email.",
  // Link mode of the email-code form (the email is added to this same guest account).
  linkTaken: "That email already has an account. Sign in to it from Settings, Account.",
  linkFailed: "That didn't send. Check the address and try again.",
  /** R2-P5 streak shield (admin "features.streakShield"): the reason to sign in, and the thank-you */
  shieldBody: (clears: number) =>
    `${clears} clear${clears === 1 ? "" : "s"} so far. Sign in and get a free streak shield: one Streak Freeze that saves your streak on a day you miss.`,
  shieldSave: "Sign in and get a free streak shield",
  shieldSheetBody: "We'll email you a code. Everything you've played stays on this account, and a free Streak Freeze lands in your bag.",
  savedShield: "Saved! Your free streak shield is in: 1 Streak Freeze.",
  savedShieldFull: "Saved! You already hold 2 Freezes, so your streak is well covered.",
} as const;
