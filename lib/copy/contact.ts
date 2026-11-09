import type { FeedbackKind } from "@/lib/feedback";
import { MESSAGE_MAX, MESSAGE_MIN } from "@/lib/feedback";

/** The public address on SPIL; NEXT_PUBLIC_SUPPORT_EMAIL overrides it when a SPUZL inbox is set. */
export const FALLBACK_SUPPORT_EMAIL = "wisdomska@gmail.com";

/** /contact (R4-02): the feedback form first, then where to go for each kind of problem. */
export const contactCopy = {
  title: "Contact",
  lede: "Found a bug, a puzzle that looks wrong or a better idea? Tell us. We read every message.",
  form: {
    label: "Send us feedback",
    kind: "What is it about?",
    kindOptional: "optional",
    kindAny: "Choose one",
    kinds: { bug: "Bug", puzzle: "A puzzle looks wrong", idea: "Idea", other: "Something else" } satisfies Record<FeedbackKind, string>,
    email: "Email, if you want a reply",
    emailHint: "Only our team sees it. Leave it empty and we won't write back.",
    emailPlaceholder: "you@example.com",
    message: "Message",
    messageHint: `At least ${MESSAGE_MIN} characters.`,
    messagePlaceholder: "What happened, or what would make SPUZL better?",
    count: (n: number) => `${n} / ${MESSAGE_MAX}`,
    from: (path: string) => `We'll add the page you came from: ${path}`,
    honeypot: "Leave this empty",
    send: "Send message",
    sending: "Sending…",
    sentTitle: "Medaase! Message received.",
    sentBody: "Thank you for taking the time. If you left an email, we'll write back when we can.",
    sentWithEmail: "We'll reply to the email you left as soon as we can.",
    another: "Send another",
    problems: {
      short: `Tell us a little more: at least ${MESSAGE_MIN} characters.`,
      long: `That's a lot! Keep it under ${MESSAGE_MAX} characters.`,
      email: "That email doesn't look right. Check it, or leave it empty.",
    },
    errors: {
      rate_limited: "You've sent a few messages already. Give it an hour and try again, or email us.",
      offline: "You look offline. Your message is still here; send it when you're back.",
      generic: "We couldn't send that just now. Your message is still here; try again in a moment.",
    },
  },
  orEmail: "Or email",
  sections: {
    unkindTitle: "Someone is being unkind or cheating",
    unkind:
      "Open their profile or tap the three dots on their activity, then Report. Pick a reason and, if you like, block them in the same step. A moderator checks every report within a day.",
    puzzleTitle: "A puzzle looks broken",
    puzzle: 'Pick "A puzzle looks wrong" above and tell us the game and the date. If a puzzle is broken we can fix it.',
    dataTitle: "Your data or account",
    dataBefore: "You can download or delete everything yourself in ",
    dataLink: "Settings, Account",
    dataAfter: ". Parents and teachers who need a young player's account removed can write to us.",
  },
  /** In-app entry points (Settings, Me, the landing footer). */
  entry: "Send feedback",
  entryHint: "Bugs, puzzles, ideas",
  footer: "Feedback",
} as const;

export type ContactCopy = typeof contactCopy;
