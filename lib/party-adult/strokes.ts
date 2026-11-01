/**
 * Draw It drawings are vector strokes only: no images, no uploads, no text tool. A stroke is a preset colour,
 * a preset width and a flat list of points on a 1000 × 1000 board. The server validates every batch against
 * these limits before it is kept (for the round only) and shown to the room.
 */
import { z } from "zod";

export const BOARD = 1000;
/** Pen colours, by index (tokens, so they read in both themes). */
export const PEN_COLORS = ["var(--text)", "var(--danger)", "var(--gold)", "var(--accent)", "var(--w-logic)", "var(--w-word)"] as const;
/** Pen widths in board units, by index. */
export const PEN_WIDTHS = [6, 14, 30] as const;

export const STROKE_LIMITS = {
  /** points (x, y pairs) per stroke; longer lines are split by the client */
  pointsPerStroke: 200,
  /** strokes per batch (one request) */
  perBatch: 20,
  /** strokes in one drawing */
  strokes: 400,
  /** points in one drawing */
  points: 12_000,
} as const;

export interface Stroke {
  /** colour index into PEN_COLORS */
  c: number;
  /** width index into PEN_WIDTHS */
  w: number;
  /** flat [x0, y0, x1, y1, ...] integers in 0..1000 */
  p: number[];
}

const coord = z.number().int().min(0).max(BOARD);
export const StrokeSchema = z.strictObject({
  c: z
    .number()
    .int()
    .min(0)
    .max(PEN_COLORS.length - 1),
  w: z
    .number()
    .int()
    .min(0)
    .max(PEN_WIDTHS.length - 1),
  p: z
    .array(coord)
    .min(2)
    .max(STROKE_LIMITS.pointsPerStroke * 2)
    .refine((p) => p.length % 2 === 0, { message: "odd_points" }),
});

export const StrokeBatch = z.array(StrokeSchema).min(1).max(STROKE_LIMITS.perBatch);

export const pointsIn = (strokes: readonly Stroke[]) => strokes.reduce((n, s) => n + s.p.length / 2, 0);

/** Whether a batch still fits in the drawing (stroke and point caps). */
export function fitsDrawing(existing: { strokes: number; points: number }, batch: readonly Stroke[]): boolean {
  return existing.strokes + batch.length <= STROKE_LIMITS.strokes && existing.points + pointsIn(batch) <= STROKE_LIMITS.points;
}

/**
 * Client helper: board-space points from a pointer path, dropping points closer than `minGap` and splitting
 * long lines into strokes the server accepts.
 */
export function toStrokes(path: readonly [number, number][], c: number, w: number, minGap = 4): Stroke[] {
  const pts: number[] = [];
  let last: [number, number] | null = null;
  for (const [x0, y0] of path) {
    const x = Math.max(0, Math.min(BOARD, Math.round(x0)));
    const y = Math.max(0, Math.min(BOARD, Math.round(y0)));
    if (last && Math.hypot(x - last[0], y - last[1]) < minGap) continue;
    pts.push(x, y);
    last = [x, y];
  }
  if (!pts.length) return [];
  if (pts.length === 2) pts.push(pts[0], pts[1]); // a dot
  const out: Stroke[] = [];
  const max = STROKE_LIMITS.pointsPerStroke * 2;
  // Overlap one point between pieces so the line stays joined.
  for (let i = 0; i < pts.length - 2; i += max - 2) out.push({ c, w, p: pts.slice(i, i + max) });
  return out.filter((s) => s.p.length >= 4);
}

/** SVG path data for a stroke. */
export const strokePath = (s: Stroke) => {
  let d = `M${s.p[0]} ${s.p[1]}`;
  for (let i = 2; i < s.p.length; i += 2) d += `L${s.p[i]} ${s.p[i + 1]}`;
  return d;
};
