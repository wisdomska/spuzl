import { describe, expect, it } from "vitest";
import { DEMO_CLEAR_TTL_MS, parseDemoClear } from "./onboarding";

const SOLVED = [0, 2, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 2, 0];
const now = 1_800_000_000_000;
const raw = (o: Record<string, unknown>) => JSON.stringify({ game: "crownfall", state: SOLVED, ms: 21_400, at: now - 5_000, ...o });

describe("landing demo clear carried into onboarding (R2-08)", () => {
  it("reads a fresh clear", () => {
    expect(parseDemoClear(raw({}), now)).toEqual({ game: "crownfall", state: SOLVED, ms: 21_400, at: now - 5_000 });
  });

  it("rounds the active time", () => {
    expect(parseDemoClear(raw({ ms: 1234.6 }), now)?.ms).toBe(1235);
  });

  it("ignores missing, broken or foreign data", () => {
    expect(parseDemoClear(null, now)).toBeNull();
    expect(parseDemoClear("", now)).toBeNull();
    expect(parseDemoClear("{nope", now)).toBeNull();
    expect(parseDemoClear("42", now)).toBeNull();
    expect(parseDemoClear(raw({ game: "dusk" }), now)).toBeNull();
    expect(parseDemoClear(raw({ state: SOLVED.slice(1) }), now)).toBeNull();
    expect(parseDemoClear(raw({ state: SOLVED.map((x) => (x === 2 ? 3 : x)) }), now)).toBeNull();
    expect(parseDemoClear(raw({ ms: -1 }), now)).toBeNull();
    expect(parseDemoClear(raw({ ms: "20" }), now)).toBeNull();
    expect(parseDemoClear(raw({ ms: 90_000_000 }), now)).toBeNull();
  });

  it("drops a clear that is too old or stamped in the future", () => {
    expect(parseDemoClear(raw({ at: now - DEMO_CLEAR_TTL_MS - 1 }), now)).toBeNull();
    expect(parseDemoClear(raw({ at: now - DEMO_CLEAR_TTL_MS + 1 }), now)).not.toBeNull();
    expect(parseDemoClear(raw({ at: now + 5 * 60_000 }), now)).toBeNull();
    expect(parseDemoClear(raw({ at: "yesterday" }), now)).toBeNull();
  });
});
