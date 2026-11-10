import { describe, expect, it } from "vitest";
import { GAMES } from "@/lib/catalog";
import { TYPICAL_SEC } from "@/lib/games-meta";
import { DEFAULTS, type GameSettings } from "@/lib/game-settings/schema";
import { addDays } from "@/lib/admin/dates";
import {
  FIVE_SLOTS,
  FIVE_WORLDS,
  MAX_POINTS,
  MAX_SCORE,
  fiveDate,
  fivePoints,
  msToFiveReset,
  offlineInDay,
  parseSchedule,
  pickFive,
  replaceSlots,
  rulesFrom,
  scheduleToJson,
  shareGrid,
  slotsFor,
  type Candidate,
  type ScheduleDay,
} from "./index";

const LIVE: Candidate[] = GAMES.map((g) => ({ id: g.id, world: g.world, typicalSec: TYPICAL_SEC[g.id] ?? 180 }));
const rules = (patch: Partial<GameSettings> = {}) => rulesFrom({ ...DEFAULTS, ...patch });
const DAY = "2026-11-06";

describe("Daily Five selection", () => {
  it("is deterministic per date: same date and rules, same five, whatever the candidate order", () => {
    const a = pickFive(DAY, rules(), LIVE);
    const b = pickFive(DAY, rules(), [...LIVE].reverse());
    expect(a).toEqual(b);
    expect(a).toHaveLength(FIVE_SLOTS);
    expect(a.map((p) => p.slot)).toEqual([1, 2, 3, 4, 5]);
  });

  it("gives one game per visible world, in map order, then a bonus that is not already in the five", () => {
    for (let i = 0; i < 60; i++) {
      const picks = pickFive(addDays(DAY, i), rules(), LIVE);
      expect(picks.slice(0, 4).map((p) => [p.kind, p.world])).toEqual(FIVE_WORLDS.map((w) => ["world", w]));
      expect(picks[4].kind).toBe("bonus");
      expect(new Set(picks.map((p) => p.game)).size).toBe(FIVE_SLOTS);
      for (const p of picks) expect(LIVE.find((c) => c.id === p.game)?.world).toBe(p.world);
    }
  });

  it("picks quick games (typical time within the limit) and rotates them day to day", () => {
    const r = rules();
    const quick = new Set(LIVE.filter((c) => c.typicalSec <= r.maxGameSec).map((c) => c.id));
    for (let i = 0; i < 30; i++) {
      const today = pickFive(addDays(DAY, i), r, LIVE);
      const tomorrow = pickFive(addDays(DAY, i + 1), r, LIVE);
      for (const p of today) expect(quick.has(p.game), p.game).toBe(true);
      // Each world with two or more quick games shows a different one tomorrow.
      for (let w = 0; w < 4; w++) {
        const n = LIVE.filter((c) => c.world === today[w].world && quick.has(c.id)).length;
        if (n > 1) expect(tomorrow[w].game).not.toBe(today[w].game);
      }
    }
    // About 5 minutes in all: the five's typical times add up to well under 10 minutes.
    const total = pickFive(DAY, r, LIVE).reduce((t, p) => t + (TYPICAL_SEC[p.game] ?? 180), 0);
    expect(total).toBeLessThanOrEqual(5 * r.maxGameSec);
  });

  it("falls back to the quickest game when a world has none quick enough", () => {
    const picks = pickFive(DAY, rules({ "dailyFive.maxGameSec": 30 }), LIVE);
    expect(picks).toHaveLength(FIVE_SLOTS);
    const board = picks.find((p) => p.world === "board" && p.kind === "world")!;
    const minBoard = Math.min(...LIVE.filter((c) => c.world === "board").map((c) => c.typicalSec));
    expect(TYPICAL_SEC[board.game]).toBe(minBoard);
  });

  it("hands a switched-off world's slot to the bonus, and keeps the bonus inside its pool", () => {
    const r = rules({ "dailyFive.world.board": false, "dailyFive.bonus.logic": false, "dailyFive.bonus.board": false });
    for (let i = 0; i < 20; i++) {
      const picks = pickFive(addDays(DAY, i), r, LIVE);
      expect(picks).toHaveLength(FIVE_SLOTS);
      expect(picks.filter((p) => p.kind === "world").map((p) => p.world)).toEqual(["logic", "word", "reflex"]);
      for (const p of picks.filter((x) => x.kind === "bonus")) expect(["word", "reflex"]).toContain(p.world);
      expect(new Set(picks.map((p) => p.game)).size).toBe(FIVE_SLOTS);
    }
  });

  it("rotates the bonus world through the pool", () => {
    const worlds = new Set(Array.from({ length: 8 }, (_, i) => pickFive(addDays(DAY, i), rules(), LIVE)[4].world));
    expect(worlds.size).toBeGreaterThanOrEqual(3);
  });

  it("slots a manual pick: first game of a world holds its slot, the rest are bonuses", () => {
    expect(
      slotsFor([
        { id: "crownfall", world: "logic" },
        { id: "dusk", world: "logic" },
        { id: "remix", world: "word" },
      ]).map((p) => [p.slot, p.kind, p.game]),
    ).toEqual([
      [1, "world", "crownfall"],
      [2, "bonus", "dusk"],
      [3, "world", "remix"],
    ]);
  });
});

describe("Daily Five when a game is switched off (R4-06)", () => {
  const day = pickFive(DAY, rules(), LIVE).map((p) => ({ slot: p.slot, kind: p.kind, world: p.world, game: p.game }));

  it("swaps only the closed game's slot, for a quick game of the same world not already in the day", () => {
    const off = day[1].game;
    const swaps = replaceSlots(DAY, day, (id) => id === off, rules(), LIVE);
    expect(swaps).toHaveLength(1);
    expect(swaps[0].slot).toBe(2);
    expect(swaps[0].kind).toBe("world");
    expect(swaps[0].world).toBe(day[1].world);
    expect(swaps[0].game).not.toBe(off);
    expect(day.map((d) => d.game)).not.toContain(swaps[0].game);
    expect(LIVE.find((c) => c.id === swaps[0].game)!.typicalSec).toBeLessThanOrEqual(rules().maxGameSec);
  });

  it("is deterministic and never picks another closed game", () => {
    const closed = new Set([
      day[0].game,
      day[4].game,
      ...LIVE.filter((c) => c.world === day[0].world)
        .slice(0, 3)
        .map((c) => c.id),
    ]);
    const a = replaceSlots(DAY, day, (id) => closed.has(id), rules(), LIVE);
    const b = replaceSlots(DAY, [...day].reverse(), (id) => closed.has(id), rules(), [...LIVE].reverse());
    expect(a).toEqual(b);
    expect(a.map((p) => p.slot)).toEqual([1, 5]);
    for (const p of a) expect(closed.has(p.game)).toBe(false);
    expect(new Set([...day.map((d) => d.game), ...a.map((p) => p.game)]).size).toBe(day.length + a.length);
  });

  it("takes a game from another world as a bonus when the world has none left, and changes nothing when all are open", () => {
    const only = LIVE.filter((c) => c.world !== day[2].world || c.id === day[2].game);
    const swaps = replaceSlots(DAY, day, (id) => id === day[2].game, rules(), only);
    expect(swaps).toHaveLength(1);
    expect(swaps[0].kind).toBe("bonus");
    expect(swaps[0].world).not.toBe(day[2].world);
    expect(replaceSlots(DAY, day, () => false, rules(), LIVE)).toEqual([]);
  });

  it("leaves a slot out when no game is left to take", () => {
    expect(
      replaceSlots(
        DAY,
        day,
        (id) => id === day[0].game,
        rules(),
        LIVE.filter((c) => day.some((d) => d.game === c.id)),
      ),
    ).toEqual([]);
  });
});

describe("Daily Five and Quads (R2-14)", () => {
  const days = (cands: Candidate[], patch: Partial<GameSettings> = {}) =>
    Array.from({ length: 60 }, (_, i) => pickFive(addDays(DAY, i), rules(patch), cands)).flat();

  it("picks Quads for the Words & Quiz slot when it is quick enough (typical 120 s, limit 120 s)", () => {
    expect(TYPICAL_SEC.quads).toBeLessThanOrEqual(DEFAULTS["dailyFive.maxGameSec"]);
    expect(LIVE.some((c) => c.id === "quads" && c.world === "word")).toBe(true);
    expect(days(LIVE).some((p) => p.game === "quads" && p.world === "word")).toBe(true);
  });

  it("never picks Quads when its typical time is over the limit", () => {
    const slow = LIVE.map((c) => (c.id === "quads" ? { ...c, typicalSec: 300 } : c));
    expect(days(slow).some((p) => p.game === "quads")).toBe(false);
    expect(days(LIVE, { "dailyFive.maxGameSec": 90 }).some((p) => p.game === "quads")).toBe(false);
  });
});

describe("Daily Five day and reset", () => {
  it("resets at midnight GMT by default, or at the admin's hour", () => {
    expect(fiveDate(new Date("2026-11-06T00:00:00Z"))).toBe("2026-11-06");
    expect(fiveDate(new Date("2026-11-06T23:59:59Z"))).toBe("2026-11-06");
    expect(fiveDate(new Date("2026-11-06T05:59:00Z"), 6)).toBe("2026-11-05");
    expect(fiveDate(new Date("2026-11-06T06:00:00Z"), 6)).toBe("2026-11-06");
    expect(msToFiveReset(new Date("2026-11-06T23:00:00Z"))).toBe(3_600_000);
    expect(msToFiveReset(new Date("2026-11-06T05:00:00Z"), 6)).toBe(3_600_000);
  });

  it("checks an offline clear against the Daily Five day for a Daily Five attempt (R4-07)", () => {
    // Reset at 06:00 GMT: a clear at 03:00 on the 6th belongs to the five of the 5th.
    const early = new Date("2026-11-06T03:00:00Z");
    expect(offlineInDay(early, "2026-11-05", true, 6)).toBe(true);
    expect(offlineInDay(early, "2026-11-05", false, 6)).toBe(false);
    // The regular Daily keeps the GMT date, and a five game opened as that Daily before the reset fits too.
    expect(offlineInDay(early, "2026-11-06", false, 6)).toBe(true);
    expect(offlineInDay(early, "2026-11-06", true, 6)).toBe(true);
    // After the day is over, neither fits.
    expect(offlineInDay(new Date("2026-11-06T07:00:00Z"), "2026-11-05", true, 6)).toBe(false);
    expect(offlineInDay(new Date("2026-11-07T00:30:00Z"), "2026-11-06", false, 0)).toBe(false);
    expect(offlineInDay(new Date("2026-11-06T23:30:00Z"), "2026-11-06", true, 0)).toBe(true);
  });
});

describe("Daily Five scoring", () => {
  it("gives 100 for a clear plus speed, less hints and mistakes, between 50 and 200", () => {
    expect(fivePoints({ state: "cleared", timeMs: 0 }, 100)).toBe(MAX_POINTS);
    expect(fivePoints({ state: "cleared", timeMs: 100_000 }, 100)).toBe(150);
    expect(fivePoints({ state: "cleared", timeMs: 400_000 }, 100)).toBe(100);
    expect(fivePoints({ state: "cleared", timeMs: 100_000, hints: 2, mistakes: 2 }, 100)).toBe(110);
    expect(fivePoints({ state: "cleared", timeMs: 400_000, hints: 9 }, 100)).toBe(50);
  });
  it("gives nothing for a miss, an unfinished game or a flagged clear", () => {
    for (const state of ["failed", "flagged", "new", "in_progress"] as const) expect(fivePoints({ state, timeMs: 1000 }, 100)).toBe(0);
    expect(MAX_SCORE).toBe(1000);
  });
});

describe("Daily Five share grid", () => {
  const grid = shareGrid({
    date: "2026-11-06",
    score: 845,
    url: "spuzl.vercel.app/daily",
    rows: [
      { world: "logic", name: "Crownfall", state: "cleared", timeMs: 72_000, points: 200 },
      { world: "word", name: "Remix", state: "cleared", timeMs: 48_500, points: 120 },
      { world: "reflex", name: "Echo", state: "failed", timeMs: 40_000, points: 0 },
      { world: "board", name: "Four Up", state: "cleared", timeMs: 65_000, points: 81 },
      { world: "logic", name: "Weave", state: "flagged", timeMs: 1_000, points: 0 },
    ],
  });
  it("is text only, one row per game with world-colour squares and the time", () => {
    expect(grid.split("\n")).toEqual([
      "SPUZL Daily Five #220 · 845/1000",
      "🟦🟦🟦🟦🟦 Crownfall 1:12",
      "🟩🟩🟩⬜⬜ Remix 0:48",
      "⬛⬛⬛⬛⬛ Echo missed",
      "🟫🟫⬜⬜⬜ Four Up 1:05",
      "⬛⬛⬛⬛⬛ Weave in review",
      "spuzl.vercel.app/daily",
    ]);
  });
  it("links back to today's Daily Five by default and never carries an answer", () => {
    const plain = shareGrid({ date: "2026-11-06", score: 0, rows: [] });
    expect(plain.split("\n").at(-1)).toMatch(/\/daily$/);
    expect(grid).not.toMatch(/solution|\[|\{/);
  });
});

describe("Daily Five schedule JSON", () => {
  const isGame = (id: string) => LIVE.some((c) => c.id === id);
  const days: ScheduleDay[] = [
    { date: "2026-11-08", games: pickFive("2026-11-08", rules(), LIVE).map((p) => p.game), locked: true },
    { date: "2026-11-07", games: pickFive("2026-11-07", rules(), LIVE).map((p) => p.game), locked: false },
  ];

  it("round-trips: export then import gives the same days (sorted by date)", () => {
    const json = scheduleToJson(days);
    const back = parseSchedule(json, isGame);
    expect(back).toEqual({ ok: true, days: [...days].sort((a, b) => (a.date < b.date ? -1 : 1)) });
    expect(scheduleToJson(back.ok ? back.days : [])).toBe(json);
  });

  it("lists every problem and accepts nothing when a row is bad", () => {
    const bad = JSON.stringify({
      app: "spuzl",
      kind: "daily-five",
      version: 1,
      days: [
        { date: "2026-13-40", games: ["crownfall"] },
        { date: "2026-11-09", games: ["crownfall", "crownfall", "remix", "echo", "chess"] },
        { date: "2026-11-10", games: ["crownfall", "nope", "remix", "echo", "chess"], locked: "yes" },
        { date: "2026-11-10", games: ["crownfall", "dusk", "remix", "echo", "chess"] },
      ],
    });
    const r = parseSchedule(bad, isGame);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.join("\n")).toMatch(/Day 1: date/);
    expect(r.errors.join("\n")).toMatch(/Day 1: needs exactly 5/);
    expect(r.errors.join("\n")).toMatch(/Day 2: a game appears twice/);
    expect(r.errors.join("\n")).toMatch(/Day 3: unknown or unavailable game "nope"/);
    expect(r.errors.join("\n")).toMatch(/Day 3: locked must be/);
    expect(r.errors.join("\n")).toMatch(/Day 4: 2026-11-10 appears twice/);
    expect(parseSchedule("{", isGame)).toEqual({ ok: false, errors: ["Not valid JSON."] });
    expect(parseSchedule(JSON.stringify({ days: [] }), isGame).ok).toBe(false);
  });
});
