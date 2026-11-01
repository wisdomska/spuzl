import { describe, expect, it } from "vitest";
import { parsePlayHref } from "./early-attempt";

describe("attempt priming (SPZ-01)", () => {
  it("reads daily and free play links only", () => {
    expect(parsePlayHref("/play/crownfall")).toEqual({ game: "crownfall", mode: "daily" });
    expect(parsePlayHref("/play/dusk?mode=free&difficulty=hard")).toEqual({ game: "dusk", mode: "free", difficulty: "hard" });
    expect(parsePlayHref("/play/dusk?mode=archive&date=2026-10-01")).toBeNull();
    expect(parsePlayHref("/play/chess/bot")).toBeNull();
    expect(parsePlayHref("/library")).toBeNull();
  });
});
