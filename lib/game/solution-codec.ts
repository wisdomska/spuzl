/**
 * Some games (Echo, Twins, Flinch) have no hidden solution: they are verified by replay, so their
 * solution is null. The puzzles table requires a value, so null is stored as a marker and decoded on load.
 */
const NONE = { __none: true } as const;

export function encodeSolution(solution: unknown): unknown {
  return solution === null || solution === undefined ? NONE : solution;
}

export function decodeSolution(stored: unknown): unknown {
  return stored && typeof stored === "object" && (stored as Record<string, unknown>).__none === true ? null : stored;
}
