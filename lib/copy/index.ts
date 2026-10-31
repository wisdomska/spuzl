/**
 * Player-facing copy, one place per feature. New strings go here (not inline) so wording stays
 * consistent across screens and can be translated later: swap `en` for another locale object.
 * Keep SPUZL's voice: short, warm, plain; local flavour where it fits ("Akwaaba").
 */
export const en = {
  signIn: {
    emailLabel: "Your email",
    emailPlaceholder: "you@example.com",
    sendCode: "Send me a code",
    sending: "Sending your code…",
    emailHelp: "We'll email you a 6-digit code. No password needed.",
    sentTo: "We sent a code to",
    codeLabel: "6-digit code",
    codeOrLink: "Type the 6-digit code from the email, or tap the sign-in link in it.",
    signIn: "Sign in",
    signingIn: "Signing you in…",
    otherEmail: "Use another email",
    resend: "Resend code",
    resendIn: (s: number) => `Resend in ${s}s`,
    tooMany: "Too many codes in a row. Wait a minute and try again.",
    sendFailed: "We couldn't send a code. Check the email and try again.",
    // Supabase answers "Token has expired or is invalid" for both cases, so don't guess which.
    badCode: "That code didn't work. Check it against the email, or send a new one.",
  },
  account: {
    signInExisting: "Sign in to an existing account",
    signInLeavesGuest: "Signing in to another account leaves this guest's progress on this phone behind.",
    backToSaving: "Back to saving this guest",
  },
  welcome: {
    helloTitle: "Akwaaba! Ready to play?",
    helloBody: "51 tiny games, a new Daily every day. Jump in as a guest, or sign in to keep your streak on every phone.",
    playAsGuest: "Play as guest",
    signInWithEmail: "Sign in with email",
    signInLater: "You can sign in later from Settings. Your progress comes with you.",
    signInTitle: "Sign in",
    signedInNote: "Signed in. Your Spuz is saved to your account.",
  },
} as const;

export const copy = en;
