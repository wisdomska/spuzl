/** Level ladder ("Levels" mode) copy. */
export const levelsCopy = {
  mode: "Levels",
  level: (n: number) => `Level ${n}`,
  /** game card status: "Level 12 · Next: 13" */
  status: (top: number, next: number, done: boolean) =>
    done ? `All ${top} levels cleared` : top > 0 ? `Level ${top} · Next: ${next}` : `Start at Level ${next}`,
  sheetTitle: (game: string) => `${game} levels`,
  sheetLead: "Clear a level to open the next one. Cleared levels replay any time.",
  play: (n: number) => `Play Level ${n}`,
  allLevels: "All levels",
  best: (time: string) => `Best ${time}`,
  tileLabel: (n: number, state: "cleared" | "next" | "locked", best?: string) =>
    state === "cleared"
      ? `Level ${n}, cleared${best ? `, best ${best}` : ""}. Replay`
      : state === "next"
        ? `Level ${n}, play next`
        : `Level ${n}, locked`,
  levelCleared: (n: number) => `Level ${n} cleared!`,
  nextLevel: (n: number) => `Next level: ${n}`,
  ladderDone: "Every level cleared. Free play never runs out.",
  tryAgain: "Try again",
  failedTitle: "Not this time",
  errorTitle: "Something broke",
  errorBody: "Try again in a moment.",
  freePlay: "Free play",
  endless: "New levels keep coming",
  difficulty: { easy: "Easy", medium: "Medium", hard: "Hard", expert: "Expert", mega: "Mega" },
  loading: "Loading levels…",
  loadFailed: "Couldn't load your levels. Try again in a moment.",
} as const;
