/** Player-facing copy for Crownfall (board, patterns offer, hints). */

/** Region colour names, indexed like the --reg-N palette in app/globals.css (same hue in both themes). */
const regionNames = ["purple", "teal", "pink", "green", "orange", "blue", "red", "olive", "gold", "grey"] as const;

export const CROWNFALL_COPY = {
  regionNames,
  regionName: (region: number): string => regionNames[region] ?? `colour ${region + 1}`,
  patternsOffer: {
    title: "Colours hard to tell apart?",
    body: "Patterns give every colour region its own texture.",
    accept: "Turn on patterns",
    dismiss: "Dismiss",
    accepted: "Patterns on. Change it any time in Settings.",
  },
  /** Hint sentences (games/crownfall/logic.ts `explainNext`). One sentence each, no dashes. */
  hints: {
    wrongCrown: "This crown does not belong here.",
    wrongMark: "This X covers the only crown spot that works here, so clear it.",
    lastSpotLine: (line: string) => `${cap(line)} has only one spot left, so its crown goes here.`,
    lastSpotRegion: (colour: string) => `The ${colour} region has only one spot left, so its crown goes here.`,
    lineInRegion: (line: string, colour: string) =>
      `${cap(line)} can only hold its crown in the ${colour} region, so the ${colour} region's other cells are out.`,
    regionInLine: (colour: string, line: string) => `The ${colour} region fits only in ${line}, so ${line}'s other cells are out.`,
    emptiesRegion: (colour: string) => `A crown here would leave the ${colour} region with no room, so this cell is out.`,
    emptiesLine: (line: string) => `A crown here would leave ${line} with no room, so this cell is out.`,
    reveal: (line: string) => `Every other spot in ${line} leads to a dead end, so its crown goes here.`,
  },
  row: (r: number) => `row ${r + 1}`,
  column: (c: number) => `column ${c + 1}`,
  cellState: { crown: "crown", mark: "marked empty", empty: "empty", bad: ", breaks a rule" },
  cellLabel: (r: number, c: number, colour: string, state: string) => `Row ${r + 1}, column ${c + 1}, ${colour} region, ${state}`,
} as const;

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
