/**
 * Live ink for Draw It: the drawer's in-progress line, streamed to the room while it is being drawn.
 *
 * Live ink is ephemeral and never stored. The drawer posts each batch to the ink relay (POST /api/v1/ink) with
 * the ink pass its round view gave it (lib/party-adult/ink-pass.ts); the relay checks the pass and the batch and
 * broadcasts it on the room's ink channel (`inkTopic`, event "ink"), stamped server side with the drawer and the
 * round (R4-24). When the drawer lifts the pen, the finished stroke still goes through POST /party/draw (the
 * server's caps and checks) and the stored drawing replaces the live line.
 *
 * Bandwidth: the drawer sends one small batch every INK.batchMs while the pen is down, only when it has new
 * points, and never while the last one is still on its way (so batches stay in order and a slow phone just sends
 * fewer, bigger ones). Coordinates are whole board units (0..1000); points closer than INK.minGap are dropped;
 * the first point of a batch is absolute and the rest are deltas from the point before, so most numbers are 1-2
 * digits.
 *
 * Trust: players can't publish on the ink channel (the Realtime policy, the Ably token's capability and the
 * PartyKit relay all refuse it), so the sender stamp is the server's. Viewers still keep a batch only when it
 * names the round's drawer (from the server's view) and this round, and every field passes the checks below.
 * The stored stroke is always the truth; live ink only ever shows until it arrives.
 */
import { BOARD, PEN_COLORS, PEN_WIDTHS } from "./strokes";

/** The room's ink channel: members read it, only the server writes to it (R4-24). */
export const inkTopic = (matchId: string) => `ink:${matchId}`;
/** Where the drawer posts its live batches (app/api/v1/ink). */
export const INK_RELAY = "/api/v1/ink";

export const INK = {
  /** how often the drawer sends a batch while the pen is down (each one is a request to the relay) */
  batchMs: 100,
  /** points per batch at most (the rest wait for the next batch) */
  maxPerBatch: 48,
  /** points closer than this (board units) are dropped */
  minGap: 3,
  /** points one live line may hold on a viewer's screen */
  maxPoints: 2000,
  /** live lines at once on a viewer's screen */
  maxLines: 4,
  /** a line still drawing that goes quiet this long is dropped (lost pen-up, or someone else's message) */
  quietMs: 4000,
  /** a finished line waits this long at most for the stored drawing to replace it */
  holdMs: 2500,
} as const;

/** One batch as it goes over the wire. */
export interface InkWire {
  /** sender: the drawer's player id */
  by: string;
  /** round number */
  r: number;
  /** the drawer's line number this round (counts up from 1 per pen-down) */
  s: number;
  /** colour index */
  c: number;
  /** width index */
  w: number;
  /** index of this batch's first point within the line */
  i: number;
  /** first point absolute, then deltas: [x0, y0, dx1, dy1, ...] */
  p: number[];
  /** 1 on the last batch of a line (pen up) */
  e?: 1;
}

/** A batch after checks: points are absolute again. */
export interface InkBatch {
  s: number;
  c: number;
  w: number;
  i: number;
  p: number[];
  end: boolean;
}

/** A board point as whole units, inside the board. */
export function quantise(x: number, y: number): [number, number] {
  const q = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(BOARD, Math.round(v))) : 0);
  return [q(x), q(y)];
}

/** Flat absolute points to the wire form (first absolute, then deltas). */
export function encodePoints(abs: readonly number[]): number[] {
  const out: number[] = [];
  for (let k = 0; k + 1 < abs.length; k += 2) {
    if (k === 0) out.push(abs[0], abs[1]);
    else out.push(abs[k] - abs[k - 2], abs[k + 1] - abs[k - 1]);
  }
  return out;
}

/** The wire form back to flat absolute points, or null when it isn't a valid batch. */
export function decodePoints(p: unknown): number[] | null {
  if (!Array.isArray(p) || p.length % 2 !== 0 || p.length > INK.maxPerBatch * 2) return null;
  const out: number[] = [];
  let x = 0;
  let y = 0;
  for (let k = 0; k < p.length; k += 2) {
    const a = p[k];
    const b = p[k + 1];
    if (!Number.isInteger(a) || !Number.isInteger(b)) return null;
    x = k === 0 ? a : x + a;
    y = k === 0 ? b : y + b;
    if (x < 0 || x > BOARD || y < 0 || y > BOARD) return null;
    out.push(x, y);
  }
  return out;
}

const smallInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

/**
 * Checks a received message. Kept only when it comes from the round's drawer, for this round, while the
 * round is drawing, and every field is in range.
 */
export function parseInk(raw: unknown, expect: { leadId: string | null; round: number; drawing: boolean }): InkBatch | null {
  if (!expect.drawing || !expect.leadId || !raw || typeof raw !== "object") return null;
  const m = raw as Partial<Record<keyof InkWire, unknown>>;
  if (m.by !== expect.leadId || m.r !== expect.round) return null;
  return checkBatch(m);
}

/** The relay's check of a batch the drawer posts (no sender or round: the server stamps those). */
export function checkBatch(raw: unknown): InkBatch | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Partial<Record<keyof InkWire, unknown>>;
  if (!smallInt(m.s, 1, 100_000) || !smallInt(m.i, 0, INK.maxPoints)) return null;
  if (!smallInt(m.c, 0, PEN_COLORS.length - 1) || !smallInt(m.w, 0, PEN_WIDTHS.length - 1)) return null;
  const p = decodePoints(m.p);
  if (!p) return null;
  const end = m.e === 1;
  if (!p.length && !end) return null;
  return { s: m.s, c: m.c, w: m.w, i: m.i, p, end };
}

/* ---------------- Drawer: batching ---------------- */

/** Collects the drawer's points for one line at a time and hands them out as wire batches. */
export class InkBatcher {
  private seq = 0;
  private c = 0;
  private w = 0;
  private sent = 0;
  private buf: number[] = [];
  private last: [number, number] | null = null;
  private open = false;

  /** Pen down: a new line. */
  start(c: number, w: number) {
    this.seq++;
    this.c = c;
    this.w = w;
    this.sent = 0;
    this.buf = [];
    this.last = null;
    this.open = true;
  }

  /** A pointer position in board units. Points too close to the last kept one are dropped. */
  add(x: number, y: number) {
    if (!this.open) return;
    const [qx, qy] = quantise(x, y);
    if (this.last && Math.hypot(qx - this.last[0], qy - this.last[1]) < INK.minGap) return;
    if (this.sent + this.buf.length / 2 >= INK.maxPoints) return;
    this.buf.push(qx, qy);
    this.last = [qx, qy];
  }

  /**
   * The next batch to send, or null when there is nothing new. `end` (pen up) sends what is left with the
   * end mark, even with no new points, and closes the line.
   */
  take(end = false): Omit<InkWire, "by" | "r"> | null {
    if (!this.open) return null;
    const n = Math.min(this.buf.length, INK.maxPerBatch * 2);
    const rest = this.buf.length - n;
    if (!n && !end) return null;
    const pts = this.buf.slice(0, n);
    this.buf = this.buf.slice(n);
    const out: Omit<InkWire, "by" | "r"> = { s: this.seq, c: this.c, w: this.w, i: this.sent, p: encodePoints(pts) };
    this.sent += n / 2;
    // A pen-up with more than one batch left: the end mark rides on the last one (the caller takes again).
    if (end && !rest) {
      out.e = 1;
      this.open = false;
    }
    return out;
  }

  get drawing() {
    return this.open;
  }
}

/* ---------------- Viewers: live lines and interpolation ---------------- */

export interface LiveLine {
  s: number;
  c: number;
  w: number;
  /** flat absolute points received so far */
  pts: number[];
  /** how many points are drawn on screen (fractional while easing in) */
  shown: number;
  /** pen up received */
  ended: boolean;
  /** stored strokes when the pen-up arrived: the line goes once the stored drawing changes */
  storedAtEnd: number;
  /** last message for this line (ms) */
  at: number;
}

export type LiveLines = Map<number, LiveLine>;

/**
 * Adds a checked batch to the live lines. Points must arrive in order: a repeat or an old batch is ignored;
 * after a lost batch the line carries on from the new points (the gap shows as a straight join).
 */
export function applyInk(lines: LiveLines, b: InkBatch, now: number, stored: number): void {
  let l = lines.get(b.s);
  if (!l) {
    if (lines.size >= INK.maxLines) {
      const oldest = [...lines.values()].sort((a, z) => a.at - z.at)[0];
      lines.delete(oldest.s);
    }
    l = { s: b.s, c: b.c, w: b.w, pts: [], shown: 0, ended: false, storedAtEnd: stored, at: now };
    lines.set(b.s, l);
  }
  if (l.ended) return;
  const have = l.pts.length / 2;
  if (b.i < have) {
    // Overlap: keep only the points we don't have yet.
    const skip = have - b.i;
    if (skip * 2 >= b.p.length && !b.end) return;
    b = { ...b, p: b.p.slice(skip * 2) };
  }
  const room = INK.maxPoints * 2 - l.pts.length;
  if (room > 0) l.pts.push(...b.p.slice(0, room));
  l.at = now;
  if (b.end) {
    l.ended = true;
    l.storedAtEnd = stored;
  }
}

/**
 * Drops lines that are done: finished lines once the stored drawing changed (it now holds them) or after
 * INK.holdMs, and quiet unfinished lines after INK.quietMs. Returns whether anything was dropped.
 */
export function pruneLive(lines: LiveLines, now: number, stored: number): boolean {
  let dropped = false;
  for (const l of [...lines.values()]) {
    const done = l.ended ? stored !== l.storedAtEnd || now - l.at > INK.holdMs : now - l.at > INK.quietMs;
    if (done) dropped = lines.delete(l.s) || dropped;
  }
  return dropped;
}

/**
 * Interpolation: how many points to show after `dtMs`. The backlog eases in over about one batch interval,
 * so a batch of points is drawn smoothly instead of all at once. Reduced motion shows everything at once.
 */
export function stepShown(shown: number, total: number, dtMs: number, reduced: boolean): number {
  if (reduced || total - shown <= 0.01) return total;
  const backlog = total - shown;
  // Never fall more than two batches behind, and always move at least a little.
  const next = shown + backlog * Math.min(1, Math.max(0, dtMs) / INK.batchMs);
  return Math.min(total, Math.max(next, total - INK.maxPerBatch * 2, shown + Math.min(backlog, 0.25)));
}

/**
 * The points to draw for `shown` (fractional): whole points up to it, then a point part way along the
 * next segment, so the line's tip glides instead of jumping point to point.
 */
export function visiblePoints(pts: readonly number[], shown: number): number[] {
  const n = pts.length / 2;
  if (!n || shown <= 0) return [];
  if (shown >= n) return pts.slice();
  const whole = Math.max(1, Math.floor(shown));
  const out = pts.slice(0, whole * 2);
  const f = shown - Math.floor(shown);
  if (f > 0 && whole < n) {
    const [x0, y0] = [pts[whole * 2 - 2], pts[whole * 2 - 1]];
    const [x1, y1] = [pts[whole * 2], pts[whole * 2 + 1]];
    out.push(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f);
  }
  return out;
}

/** SVG path data for live points (a dot when there is only one point). */
export function livePath(pts: readonly number[]): string {
  if (pts.length < 2) return "";
  const r = (v: number) => Math.round(v * 10) / 10;
  let d = `M${r(pts[0])} ${r(pts[1])}`;
  if (pts.length === 2) return `${d}L${r(pts[0])} ${r(pts[1])}`;
  for (let k = 2; k + 1 < pts.length; k += 2) d += `L${r(pts[k])} ${r(pts[k + 1])}`;
  return d;
}
