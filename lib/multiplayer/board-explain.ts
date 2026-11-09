/**
 * Why a tap on a live board did nothing (Board Bay and the bot games). A tap on your own piece or pit that can't move
 * used to be silent; these say which rule stopped it, so the board can explain instead of ignoring the tap.
 */

/** Draughts men and kings by seat: 1 and 2 are seat 0's, 3 and 4 are seat 1's (games/draughts/engine). */
const ownsMan = (piece: number, seat: number) => (seat === 0 ? piece === 1 || piece === 2 : piece === 3 || piece === 4);

/** A path whose first step jumps two rows is a capture. */
export const isCapturePath = (path: readonly number[]) => path.length > 1 && Math.abs((path[1] >> 3) - (path[0] >> 3)) === 2;

/**
 * Draughts: a tap on your own man that has no legal path, on your turn. "capture" when the moves you do have are
 * captures (captures are compulsory), "blocked" when it simply has nowhere to go; null when the tap is fine.
 */
export function draughtsTapReason(
  board: readonly number[],
  paths: readonly (readonly number[])[],
  sq: number,
  seat: number,
): "capture" | "blocked" | null {
  if (!paths.length || !ownsMan(board[sq] ?? 0, seat) || paths.some((p) => p[0] === sq)) return null;
  return paths.some(isCapturePath) ? "capture" : "blocked";
}

/**
 * Oware: a tap on one of your own pits that you can't sow, on your turn. "empty" for an empty pit, "feed" for a pit
 * the feeding rule rules out (their side is empty and this pit's seeds would not reach it); null when the tap is fine.
 */
export function owareTapReason(pits: readonly number[], legal: readonly number[], pit: number, seat: number): "empty" | "feed" | null {
  const mine = seat === 0 ? pit < 6 : pit >= 6;
  if (!legal.length || !mine || legal.includes(pit)) return null;
  return pits[pit] ? "feed" : "empty";
}

/**
 * Draughts: several capture paths from one man can end on the same square (they take different pieces). Given the
 * landings chosen so far (`prefix`, starting with the man) and the end square, either the one path left (`move`), or
 * the squares that tell the paths apart next (`hops`), with the prefix carried over the landings every path shares.
 */
export function narrowRoute(
  paths: readonly (readonly number[])[],
  prefix: readonly number[],
  end: number,
): { move: number[] } | { prefix: number[]; hops: number[]; paths: number[][] } {
  const starts = (m: readonly number[], pre: readonly number[]) => pre.every((x, i) => m[i] === x);
  const cands = paths.filter((m) => m[m.length - 1] === end && starts(m, prefix)).map((m) => [...m]);
  if (cands.length <= 1) return { move: cands[0] ?? [...prefix] };
  const pre = [...prefix];
  for (;;) {
    const next = new Set(cands.map((m) => m[pre.length]));
    if (next.size !== 1) break;
    const [n] = next;
    if (n === undefined || n === end) break;
    pre.push(n);
  }
  return { prefix: pre, hops: [...new Set(cands.map((m) => m[pre.length]))], paths: cands };
}
