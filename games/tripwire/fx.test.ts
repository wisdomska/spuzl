import { describe, expect, it } from "vitest";
import { spreadOf } from "./fx";

describe("spreadOf", () => {
  it("measures the farthest opened tile in king moves", () => {
    // 5 wide: tile 12 is row 2, column 2
    expect(spreadOf([12], 12, 5)).toBe(0);
    expect(spreadOf([12, 13, 7, 18], 12, 5)).toBe(1);
    expect(spreadOf([0, 24, 12], 12, 5)).toBe(2);
    expect(spreadOf([4], 0, 5)).toBe(4);
  });
  it("is 0 for an empty flood", () => {
    expect(spreadOf([], 3, 5)).toBe(0);
  });
});
