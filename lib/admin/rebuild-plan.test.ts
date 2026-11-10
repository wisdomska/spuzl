import { describe, expect, it } from "vitest";
import { planRebuild } from "./rebuild-plan";

describe("Rebuild upcoming days (R4-14)", () => {
  const today = "2026-11-10";

  it("rebuilds unlocked future days built from the generator, in date order", () => {
    const { rebuild, skipped } = planRebuild(
      [
        { date: "2026-11-14", locked: false, generated: true },
        { date: "2026-11-12", locked: false, generated: true },
      ],
      today,
    );
    expect(rebuild.map((d) => d.date)).toEqual(["2026-11-12", "2026-11-14"]);
    expect(skipped).toEqual([]);
  });

  it("keeps today and past days, locked days, custom items and Daily Five days already started", () => {
    const { rebuild, skipped } = planRebuild(
      [
        { date: "2026-11-10", locked: false, generated: true },
        { date: "2026-11-09", locked: false, generated: true },
        { date: "2026-11-11", locked: true, generated: true },
        { date: "2026-11-12", locked: false, generated: false },
        { date: "2026-11-13", locked: false, generated: true, played: 2 },
        { date: "2026-11-15", locked: false, generated: true, played: 0 },
      ],
      today,
    );
    expect(rebuild.map((d) => d.date)).toEqual(["2026-11-15"]);
    expect(skipped.map((d) => [d.date, d.reason])).toEqual([
      ["2026-11-09", "past_or_today"],
      ["2026-11-10", "past_or_today"],
      ["2026-11-11", "locked"],
      ["2026-11-12", "custom"],
      ["2026-11-13", "played"],
    ]);
  });

  it("checks a lock before anything else", () => {
    expect(planRebuild([{ date: "2026-11-20", locked: true, generated: false, played: 3 }], today).skipped[0].reason).toBe("locked");
  });
});
