import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, {
  FACES,
  generate,
  grade,
  GRID_FOR,
  hint,
  luckLimit,
  pairsOf,
  replay,
  scoreFor,
  verify,
  type TwinsPuzzle,
  type TwinsState,
} from "./logic";

const D: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];
const GAP = 400;

const timed = (cards: number[]): TwinsState => ({ flips: cards.map((c, i) => [c, i * GAP]) });

/** A human-like player with perfect memory: flips unseen cards and matches anything it remembers. */
function honest(p: TwinsPuzzle, rng = createRng("player")): number[] {
  const seen = new Map<number, number[]>();
  const done = new Set<number>();
  const out: number[] = [];
  const unseen = () => rng.shuffle(p.faces.map((_, i) => i).filter((i) => !done.has(i) && ![...seen.values()].flat().includes(i)));
  const remember = (c: number) => seen.set(p.faces[c], [...new Set([...(seen.get(p.faces[c]) ?? []), c])]);
  while (done.size < p.faces.length) {
    const known = [...seen.entries()].find(([, cs]) => cs.length === 2 && !done.has(cs[0]));
    if (known) {
      out.push(known[1][0], known[1][1]);
      done.add(known[1][0]).add(known[1][1]);
      continue;
    }
    const a = unseen()[0];
    out.push(a);
    remember(a);
    const partner = (seen.get(p.faces[a]) ?? []).find((c) => c !== a);
    const b = partner ?? unseen()[0];
    out.push(b);
    remember(b);
    if (p.faces[a] === p.faces[b]) done.add(a).add(b);
  }
  return out;
}

/** A cheat who can see every face: two flips per pair, every match blind. */
function clairvoyant(p: TwinsPuzzle): number[] {
  const out: number[] = [];
  const used = new Set<number>();
  p.faces.forEach((f, i) => {
    if (used.has(i)) return;
    const j = p.faces.findIndex((g, k) => k !== i && g === f);
    used.add(i).add(j);
    out.push(i, j);
  });
  return out;
}

describe("twins generation", () => {
  it("is deterministic and places every face exactly twice", () => {
    for (const d of D) {
      for (let k = 0; k < 20; k++) {
        const a = generate(createRng(`tw:${d}:${k}`), d);
        expect(generate(createRng(`tw:${d}:${k}`), d)).toEqual(a);
        const { rows, cols } = GRID_FOR[d];
        expect(a.puzzle.faces).toHaveLength(rows * cols);
        const counts = new Map<number, number>();
        a.puzzle.faces.forEach((f) => counts.set(f, (counts.get(f) ?? 0) + 1));
        expect([...counts.values()].every((c) => c === 2)).toBe(true);
        expect(Math.max(...a.puzzle.faces)).toBeLessThan(FACES.length);
      }
    }
  });

  it("grades bigger boards as harder", () => {
    const gs = D.map((d) => generate(createRng("g"), d).grade);
    for (let i = 1; i < gs.length; i++) expect(gs[i]).toBeGreaterThan(gs[i - 1]);
    expect(grade(100)).toBe(100);
  });
});

describe("twins verify", () => {
  it("accepts honest perfect-memory play across seeds", () => {
    for (const d of D) {
      for (let k = 0; k < 10; k++) {
        const g = generate(createRng(`honest:${d}:${k}`), d);
        const flips = honest(g.puzzle, createRng(`p:${d}:${k}`));
        const v = verify(g.puzzle, null, timed(flips));
        expect(v.ok, `${d}:${k} ${v.reason}`).toBe(true);
        expect(v.score).toBe(scoreFor(pairsOf(g.puzzle), flips.length));
      }
    }
  });

  it("rejects a clairvoyant run as implausible", () => {
    const g = generate(createRng("cheat"), "medium");
    const v = verify(g.puzzle, null, timed(clairvoyant(g.puzzle)));
    expect(v.reason).toBe("too many blind matches");
    expect(replay(g.puzzle, timed(clairvoyant(g.puzzle))).blind).toBe(pairsOf(g.puzzle));
    expect(luckLimit(8)).toBe(4);
  });

  it("rejects unfinished boards and illegal flips", () => {
    const g = generate(createRng("near"), "easy");
    const p = g.puzzle;
    const flips = honest(p);
    expect(verify(p, null, timed(flips.slice(0, -2))).reason).toBe("pairs left");
    expect(verify(p, null, timed([0, 0])).reason).toBe("flipped the same card twice");
    const pair = clairvoyant(p).slice(0, 2);
    expect(verify(p, null, timed([...pair, pair[0]])).reason).toBe("flipped a matched card");
    expect(verify(p, null, timed([99])).reason).toBe("malformed flip");
    expect(verify(p, null, { flips: [[0]] } as never).reason).toBe("malformed flip");
    expect(verify(p, null, null as never).ok).toBe(false);
    expect(
      verify(p, null, {
        flips: [
          [0, 5],
          [1, 500],
        ],
      }).reason,
    ).toBe("first flip must be at 0 ms");
    expect(
      verify(p, null, {
        flips: [
          [0, 0],
          [1, 50],
        ],
      }).reason,
    ).toBe("faster than the human floor");
  });

  it("tracks progress by pairs", () => {
    const g = generate(createRng("prog"), "easy");
    const pair = clairvoyant(g.puzzle).slice(0, 2);
    expect(logic.progress(g.puzzle, null, timed(pair))).toBeCloseTo(1 / 6);
    expect(logic.progress(g.puzzle, null, timed([]))).toBe(0);
    expect(replay(g.puzzle, timed([pair[0]])).open).toBe(pair[0]);
  });

  it("hints point at a real pair, preferring a half-seen one, and stop when done", () => {
    const g = generate(createRng("hint"), "medium");
    const p = g.puzzle;
    const h0 = hint(p, null, timed([]))!;
    const [a, b] = h0.target as number[];
    expect(p.faces[a]).toBe(p.faces[b]);
    expect(a).not.toBe(b);
    const far = p.faces.findIndex((f, i) => i > 3 && f !== p.faces[0]);
    const h1 = hint(p, null, timed([far]))!;
    expect((h1.target as number[]).includes(far)).toBe(true);
    let s = timed([]);
    for (let k = 0; k < pairsOf(p); k++) {
      const [x, y] = hint(p, null, s)!.target as number[];
      s = timed([...s.flips.map((f) => f[0]), x, y]);
    }
    expect(verify(p, null, s).progress).toBe(1);
    expect(hint(p, null, s)).toBeNull();
    expect(hint(p, null, null as never)).toBeNull();
  });
});
