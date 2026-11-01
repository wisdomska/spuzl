import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, {
  accuracyFor,
  ACCURACY_MAX,
  generate,
  GOAL_POINTS,
  KICKS,
  meterAt,
  MIN_PERIOD_MS,
  PERIODS_FOR,
  replayKick,
  shoot,
  STEP_MS,
  tally,
  verify,
  zoneOf,
  type KickInput,
  type PenaltyPuzzle,
} from "./logic";

const D: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];

/** First tap time at or after `from` where the meter reads closest to `value` (brute force, like a careful human). */
function timeFor(period: number, value: number, from = 100, stepped = false) {
  let best = from;
  for (let t = from; t < from + period; t++)
    if (Math.abs(meterAt(t, period, stepped) - value) < Math.abs(meterAt(best, period, stepped) - value)) best = t;
  return best;
}
/** A kick aimed at `aim` with `power`, both taps past the human floor. */
function kick(p: PenaltyPuzzle, i: number, aim: number, power: number, stepped = false): KickInput {
  const k = p.kicks[i];
  return { aimAt: timeFor(k.aimPeriod, aim, 100, stepped), powerAt: timeFor(k.powerPeriod, power, 100, stepped), stepped };
}
/** A corner away from the keeper. */
const goalAim = (dive: number) => (dive === 0 ? 85 : 15);

describe("penalty meters", () => {
  it("sweeps 0 -> 100 -> 0 with integer values", () => {
    expect(meterAt(0, 2000)).toBe(0);
    expect(meterAt(500, 2000)).toBe(50);
    expect(meterAt(1000, 2000)).toBe(100);
    expect(meterAt(1500, 2000)).toBe(50);
    expect(meterAt(2000, 2000)).toBe(0);
    expect(meterAt(2500, 2000)).toBe(50);
    for (let t = 0; t < 5000; t += 7) {
      const v = meterAt(t, 1640);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("holds each value for a whole step with reduced motion", () => {
    for (let t = 0; t < 4000; t += 13) expect(meterAt(t, 2000, true)).toBe(meterAt(t - (t % STEP_MS), 2000));
  });

  it("maps aim to zones and scores accuracy at the sweet spots", () => {
    expect([zoneOf(10), zoneOf(50), zoneOf(90)]).toEqual([0, 1, 2]);
    expect(accuracyFor(15, 75)).toBe(2 * ACCURACY_MAX);
    expect(accuracyFor(85, 75)).toBe(2 * ACCURACY_MAX);
    expect(accuracyFor(50, 20)).toBe(0);
    expect(shoot(2, 70, 1, 20).result).toBe("wide");
    expect(shoot(15, 95, 2, 20).result).toBe("over");
    expect(shoot(15, 10, 2, 20).result).toBe("saved");
    expect(shoot(15, 70, 0, 20).result).toBe("saved");
    expect(shoot(15, 75, 2, 20)).toEqual({ result: "goal", zone: 0, accuracy: 100, points: GOAL_POINTS + 100 });
  });
});

describe("penalty generation", () => {
  it("is deterministic, in range and never sweeps faster than the minimum", () => {
    for (const d of D) {
      const dives = new Set<number>();
      for (let s = 0; s < 25; s++) {
        const g = generate(createRng(`pk:${d}:${s}`), d);
        expect(generate(createRng(`pk:${d}:${s}`), d)).toEqual(g);
        expect(g.puzzle.kicks).toHaveLength(KICKS);
        for (const k of g.puzzle.kicks) {
          expect(k.aimPeriod % 2).toBe(0);
          expect(k.aimPeriod).toBeGreaterThanOrEqual(Math.max(MIN_PERIOD_MS, PERIODS_FOR[d].aim[0]));
          expect(k.aimPeriod).toBeLessThanOrEqual(PERIODS_FOR[d].aim[1]);
          expect(k.powerPeriod).toBeGreaterThanOrEqual(Math.max(MIN_PERIOD_MS, PERIODS_FOR[d].power[0]));
          expect(k.powerPeriod).toBeLessThanOrEqual(PERIODS_FOR[d].power[1]);
          dives.add(k.dive);
        }
      }
      expect([...dives].sort()).toEqual([0, 1, 2]);
    }
  });

  it("grades faster meters as harder", () => {
    const gs = D.map((d) => generate(createRng("g"), d).grade);
    for (let i = 1; i < gs.length; i++) expect(gs[i]).toBeGreaterThan(gs[i - 1]);
  });
});

describe("penalty verify", () => {
  it("scores five perfect corners away from the keeper, every seed and difficulty", () => {
    for (const d of D) {
      for (let s = 0; s < 20; s++) {
        const p = generate(createRng(`pv:${d}:${s}`), d).puzzle;
        const kicks = p.kicks.map((k, i) => kick(p, i, goalAim(k.dive), 75));
        const v = verify(p, null, { kicks });
        expect(v.ok).toBe(true);
        expect(v.score).toBe(KICKS * (GOAL_POINTS + 2 * ACCURACY_MAX));
        // Reduced motion: the stepped meter is read at the step the player saw, and the same corners still score.
        const stepped = p.kicks.map((k, i) => kick(p, i, goalAim(k.dive), 75, true));
        const t = tally(p, { kicks: stepped });
        expect(t.ok).toBe(true);
        expect(t.goals).toBe(KICKS);
        stepped.forEach((k, i) => {
          expect(t.outcomes[i].aim).toBe(meterAt(k.aimAt!, p.kicks[i].aimPeriod, true));
          expect(t.outcomes[i].power).toBe(meterAt(k.powerAt!, p.kicks[i].powerPeriod, true));
        });
      }
    }
  });

  it("ranks goals above accuracy and counts misses as nothing", () => {
    const p = generate(createRng("rank"), "medium").puzzle;
    const sloppy = p.kicks.map((k, i) => kick(p, i, goalAim(k.dive) === 15 ? 30 : 70, 55));
    const sharp = p.kicks.map((k, i) => (i === 0 ? kick(p, i, 50, 99) : kick(p, i, goalAim(k.dive), 75)));
    const a = tally(p, { kicks: sloppy });
    const b = tally(p, { kicks: sharp });
    expect(a.goals).toBe(5);
    expect(b.goals).toBe(4);
    expect(b.outcomes[0].result).toBe("over");
    expect(a.score).toBeGreaterThan(b.score);
  });

  it("counts timeouts as misses", () => {
    const p = generate(createRng("to"), "easy").puzzle;
    const kicks: KickInput[] = p.kicks.map((k, i) => kick(p, i, goalAim(k.dive), 75));
    kicks[0] = { aimAt: null, powerAt: null };
    kicks[1] = { aimAt: kicks[1].aimAt, powerAt: null };
    const t = tally(p, { kicks });
    expect(t.outcomes.slice(0, 2).map((o) => o.result)).toEqual(["timeout", "timeout"]);
    expect(t.goals).toBe(3);
    expect(verify(p, null, { kicks }).ok).toBe(true);
  });

  it("derives the result from the taps, not from anything the client claims", () => {
    const p = generate(createRng("claim"), "hard").puzzle;
    const k = p.kicks[0];
    const at = { aimAt: timeFor(k.aimPeriod, goalAim(k.dive)), powerAt: timeFor(k.powerPeriod, 75) };
    const forged = { ...at, result: "goal", points: 99999 } as unknown as KickInput;
    expect(replayKick(p, 0, forged)).toEqual(replayKick(p, 0, at));
    // Shifting a tap by a quarter period lands somewhere else on the meter.
    const moved = replayKick(p, 0, { ...at, aimAt: at.aimAt + k.aimPeriod / 4 });
    expect(typeof moved !== "string" && moved.aim).not.toBe(goalAim(k.dive));
  });

  it("rejects taps under the human floor, late taps and malformed input", () => {
    const p = generate(createRng("bad"), "medium").puzzle;
    const good = p.kicks.map((k, i) => kick(p, i, goalAim(k.dive), 75));
    const withKick = (i: number, k: unknown) => ({ kicks: good.map((x, j) => (j === i ? k : x)) as KickInput[] });
    expect(verify(p, null, withKick(0, { aimAt: 60, powerAt: 500 })).reason).toBe("faster than the human floor");
    expect(verify(p, null, withKick(0, { aimAt: 600, powerAt: 40 })).reason).toBe("faster than the human floor");
    expect(verify(p, null, withKick(0, { aimAt: 7000, powerAt: 1500 })).reason).toBe("tap after the kick timed out");
    expect(verify(p, null, withKick(0, { aimAt: 9000, powerAt: null })).reason).toBe("tap after the kick timed out");
    expect(verify(p, null, withKick(0, { aimAt: null, powerAt: 400 })).reason).toBe("power set before aim");
    expect(verify(p, null, withKick(0, { aimAt: 1.5, powerAt: 400 })).reason).toBe("malformed tap time");
    expect(verify(p, null, withKick(0, { aimAt: -200, powerAt: 400 })).reason).toBe("malformed tap time");
    expect(verify(p, null, withKick(0, { aimAt: 400, powerAt: 400, stepped: "yes" })).reason).toBe("malformed kick");
    expect(verify(p, null, withKick(0, null)).reason).toBe("malformed kick");
    expect(verify(p, null, null as never).ok).toBe(false);
    expect(verify(p, null, { kicks: [...good, good[0]] }).reason).toBe("malformed state");
    expect(verify(p, null, { kicks: good.slice(0, 3) }).reason).toBe("kicks left");
    expect(logic.progress(p, null, { kicks: good.slice(0, 2) })).toBeCloseTo(0.4);
  });

  it("rejects a tampered schedule with meters faster than the minimum", () => {
    const p = generate(createRng("fast"), "easy").puzzle;
    const fast = { ...p, kicks: p.kicks.map((k, i) => (i === 2 ? { ...k, aimPeriod: 400 } : k)) };
    expect(verify(fast, null, { kicks: [] }).reason).toBe("meters too fast");
  });
});
