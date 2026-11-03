import { describe, expect, it } from "vitest";
import { BAY_GAMES, CLOCK_MINUTES, DEFAULT_MINUTES, LIVE_CLOCK_MS, clockMinutes, clockMsFor } from "./bay";

describe("Board Bay time controls", () => {
  it("offers a short list per game, each including its default", () => {
    for (const g of BAY_GAMES) {
      expect(CLOCK_MINUTES[g].length, g).toBeGreaterThanOrEqual(3);
      expect(CLOCK_MINUTES[g].length, g).toBeLessThanOrEqual(5);
      expect(CLOCK_MINUTES[g], g).toContain(DEFAULT_MINUTES[g]);
      expect(
        [...CLOCK_MINUTES[g]].sort((a, b) => a - b),
        g,
      ).toEqual(CLOCK_MINUTES[g]);
    }
    expect(CLOCK_MINUTES.chess).toEqual([3, 5, 10, 15, 30]);
  });

  it("uses the asked-for minutes only when the game offers them", () => {
    expect(clockMinutes("chess", 10)).toBe(10);
    expect(clockMinutes("chess", 7)).toBe(5);
    expect(clockMinutes("fourup", 30)).toBe(5);
    expect(clockMinutes("ludo")).toBe(10);
    expect(clockMsFor("draughts", 15)).toBe(15 * 60_000);
    expect(clockMsFor("chess", null)).toBe(LIVE_CLOCK_MS);
  });
});
