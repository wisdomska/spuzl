import { describe, expect, it } from "vitest";
import { RAIL_ROWS, railWindow } from "./rail";

const ten = Array.from({ length: 10 }, (_, i) => `p${i}`);

describe("race rail window", () => {
  it("shows everyone in a small room", () => {
    expect(railWindow(ten.slice(0, 5), "p4", RAIL_ROWS)).toEqual([0, 1, 2, 3, 4]);
  });
  it("shows the top three, the player and the one ahead", () => {
    expect(railWindow(ten, "p7", RAIL_ROWS)).toEqual([0, 1, 2, 6, 7]);
    expect(railWindow(ten, "p9", RAIL_ROWS)).toEqual([0, 1, 2, 8, 9]);
  });
  it("fills with the next places when the player is near the top", () => {
    expect(railWindow(ten, "p0", RAIL_ROWS)).toEqual([0, 1, 2, 3, 4]);
    expect(railWindow(ten, "p4", RAIL_ROWS)).toEqual([0, 1, 2, 3, 4]);
    expect(railWindow(ten, "p5", RAIL_ROWS)).toEqual([0, 1, 2, 4, 5]);
  });
  it("shows the top five to a watcher", () => {
    expect(railWindow(ten, "teacher", RAIL_ROWS)).toEqual([0, 1, 2, 3, 4]);
  });
  it("shows everyone when asked", () => {
    expect(railWindow(ten, "p7", 10)).toHaveLength(10);
  });
});
