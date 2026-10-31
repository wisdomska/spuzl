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
  cellState: { crown: "crown", mark: "marked empty", empty: "empty", bad: ", breaks a rule" },
  cellLabel: (r: number, c: number, colour: string, state: string) => `Row ${r + 1}, column ${c + 1}, ${colour} region, ${state}`,
} as const;
