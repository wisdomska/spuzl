/**
 * The game so far, for the live board's move list, review and captured pieces: pure helpers over a ChessMatch
 * (games/chess/rules.ts keeps the start position's key, every move in SAN and the current FEN).
 */
import { BLACK, WHITE, legalMoves, make, material, parseFen, san, toFen, uci, type Position } from "./engine";

/** The start position's FEN, rebuilt from its repetition key (`<placement> <turn> <castling bits> <ep>`). */
export function startFenFromKey(key: string | undefined): string | null {
  if (!key) return null;
  const [placement, turn, castle, ep] = key.split(" ");
  if (!placement || (turn !== "0" && turn !== "1")) return null;
  const bits = Number(castle) || 0;
  const rights = (bits & 1 ? "K" : "") + (bits & 2 ? "Q" : "") + (bits & 4 ? "k" : "") + (bits & 8 ? "q" : "");
  return `${placement} ${turn === "0" ? "w" : "b"} ${rights || "-"} ${ep ?? "-"} 0 1`;
}

/** One position of the game: its FEN, and the move (UCI) that led to it (null for the start). */
export interface Ply {
  fen: string;
  move: string | null;
}

/**
 * Every position of the game from the start, by playing the SAN move list again. Null when the list doesn't replay
 * (an unknown start, a move that isn't legal) or doesn't reach `fen`, so review is simply not offered.
 */
export function replay(sans: readonly string[], startFen: string, fen?: string): Ply[] | null {
  let p: Position = parseFen(startFen);
  const out: Ply[] = [{ fen: toFen(p), move: null }];
  for (const s of sans) {
    const m = legalMoves(p).find((x) => san(p, x) === s);
    if (!m) return null;
    p = make(p, m);
    out.push({ fen: toFen(p), move: uci(m) });
  }
  // Same placement and side to move (the move counters of a rebuilt start may differ).
  if (fen !== undefined && fen.split(" ").slice(0, 2).join(" ") !== out[out.length - 1].fen.split(" ").slice(0, 2).join(" ")) return null;
  return out;
}

/** The move list in numbered pairs: 1. e4 e5 2. Nf3 … (`black` missing on the last row while white's move stands alone). */
export function movePairs(sans: readonly string[], firstBlack = false): { n: number; white: string | null; black: string | null }[] {
  const list = firstBlack ? [null, ...sans] : [...sans];
  const out: { n: number; white: string | null; black: string | null }[] = [];
  for (let i = 0; i < list.length; i += 2) out.push({ n: i / 2 + 1, white: list[i], black: list[i + 1] ?? null });
  return out;
}

/** Captured-piece letters (lower case: p n b r q), in the order the big online boards show them. */
export const CAPTURE_ORDER = ["p", "n", "b", "r", "q"] as const;
export type CapturedKind = (typeof CAPTURE_ORDER)[number];
const START_COUNT: Record<CapturedKind, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };

/**
 * What each side has taken, from the pieces left on the board, lowest value first, and the material lead (white's
 * material less black's: positive when white is ahead). A promoted piece counts as the pawn it was, so promoting
 * doesn't show as a capture.
 */
export function capturedPieces(fen: string): { byWhite: CapturedKind[]; byBlack: CapturedKind[]; diff: number } {
  const p = parseFen(fen);
  const lost = (white: boolean): CapturedKind[] => {
    const board = fen.split(" ")[0];
    const count = (k: CapturedKind) => [...board].filter((c) => c === (white ? k.toUpperCase() : k)).length;
    const missing = Object.fromEntries(CAPTURE_ORDER.map((k) => [k, Math.max(0, START_COUNT[k] - count(k))])) as Record<
      CapturedKind,
      number
    >;
    // Extra pieces came from promoted pawns: those pawns weren't taken.
    const promoted = (["n", "b", "r", "q"] as const).reduce((s, k) => s + Math.max(0, count(k) - START_COUNT[k]), 0);
    missing.p = Math.max(0, missing.p - promoted);
    return CAPTURE_ORDER.flatMap((k) => Array.from({ length: missing[k] }, () => k));
  };
  return { byWhite: lost(false), byBlack: lost(true), diff: material(p.b, WHITE) - material(p.b, BLACK) };
}
