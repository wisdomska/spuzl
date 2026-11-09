/**
 * Player-facing copy added in the gameplay UX pass (9 Nov) for the Words & Quiz boards that keep most of their
 * older wording inline (Rungs, Remix, Seven). Same voice as `lib/copy/index.ts`: short, warm, plain.
 */
export const wordBoards = {
  rungs: {
    /** all five rungs in a valid order, but the server's confirmation never arrived */
    lockOffline: "No connection, so the ladder is not locked yet. Tap Check ladder to try again.",
    /** a valid-looking order the server did not accept (content keeps one ladder, so this is rare) */
    lockRefused: "Every step changes one letter, but this is not the ladder. Try another order.",
    checkLadder: "Check ladder",
    /** the ladder grid's name, with how to play it from a keyboard */
    ladder: "Rungs ladder. Up and down move between rows; a blank row takes what you type.",
  },
  minicross: {
    entry: (n: number, d: "across" | "down") => `${n} ${d === "across" ? "Across" : "Down"}`,
    /** a full grid with wrong letters: which entries to look at (never which square) */
    off: (names: string[]) => `Not quite. Check ${names.join(", ")}.`,
    offList: "Entries to check",
    /** read after a square's name while its entry is marked */
    offCell: ", in an entry to check",
  },
  remix: {
    /** the answer row is full but its check never came back */
    offline: "No connection. Tap Check to try again.",
    check: "Check",
  },
} as const;
