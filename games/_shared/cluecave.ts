/**
 * Shared helpers for the Clue Cave content games (Hunch, Quickfire, Pinned, Flagged).
 * Pure TypeScript, safe on server and client.
 */
import { createRng, hashSeed } from "@/lib/rng";

/**
 * Daily rotation over a pool: day `index` takes `perDay` consecutive slots of a fixed permutation
 * of the pool. Consecutive days never share an entry (needs pool >= 2 * perDay), and when the pool
 * wraps the slots shift, so later days get fresh combinations.
 */
export function rotation(poolSize: number, perDay: number, index: number, salt: string): number[] {
  if (poolSize < perDay * 2) throw new Error("pool too small for rotation");
  const order = createRng(`rot:${salt}:${poolSize}`).shuffle(Array.from({ length: poolSize }, (_, i) => i));
  const start = (((index * perDay) % poolSize) + poolSize) % poolSize;
  return Array.from({ length: perDay }, (_, k) => order[(start + k) % poolSize]);
}

/** Number of distinct Daily packs before a pool would repeat a pack start. */
export function packCount(poolSize: number, perDay: number) {
  return Math.floor(poolSize / perDay);
}

/* ---------- Sealed answer data ---------- */
/**
 * Boards give instant feedback (right, wrong, warm, distance), so they need answer data. It ships
 * sealed: XOR with a keyed stream, base64. This keeps answers out of plain sight in devtools; it is
 * not a security boundary. Scores always come from the server's verify(), which uses the secret
 * solution and ignores the sealed copy.
 */
export function seal(value: unknown, key: string): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const rng = createRng(`seal:${key}`);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ Math.floor(rng.next() * 256);
  let bin = "";
  out.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

export function unseal<T>(sealed: string, key: string): T {
  const bin = atob(sealed);
  const rng = createRng(`seal:${key}`);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) ^ Math.floor(rng.next() * 256);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

/* ---------- Text matching ---------- */

const STOP = new Set(["a", "an", "the", "of", "and", "or", "to", "in", "on", "with", "that", "have", "has", "had", "things", "thing", "stuff", "items", "item", "kinds", "kind", "types", "type", "famous", "some", "are", "is", "you", "can", "which", "they", "all", "for", "your", "their", "made", "from", "by", "them", "it", "be", "used"]);

/** Lowercase, strip accents and punctuation, drop filler words, singularise simple plurals. */
export function normaliseGuess(s: string): string[] {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map(singular);
}

function singular(w: string) {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && /(ches|shes|xes|sses)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) return w.slice(0, -1);
  return w;
}

/** Edit distance counting a swap of two neighbouring letters as one edit (optimal string alignment). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[m][n];
}

/** Typo tolerance: none under 5 letters, 1 edit from 5, 2 edits from 9. */
export function closeEnough(guess: string, target: string) {
  const len = Math.max(guess.length, target.length);
  const allowed = len >= 9 ? 2 : len >= 5 ? 1 : 0;
  return levenshtein(guess, target) <= allowed;
}

/* ---------- Timed answer rounds (Quickfire, Flagged) ---------- */

export interface TimedAnswer {
  /** chosen option index, null when the round timed out */
  pick: number | null;
  /** ms from the question appearing to the tap (or the limit on timeout) */
  ms: number;
}

/** Nobody reads a question and taps a choice in under this. */
export const READ_FLOOR_MS = 300;

/** Validates a list of timed answers. Returns a reason string when the log is malformed or implausible. */
export function checkTimedAnswers(answers: unknown, count: number, options: number, limitMs: number): string | null {
  if (!Array.isArray(answers) || answers.length !== count) return "malformed answers";
  for (const a of answers as TimedAnswer[]) {
    if (!a || typeof a !== "object") return "malformed answer";
    if (!Number.isInteger(a.ms) || a.ms < 0 || a.ms > limitMs) return "answer time out of range";
    if (a.pick === null) {
      if (a.ms !== limitMs) return "timeout without the full time";
      continue;
    }
    if (!Number.isInteger(a.pick) || a.pick < 0 || a.pick >= options) return "malformed pick";
    if (a.ms < READ_FLOOR_MS) return "faster than the human floor";
  }
  return null;
}

/** 100 per correct answer, plus up to 50 for speed. */
export function timedScore(answers: TimedAnswer[], correct: number[], limitMs: number) {
  let score = 0, right = 0;
  answers.forEach((a, i) => {
    if (a.pick !== null && a.pick === correct[i]) {
      right++;
      score += 100 + Math.round((50 * (limitMs - a.ms)) / limitMs);
    }
  });
  return { score, right };
}

/** Stable per-puzzle key for sealing, so two puzzles never share a stream. */
export function puzzleKey(...parts: (string | number)[]) {
  return hashSeed(parts.join("|")).toString(36);
}
