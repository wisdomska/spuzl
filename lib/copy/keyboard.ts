/** The letter keyboard and its typing-keys stand-in on computers (games/_shared/LetterKeyboard.tsx). */
export const keyboardCopy = {
  group: "Letter keyboard",
  typingGroup: "Typing keys",
  typeLetters: "Type letters",
  enter: "Enter",
  backspace: "Backspace",
  /** what Enter does, after the key name: "Enter to submit" */
  enterDoes: (what: string) => `to ${what}`,
  backspaceDoes: "to delete",
  submit: "submit",
  next: "go to the next clue",
  /** Seven's empty word line with a physical keyboard (a phone says "Tap letters") */
  typeOrClick: "Type or click letters",
  /** quiz boards: the number keys pick an answer */
  pickKeys: "1–4",
  pickDoes: "to answer",
  /** Rage Ridge on a computer: the keys that play it, in place of the on-screen pad */
  moveKeys: "← →",
  moveDoes: "to move",
  space: "Space",
  actionDoes: (action: string) => `to ${action.toLowerCase()}`,
  /** Dash: the jump keys and the duck keys */
  jumpKeys: "Space ↑",
  duckKeys: "↓",
  duckDoes: "to duck",
  showControls: "Show controls",
  hideControls: "Hide controls",
  show: "Show keyboard",
  hide: "Hide keyboard",
} as const;
