import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { checkTapTimes, FLASH_PERIOD_MS, stdev } from "@/games/_shared/reflex";
import logic, {
  generate,
  grade,
  IDLE_MS,
  LENGTH_FOR,
  padName,
  PADS,
  START_FOR,
  verify,
  type EchoPuzzle,
  type EchoRound,
  type EchoState,
} from "./logic";

const D: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];

/** A run that repeats `rounds` rounds perfectly, then ends with `end`. */
function run(p: EchoPuzzle, rounds: number, end: "wrong" | "idle" | "none" = "wrong", gap = 320): EchoState {
  const out: EchoRound[] = [];
  for (let r = 0; r < rounds; r++) out.push({ taps: p.seq.slice(0, p.start + r).map((pad, i) => [pad, (i + 1) * gap]) });
  if (end === "wrong") {
    const len = p.start + rounds;
    const taps: [number, number][] = p.seq.slice(0, len - 1).map((pad, i) => [pad, (i + 1) * gap]);
    taps.push([(p.seq[len - 1] + 1) % PADS, len * gap]);
    out.push({ taps });
  }
  if (end === "idle") out.push({ taps: [[p.seq[0], gap]] });
  return { rounds: out };
}

describe("echo generation", () => {
  it("is deterministic per seed and difficulty, with no triple repeats", () => {
    for (const d of D) {
      for (let k = 0; k < 20; k++) {
        const a = generate(createRng(`echo:${d}:${k}`), d);
        expect(generate(createRng(`echo:${d}:${k}`), d)).toEqual(a);
        expect(a.puzzle.seq).toHaveLength(LENGTH_FOR[d]);
        expect(a.puzzle.start).toBe(START_FOR[d]);
        a.puzzle.seq.forEach((p, i) => {
          expect(p).toBeGreaterThanOrEqual(0);
          expect(p).toBeLessThan(PADS);
          if (i >= 2) expect(p === a.puzzle.seq[i - 1] && p === a.puzzle.seq[i - 2]).toBe(false);
        });
      }
    }
  });

  it("never flashes faster than 2 Hz", () => {
    const g = generate(createRng("hz"), "expert").puzzle;
    expect(g.stepMs).toBeGreaterThanOrEqual(500);
    expect(1000 / g.stepMs).toBeLessThanOrEqual(2);
    expect(g.stepMs - g.onMs).toBeGreaterThanOrEqual(250);
  });

  it("grades harder difficulties higher", () => {
    const gs = ["easy", "medium", "hard", "expert"].map((d) => generate(createRng("g"), d as Difficulty).grade);
    for (let i = 1; i < gs.length; i++) expect(gs[i]).toBeGreaterThan(gs[i - 1]);
    expect(grade(9, 999)).toBe(100);
    expect(padName(2)).toBe("square");
  });
});

describe("echo verify", () => {
  const g = generate(createRng("verify"), "medium");
  const p = g.puzzle;

  it("scores the longest sequence repeated", () => {
    expect(verify(p, null, run(p, 0))).toEqual({ ok: true, progress: 0, score: 0 });
    const v = verify(p, null, run(p, 5));
    expect(v.ok).toBe(true);
    expect(v.score).toBe(p.start + 4);
    expect(verify(p, null, run(p, 3, "idle")).score).toBe(p.start + 2);
    expect(logic.progress(p, null, run(p, 5))).toBeCloseTo((p.start + 4) / p.seq.length);
  });

  it("accepts a maxed out sequence", () => {
    const all = run(p, p.seq.length - p.start + 1, "none");
    expect(verify(p, null, all)).toEqual({ ok: true, progress: 1, score: p.seq.length });
  });

  it("rejects an unfinished run", () => {
    expect(verify(p, null, run(p, 4, "none")).reason).toBe("run not finished");
  });

  it("rejects near misses: taps after a wrong pad, wrong mid-run, skipped rounds", () => {
    const s = run(p, 4);
    const last = s.rounds[s.rounds.length - 1];
    const extra = { rounds: [...s.rounds.slice(0, -1), { taps: [...last.taps, [p.seq[0], 99999]] as [number, number][] }] };
    expect(verify(p, null, extra).ok).toBe(false);
    const mid = run(p, 4, "none");
    mid.rounds[1].taps[0] = [(p.seq[0] + 1) % PADS, mid.rounds[1].taps[0][1]];
    expect(verify(p, null, mid).reason).toBe("taps after a wrong pad");
    const short = run(p, 4, "none");
    short.rounds[1].taps.pop();
    expect(verify(p, null, short).reason).toBe("round left unfinished");
  });

  it("checks timings against the human floor and the idle limit", () => {
    expect(verify(p, null, run(p, 4, "wrong", 60)).reason).toBe("faster than the human floor");
    expect(verify(p, null, run(p, 4, "wrong", IDLE_MS + 1)).reason).toBe("gap longer than the idle limit");
    const backwards = run(p, 2);
    backwards.rounds[1].taps = backwards.rounds[1].taps.map(([pad], i) => [pad, 1000 - i * 200]);
    expect(verify(p, null, backwards).ok).toBe(false);
  });

  it("rejects malformed input and tampered schedules", () => {
    expect(verify(p, null, null as never).ok).toBe(false);
    expect(verify(p, null, { rounds: "x" } as never).ok).toBe(false);
    expect(verify(p, null, { rounds: [null] } as never).ok).toBe(false);
    expect(verify(p, null, { rounds: [{ taps: [[7, 300]] }] } as never).reason).toBe("malformed tap");
    expect(verify(p, null, { rounds: [{ taps: [[0]] }] } as never).reason).toBe("malformed tap");
    expect(verify(p, null, { rounds: [{ taps: [[0, 1.5]] }] } as never).reason).toBe("malformed time");
    const tooMany = { rounds: [{ taps: p.seq.slice(0, p.start + 1).map((x, i) => [x, (i + 1) * 300]) }] } as EchoState;
    expect(verify(p, null, tooMany).reason).toBe("malformed round");
    const beyond = run(p, p.seq.length - p.start + 2, "none");
    expect(verify(p, null, beyond).reason).toBe("more rounds than steps");
    expect(verify({ ...p, stepMs: 300 }, null, run(p, 1)).reason).toBe("flash rate above 2 Hz");
    expect(verify({ ...p, onMs: 400 }, null, run(p, 1)).reason).toBe("flash rate above 2 Hz");
    expect(logic.progress(p, null, null as never)).toBe(0);
  });

  it("shared reflex helpers", () => {
    expect(checkTapTimes([100, 250, 400])).toBeNull();
    expect(checkTapTimes(["x"])).toBe("malformed time");
    expect(checkTapTimes([-5])).toBe("malformed time");
    expect(stdev([])).toBe(0);
    expect(stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
    expect(FLASH_PERIOD_MS).toBe(500);
  });
});
