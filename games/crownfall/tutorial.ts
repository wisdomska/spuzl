import type { CrownfallPuzzle, CrownfallSolution } from "./logic";

/** The first-run tutorial board: prototype PZ[0], 4 × 4 (Onboarding O2). Regions A..D → 0..3. */
export const TUTORIAL_PUZZLE: CrownfallPuzzle = { size: 4, regions: "AAABAABBCCDBCDDD".split("").map((ch) => ch.charCodeAt(0) - 65) };
export const TUTORIAL_SOLUTION: CrownfallSolution = [1, 3, 0, 2];
