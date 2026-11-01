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
    // Google's approved button wording.
    google: "Continue with Google",
    googleOpening: "Opening Google…",
    googleFailed: "Google sign-in didn't start. Try again, or use your email.",
    or: "or",
  },
  account: {
    signInExisting: "Sign in to an existing account",
    signInLeavesGuest: "Signing in to another account leaves this guest's progress on this phone behind.",
    backToSaving: "Back to saving this guest",
  },
  shell: {
    hintsLeft: (n: number) => (n === 1 ? "1 hint left" : `${n} hints left`),
    hintsFree: "Hints are free in this guided round",
    hintConfirmTitle: "Use a hint?",
    hintConfirmDaily: (keptPct: number) =>
      keptPct >= 100
        ? "Hints are free on today's Daily."
        : keptPct === 50
          ? "Daily XP is halved when you use a hint."
          : keptPct === 0
            ? "You won't earn Daily XP after using a hint."
            : `You keep ${keptPct}% of the Daily XP after using a hint.`,
    hintConfirmFree: "Free play hints come from your 3 per puzzle, then your hint packs. No XP is lost.",
    cancel: "Cancel",
    useHint: "Use hint",
  },
  comfort: {
    title: "Comfort",
    patterns: "Colour-blind patterns",
    textSize: "Text size",
    reducedMotion: "Reduced motion",
    hideTimer: "Hide timer",
    sound: "Sound",
    haptics: "Haptics",
    on: "On",
    off: "Off",
    system: "Like my phone",
  },
  play: {
    another: (game: string) => `Another ${game}`,
    backToGrid: "Back to the Grid",
    cleared: "Cleared!",
    accuracy: (pct: number) => `${pct}% accuracy`,
    levelUp: (lv: number) => `Level ${lv}`,
    rankUp: (rank: string, world: string) => `${rank} in ${world}`,
    badge: (name: string) => `Badge: ${name}`,
    streak: (days: number, sparks: number) => (sparks ? `${days}-day streak, +${sparks} Sparks` : `${days}-day streak`),
    fullSpuzl: "Full Spuzl!",
  },
  welcome: {
    helloTitle: "Akwaaba! Ready to play?",
    helloBody: "51 tiny games to play any time. Jump in as a guest, or sign in to keep your streak on every phone.",
    playAsGuest: "Play as guest",
    signInWithEmail: "Sign in with email",
    signInLater: "You can sign in later from Settings. Your progress comes with you.",
    signInFailed: "Sign-in didn't finish. Try again, or play as a guest.",
    signInTitle: "Sign in",
    signedInNote: "Signed in. Your Spuz is saved to your account.",
    startTitle: "How do you want to start?",
    starts: {
      tutorial: { t: "Learn a game in 30 seconds", d: "A tiny puzzle with tips as you go." },
      pick: { t: "Browse all 51 games", d: "See every game and pick one." },
      jump: { t: "Go to the map", d: "Islands of games. Pick one and play." },
    },
    startLater: "You can learn any game later from its Help button.",
    firstClear: "First clear!",
    firstClearLine: (time: string) => `${time} on your first ever puzzle. Okay, big brain.`,
    makeYours: "Make Spuz yours",
    makeYoursAfterClear: "Now make Spuz yours",
    ctaMap: "Save my Spuz and open the map",
    ctaLibrary: "Save my Spuz and see all games",
    saving: "Making your Spuz…",
  },
} as const;

export const copy = en;
