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
} as const;
