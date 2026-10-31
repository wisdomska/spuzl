import { describe, expect, it } from "vitest";
import { BADGES } from "@/lib/gamification/badges";
import { GAME_BY_ID } from "@/lib/catalog";
import {
  addDays,
  archiveAccess,
  badgeFamilies,
  badgeProgress,
  chainStates,
  classroomAllowed,
  monthGrid,
  nextMonday,
  purchaseState,
  shortDate,
  tabOf,
  topPercent,
  validRun,
  type BadgeStats,
} from "./index";

const stats: BadgeStats = {
  clears: 12,
  dailyClears: 8,
  noHintClears: 3,
  fullSpuzlDays: 1,
  bestStreak: 9,
  friends: 2,
  worldCleared: { logic: 3 },
  gameClears: { chess: 0 },
};

describe("badges", () => {
  it("measures progress for countable rules", () => {
    const by = (id: string) => BADGES.find((b) => b.id === id)!;
    expect(badgeProgress(by("first-clear"), stats)).toEqual({ have: 1, need: 1 });
    expect(badgeProgress(by("streak-7"), stats)).toEqual({ have: 7, need: 7 });
    expect(badgeProgress(by("streak-30"), stats)).toEqual({ have: 9, need: 30 });
    expect(badgeProgress(by("clean-10"), stats)).toEqual({ have: 3, need: 10 });
    expect(badgeProgress(by("fullspuzl-10"), stats)).toEqual({ have: 1, need: 10 });
    expect(badgeProgress(by("social-5"), stats)).toEqual({ have: 2, need: 5 });
    expect(badgeProgress(by("explorer-logic"), stats)?.have).toBe(3);
    expect(badgeProgress(by("board-mate"), stats)).toEqual({ have: 0, need: 1 });
    expect(badgeProgress(by("night-owl"), stats)).toBeNull();
  });
  it("hides secret badges until earned", () => {
    const hidden = badgeFamilies(BADGES, new Set());
    expect(hidden.find((f) => f.family === "secret")).toBeUndefined();
    const shown = badgeFamilies(BADGES, new Set(["secret-blink"]));
    expect(shown.find((f) => f.family === "secret")?.badges.map((b) => b.id)).toEqual(["secret-blink"]);
    expect(hidden[0].family).toBe("starter");
  });
});

describe("leaderboards", () => {
  it("rounds the pinned row's share up", () => {
    expect(topPercent(23, 312)).toBe(8);
    expect(topPercent(1, 1000)).toBe(1);
    expect(topPercent(5, 0)).toBe(100);
  });
});

describe("quests", () => {
  it("marks the weekly chain done, current and locked", () => {
    expect(chainStates([{ completed: true }, { completed: true }, { completed: false }, { completed: false }])).toEqual([
      "done",
      "done",
      "current",
      "locked",
    ]);
  });
});

describe("archive", () => {
  it("frees the last 7 days and locks older ones", () => {
    const today = "2026-10-31";
    expect(archiveAccess("2026-10-30", today, "2026-04-01")).toBe("free");
    expect(archiveAccess("2026-10-24", today, "2026-04-01")).toBe("free");
    expect(archiveAccess("2026-10-23", today, "2026-04-01")).toBe("locked");
    expect(archiveAccess(today, today, "2026-04-01")).toBe("today");
    expect(archiveAccess("2026-11-01", today, "2026-04-01")).toBe("future");
    expect(archiveAccess("2026-03-31", today, "2026-04-01")).toBe("before");
  });
  it("lays out a Monday-first month", () => {
    const oct = monthGrid(2026, 9);
    expect(oct.slice(0, 4)).toEqual([null, null, null, "2026-10-01"]);
    expect(oct.filter(Boolean)).toHaveLength(31);
    expect(shortDate("2026-10-27")).toBe("Tue 27 Oct");
  });
});

describe("School Cup", () => {
  it("hides Rage Ridge and photosensitive games in classroom mode", () => {
    expect(classroomAllowed(GAME_BY_ID.crownfall)).toBe(true);
    expect(classroomAllowed(GAME_BY_ID.gotcha)).toBe(false);
  });
  it("validates the run", () => {
    expect(validRun("2026-11-02", "2026-11-06", "2026-10-31")).toBeNull();
    expect(validRun("2026-11-03", "2026-11-06", "2026-10-31")).toMatch(/Monday/);
    expect(validRun("2026-10-19", "2026-10-23", "2026-10-31")).toMatch(/later/);
    expect(validRun("2026-11-02", "2026-11-09", "2026-10-31")).toMatch(/within/);
    expect(nextMonday("2026-10-31")).toBe("2026-11-02");
    expect(nextMonday("2026-11-02")).toBe("2026-11-02");
    expect(addDays("2026-11-02", 4)).toBe("2026-11-06");
  });
});

describe("shop", () => {
  const item = { price: 350, owned: false, unlockLevel: null, consumable: false };
  it("knows what the buy button can do", () => {
    expect(purchaseState(item, 1000, 5)).toEqual({ kind: "buy" });
    expect(purchaseState(item, 100, 5)).toEqual({ kind: "short", short: 250 });
    expect(purchaseState({ ...item, owned: true }, 1000, 5)).toEqual({ kind: "owned" });
    expect(purchaseState({ ...item, unlockLevel: 10 }, 1000, 5)).toEqual({ kind: "locked" });
    expect(purchaseState({ ...item, price: 0 }, 0, 5)).toEqual({ kind: "free" });
    expect(purchaseState({ ...item, consumable: true, owned: true }, 1000, 5, 2, true)).toEqual({ kind: "full" });
    expect(tabOf("freeze")).toBe("extra");
    expect(tabOf("hat")).toBe("hat");
  });
});
