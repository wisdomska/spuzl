import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, {
  classify,
  DELAY_FOR,
  FALSE_START_PENALTY,
  generate,
  grade,
  MIN_DELAY_MS,
  pointsFor,
  ROUNDS,
  tally,
  verify,
  WINDOW_MS,
  type FlinchPuzzle,
  type FlinchRound,
} from "./logic";

const D: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];
const valid = (p: FlinchPuzzle, i: number, reaction: number): FlinchRound => ({ tapAt: p.delays[i] + reaction, reaction });
const human = [231, 264, 198, 305, 247];

describe("flinch generation", () => {
  it("is deterministic and keeps every wait in range and slower than 2 Hz", () => {
    for (const d of D) {
      for (let k = 0; k < 20; k++) {
        const g = generate(createRng(`fl:${d}:${k}`), d);
        expect(generate(createRng(`fl:${d}:${k}`), d)).toEqual(g);
        expect(g.puzzle.delays).toHaveLength(ROUNDS);
        for (const x of g.puzzle.delays) {
          expect(x).toBeGreaterThanOrEqual(Math.max(MIN_DELAY_MS, DELAY_FOR[d][0]));
          expect(x).toBeLessThanOrEqual(DELAY_FOR[d][1]);
          expect(1000 / x).toBeLessThan(2);
        }
      }
    }
  });

  it("grades wider waits as harder", () => {
    const gs = D.map((d) => generate(createRng("g"), d).grade);
    for (let i = 1; i < gs.length; i++) expect(gs[i]).toBeGreaterThan(gs[i - 1]);
    expect(grade(1e6)).toBe(100);
  });
});

describe("flinch verify", () => {
  const p = generate(createRng("v"), "medium").puzzle;

  it("scores a human run from the schedule", () => {
    const rounds = human.map((r, i) => valid(p, i, r));
    const v = verify(p, null, { rounds });
    expect(v.ok).toBe(true);
    expect(v.score).toBe(human.reduce((a, r) => a + pointsFor(r), 0));
    expect(tally(p, { rounds }).best).toBe(198);
  });

  it("penalises false starts and gives nothing for timeouts", () => {
    const rounds: FlinchRound[] = human.map((r, i) => valid(p, i, r));
    rounds[1] = { tapAt: p.delays[1] - 300, reaction: null };
    rounds[2] = { tapAt: p.delays[2] + 40, reaction: null }; // under the floor counts as early
    rounds[3] = { tapAt: null, reaction: null };
    const t = tally(p, { rounds });
    expect(t.early).toBe(2);
    expect(t.score).toBe(pointsFor(231) + pointsFor(247) - 2 * FALSE_START_PENALTY);
    const allEarly = { rounds: p.delays.map((d) => ({ tapAt: d - 500, reaction: null })) };
    expect(verify(p, null, allEarly).score).toBe(0);
  });

  it("classifies taps", () => {
    expect(classify(2000, 1999)).toBe("early");
    expect(classify(2000, 2099)).toBe("early");
    expect(classify(2000, 2100)).toBe("valid");
    expect(classify(2000, 2000 + WINDOW_MS + 1)).toBe("timeout");
    expect(classify(2000, null)).toBe("timeout");
  });

  it("rejects reactions under the human floor and ones that disagree with the schedule", () => {
    const rounds = human.map((r, i) => valid(p, i, r));
    rounds[0] = { tapAt: p.delays[0] + 60, reaction: 60 };
    expect(verify(p, null, { rounds }).reason).toBe("faster than the human floor");
    rounds[0] = { tapAt: p.delays[0] + 300, reaction: 150 };
    expect(verify(p, null, { rounds }).reason).toBe("reaction does not match the schedule");
    rounds[0] = { tapAt: p.delays[0] - 400, reaction: 200 };
    expect(verify(p, null, { rounds }).reason).toBe("reaction does not match the schedule");
  });

  it("rejects scripted, too consistent reactions", () => {
    const rounds = [180, 181, 180, 182, 181].map((r, i) => valid(p, i, r));
    expect(verify(p, null, { rounds }).reason).toBe("reactions too consistent");
  });

  it("rejects malformed input, unfinished runs and tampered schedules", () => {
    expect(verify(p, null, { rounds: human.slice(0, 3).map((r, i) => valid(p, i, r)) }).reason).toBe("rounds left");
    expect(verify(p, null, null as never).ok).toBe(false);
    expect(verify(p, null, { rounds: Array(6).fill({ tapAt: null, reaction: null }) }).ok).toBe(false);
    expect(verify(p, null, { rounds: [null] } as never).reason).toBe("malformed round");
    expect(verify(p, null, { rounds: [{ tapAt: 1.5, reaction: null }] }).reason).toBe("malformed tap time");
    expect(verify(p, null, { rounds: [{ tapAt: -1, reaction: null }] }).reason).toBe("malformed tap time");
    expect(verify(p, null, { rounds: [{ tapAt: 5000, reaction: 2.5 }] }).reason).toBe("malformed reaction");
    expect(verify({ ...p, delays: [200, 3000, 3000, 3000, 3000] }, null, { rounds: [] }).reason).toBe("schedule changes too fast");
    expect(logic.progress(p, null, { rounds: [valid(p, 0, 250)] })).toBeCloseTo(0.2);
  });
});
