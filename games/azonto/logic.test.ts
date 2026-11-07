import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { FLASH_PERIOD_MS } from "@/games/_shared/reflex";
import { GAME_BY_ID } from "@/lib/catalog";
import { ARROW_NAME, MOVE_NAME } from "@/lib/copy/azonto";
import logic, { generate, practice, replay, SHAPE_FOR, suspect, verify } from "./logic";
import { COUNT_IN, IDLE_MS, MIN_RUN_MS, MOVE_DEFS, moveForKey, MOVES, type AzontoPuzzle, type AzontoState } from "./rules";

const D: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];

/** A run that repeats the first `rounds` rounds in full, with human, uneven gaps, then (optionally) a wrong move. */
function run(p: AzontoPuzzle, rounds: number, endWrong = true): AzontoState {
  const out: AzontoState["rounds"] = [];
  for (let r = 0; r < rounds; r++) {
    let ms = 0;
    out.push({ taps: p.seq.slice(0, p.start + r).map((m, k) => [m, (ms += 300 + ((k * 37 + r * 11) % 90))] as [number, number]) });
  }
  if (endWrong) {
    const n = p.start + rounds;
    const wrong = (p.seq[0] + 1) % MOVES;
    if (n <= p.seq.length) out.push({ taps: [[wrong, 400]] });
  }
  return { rounds: out };
}

describe("azonto moves (R2-P5)", () => {
  it("has four named moves, each with its own arrow, number key and shape", () => {
    expect(MOVE_DEFS).toHaveLength(MOVES);
    for (const k of ["arrow", "key", "shape", "id"] as const) expect(new Set(MOVE_DEFS.map((m) => m[k])).size).toBe(MOVES);
    for (const m of MOVE_DEFS) {
      expect(MOVE_NAME[m.id]).toBeTruthy();
      expect(ARROW_NAME[m.arrow]).toBeTruthy();
    }
    expect(Object.values(MOVE_NAME)).toEqual(["Iron", "Phone call", "Wash", "Boxing"]);
  });

  it("maps keys 1 to 4 and the arrows to moves, and nothing else", () => {
    expect(["1", "2", "3", "4"].map(moveForKey)).toEqual([0, 1, 2, 3]);
    expect(["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].map(moveForKey)).toEqual([0, 1, 2, 3]);
    for (const k of ["5", "a", "Enter", " ", "toString", "constructor"]) expect(moveForKey(k), k).toBeNull();
  });
});

describe("azonto generation", () => {
  it("is deterministic per seed, 20+ seeds per difficulty, beats never above 2 Hz, no move three times running", () => {
    for (const d of D)
      for (let k = 0; k < 20; k++) {
        const a = generate(createRng(`az:${d}:${k}`), d);
        expect(generate(createRng(`az:${d}:${k}`), d)).toEqual(a);
        const p = a.puzzle;
        expect(p.seq).toHaveLength(SHAPE_FOR[d].len);
        expect(p.beatMs).toBeGreaterThanOrEqual(FLASH_PERIOD_MS);
        expect(p.beatMs - p.onMs).toBeGreaterThanOrEqual(250);
        for (let i = 2; i < p.seq.length; i++) expect(p.seq[i] === p.seq[i - 1] && p.seq[i] === p.seq[i - 2]).toBe(false);
        expect(a.solution).toBeNull();
      }
    expect(generate(createRng("x"), "easy")).not.toEqual(generate(createRng("y"), "easy"));
  });

  it("grades harder difficulties higher", () => {
    const g = (d: Difficulty) => generate(createRng("g"), d).grade;
    expect(g("easy")).toBeLessThan(g("medium"));
    expect(g("medium")).toBeLessThan(g("hard"));
    expect(g("hard")).toBeLessThan(g("expert"));
  });

  it("the practice round shows every move once and clears in full", () => {
    const p = practice().puzzle;
    expect(practice()).toEqual(practice());
    expect([...p.seq].sort()).toEqual([0, 1, 2, 3]);
    expect(logic.practice).toBe(practice);
    expect(verify(p, null, run(p, p.seq.length - p.start + 1, false))).toMatchObject({ ok: true, score: p.seq.length });
  });

  it("the catalogue floor is the shortest honest run", () => {
    expect(GAME_BY_ID.azonto.minTimeMs).toBe(MIN_RUN_MS);
    const quickest = Math.min(...D.map((d) => SHAPE_FOR[d].beatMs));
    expect(COUNT_IN * quickest + quickest + 100).toBeGreaterThanOrEqual(MIN_RUN_MS);
  });
});

describe("azonto verify (the server's replay)", () => {
  const p = generate(createRng("az:verify"), "medium").puzzle;

  it("scores the longest sequence repeated once the run is over", () => {
    expect(verify(p, null, run(p, 3))).toEqual({ ok: true, progress: (p.start + 2) / p.seq.length, score: p.start + 2 });
    expect(verify(p, null, run(p, 0))).toMatchObject({ ok: true, score: 0 });
    // the whole dance
    expect(verify(p, null, run(p, p.seq.length - p.start + 1, false))).toMatchObject({ ok: true, score: p.seq.length });
  });

  it("an idle ending (an unfinished last round) is over too", () => {
    const s = run(p, 2, false);
    s.rounds.push({ taps: [[p.seq[0], 500]] });
    expect(verify(p, null, s)).toMatchObject({ ok: true, score: p.start + 1 });
  });

  it("a run still going does not count", () => {
    expect(verify(p, null, run(p, 2, false))).toMatchObject({ ok: false, reason: "run not finished" });
  });

  it("rejects forged logs: moves after a slip, wrong rounds, inhuman or idle times, bad moves", () => {
    const s = run(p, 2);
    s.rounds[1].taps[0] = [(p.seq[0] + 1) % MOVES, s.rounds[1].taps[0][1]];
    expect(verify(p, null, s).ok).toBe(false);
    const fast = run(p, 2);
    fast.rounds[1].taps[1][1] = fast.rounds[1].taps[0][1] + 40;
    expect(verify(p, null, fast).reason).toBe("faster than the human floor");
    const slow = run(p, 2);
    slow.rounds[0].taps[0][1] = IDLE_MS + 1;
    expect(verify(p, null, slow).ok).toBe(false);
    expect(verify(p, null, { rounds: [{ taps: [[7, 300]] }] }).reason).toBe("malformed move");
    expect(
      verify(p, null, { rounds: [{ taps: Array.from({ length: p.start + 1 }, (_, k) => [p.seq[k], 300 * (k + 1)]) }] } as never).ok,
    ).toBe(false);
    expect(verify(p, null, null as never).ok).toBe(false);
    // a demonstration faster than 2 Hz is refused whatever the log says
    expect(replay({ ...p, beatMs: 400 }, run(p, 1)).ok).toBe(false);
  });

  it("progress never runs ahead of what was repeated", () => {
    expect(logic.progress(p, null, run(p, 2, false))).toBeCloseTo((p.start + 1) / p.seq.length);
    expect(logic.progress(p, null, { rounds: [] })).toBe(0);
  });

  it("flags move timing too even for a person", () => {
    const even: AzontoState = { rounds: [] };
    for (let r = 0; r < 5; r++)
      even.rounds.push({ taps: p.seq.slice(0, p.start + r).map((m, k) => [m, 400 * (k + 1)] as [number, number]) });
    expect(suspect(p, null, even)).toMatch(/regular/);
    expect(suspect(p, null, run(p, 5))).toBeNull();
  });
});
