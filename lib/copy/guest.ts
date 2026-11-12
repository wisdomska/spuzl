/** Guest safety net (SPZ-20): the "Save your streak" prompt shown to guests after a few clears. */
export const guestCopy = {
  title: "Save your streak",
  body: (clears: number) => `${clears} clear${clears === 1 ? "" : "s"} so far. Add your email to keep your streak safe.`,
  save: "Save it",
  notNow: "Not now",
  dismissAria: "Dismiss save your streak",
  sheetTitle: "Save your streak",
  sheetBody: "We'll email you a code. Your progress stays.",
  saved: "Saved. Your progress is now on your email.",
  // Link mode of the email-code form (the email is added to this same guest account).
  linkTaken: "That email already has an account. Sign in to it from Settings, Account.",
  linkFailed: "That didn't send. Check the address and try again.",
  /** R2-P5 streak shield (admin "features.streakShield"): the reason to sign in, and the thank-you */
  shieldBody: (clears: number) =>
    `${clears} clear${clears === 1 ? "" : "s"} so far. Sign in for a free Streak Freeze: it covers a missed day.`,
  shieldSave: "Sign in for a free shield",
  shieldSheetBody: "We'll email you a code. Your progress stays, plus a free Streak Freeze.",
  savedShield: "Saved! Your free streak shield is in: 1 Streak Freeze.",
  savedShieldFull: "Saved! You already hold 2 Freezes.",
} as const;
