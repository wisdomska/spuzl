/**
 * The physical sound of one Board Bay move, worked out from the state before and after it (both players hear the
 * same thing: their own move as it is sent, the other side's as it arrives). Falls back to a plain placement when a
 * state is missing or from an older format, so a sound never breaks a game.
 */
import { play } from "./index";

type S = Record<string, unknown> | null | undefined;

const num = (x: unknown) => (typeof x === "number" ? x : 0);

function chess(next: S) {
  const sans = (next?.sans as string[] | undefined) ?? [];
  const san = sans[sans.length - 1] ?? "";
  if (san.includes("x")) play("pieceCapture");
  else if (san.startsWith("O-O")) play("castle");
  else if (/[+#]$/.test(san)) play("pieceCheck");
  else play("piecePlace");
}

function draughts(prev: S, next: S) {
  const b0 = (prev?.board as number[] | undefined) ?? [];
  const b1 = (next?.board as number[] | undefined) ?? [];
  const pieces = (b: number[]) => b.filter((p) => p !== 0).length;
  // 2 and 4 are kings (games/draughts/engine KING0 / KING1)
  const kings = (b: number[]) => b.filter((p) => p === 2 || p === 4).length;
  if (b0.length && pieces(b1) < pieces(b0)) play("discCapture");
  else play("discPlace");
  if (b0.length && kings(b1) > kings(b0)) play("discCrown", { delay: 0.16 });
}

function oware(prev: S, next: S, move: unknown) {
  const pits = (prev?.pits as number[] | undefined) ?? [];
  const seeds = Math.min(12, num(pits[num(move)]) || 1);
  for (let k = 0; k < seeds; k++) play("seedDrop", { delay: k * 0.09, silentHaptic: k > 0, gain: k ? 0.85 : 1 });
  const before = (prev?.scores as number[] | undefined) ?? [0, 0];
  const after = (next?.scores as number[] | undefined) ?? before;
  if (num(after[0]) + num(after[1]) > num(before[0]) + num(before[1])) play("seedScoop", { delay: seeds * 0.09 + 0.12 });
}

function ludo(prev: S, move: unknown) {
  const m = move as { kind?: string } | null;
  if (m?.kind === "roll") return play("diceRoll");
  const steps = Math.min(6, num(prev?.roll) || 1);
  for (let k = 0; k < steps; k++) play("tokenStep", { delay: k * 0.11, silentHaptic: k > 0 });
}

function fourup(prev: S, move: unknown) {
  const grid = (prev?.grid as number[] | undefined) ?? [];
  const col = num(move);
  // 7 columns × 6 rows, row 0 at the top: the disc falls past every empty slot in its column
  let empty = 0;
  for (let r = 0; r < 6; r++) if (grid[r * 7 + col] === 0) empty++;
  play("columnDrop", { step: Math.max(1, empty) });
}

export function playBayMove(game: string, prev: unknown, next: unknown, move: unknown) {
  const p = prev as S;
  const n = next as S;
  switch (game) {
    case "chess":
      return chess(n);
    case "draughts":
      return draughts(p, n);
    case "oware":
      return oware(p, n, move);
    case "ludo":
      return ludo(p, move);
    case "fourup":
      return fourup(p, move);
    default:
      return play("piecePlace");
  }
}
