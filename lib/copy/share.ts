/** Invite sharing copy. */
export const shareCopy = {
  share: "Share",
  title: "Share your invite",
  description: "Pick where to send it.",
  more: "More",
  copyLink: "Copy link",
  copied: "Copied",
  pasted: (app: string) => `Message copied. Paste it in ${app}.`,
} as const;

/** Story card shared from a clear (R2-P5, admin setting "features.storyCards"): 9:16 card with a "Beat me" link. */
export const storyCopy = {
  /** the effort line under the time */
  line: (hints: number, slips: number) =>
    hints === 0 && slips === 0
      ? "Clean clear. No hints, no slips."
      : `${hints === 0 ? "No hints" : `${hints} hint${hints === 1 ? "" : "s"}`}, ${slips === 0 ? "no slips" : `${slips} slip${slips === 1 ? "" : "s"}`}.`,
  /** share text: the result and the short challenge link (spoiler free) */
  text: (game: string, time: string, link: string) => `I cleared ${game} in ${time} on SPUZL. Beat me: ${link}`,
  sheetTitle: (game: string) => `Dare a friend on ${game}`,
  alt: (game: string, time: string) => `Your ${game} story card: ${time}, Beat me`,
  shareCta: "Share",
  story: "Story 9:16",
  square: "Square 1:1",
  formatLabel: "Card shape",
  failed: "Couldn't make your card. Try again.",
} as const;
