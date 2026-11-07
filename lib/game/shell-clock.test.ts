import { describe, expect, it } from "vitest";
import { haltClock, newClock, readClock, runClock } from "./shell-clock";

describe("shell clocks (R2-15)", () => {
  it("counts nothing until it runs: board load is not the start", () => {
    const c = newClock();
    expect(readClock(c, 5_000)).toBe(0);
  });

  it("starts at the first move, stops while held, carries on after", () => {
    const c = newClock();
    runClock(c, 1_000); // first move
    expect(readClock(c, 4_000)).toBe(3_000);
    haltClock(c, 4_000); // paused
    expect(readClock(c, 60_000)).toBe(3_000);
    runClock(c, 60_000); // resumed
    expect(readClock(c, 62_500)).toBe(5_500);
  });

  it("a move that starts and solves in the same tick reads a real time, never negative", () => {
    const c = newClock();
    runClock(c, 10_000);
    expect(readClock(c, 10_000)).toBe(0);
    expect(readClock(c, 9_990)).toBe(0);
    haltClock(c, 10_040);
    expect(readClock(c, 99_999)).toBe(40);
  });

  it("running twice keeps the first start; halting twice keeps the count", () => {
    const c = newClock();
    runClock(c, 1_000);
    runClock(c, 3_000);
    expect(readClock(c, 4_000)).toBe(3_000);
    haltClock(c, 4_000);
    haltClock(c, 9_000);
    expect(readClock(c, 9_000)).toBe(3_000);
  });

  it("a resumed game carries on from its saved time", () => {
    const c = newClock(42_000);
    expect(readClock(c, 0)).toBe(42_000);
    runClock(c, 100);
    expect(readClock(c, 1_100)).toBe(43_000);
  });
});
