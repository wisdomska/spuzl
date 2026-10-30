/**
 * Chess move generator with the full rules: castling, en passant, promotion, check, checkmate,
 * stalemate, fifty-move rule, threefold repetition and insufficient material. Pure TypeScript.
 *
 * Squares are 0..63, row-major from a8 (index 0) to h1 (index 63), the same orientation as the
 * prototype's `chLegal(pos, r, c)` (row 0 is rank 8). Pieces: 0 empty, white 1..6 (P N B R Q K),
 * black 9..14 (8 | type).
 */

export const EMPTY = 0;
export const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
export const WHITE = 0, BLACK = 1;
export type Color = 0 | 1;

export interface Position {
  b: Int8Array;
  turn: Color;
  /** bit 1 white O-O, 2 white O-O-O, 4 black O-O, 8 black O-O-O */
  castle: number;
  /** en passant target square or -1 */
  ep: number;
  half: number;
  full: number;
}

export interface Move {
  from: number;
  to: number;
  /** promotion piece type (KNIGHT..QUEEN) or 0 */
  promo: number;
}

export const colorOf = (p: number): Color => (p >> 3) as Color;
export const typeOf = (p: number) => p & 7;
export const rowOf = (sq: number) => sq >> 3;
export const colOf = (sq: number) => sq & 7;
const on = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

const LETTERS = " PNBRQK";
export const FILES = "abcdefgh";

export function sqName(sq: number) {
  return FILES[colOf(sq)] + String(8 - rowOf(sq));
}
export function parseSq(s: string): number {
  if (!/^[a-h][1-8]$/.test(s)) return -1;
  return (8 - Number(s[1])) * 8 + FILES.indexOf(s[0]);
}

/* ---------------- Precomputed tables ---------------- */

const KN: number[][] = [];
const KG: number[][] = [];
/** RAYS[d][sq]: squares along direction d; 0..3 orthogonal, 4..7 diagonal */
const RAYS: number[][][] = [];
const DIRS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
for (let d = 0; d < 8; d++) RAYS.push([]);
for (let sq = 0; sq < 64; sq++) {
  const r = rowOf(sq), c = colOf(sq);
  KN[sq] = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]].filter(([a, b]) => on(r + a, c + b)).map(([a, b]) => (r + a) * 8 + c + b);
  KG[sq] = DIRS.filter(([a, b]) => on(r + a, c + b)).map(([a, b]) => (r + a) * 8 + c + b);
  DIRS.forEach(([a, b], d) => {
    const ray: number[] = [];
    for (let k = 1; on(r + a * k, c + b * k); k++) ray.push((r + a * k) * 8 + c + b * k);
    RAYS[d][sq] = ray;
  });
}

/* ---------------- FEN ---------------- */

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function parseFen(fen: string): Position {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 2) throw new Error("bad fen");
  const rows = parts[0].split("/");
  if (rows.length !== 8) throw new Error("bad fen rows");
  const b = new Int8Array(64);
  rows.forEach((row, r) => {
    let c = 0;
    for (const ch of row) {
      if (/[1-8]/.test(ch)) c += Number(ch);
      else {
        const t = LETTERS.indexOf(ch.toUpperCase());
        if (t < 1 || c > 7) throw new Error("bad fen piece");
        b[r * 8 + c] = t | (ch === ch.toUpperCase() ? 0 : 8);
        c++;
      }
    }
    if (c !== 8) throw new Error("bad fen row length");
  });
  if (parts[1] !== "w" && parts[1] !== "b") throw new Error("bad fen turn");
  const cs = parts[2] ?? "-";
  let castle = 0;
  if (cs.includes("K")) castle |= 1;
  if (cs.includes("Q")) castle |= 2;
  if (cs.includes("k")) castle |= 4;
  if (cs.includes("q")) castle |= 8;
  const ep = parts[3] && parts[3] !== "-" ? parseSq(parts[3]) : -1;
  return { b, turn: parts[1] === "w" ? WHITE : BLACK, castle, ep, half: Number(parts[4] ?? 0) || 0, full: Number(parts[5] ?? 1) || 1 };
}

export function boardFen(b: Int8Array) {
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let s = "", gap = 0;
    for (let c = 0; c < 8; c++) {
      const p = b[r * 8 + c];
      if (!p) gap++;
      else {
        if (gap) s += gap;
        gap = 0;
        const l = LETTERS[typeOf(p)];
        s += colorOf(p) === WHITE ? l : l.toLowerCase();
      }
    }
    if (gap) s += gap;
    rows.push(s);
  }
  return rows.join("/");
}

export function toFen(p: Position) {
  const cs = (p.castle & 1 ? "K" : "") + (p.castle & 2 ? "Q" : "") + (p.castle & 4 ? "k" : "") + (p.castle & 8 ? "q" : "");
  return `${boardFen(p.b)} ${p.turn === WHITE ? "w" : "b"} ${cs || "-"} ${p.ep >= 0 ? sqName(p.ep) : "-"} ${p.half} ${p.full}`;
}

/** Rows of 8 chars ('.' empty, PNBRQK white, pnbrqk black), the prototype's board format. */
export function toRows(b: Int8Array): string[] {
  const out: string[] = [];
  for (let r = 0; r < 8; r++) {
    let s = "";
    for (let c = 0; c < 8; c++) {
      const p = b[r * 8 + c];
      s += p ? (colorOf(p) === WHITE ? LETTERS[typeOf(p)] : LETTERS[typeOf(p)].toLowerCase()) : ".";
    }
    out.push(s);
  }
  return out;
}

/* ---------------- Attacks ---------------- */

export function kingSquare(b: Int8Array, color: Color): number {
  const k = KING | (color << 3);
  for (let i = 0; i < 64; i++) if (b[i] === k) return i;
  return -1;
}

/** Is `sq` attacked by any piece of colour `by`? */
export function attacked(b: Int8Array, sq: number, by: Color): boolean {
  const r = rowOf(sq), c = colOf(sq);
  const off = by << 3;
  // pawns: a white pawn attacks up (towards row 0), so it sits one row below the target
  const pr = by === WHITE ? r + 1 : r - 1;
  if (pr >= 0 && pr < 8) {
    if (c > 0 && b[pr * 8 + c - 1] === (PAWN | off)) return true;
    if (c < 7 && b[pr * 8 + c + 1] === (PAWN | off)) return true;
  }
  for (const s of KN[sq]) if (b[s] === (KNIGHT | off)) return true;
  for (const s of KG[sq]) if (b[s] === (KING | off)) return true;
  for (let d = 0; d < 8; d++) {
    const ray = RAYS[d][sq];
    for (let k = 0; k < ray.length; k++) {
      const p = b[ray[k]];
      if (!p) continue;
      if (colorOf(p) === by) {
        const t = typeOf(p);
        if (t === QUEEN || (d < 4 ? t === ROOK : t === BISHOP)) return true;
      }
      break;
    }
  }
  return false;
}

export function inCheck(p: Position, color: Color = p.turn): boolean {
  const k = kingSquare(p.b, color);
  return k >= 0 && attacked(p.b, k, (1 - color) as Color);
}

/* ---------------- Move generation ---------------- */

function pseudo(p: Position, out: Move[], onlyFrom = -1) {
  const b = p.b, me = p.turn, them = (1 - me) as Color;
  const push = (from: number, to: number, promo = 0) => out.push({ from, to, promo });
  for (let sq = 0; sq < 64; sq++) {
    if (onlyFrom >= 0 && sq !== onlyFrom) continue;
    const pc = b[sq];
    if (!pc || colorOf(pc) !== me) continue;
    const t = typeOf(pc), r = rowOf(sq), c = colOf(sq);
    if (t === PAWN) {
      const dir = me === WHITE ? -1 : 1;
      const startRow = me === WHITE ? 6 : 1;
      const lastRow = me === WHITE ? 0 : 7;
      const addPawn = (to: number) => {
        if (rowOf(to) === lastRow) for (const pr of [QUEEN, ROOK, BISHOP, KNIGHT]) push(sq, to, pr);
        else push(sq, to);
      };
      const one = sq + dir * 8;
      if (on(r + dir, c) && !b[one]) {
        addPawn(one);
        const two = sq + dir * 16;
        if (r === startRow && !b[two]) push(sq, two);
      }
      for (const dc of [-1, 1]) {
        if (!on(r + dir, c + dc)) continue;
        const to = (r + dir) * 8 + c + dc;
        if (b[to] && colorOf(b[to]) === them) addPawn(to);
        else if (to === p.ep) push(sq, to);
      }
    } else if (t === KNIGHT || t === KING) {
      for (const to of t === KNIGHT ? KN[sq] : KG[sq]) if (!b[to] || colorOf(b[to]) === them) push(sq, to);
      if (t === KING) castleMoves(p, sq, push);
    } else {
      const d0 = t === BISHOP ? 4 : 0, d1 = t === ROOK ? 4 : 8;
      for (let d = d0; d < d1; d++) {
        for (const to of RAYS[d][sq]) {
          if (!b[to]) push(sq, to);
          else {
            if (colorOf(b[to]) === them) push(sq, to);
            break;
          }
        }
      }
    }
  }
}

function castleMoves(p: Position, sq: number, push: (f: number, t: number) => void) {
  const me = p.turn, them = (1 - me) as Color, b = p.b;
  const home = me === WHITE ? 60 : 4;
  if (sq !== home) return;
  const ks = me === WHITE ? 1 : 4, qs = me === WHITE ? 2 : 8;
  if (!(p.castle & (ks | qs))) return;
  if (attacked(b, home, them)) return;
  const rook = ROOK | (me << 3);
  if (p.castle & ks && !b[home + 1] && !b[home + 2] && b[home + 3] === rook && !attacked(b, home + 1, them) && !attacked(b, home + 2, them)) push(home, home + 2);
  if (p.castle & qs && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === rook && !attacked(b, home - 1, them) && !attacked(b, home - 2, them)) push(home, home - 2);
}

/** Applies a move without legality checks. Returns a new position. */
export function make(p: Position, m: Move): Position {
  const b = p.b.slice();
  const pc = b[m.from], t = typeOf(pc), me = p.turn;
  const captured = b[m.to];
  let ep = -1;
  b[m.to] = m.promo ? m.promo | (me << 3) : pc;
  b[m.from] = EMPTY;
  if (t === PAWN) {
    if (m.to === p.ep) b[m.to + (me === WHITE ? 8 : -8)] = EMPTY;
    if (Math.abs(m.to - m.from) === 16) ep = (m.to + m.from) / 2;
  }
  if (t === KING && Math.abs(m.to - m.from) === 2) {
    if (m.to > m.from) {
      b[m.from + 1] = b[m.from + 3];
      b[m.from + 3] = EMPTY;
    } else {
      b[m.from - 1] = b[m.from - 4];
      b[m.from - 4] = EMPTY;
    }
  }
  let castle = p.castle;
  if (t === KING) castle &= me === WHITE ? ~3 : ~12;
  for (const [sq, bit] of [[63, 1], [56, 2], [7, 4], [0, 8]] as const) if (m.from === sq || m.to === sq) castle &= ~bit;
  return {
    b,
    turn: (1 - me) as Color,
    castle,
    ep,
    half: t === PAWN || captured ? 0 : p.half + 1,
    full: me === BLACK ? p.full + 1 : p.full,
  };
}

export function legalMoves(p: Position, onlyFrom = -1): Move[] {
  const ps: Move[] = [];
  pseudo(p, ps, onlyFrom);
  const me = p.turn;
  return ps.filter((m) => !inCheck(make(p, m), me));
}

export function hasLegalMove(p: Position): boolean {
  const ps: Move[] = [];
  pseudo(p, ps);
  const me = p.turn;
  for (const m of ps) if (!inCheck(make(p, m), me)) return true;
  return false;
}

export const isCheckmate = (p: Position) => inCheck(p) && !hasLegalMove(p);
export const isStalemate = (p: Position) => !inCheck(p) && !hasLegalMove(p);

export function isCapture(p: Position, m: Move) {
  return !!p.b[m.to] || (typeOf(p.b[m.from]) === PAWN && m.to === p.ep);
}

/** K v K, K+minor v K, and bishops only, all on one square colour. */
export function insufficientMaterial(b: Int8Array): boolean {
  const minors: { t: number; sq: number }[] = [];
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq];
    if (!p) continue;
    const t = typeOf(p);
    if (t === KING) continue;
    if (t === PAWN || t === ROOK || t === QUEEN) return false;
    minors.push({ t, sq });
  }
  if (minors.length <= 1) return true;
  if (minors.every((m) => m.t === BISHOP)) {
    const shade = (sq: number) => (rowOf(sq) + colOf(sq)) % 2;
    return minors.every((m) => shade(m.sq) === shade(minors[0].sq));
  }
  return false;
}

/* ---------------- Notation ---------------- */

export function uci(m: Move) {
  return sqName(m.from) + sqName(m.to) + (m.promo ? " nbrq"[m.promo - 1] : "");
}

/** Parses a UCI string into one of the legal moves of `p`, or null. */
export function fromUci(p: Position, s: string): Move | null {
  if (typeof s !== "string" || !/^[a-h][1-8][a-h][1-8][nbrq]?$/.test(s)) return null;
  const from = parseSq(s.slice(0, 2)), to = parseSq(s.slice(2, 4));
  const promo = s.length === 5 ? " nbrq".indexOf(s[4]) + 1 : 0;
  return legalMoves(p, from).find((m) => m.to === to && m.promo === promo) ?? null;
}

export function san(p: Position, m: Move): string {
  const pc = p.b[m.from], t = typeOf(pc);
  let s: string;
  if (t === KING && Math.abs(m.to - m.from) === 2) s = m.to > m.from ? "O-O" : "O-O-O";
  else {
    const cap = isCapture(p, m);
    if (t === PAWN) {
      s = (cap ? FILES[colOf(m.from)] + "x" : "") + sqName(m.to) + (m.promo ? "=" + LETTERS[m.promo] : "");
    } else {
      const others = legalMoves(p).filter((o) => o.to === m.to && o.from !== m.from && p.b[o.from] === pc);
      let dis = "";
      if (others.length) {
        const sameFile = others.some((o) => colOf(o.from) === colOf(m.from));
        const sameRow = others.some((o) => rowOf(o.from) === rowOf(m.from));
        if (!sameFile) dis = FILES[colOf(m.from)];
        else if (!sameRow) dis = String(8 - rowOf(m.from));
        else dis = sqName(m.from);
      }
      s = LETTERS[t] + dis + (cap ? "x" : "") + sqName(m.to);
    }
  }
  const after = make(p, m);
  if (inCheck(after)) s += hasLegalMove(after) ? "+" : "#";
  return s;
}

/** Position identity for repetition: placement, side, castling rights and a usable en passant square. */
export function positionKey(p: Position): string {
  let ep = "-";
  if (p.ep >= 0 && legalMoves(p).some((m) => m.to === p.ep && typeOf(p.b[m.from]) === PAWN)) ep = sqName(p.ep);
  return `${boardFen(p.b)} ${p.turn} ${p.castle} ${ep}`;
}

export const PIECE_VALUE = [0, 1, 3, 3, 5, 9, 0];

export function material(b: Int8Array, color: Color) {
  let s = 0;
  for (let i = 0; i < 64; i++) if (b[i] && colorOf(b[i]) === color) s += PIECE_VALUE[typeOf(b[i])];
  return s;
}
