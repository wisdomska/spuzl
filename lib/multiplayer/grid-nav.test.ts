import { describe, expect, it } from "vitest";
import { gridMove } from "./grid-nav";

describe("gridMove", () => {
  it("moves one square with the arrows and stops at the edges", () => {
    expect(gridMove(9, "ArrowUp")).toBe(1);
    expect(gridMove(9, "ArrowDown")).toBe(17);
    expect(gridMove(9, "ArrowLeft")).toBe(8);
    expect(gridMove(9, "ArrowRight")).toBe(10);
    expect(gridMove(0, "ArrowUp")).toBe(0);
    expect(gridMove(0, "ArrowLeft")).toBe(0);
    expect(gridMove(63, "ArrowDown")).toBe(63);
    expect(gridMove(63, "ArrowRight")).toBe(63);
  });
  it("jumps to the row ends and the column ends", () => {
    expect(gridMove(10, "Home")).toBe(8);
    expect(gridMove(10, "End")).toBe(15);
    expect(gridMove(42, "PageUp")).toBe(2);
    expect(gridMove(2, "PageDown")).toBe(58);
  });
  it("leaves Enter, Space and Escape to the board", () => {
    for (const k of ["Enter", " ", "Escape", "a"]) expect(gridMove(5, k)).toBeNull();
  });
});
