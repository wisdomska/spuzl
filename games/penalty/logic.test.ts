import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { PRACTICE, type GuessContext } from "@/games/_shared/guess";
import { checkGuessWith, finalVerdict } from "@/lib/game/guess-check";
import logic, {
  accuracyFor,
  ACCURACY_MAX,
  audit,
  checkGuess,
  contentCount,
  generate,
  generateAt,
  GOAL_POINTS,
  KICKS,
  meterAt,
  MIN_PERIOD_MS,
  MIN_SPREAD_MS,
  PERIODS_FOR,
  readKick,
  replayKick,
  shoot,
  STEP_MS,
  suspect,
  sweetOffset,
  tally,
  verify,
  zoneOf,
  type KickInput,
  type PenaltyGuess,
  type PenaltyPuzzle,
  type PenaltySolution,
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
/** Five perfect corners away from the keeper. */
const perfect = (p: PenaltyPuzzle, s: PenaltySolution) => p.kicks.map((_, i) => kick(p, i, goalAim(s.dives[i]), 75));
/** Sweet-spot moments on a 2000 ms meter: aim 15 at 150 ms, power 75 at 750 ms (scaled by each kick's period). */
const AIM_TIME = 150;
const POWER_TIME = 750;
const attempt = (log: unknown[]): GuessContext => ({ kind: "attempt", state: null, log });

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
  it("is deterministic, in range, never sweeps faster than the minimum, and keeps the dives out of the puzzle", () => {
    for (const d of D) {
      const dives = new Set<number>();
      for (let s = 0; s < 25; s++) {
        const g = generate(createRng(`pk:${d}:${s}`), d);
        expect(generate(createRng(`pk:${d}:${s}`), d)).toEqual(g);
        expect(generateAt(g.puzzle.ref.i, d)).toEqual(g);
        expect(g.puzzle.ref).toMatchObject({ game: "penalty", d });
        expect(g.puzzle.kicks).toHaveLength(KICKS);
        expect(g.solution.dives).toHaveLength(KICKS);
        expect(JSON.stringify(g.puzzle)).not.toMatch(/dive/);
        for (const k of g.puzzle.kicks) {
          expect(k.aimPeriod % 2).toBe(0);
          expect(k.aimPeriod).toBeGreaterThanOrEqual(Math.max(MIN_PERIOD_MS, PERIODS_FOR[d].aim[0]));
          expect(k.aimPeriod).toBeLessThanOrEqual(PERIODS_FOR[d].aim[1]);
          expect(k.powerPeriod).toBeGreaterThanOrEqual(Math.max(MIN_PERIOD_MS, PERIODS_FOR[d].power[0]));
          expect(k.powerPeriod).toBeLessThanOrEqual(PERIODS_FOR[d].power[1]);
        }
        g.solution.dives.forEach((x) => dives.add(x));
      }
      expect([...dives].sort()).toEqual([0, 1, 2]);
    }
    // indices wrap like a content game's
    expect(generateAt(contentCount + 3, "easy")).toEqual(generateAt(3, "easy"));
    expect(generateAt(-1, "easy").puzzle.ref.i).toBe(contentCount - 1);
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
        const { puzzle: p, solution: sol } = generate(createRng(`pv:${d}:${s}`), d);
        const v = verify(p, sol, { kicks: perfect(p, sol) });
        expect(v.ok).toBe(true);
        expect(v.score).toBe(KICKS * (GOAL_POINTS + 2 * ACCURACY_MAX));
        // Reduced motion: the stepped meter is read at the step the player saw, and the same corners still score.
        const stepped = p.kicks.map((_, i) => kick(p, i, goalAim(sol.dives[i]), 75, true));
        const t = tally(p, sol, { kicks: stepped });
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
    const { puzzle: p, solution: sol } = generate(createRng("rank"), "medium");
    const sloppy = p.kicks.map((_, i) => kick(p, i, goalAim(sol.dives[i]) === 15 ? 30 : 70, 55));
    const sharp = p.kicks.map((_, i) => (i === 0 ? kick(p, i, 50, 99) : kick(p, i, goalAim(sol.dives[i]), 75)));
    const a = tally(p, sol, { kicks: sloppy });
    const b = tally(p, sol, { kicks: sharp });
    expect(a.goals).toBe(5);
    expect(b.goals).toBe(4);
    expect(b.outcomes[0].result).toBe("over");
    expect(a.score).toBeGreaterThan(b.score);
  });

  it("counts timeouts as misses", () => {
    const { puzzle: p, solution: sol } = generate(createRng("to"), "easy");
    const kicks = perfect(p, sol);
    kicks[0] = { aimAt: null, powerAt: null };
    kicks[1] = { aimAt: kicks[1].aimAt, powerAt: null };
    const t = tally(p, sol, { kicks });
    expect(t.outcomes.slice(0, 2).map((o) => o.result)).toEqual(["timeout", "timeout"]);
    expect(t.goals).toBe(3);
    expect(verify(p, sol, { kicks }).ok).toBe(true);
  });

  it("derives the result from the taps, not from anything the client claims", () => {
    const { puzzle: p, solution: sol } = generate(createRng("claim"), "hard");
    const k = p.kicks[0];
    const at = { aimAt: timeFor(k.aimPeriod, goalAim(sol.dives[0])), powerAt: timeFor(k.powerPeriod, 75) };
    const forged = { ...at, result: "goal", points: 99999 } as unknown as KickInput;
    expect(replayKick(p, sol, 0, forged)).toEqual(replayKick(p, sol, 0, at));
    // Shifting a tap by a quarter period lands somewhere else on the meter.
    const moved = replayKick(p, sol, 0, { ...at, aimAt: at.aimAt + k.aimPeriod / 4 });
    expect(typeof moved !== "string" && moved.aim).not.toBe(goalAim(sol.dives[0]));
    // no keeper (a missing solution) never scores
    expect(replayKick(p, { dives: [] }, 0, at)).toBe("no keeper for this kick");
  });

  it("rejects taps under the human floor, late taps and malformed input", () => {
    const { puzzle: p, solution: sol } = generate(createRng("bad"), "medium");
    const good = perfect(p, sol);
    const withKick = (i: number, k: unknown) => ({ kicks: good.map((x, j) => (j === i ? k : x)) as KickInput[] });
    expect(verify(p, sol, withKick(0, { aimAt: 60, powerAt: 500 })).reason).toBe("faster than the human floor");
    expect(verify(p, sol, withKick(0, { aimAt: 600, powerAt: 40 })).reason).toBe("faster than the human floor");
    expect(verify(p, sol, withKick(0, { aimAt: 7000, powerAt: 1500 })).reason).toBe("tap after the kick timed out");
    expect(verify(p, sol, withKick(0, { aimAt: 9000, powerAt: null })).reason).toBe("tap after the kick timed out");
    expect(verify(p, sol, withKick(0, { aimAt: null, powerAt: 400 })).reason).toBe("power set before aim");
    expect(verify(p, sol, withKick(0, { aimAt: 1.5, powerAt: 400 })).reason).toBe("malformed tap time");
    expect(verify(p, sol, withKick(0, { aimAt: -200, powerAt: 400 })).reason).toBe("malformed tap time");
    expect(verify(p, sol, withKick(0, { aimAt: 400, powerAt: 400, stepped: "yes" })).reason).toBe("malformed kick");
    expect(verify(p, sol, withKick(0, null)).reason).toBe("malformed kick");
    expect(verify(p, sol, null as never).ok).toBe(false);
    expect(verify(p, sol, { kicks: [...good, good[0]] }).reason).toBe("malformed state");
    expect(verify(p, sol, { kicks: good.slice(0, 3) }).reason).toBe("kicks left");
    expect(logic.progress(p, sol, { kicks: good.slice(0, 2) })).toBeCloseTo(0.4);
    expect(readKick(p, 9, good[0])).toBe("malformed kick");
  });

  it("rejects a tampered schedule with meters faster than the minimum", () => {
    const { puzzle: p, solution: sol } = generate(createRng("fast"), "easy");
    const fast = { ...p, kicks: p.kicks.map((k, i) => (i === 2 ? { ...k, aimPeriod: 400 } : k)) };
    expect(verify(fast, sol, { kicks: [] }).reason).toBe("meters too fast");
  });
});

describe("penalty keeper stays on the server", () => {
  it("answers a committed shot with the dive, refuses a bare reference, and never needs the keeper for a timeout", () => {
    const { puzzle: p, solution: sol } = generateAt(77, "medium");
    const shot: PenaltyGuess = { kick: 0, input: kick(p, 0, 15, 75) };
    const want = replayKick(p, sol, 0, shot.input);
    expect(checkGuess(p, sol, shot, PRACTICE)).toEqual({ ok: true, outcome: want, dive: sol.dives[0] });
    expect(checkGuess(p, sol, shot)).toEqual({ ok: false, refused: true });
    expect(checkGuess(p, sol, { kick: 0, input: { aimAt: null, powerAt: null } }, PRACTICE)).toEqual({ ok: false, invalid: true });
    expect(checkGuess(p, sol, { kick: 0, input: { aimAt: 500, powerAt: null } }, PRACTICE)).toEqual({ ok: false, invalid: true });
    expect(checkGuess(p, sol, { kick: 0, input: { aimAt: 50, powerAt: 500 } }, PRACTICE)).toEqual({ ok: false, invalid: true });
    expect(checkGuess(p, sol, { kick: 5, input: shot.input }, PRACTICE)).toEqual({ ok: false, invalid: true });
    expect(checkGuess(p, sol, { kick: 1.5, input: shot.input }, PRACTICE)).toEqual({ ok: false, invalid: true });
    expect(checkGuess(p, sol, null as never, PRACTICE)).toEqual({ ok: false, invalid: true });
  });

  it("keeps each shot on the attempt before answering: no take-backs, no going back, a resume is answered again", () => {
    const { puzzle: p, solution: sol } = generateAt(123, "hard");
    let log: unknown[] = [];
    const send = (g: PenaltyGuess) => {
      const out = checkGuessWith(logic, p, sol, g, attempt(log), 1000 + log.length);
      if (out.entry) log = [...log, out.entry];
      return out.result;
    };
    const k0 = kick(p, 0, 15, 75);
    expect(send({ kick: 0, input: k0 })).toMatchObject({ ok: true, dive: sol.dives[0] });
    expect(log).toEqual([{ kick: 0, aimAt: k0.aimAt, powerAt: k0.powerAt, stepped: false, t: 1000 }]);
    // the same taps again (a resume): answered, not logged twice
    expect(send({ kick: 0, input: k0 })).toMatchObject({ ok: true });
    expect(log).toHaveLength(1);
    // a different shot on a kick already answered: refused
    expect(send({ kick: 0, input: kick(p, 0, 85, 75) })).toEqual({ ok: false, refused: true });
    // kick 1 times out (no server call); kick 2 is shot; then nobody goes back to kick 1
    const k2 = kick(p, 2, 85, 70);
    expect(send({ kick: 2, input: k2 })).toMatchObject({ ok: true, dive: sol.dives[2] });
    expect(send({ kick: 1, input: kick(p, 1, 15, 75) })).toEqual({ ok: false, refused: true });
    expect(log).toHaveLength(2);
  });

  it("finish holds the state to the shots the server answered", () => {
    const { puzzle: p, solution: sol } = generateAt(5, "easy");
    const kicks = p.kicks.map((_, i) => kick(p, i, i % 2 ? 20 : 80, 60 + i));
    const log = kicks.map((k, i) => ({ kick: i, aimAt: k.aimAt, powerAt: k.powerAt, stepped: false, t: i }));
    const state = { kicks };
    expect(audit(p, sol, state, log)).toBeNull();
    expect(finalVerdict(logic, p, sol, state, log).verdict.ok).toBe(true);
    // never sent: the cheat that reads no dive but skips the server
    expect(audit(p, sol, state, log.slice(0, 4))).toBe("shot the server never saw");
    // changed after the dive was known
    const changed = { kicks: kicks.map((k, i) => (i === 3 ? kick(p, 3, goalAim(sol.dives[3]), 75) : k)) };
    if (JSON.stringify(changed.kicks[3]) !== JSON.stringify(kicks[3]))
      expect(audit(p, sol, changed, log)).toBe("shot changed after the keeper moved");
    // an answered shot turned into a timeout afterwards
    const dropped = { kicks: kicks.map((k, i) => (i === 1 ? { aimAt: null, powerAt: null } : k)) };
    expect(audit(p, sol, dropped, log)).toBe("answered shot missing from the state");
    expect(finalVerdict(logic, p, sol, dropped, log).verdict.ok).toBe(false);
    // timeouts need no log
    const allSlow = { kicks: kicks.map(() => ({ aimAt: null, powerAt: null })) };
    expect(audit(p, sol, allSlow, [])).toBeNull();
    expect(audit(p, sol, null as never, [])).toBeNull();
  });
});

describe("penalty bot check (tap spread)", () => {
  it("measures the distance from the nearest sweet-spot moment", () => {
    // period 2000: the meter reads 15 at 150 ms and 1850 ms, 85 at 850 and 1150, 75 at 750 and 1250
    expect(sweetOffset(150, 2000, [15, 85])).toBe(0);
    expect(sweetOffset(170, 2000, [15, 85])).toBe(20);
    expect(sweetOffset(2130, 2000, [15, 85])).toBe(-20);
    expect(sweetOffset(1840, 2000, [15, 85])).toBe(-10);
    expect(sweetOffset(760, 2000, [75])).toBe(10);
    expect(sweetOffset(1990, 2000, [15])).toBe(140);
  });

  it("flags machine-regular taps on the sweet spots, never a person's scatter", () => {
    const { puzzle: p, solution: sol } = generateAt(9, "medium");
    // exact sweet-spot taps (a script reading the meter)
    const exact = (off: number) =>
      p.kicks.map((k) => ({
        aimAt: Math.round((AIM_TIME * k.aimPeriod) / 2000) + off,
        powerAt: Math.round((POWER_TIME * k.powerPeriod) / 2000) + off,
      }));
    const bot = { kicks: exact(0) };
    expect(suspect(p, sol, bot)).toMatch(/too regular/);
    // a constant lag is just as regular
    expect(suspect(p, sol, { kicks: exact(37) })).toMatch(/too regular/);
    // a person: tens of ms of scatter around the same spots
    const rng = createRng("human");
    const human = {
      kicks: exact(0).map((k) => ({ aimAt: k.aimAt + rng.int(-60, 60), powerAt: k.powerAt + rng.int(-60, 60) })),
    };
    expect(suspect(p, sol, human)).toBeNull();
    // too few shots to judge
    expect(
      suspect(p, sol, { kicks: [...bot.kicks.slice(0, 3), { aimAt: null, powerAt: null }, { aimAt: null, powerAt: null }] }),
    ).toBeNull();
    expect(MIN_SPREAD_MS).toBeGreaterThan(0);
  });

  it("flags at finish without failing the clear", () => {
    const { puzzle: p, solution: sol } = generateAt(9, "medium");
    const kicks = p.kicks.map((k) => ({
      aimAt: Math.round((AIM_TIME * k.aimPeriod) / 2000),
      powerAt: Math.round((POWER_TIME * k.powerPeriod) / 2000),
    }));
    const log = kicks.map((k, i) => ({ kick: i, ...k, stepped: false }));
    const out = finalVerdict(logic, p, sol, { kicks }, log);
    expect(out.verdict.ok).toBe(true);
    expect(out.suspect).toMatch(/too regular/);
  });
});
