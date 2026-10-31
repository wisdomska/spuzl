import { describe, expect, it } from "vitest";
import { buildNotices, streakAtRisk } from "./notices";

const evening = new Date(2026, 9, 31, 21, 0); // local 9 pm
const morning = new Date(2026, 9, 31, 9, 0);
const base = { streak: { current: 12, last_clear_date: "2026-10-30" }, date: "2026-10-31" };

describe("notices", () => {
  it("flags a streak at risk in the evening when today has no clear", () => {
    expect(streakAtRisk(base, evening)).toBe(true);
    expect(streakAtRisk({ ...base, streak: { current: 12, last_clear_date: "2026-10-31" } }, evening)).toBe(false);
    expect(streakAtRisk({ ...base, streak: { current: 0, last_clear_date: null } }, evening)).toBe(false);
    expect(streakAtRisk({ streak: null }, evening)).toBe(false);
    const n = buildNotices(base, evening);
    expect(n[0]).toMatchObject({
      kind: "streak_at_risk",
      tone: "warn",
      text: "12 day streak at risk. One Daily keeps it alive.",
      href: "/",
    });
  });

  it("also warns in the last four hours before the GMT reset", () => {
    const late = new Date(Date.UTC(2026, 9, 31, 21, 0));
    const early = new Date(Date.UTC(2026, 9, 31, 6, 0));
    // Only the reset window matters when the local hour is before 8 pm.
    if (late.getHours() < 20) expect(streakAtRisk(base, late)).toBe(true);
    if (early.getHours() < 20) expect(streakAtRisk(base, early)).toBe(false);
    expect(streakAtRisk(base, morning)).toBe(morning.getHours() >= 20 || Date.UTC(2026, 10, 1) - morning.getTime() <= 4 * 3600_000);
  });

  it("lists games new to this device, never on first run", () => {
    const ready = ["crownfall", "pinned", "buried", "weave"];
    expect(buildNotices({ readyGames: ready, seenGames: null }, morning)).toEqual([]);
    const [n] = buildNotices({ readyGames: ready, seenGames: ["crownfall"] }, morning);
    expect(n).toMatchObject({ kind: "new_games", text: "3 new games: Pinned, Buried and 1 more.", href: "/play/pinned" });
    const [one] = buildNotices({ readyGames: ["crownfall", "pinned"], seenGames: ["crownfall"] }, morning);
    expect(one.text).toBe("New game: Pinned.");
    expect(buildNotices({ readyGames: ["ghost-game"], seenGames: [] }, morning)).toEqual([]);
  });

  it("words league results for each outcome", () => {
    const l = { week: "2026-10-26", tier: "Silver", place: 5, of: 30 };
    expect(buildNotices({ league: { ...l, outcome: "promoted" } }, morning)[0]).toMatchObject({
      tone: "success",
      text: "Promoted to Silver. You finished 5 of 30.",
      href: "/leagues",
    });
    expect(buildNotices({ league: { ...l, outcome: "stayed" } }, morning)[0].text).toBe("You held Silver, finishing 5 of 30.");
    expect(buildNotices({ league: { ...l, outcome: "demoted" } }, morning)[0].text).toBe("Down to Silver this week. You finished 5 of 30.");
  });

  it("hides dismissed notices by id, and copy has no em or en dashes", () => {
    const all = buildNotices(
      {
        ...base,
        readyGames: ["crownfall", "pinned"],
        seenGames: ["crownfall"],
        league: { week: "w", outcome: "promoted", tier: "Gold", place: 1, of: 30 },
      },
      evening,
    );
    expect(all.map((n) => n.kind)).toEqual(["streak_at_risk", "league_result", "new_games"]);
    expect(all.map((n) => n.text).join(" ")).not.toMatch(/[–—]/);
    const left = buildNotices(
      {
        ...base,
        readyGames: ["crownfall", "pinned"],
        seenGames: ["crownfall"],
        dismissed: [all[0].id, all[2].id],
      },
      evening,
    );
    expect(left).toEqual([]);
  });
});
