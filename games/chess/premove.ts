/**
 * Premoves: moves queued while the other side is to move, played the moment your turn comes if they are legal then.
 * Pure helpers for the live chess board (components/multiplayer/bay/boards.tsx). Squares are engine squares
 * (0 = a8 … 63 = h1); a premove is a UCI string ("e2e4"), promotions always queen ("e7e8q").
 *
 * While queueing, the board is a guess: your earlier premoves are drawn as made (a pawn reaching the last rank
 * becomes a queen, a castling king brings its rook), and a piece may be premoved to any square its kind of move
 * reaches on an empty board, captures and squares your own pieces stand on included (they may be gone by then).
 * Whether it is legal is decided only when your turn comes, against the real position.
 */
import { BISHOP, KING, KNIGHT, PAWN, QUEEN, ROOK, WHITE, colOf, colorOf, parseSq, rowOf, sqName, typeOf, type Color } from "./engine";

/** The most premoves you can queue at once (as on the big online boards). */
export const PREMOVE_MAX = 3;

const on = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

/** Squares a piece of this kind could reach from `from` on an empty board (castling included for a king at home). */
export function premoveTargets(b: Int8Array, from: number): number[] {
  const pc = b[from];
  if (!pc) return [];
  const t = typeOf(pc),
    me = colorOf(pc);
  const r = rowOf(from),
    c = colOf(from);
  const out: number[] = [];
  const add = (rr: number, cc: number) => on(rr, cc) && out.push(rr * 8 + cc);
  const ray = (dr: number, dc: number) => {
    for (let k = 1; on(r + dr * k, c + dc * k); k++) add(r + dr * k, c + dc * k);
  };
  if (t === PAWN) {
    const dir = me === WHITE ? -1 : 1;
    add(r + dir, c);
    if (r === (me === WHITE ? 6 : 1)) add(r + 2 * dir, c);
    add(r + dir, c - 1);
    add(r + dir, c + 1);
  } else if (t === KNIGHT) {
    for (const [a, d] of [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ])
      add(r + a, c + d);
  } else if (t === KING) {
    for (let a = -1; a <= 1; a++) for (let d = -1; d <= 1; d++) if (a || d) add(r + a, c + d);
    // Castling from the home square, toward a rook of ours still in its corner.
    const home = me === WHITE ? 60 : 4;
    const rook = ROOK | (me << 3);
    if (from === home) {
      if (b[home + 3] === rook) out.push(home + 2);
      if (b[home - 4] === rook) out.push(home - 2);
    }
  } else {
    if (t === ROOK || t === QUEEN)
      for (const [a, d] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const)
        ray(a, d);
    if (t === BISHOP || t === QUEEN)
      for (const [a, d] of [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ] as const)
        ray(a, d);
  }
  return out;
}

/** The UCI string for a premove: a pawn reaching the last rank promotes to a queen. */
export function premoveUci(b: Int8Array, from: number, to: number): string {
  const pc = b[from];
  const last = typeOf(pc) === PAWN && (rowOf(to) === 0 || rowOf(to) === 7);
  return sqName(from) + sqName(to) + (last ? "q" : "");
}

/** The board as the premover imagines it: each queued premove made in turn, with no legality checks. */
export function applyPremoves(b: Int8Array, queue: readonly string[]): Int8Array {
  const out = b.slice();
  for (const m of queue) {
    const from = parseSq(m.slice(0, 2)),
      to = parseSq(m.slice(2, 4));
    const pc = out[from];
    if (!pc) continue;
    const me = colorOf(pc);
    out[to] = m.length === 5 ? QUEEN | (me << 3) : pc;
    out[from] = 0;
    if (typeOf(pc) === KING && Math.abs(to - from) === 2) {
      const rookFrom = to > from ? from + 3 : from - 4,
        rookTo = to > from ? from + 1 : from - 1;
      out[rookTo] = out[rookFrom];
      out[rookFrom] = 0;
    }
  }
  return out;
}

/** Can `side` start a premove from `from` on this imagined board (its own piece, with somewhere to go)? */
export function canPremoveFrom(b: Int8Array, from: number, side: Color): boolean {
  const pc = b[from];
  return !!pc && colorOf(pc) === side && premoveTargets(b, from).length > 0;
}

/** Adds a premove to the queue (refused once the queue is full). */
export function queuePremove(queue: readonly string[], move: string, max = PREMOVE_MAX): string[] {
  return queue.length >= max ? [...queue] : [...queue, move];
}

/**
 * Your turn came: the first queued premove is played if it is one of the legal moves now (`legal`, UCI), and the rest
 * stay queued. If it is not legal, nothing is played and the whole queue is dropped (the later ones were planned on
 * top of it).
 */
export function resolvePremove(
  queue: readonly string[],
  legal: readonly string[],
): { play: string | null; rest: string[]; dropped: boolean } {
  if (!queue.length) return { play: null, rest: [], dropped: false };
  const [first, ...rest] = queue;
  if (legal.includes(first)) return { play: first, rest, dropped: false };
  return { play: null, rest: [], dropped: true };
}
