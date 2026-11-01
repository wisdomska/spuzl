/** Player-facing copy for Higher or Lower (games/hilo). */
export const hilo = {
  /* Board */
  board: "Higher or Lower cards",
  progress: (made: number, total: number) => `Call ${Math.min(made + 1, total)} of ${total}`,
  callsDone: (total: number) => `${total} of ${total} calls made`,
  slips: (used: number, max: number) => `Slips ${used} of ${max}`,
  slipsLabel: (used: number, max: number) => `${used} of ${max} slips used`,
  anchor: "Now showing",
  challenger: "Next card",
  hidden: "?",
  anchorCard: (expr: string, value: number) => `Now showing ${expr}, worth ${value}`,
  challengerCard: (expr: string, shown: number | null) =>
    shown === null ? `Next card ${expr}, value hidden` : `Next card ${expr}, worth ${shown}`,
  higher: "Higher",
  lower: "Lower",
  higherLabel: (expr: string, value: number) => `Higher: ${expr} is more than ${value}`,
  lowerLabel: (expr: string, value: number) => `Lower: ${expr} is less than ${value}`,
  pip: (k: number, result: "right" | "slip" | "open") =>
    `Call ${k}: ${result === "right" ? "right" : result === "slip" ? "slip" : "not made yet"}`,
  calls: "Your calls",
  hint: "Hint",

  /* Feedback */
  start: "Is the next card higher or lower?",
  startTutorial: "Work out the next card. Tap Higher if it beats the card now showing, Lower if not.",
  right: (expr: string, v: number, word: "higher" | "lower", prev: number) => `Right. ${expr} is ${v}, ${word} than ${prev}.`,
  slip: (expr: string, v: number, word: "higher" | "lower", prev: number, left: number) =>
    `Slip. ${expr} is ${v}, ${word} than ${prev}. ${left === 1 ? "1 slip left." : `${left} slips left.`}`,
  out: (right: number) => `Three slips. Run over with ${right} right.`,
  cleared: (right: number, total: number) => `Run done. ${right} of ${total} right.`,
  higherWord: "higher" as const,
  lowerWord: "lower" as const,

  /* Server hint: the value of the card in play, with one reason */
  hintCard: (expr: string, v: number, reason: string, prev: number) => `${expr} = ${v}. ${reason} Compare it with ${prev}.`,
  reason: {
    plain: (a: number) => `It is just ${a}.`,
    add: (a: number, tens: number, mid: number, ones: number) =>
      ones === 0 || tens === 0 ? `Count on from ${a}.` : `${a} + ${tens} is ${mid}, then add ${ones}.`,
    sub: (a: number, tens: number, mid: number, ones: number) =>
      ones === 0 || tens === 0 ? `Count back from ${a}.` : `${a} − ${tens} is ${mid}, then take ${ones} more.`,
    mul: (a: number, b: number) => `That is ${b} lots of ${a}.`,
    div: (a: number, b: number, v: number) => `${v} × ${b} makes ${a}.`,
    pct: (of: number, tenth: number) => `10% of ${of} is ${tenth}, so scale from there.`,
    sq: (a: number) => `A square is ${a} × ${a}.`,
    frac: (d: number, of: number, part: number) => `1/${d} of ${of} is ${part}, so count up the parts.`,
  },
};
