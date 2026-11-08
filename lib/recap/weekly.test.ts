import { describe, expect, it } from "vitest";
import { buildRecap, hasRecap, recapDue, recapWeeks, weekLabels, type WeeklyRecap } from "./weekly";
import { recapCard, recapShareText, recapStats, SAMPLE_RECAP } from "@/lib/share/recap-card";
import { signRecapToken, verifyRecapToken } from "@/lib/share/recap-token";

const recap = (over: Partial<WeeklyRecap> = {}): WeeklyRecap => ({
  week: "2026-11-02",
  cleared: 12,
  best: { game: "crownfall", ms: 42_000 },
  streak: 12,
  league: { tier: 1, rank: 4, result: "promoted" },
  sparks: 145,
  ...over,
});

describe("weekly recap: which week", () => {
  it("sums up the GMT week before the visit's week (Monday to Sunday)", () => {
    expect(recapWeeks(new Date("2026-11-09T00:00:00Z"))).toEqual({ thisWeek: "2026-11-09", recapWeek: "2026-11-02" });
    expect(recapWeeks(new Date("2026-11-08T23:59:59Z"))).toEqual({ thisWeek: "2026-11-02", recapWeek: "2026-10-26" });
    expect(recapWeeks(new Date("2026-11-12T10:00:00Z")).recapWeek).toBe("2026-11-02");
    expect(weekLabels("2026-11-02")).toEqual({ from: "2 Nov", to: "8 Nov" });
    expect(weekLabels("2026-12-28")).toEqual({ from: "28 Dec", to: "3 Jan" });
  });
});

describe("weekly recap: when it shows", () => {
  const monday = new Date("2026-11-09T08:00:00Z");
  it("on the first visit of the week, once", () => {
    expect(recapDue({ enabled: true, shownWeek: null, now: monday, recap: recap() })).toBe(true);
    expect(recapDue({ enabled: true, shownWeek: "2026-11-02", now: monday, recap: recap() })).toBe(true);
    expect(recapDue({ enabled: true, shownWeek: "2026-11-09", now: monday, recap: recap() })).toBe(false);
  });
  it("never while off, with nothing to show, or for a stale week", () => {
    expect(recapDue({ enabled: false, shownWeek: null, now: monday, recap: recap() })).toBe(false);
    expect(recapDue({ enabled: true, shownWeek: null, now: monday, recap: recap({ cleared: 0, sparks: 0 }) })).toBe(false);
    expect(recapDue({ enabled: true, shownWeek: null, now: monday, recap: null })).toBe(false);
    expect(recapDue({ enabled: true, shownWeek: null, now: monday, recap: recap({ week: "2026-10-26" }) })).toBe(false);
  });
  it("a week with only Sparks still counts", () => {
    expect(hasRecap(recap({ cleared: 0, sparks: 20 }))).toBe(true);
  });
});

describe("weekly recap: built from rows", () => {
  it("adds up earned Sparks only, keeps the fastest timed clear, and the league from the player's own tier", () => {
    const r = buildRecap({
      week: "2026-11-02",
      cleared: 7,
      fastest: { game_id: "dusk", time_ms: 31_000 },
      streak: 5,
      league: { tier: 2, home_tier: 1, final_rank: 3, result: "promoted" },
      sparks: [{ amount: 10 }, { amount: 25 }, { amount: -30 }],
    });
    expect(r).toEqual({
      week: "2026-11-02",
      cleared: 7,
      best: { game: "dusk", ms: 31_000 },
      streak: 5,
      league: { tier: 1, rank: 3, result: "promoted" },
      sparks: 35,
    });
  });
  it("copes with no league, no timed clear and no streak row", () => {
    const r = buildRecap({ week: "2026-11-02", cleared: 1, fastest: null, streak: null, league: null, sparks: [] });
    expect(r).toMatchObject({ best: null, streak: 0, league: null, sparks: 0 });
    expect(
      buildRecap({ week: "w", cleared: 1, fastest: null, streak: 1, league: { tier: 0, final_rank: null, result: "weird" }, sparks: [] })
        .league,
    ).toEqual({
      tier: 0,
      rank: null,
      result: null,
    });
  });
});

describe("weekly recap card", () => {
  it("shows clears, best time with the game, streak, league and Sparks", () => {
    expect(recapStats(recap(), { minor: false, hideActivity: false })).toEqual([
      { id: "best", label: "Best time", value: "0:42 in Crownfall" },
      { id: "streak", label: "Streak", value: "🔥 12 days" },
      { id: "league", label: "League", value: "Up to Gold Crown" },
      { id: "sparks", label: "Sparks earned", value: "+145" },
    ]);
    const c = recapCard(recap(), { minor: false, hideActivity: false });
    expect(c).toMatchObject({
      big: "12",
      line: "games cleared",
      range: "2 Nov to 8 Nov",
      mood: "party",
      alt: "My week on SPUZL: 12 games cleared",
    });
    expect(SAMPLE_RECAP.stats).toHaveLength(4);
  });
  it("league result wording: stayed, demoted, or just the place mid-week", () => {
    const v = (league: WeeklyRecap["league"]) =>
      recapStats(recap({ league }), { minor: false, hideActivity: false }).find((s) => s.id === "league")?.value;
    expect(v({ tier: 1, rank: 10, result: "stayed" })).toBe("Held Silver Gear");
    expect(v({ tier: 1, rank: 28, result: "demoted" })).toBe("Down to Bronze Block");
    expect(v({ tier: 1, rank: 2, result: null })).toBe("2nd place");
  });
  it("keeps the status card's privacy rules: no league under 16, no streak with activity hidden", () => {
    const ids = (o: { minor: boolean; hideActivity: boolean }) => recapStats(recap(), o).map((s) => s.id);
    expect(ids({ minor: true, hideActivity: false })).toEqual(["best", "streak", "sparks"]);
    expect(ids({ minor: false, hideActivity: true })).toEqual(["best", "league", "sparks"]);
    expect(recapShareText(recap())).toMatch(/^My week on SPUZL: 12 games cleared\. Come and play: \S+$/);
  });
});

describe("weekly recap card links", () => {
  const id = "0f8fad5b-d9cb-469f-a165-70867728950e";
  it("are signed for one player and one week", () => {
    const t = signRecapToken(id, "2026-11-02", "s3cret");
    expect(t).toMatch(/^0f8fad5b-d9cb-469f-a165-70867728950e\.20261102\.[\w-]+$/);
    expect(verifyRecapToken(t, "s3cret")).toEqual({ playerId: id, week: "2026-11-02" });
    expect(verifyRecapToken(t, "other")).toBeNull();
    expect(verifyRecapToken(t.replace("20261102", "20261026"), "s3cret")).toBeNull();
    expect(verifyRecapToken("nope", "s3cret")).toBeNull();
    expect(verifyRecapToken(`${t}.x`, "s3cret")).toBeNull();
    expect(() => signRecapToken("not-a-uuid", "2026-11-02", "s3cret")).toThrow();
  });
});
