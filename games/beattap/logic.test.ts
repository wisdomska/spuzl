import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import logic, {
  generate,
  GOOD_MS,
  judge,
  LEAD_MS,
  MIN_GAP_MS,
  PATTERN_FOR,
  PERFECT_MS,
  POINTS,
  songEnd,
  STRAY_PENALTY,
  verify,
  type BeatPuzzle,
} from "./logic";

const D: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];
/** A human-ish wobble around each beat: -25..+25 ms, never a flat line. */
const wobble = (i: number) => ((i * 37) % 51) - 25;
const human = (p: BeatPuzzle) => p.beats.map((b, i) => b + wobble(i));

describe("beat tap generation", () => {
  it("is deterministic, starts after the lead in and never pulses faster than 2 Hz", () => {
    for (const d of D) {
      for (let s = 0; s < 25; s++) {
        const g = generate(createRng(`bt:${d}:${s}`), d);
        expect(generate(createRng(`bt:${d}:${s}`), d)).toEqual(g);
        const { beats } = g.puzzle;
        expect(beats).toHaveLength(PATTERN_FOR[d].count);
        expect(beats[0]).toBe(LEAD_MS);
        for (let i = 1; i < beats.length; i++) {
          expect(beats[i] - beats[i - 1]).toBeGreaterThanOrEqual(MIN_GAP_MS);
          expect(1000 / (beats[i] - beats[i - 1])).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it("grades longer, more syncopated patterns as harder", () => {
    const gs = D.map((d) => generate(createRng("g"), d).grade);
    for (let i = 1; i < gs.length; i++) expect(gs[i]).toBeGreaterThan(gs[i - 1]);
  });
});

describe("beat tap judge", () => {
  const beats = [2000, 2500, 3000, 4000];

  it("judges by timing window", () => {
    const j = judge(beats, [2000 + PERFECT_MS, 2500 - GOOD_MS, 3000 + GOOD_MS + 1]);
    expect(j.marks).toEqual(["perfect", "good", "miss", "miss"]);
    expect(j.offsets).toEqual([PERFECT_MS, -GOOD_MS, null, null]);
    expect(j.strays).toBe(1);
    expect(j.score).toBe(POINTS.perfect + POINTS.good - STRAY_PENALTY);
  });

  it("matches each beat once and turns extra taps into strays", () => {
    const j = judge(beats, [1990, 2030, 2600, 3500]);
    expect(j.tapBeat).toEqual([0, -1, 1, -1]);
    expect(j.marks).toEqual(["perfect", "good", "miss", "miss"]);
  });

  it("never pays for tapping all the time", () => {
    const p = generate(createRng("spam"), "medium").puzzle;
    const spam = Array.from({ length: Math.floor(songEnd(p) / 100) }, (_, i) => 100 * (i + 1));
    const v = verify(p, null, { taps: spam, done: true });
    expect(v.ok).toBe(true);
    expect(v.score!).toBeLessThan(verify(p, null, { taps: human(p).slice(0, 4), done: true }).score!);
  });
});

describe("beat tap verify", () => {
  it("scores a human run from the shared judge on every seed and difficulty", () => {
    for (const d of D) {
      for (let s = 0; s < 20; s++) {
        const p = generate(createRng(`bv:${d}:${s}`), d).puzzle;
        const taps = human(p);
        const v = verify(p, null, { taps, done: true });
        expect(v.ok).toBe(true);
        expect(v.score).toBe(judge(p.beats, taps).score);
        expect(v.score).toBeGreaterThan(p.beats.length * POINTS.good);
        // Shifting every tap 200 ms early misses the whole song.
        expect(verify(p, null, { taps: taps.map((t) => t - 200), done: true }).score).toBe(0);
      }
    }
  });

  it("counts silence as all misses and needs the song to finish", () => {
    const p = generate(createRng("quiet"), "easy").puzzle;
    expect(verify(p, null, { taps: [], done: true })).toMatchObject({ ok: true, score: 0 });
    const half = human(p).slice(0, 8);
    const v = verify(p, null, { taps: half, done: false });
    expect(v.reason).toBe("song not finished");
    expect(v.progress).toBeCloseTo(8 / p.beats.length);
    expect(logic.progress(p, null, { taps: half, done: false })).toBeCloseTo(8 / p.beats.length);
  });

  it("rejects scripted, malformed and impossible taps", () => {
    const p = generate(createRng("bad"), "hard").puzzle;
    expect(verify(p, null, { taps: p.beats, done: true }).reason).toBe("taps too consistent");
    expect(verify(p, null, { taps: [2000, 2050], done: true }).reason).toBe("faster than the human floor");
    expect(verify(p, null, { taps: [50], done: true }).reason).toBe("faster than the human floor");
    expect(verify(p, null, { taps: [2000, 1900], done: true }).ok).toBe(false);
    expect(verify(p, null, { taps: [2000.5], done: true }).reason).toBe("malformed time");
    expect(verify(p, null, { taps: [songEnd(p) + 1], done: true }).reason).toBe("tap after the song ended");
    expect(verify(p, null, { taps: [] } as never).reason).toBe("malformed state");
    expect(verify(p, null, null as never).ok).toBe(false);
  });

  it("rejects a tampered pattern or widened windows", () => {
    const p = generate(createRng("tamper"), "easy").puzzle;
    expect(verify({ ...p, goodMs: 400 }, null, { taps: [], done: true }).reason).toBe("windows do not match");
    const fast = [...p.beats];
    fast[3] = fast[2] + 200;
    expect(verify({ ...p, beats: fast }, null, { taps: [], done: true }).reason).toBe("pulse rate above 2 Hz");
  });
});
