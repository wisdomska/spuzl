import { describe, expect, it } from "vitest";
import { LAUNCH_IDS } from "@/lib/catalog";
import { CELL, dailyShareText, duelShareText, effortGrid, fullSpuzlShareText, partyShareText, SHARE_DOMAIN } from "./text";
import { cardDate, dailyCard, duelCard, mix, ordinal, partyCard, SAMPLE_CARDS, streakFoot, worldCardColours } from "./card-model";

const cells = (rows: string[]) => Array.from(rows.join("")).filter((c) => c !== "️");

describe("effortGrid", () => {
  it("is two rows of five, all clean for a clean clear", () => {
    const g = effortGrid({ timeMs: 72_000 });
    expect(g).toEqual(["🟩🟩🟩🟩🟩", "🟩🟩🟩🟩🟩"]);
  });

  it("places hints and slips by timestamp", () => {
    const g = effortGrid({ timeMs: 100_000, hintsAtMs: [75_000], slipsAtMs: [5_000] });
    expect(g).toEqual(["🟥🟩🟩🟩🟩", "🟩🟩🟨🟩🟩"]);
  });

  it("spreads counts evenly when there are no timestamps, and is deterministic", () => {
    const a = effortGrid({ timeMs: 60_000, hints: 2, slips: 1 });
    expect(a).toEqual(effortGrid({ timeMs: 60_000, hints: 2, slips: 1 }));
    const flat = cells(a);
    expect(flat.filter((c) => c === CELL.hint)).toHaveLength(2);
    expect(flat.filter((c) => c === CELL.slip)).toHaveLength(1);
  });

  it("a slip outranks a hint in the same slice", () => {
    const g = effortGrid({ timeMs: 10_000, hintsAtMs: [500], slipsAtMs: [600] });
    expect(cells(g)[0]).toBe(CELL.slip);
  });

  it("greys out slices not reached", () => {
    const g = effortGrid({ timeMs: 10_000, reached: 0.4 });
    expect(g).toEqual(["🟩🟩🟩🟩⬛", "⬛⬛⬛⬛⬛"]);
  });

  it("clamps out-of-range timestamps and reach", () => {
    const g = effortGrid({ timeMs: 1000, hintsAtMs: [-50, 99_999], reached: 7 });
    expect(cells(g)[0]).toBe(CELL.hint);
    expect(cells(g)[9]).toBe(CELL.hint);
    expect(effortGrid({ timeMs: 0, hintsAtMs: [10] })[0].startsWith(CELL.hint)).toBe(true);
  });
});

describe("share text", () => {
  it("matches the design's Daily format", () => {
    const t = dailyShareText({ gameId: "crownfall", number: 214, timeMs: 72_000, hintsAtMs: [52_000], streak: 12 });
    expect(t).toBe(["SPUZL #214 · Crownfall · 1:12 🔥12", "🟩🟩🟩🟩🟩", "🟩🟩🟨🟩🟩", SHARE_DOMAIN].join("\n"));
  });

  it("drops the flame without a streak and shows points for score games", () => {
    const t = dailyShareText({ gameId: "deadon", number: 3, timeMs: 30_000, score: 1240 });
    expect(t.split("\n")[0]).toBe("SPUZL #3 · Dead On · 1,240 pts");
  });

  it("never contains board state or a solution, whatever extra data the caller holds", () => {
    const input = { gameId: "crownfall", number: 1, timeMs: 5000, solution: [1, 3, 0, 2], state: [0, 2, 0, 0] };
    const t = dailyShareText(input as Parameters<typeof dailyShareText>[0]);
    expect(t).not.toMatch(/\[|1,3,0,2|solution|state/);
    expect(t.split("\n")).toHaveLength(4);
  });

  it("matches the design's Full Spuzl format", () => {
    const t = fullSpuzlShareText({ number: 214, cleared: [...LAUNCH_IDS].reverse(), totalMs: 38 * 60_000 + 12_000, streak: 12 });
    expect(t).toBe(["SPUZL #214 · FULL SPUZL 15/15 · 38:12 🔥12", "🟪🟪🟪🟦🟦🟧🟨🟩🟩🟩🟩🟥🔷🔴🔴", SHARE_DOMAIN].join("\n"));
  });

  it("shows progress and dark squares on a partial day", () => {
    const t = fullSpuzlShareText({ number: 9, cleared: ["crownfall", "nope"], totalMs: 60_000 });
    const [head, strip] = t.split("\n");
    expect(head).toBe("SPUZL #9 · 1/15 Dailies · 1:00");
    expect(strip.startsWith("🟪⬛")).toBe(true);
  });

  it("matches the design's Duel format", () => {
    const t = duelShareText({ gameId: "sixer", me: "Ama", them: "Tunde", rounds: ["won", "lost", "won"], rating: 1438 });
    expect(t).toBe(["SPUZL Duel · Sixer", "Ama 2 - 1 Tunde", "🟩🟥🟩 · rating 1,438", SHARE_DOMAIN].join("\n"));
    expect(duelShareText({ gameId: "?", me: "A", them: "B", rounds: ["won"] }).split("\n")[2]).toBe("🟩");
  });

  it("formats Party podiums", () => {
    expect(partyShareText({ players: 5, place: 1, games: 3, code: "K7QX" })).toBe(
      ["SPUZL Party · 5 Spuzlers", "🥇 1st of 5 · 3 games · Room K7QX", SHARE_DOMAIN].join("\n"),
    );
    expect(partyShareText({ players: 8, place: 4, games: 1 }).split("\n")[1]).toBe("🎉 4th of 8 · 1 game");
  });

  it("uses no em or en dashes", () => {
    const all = [
      dailyShareText({ gameId: "crownfall", number: 1, timeMs: 1000 }),
      fullSpuzlShareText({ number: 1, cleared: LAUNCH_IDS, totalMs: 1 }),
      duelShareText({ gameId: "sixer", me: "a", them: "b", rounds: ["won", "won"] }),
      partyShareText({ players: 2, place: 2, games: 2 }),
    ].join("\n");
    expect(all).not.toMatch(/[–—]/);
  });
});

describe("card model", () => {
  it("reproduces the design sample cards", () => {
    expect(SAMPLE_CARDS.daily).toMatchObject({
      bg: "#1B1835",
      dot: "#2E2858",
      kicker: "Crownfall #214",
      big: "1:12",
      line: "No hints. Faster than 82%.",
      foot: "🔥 12 days",
      mood: "cheer",
    });
    expect(SAMPLE_CARDS.full).toMatchObject({ big: "Full Spuzl", line: "All 15 Dailies in 38:12", foot: "🔥 12 · Lv 15", spuz: "#2FD3E0" });
    expect(SAMPLE_CARDS.duel).toMatchObject({
      kicker: "Duel · Sixer",
      big: "2 - 1",
      line: "Beat Tunde. Rating 1,438.",
      foot: "+18 rating",
    });
    expect(SAMPLE_CARDS.party).toMatchObject({
      kicker: "Party · 5 Spuzlers",
      big: "1st",
      line: "Kofi took the room. 3 games.",
      foot: "Room K7QX",
    });
  });

  it("tints daily cards with the world colour", () => {
    expect(mix("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    const c = worldCardColours("word");
    expect(c.bg).toMatch(/^#[0-9A-F]{6}$/);
    expect(c.bg).not.toBe(c.dot);
  });

  it("words effort, comparison and streak honestly", () => {
    const base = {
      world: "rage" as const,
      gameName: "Dash",
      number: 5,
      scoring: "deaths" as const,
      timeMs: 61_000,
      score: null,
      hints: 0,
      deaths: 3,
      percentile: 100,
      field: 1,
      streak: 1,
    };
    expect(dailyCard(base).line).toBe("3 deaths.");
    expect(dailyCard({ ...base, field: 9 }).line).toBe("3 deaths. Fastest today.");
    expect(dailyCard({ ...base, deaths: 0 }).line).toBe("No deaths.");
    expect(dailyCard({ ...base, scoring: "time", hints: 1 }).line).toBe("1 hint.");
    expect(dailyCard({ ...base, scoring: "score", score: 12_345 }).big).toBe("12,345");
    expect(dailyCard(base).foot).toBe("🔥 1 day");
    expect(streakFoot(0)).toBe("");
    expect(streakFoot(0, 4)).toBe("Lv 4");
  });

  it("handles unrated duels and lower podium places", () => {
    const d = duelCard({
      gameName: "Mix",
      winnerRounds: 2,
      loserRounds: 0,
      loser: "Bot",
      ratingAfter: null,
      ratingBefore: null,
      bestOf: 3,
    });
    expect(d.line).toBe("Beat Bot.");
    expect(d.foot).toBe("Best of 3");
    expect(
      duelCard({ ...d, gameName: "x", winnerRounds: 2, loserRounds: 1, loser: "Z", ratingAfter: 990, ratingBefore: 1000, bestOf: 3 }).foot,
    ).toBe("-10 rating");
    expect(partyCard({ players: 6, place: 3, winner: "Kofi", games: 1, code: null })).toMatchObject({
      big: "3rd",
      mood: "proud",
      foot: "",
    });
    expect(partyCard({ players: 6, place: 5, winner: "Kofi", games: 2, code: "AB" }).mood).toBe("cheer");
  });

  it("formats dates and ordinals", () => {
    expect(cardDate("2025-10-30")).toBe("Thu 30 Oct");
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 103, 111].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "103rd",
      "111th",
    ]);
  });
});
