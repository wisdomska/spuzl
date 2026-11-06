import { describe, expect, it } from "vitest";
import { parsePlayHref } from "./early-attempt";

describe("attempt priming (SPZ-01, R2-01)", () => {
  it("reads daily, free play and level links", () => {
    expect(parsePlayHref("/play/crownfall")).toEqual({ game: "crownfall", mode: "daily" });
    expect(parsePlayHref("/play/dusk?mode=free&difficulty=hard")).toEqual({ game: "dusk", mode: "free", difficulty: "hard" });
    // R2-01: Continue opens ladder games in level mode; those taps are primed too
    expect(parsePlayHref("/play/dusk?mode=level")).toEqual({ game: "dusk", mode: "level", level: undefined });
    expect(parsePlayHref("/play/dusk?mode=level&level=12")).toEqual({ game: "dusk", mode: "level", level: 12 });
    expect(parsePlayHref("/play/dusk?mode=level&level=x")).toEqual({ game: "dusk", mode: "level", level: undefined });
  });

  it("leaves other links alone", () => {
    expect(parsePlayHref("/play/dusk?mode=archive&date=2026-10-01")).toBeNull();
    expect(parsePlayHref("/play/chess/bot")).toBeNull();
    expect(parsePlayHref("/library")).toBeNull();
  });
});
