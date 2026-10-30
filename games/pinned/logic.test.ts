import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { unseal } from "@/games/_shared/cluecave";
import logic, { AFRICA_PER_DAY, contentCount, DAYS, distanceKm, generate, generateAt, gradeOf, hint, pointsFor, ROUNDS, score, sealKey, verify, type LatLon } from "./logic";
import { CONTENT, needsReview } from "./content";
import { LAND, ringPath, VIEWS } from "./geo";

const D: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];

describe("pinned content and geometry", () => {
  it("has unique landmarks inside their map, about a fifth or more on the Africa map", () => {
    expect(needsReview).toBe(true);
    expect(new Set(CONTENT.map((l) => l.name)).size).toBe(CONTENT.length);
    for (const l of CONTENT) {
      const v = VIEWS[l.map];
      expect(l.lat).toBeGreaterThanOrEqual(v.south);
      expect(l.lat).toBeLessThanOrEqual(v.north);
      expect(l.lon).toBeGreaterThanOrEqual(v.west);
      expect(l.lon).toBeLessThanOrEqual(v.east);
      expect(l.line).not.toMatch(/[–—]/);
    }
    expect(CONTENT.filter((l) => l.map === "africa").length / CONTENT.length).toBeGreaterThan(0.2);
  });

  it("draws closed rings in lon/lat range", () => {
    for (const r of LAND) {
      for (const [lon, lat] of r) {
        expect(Math.abs(lon)).toBeLessThanOrEqual(180);
        expect(Math.abs(lat)).toBeLessThanOrEqual(90);
      }
    }
    expect(ringPath([[0, 0], [1, 1]])).toBe("M0 0L1 -1Z");
  });
});

describe("pinned distance and points", () => {
  it("measures great-circle distance", () => {
    const accra: LatLon = [5.56, -0.2];
    const london: LatLon = [51.507, -0.128];
    expect(distanceKm(accra, london)) .toBeGreaterThan(5050);
    expect(distanceKm(accra, london)).toBeLessThan(5130);
    expect(distanceKm([0, 0], [0, 180])).toBeCloseTo(Math.PI * 6371, 0);
    expect(distanceKm(accra, accra)).toBe(0);
  });
  it("scores 1000 on the spot and fades with distance, faster on the Africa map", () => {
    expect(pointsFor(0, "world")).toBe(1000);
    expect(pointsFor(1500, "world")).toBe(368);
    expect(pointsFor(500, "africa")).toBeLessThan(pointsFor(500, "world"));
    expect(pointsFor(20000, "world")).toBe(0);
  });
});

describe("pinned generation", () => {
  it("is deterministic with one Africa round a day and no repeats on consecutive days", () => {
    expect(contentCount).toBe(DAYS);
    for (let i = 0; i < DAYS; i++) {
      const g = generateAt(i);
      expect(generateAt(i)).toEqual(g);
      expect(g.puzzle.rounds).toHaveLength(ROUNDS);
      expect(g.puzzle.rounds.filter((r) => r.map === "africa")).toHaveLength(AFRICA_PER_DAY);
      const next = new Set(generateAt(i + 1).puzzle.rounds.map((r) => r.name));
      expect(g.puzzle.rounds.some((r) => next.has(r.name))).toBe(false);
      g.puzzle.rounds.forEach((r, k) => {
        const l = CONTENT.find((x) => x.name === r.name)!;
        expect(g.solution.spots[k]).toEqual([l.lat, l.lon]);
      });
    }
  });

  it("seals the spots and keeps them out of plain text", () => {
    const g = generateAt(1);
    expect(unseal<LatLon[]>(g.puzzle.sealed, sealKey(g.puzzle.ref))).toEqual(g.solution.spots);
    expect(JSON.stringify(g.puzzle)).not.toContain(String(g.solution.spots[0][0]));
  });

  it("free play is deterministic and grades harder difficulties higher", () => {
    const avg: Record<string, number> = {};
    for (const d of D) {
      let t = 0;
      for (let k = 0; k < 30; k++) {
        const g = generate(createRng(`pn:${d}:${k}`), d);
        expect(generate(createRng(`pn:${d}:${k}`), d)).toEqual(g);
        t += g.grade;
      }
      avg[d] = t / 30;
    }
    expect(avg.easy).toBeLessThan(avg.medium);
    expect(avg.medium).toBeLessThan(avg.hard);
    expect(avg.hard).toBeLessThan(avg.expert);
    expect(gradeOf(CONTENT.slice(0, 5))).toBeGreaterThan(0);
  });
});

describe("pinned verify", () => {
  const g = generateAt(0);
  const p = g.puzzle;

  it("scores perfect pins at 1000 each and near pins a little less", () => {
    expect(verify(p, g.solution, { pins: g.solution.spots })).toEqual({ ok: true, progress: 1, score: 5000 });
    const near = g.solution.spots.map(([lat, lon]) => [lat + 0.5, lon] as LatLon);
    const v = verify(p, g.solution, { pins: near });
    expect(v.score).toBeLessThan(5000);
    expect(v.score).toBeGreaterThan(4000);
    const skipped = [null, ...g.solution.spots.slice(1)];
    expect(verify(p, g.solution, { pins: skipped }).score).toBe(4000);
    expect(score(p, g.solution, [])).toBe(0);
  });

  it("rejects malformed, off-map and unfinished pins", () => {
    expect(verify(p, g.solution, { pins: g.solution.spots.slice(0, 3) }).reason).toBe("rounds left");
    expect(verify(p, g.solution, { pins: [...g.solution.spots, [0, 0]] }).reason).toBe("malformed state");
    expect(verify(p, g.solution, null as never).ok).toBe(false);
    const africaIdx = p.rounds.findIndex((r) => r.map === "africa");
    const off = g.solution.spots.slice() as (LatLon | null)[];
    off[africaIdx] = [0, 120];
    expect(verify(p, g.solution, { pins: off }).reason).toBe("pin off the map");
    expect(verify(p, g.solution, { pins: [[Number.NaN, 0]] } as never).reason).toBe("pin off the map");
    expect(verify(p, g.solution, { pins: [[1]] } as never).reason).toBe("pin off the map");
    expect(verify(p, g.solution, { pins: [[-80, 0]] }).reason).toBe("pin off the map");
    expect(logic.progress(p, g.solution, { pins: g.solution.spots.slice(0, 2) })).toBeCloseTo(0.4);
    expect(logic.progress(p, g.solution, null as never)).toBe(0);
  });

  it("hints draw a box that holds the spot without centring on it", () => {
    for (let q = 0; q < ROUNDS; q++) {
      const h = hint(p, g.solution, { pins: g.solution.spots.slice(0, q) })!;
      const t = h.target as { question: number; box: number[] };
      const [s, w, n, e] = t.box;
      const [lat, lon] = g.solution.spots[q];
      expect(t.question).toBe(q);
      expect(lat).toBeGreaterThanOrEqual(s);
      expect(lat).toBeLessThanOrEqual(n);
      expect(lon).toBeGreaterThanOrEqual(w);
      expect(lon).toBeLessThanOrEqual(e);
    }
    expect(hint(p, g.solution, { pins: g.solution.spots })).toBeNull();
    expect(hint(p, g.solution, null as never)).not.toBeNull();
  });
});
