/**
 * Why a tap on a live board did nothing (Board Bay and the bot games). A tap on your own piece or pit that can't move
 * used to be silent; these say which rule stopped it, so the board can explain instead of ignoring the tap.
 */

/** Draughts men and kings by seat: 1 and 2 are seat 0's, 3 and 4 are seat 1's (games/draughts/engine). */
const ownsMan = (piece: number, seat: number) => (seat === 0 ? piece === 1 || piece === 2 : piece === 3 || piece === 4);

/**
 * Is this legal path a capture? On 8 × 8 a capture's first step jumps two rows. On 10 × 10 a flying king's plain
 * move can cross many rows, so ask the board: a capture lands past an enemy piece on the way.
 */
export function isCapturePath(path: readonly number[], board?: readonly number[]): boolean {
  if (path.length < 2) return false;
  if (path.length > 2) return true;
  const n = board && board.length === 100 ? 10 : 8;
  const [a, b] = path;
  const dr = Math.sign(Math.floor(b / n) - Math.floor(a / n)),
    dc = Math.sign((b % n) - (a % n));
  const steps = Math.abs(Math.floor(b / n) - Math.floor(a / n));
  if (!board) return steps === 2;
  for (let k = 1; k < steps; k++) if (board[(Math.floor(a / n) + k * dr) * n + (a % n) + k * dc]) return true;
  return false;
}

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
  return paths.some((p) => isCapturePath(p, board)) ? "capture" : "blocked";
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
