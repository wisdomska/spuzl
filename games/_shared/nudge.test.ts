import { describe, expect, it } from "vitest";
import { nudgeKeyframes } from "./nudge";

describe("nudgeKeyframes", () => {
  it("leans toward the blocked side and returns", () => {
    expect(nudgeKeyframes(0, 5)[1].transform).toBe("translate(0px, -5px)");
    expect(nudgeKeyframes(1, 5)[1].transform).toBe("translate(5px, 0px)");
    expect(nudgeKeyframes(2, 4)[1].transform).toBe("translate(0px, 4px)");
    expect(nudgeKeyframes(3, 4)[1].transform).toBe("translate(-4px, 0px)");
    const k = nudgeKeyframes(1, 5);
    expect(k[0].transform).toBe(k[2].transform);
  });
  it("wraps any direction number onto the four sides", () => {
    expect(nudgeKeyframes(5, 3)[1].transform).toBe(nudgeKeyframes(1, 3)[1].transform);
    expect(nudgeKeyframes(-1, 3)[1].transform).toBe(nudgeKeyframes(3, 3)[1].transform);
  });
});
