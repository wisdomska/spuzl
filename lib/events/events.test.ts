import { describe, expect, it } from "vitest";
import { EventCreate, EventQuest, eventIdFromQuest, eventQuestDelta, eventQuestId, eventStatus, pickActive, windowProblem } from "./index";

const H = 3_600_000;
const at = (h: number) => new Date(Date.UTC(2026, 10, 10) + h * H).toISOString();
const now = Date.parse(at(0));
const row = (id: string, s: number, e: number, created = at(-100)) => ({ id, starts_at: at(s), ends_at: at(e), created_at: created });

describe("event windows", () => {
  it("must end after they start and run at most 62 days", () => {
    expect(windowProblem(at(0), at(1))).toBeNull();
    expect(windowProblem(at(1), at(1))).toMatch(/end after/);
    expect(windowProblem(at(2), at(1))).toMatch(/end after/);
    expect(windowProblem(at(0), at(62 * 24))).toBeNull();
    expect(windowProblem(at(0), at(62 * 24 + 1))).toMatch(/62 days/);
    expect(windowProblem("nope", at(1))).toMatch(/valid/);
  });

  it("has a status: upcoming, live (start inclusive, end exclusive), ended", () => {
    expect(eventStatus(row("a", 1, 2), now)).toBe("upcoming");
    expect(eventStatus(row("a", 0, 2), now)).toBe("live");
    expect(eventStatus(row("a", -2, 0), now)).toBe("ended");
  });

  it("picks one live event: latest start, then newest row", () => {
    expect(pickActive([row("past", -10, -1), row("next", 1, 5)], now)).toBeNull();
    expect(pickActive([row("past", -10, -1), row("old", -48, 48), row("new", -2, 2), row("next", 1, 5)], now)?.id).toBe("new");
    expect(pickActive([row("a", -2, 2, at(-5)), row("b", -2, 2, at(-4))], now)?.id).toBe("b");
  });
});

describe("event bonus quest", () => {
  const free = { mode: "free", world: "logic", hints: 0 };
  it("counts free-play clears only", () => {
    expect(eventQuestDelta({ kind: "free_clears" }, free)).toBe(1);
    for (const mode of ["daily", "archive", "tutorial", "challenge"])
      expect(eventQuestDelta({ kind: "free_clears" }, { ...free, mode })).toBe(0);
  });
  it("matches the world and the no-hint rule", () => {
    expect(eventQuestDelta({ kind: "world_clears", world: "logic" }, free)).toBe(1);
    expect(eventQuestDelta({ kind: "world_clears", world: "word" }, free)).toBe(0);
    expect(eventQuestDelta({ kind: "no_hint_clears" }, free)).toBe(1);
    expect(eventQuestDelta({ kind: "no_hint_clears" }, { ...free, hints: 1 })).toBe(0);
  });
  it("validates the goal JSON", () => {
    const q = { title: "Clear 5 puzzles", kind: "free_clears", n: 5, xp: 100, sparks: 50 };
    expect(EventQuest.safeParse(q).success).toBe(true);
    expect(EventQuest.safeParse({ ...q, kind: "world_clears" }).success).toBe(false); // no world
    expect(EventQuest.safeParse({ ...q, kind: "world_clears", world: "word" }).success).toBe(true);
    expect(EventQuest.safeParse({ ...q, world: "word" }).success).toBe(false);
    expect(EventQuest.safeParse({ ...q, kind: "duels" }).success).toBe(false);
    expect(EventQuest.safeParse({ ...q, n: 0 }).success).toBe(false);
    expect(EventQuest.safeParse({ ...q, sparks: 9999 }).success).toBe(false);
    expect(EventQuest.safeParse({ ...q, extra: 1 }).success).toBe(false);
  });
  it("validates events: accent from the fixed list, ISO times, no dashes", () => {
    const e = {
      name: "Harmattan Week",
      startsAt: at(0),
      endsAt: at(24),
      accent: "gold",
      banner: "Clear 5 for a bonus.",
      quest: { title: "Clear 5", kind: "free_clears", n: 5, xp: 1, sparks: 1 },
    };
    expect(EventCreate.safeParse(e).success).toBe(true);
    expect(EventCreate.safeParse({ ...e, accent: "hotpink" }).success).toBe(false);
    expect(EventCreate.safeParse({ ...e, startsAt: "tomorrow" }).success).toBe(false);
    expect(EventCreate.safeParse({ ...e, name: "Harmattan — Week" }).success).toBe(false);
  });
  it("round-trips quest ids", () => {
    const id = "3f2b8c1e-4a5d-4e6f-8a7b-9c0d1e2f3a4b";
    expect(eventIdFromQuest(eventQuestId(id))).toBe(id);
    expect(eventIdFromQuest("d-clear-3")).toBeNull();
    expect(eventIdFromQuest("ev-nope")).toBeNull();
  });
});
