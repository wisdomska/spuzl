import { describe, expect, it } from "vitest";
import { gridMove, gridMoveRC } from "./grid-nav";

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

describe("gridMoveRC (rows × columns boards: Oware 2 × 6, Four Up 1 × 7)", () => {
  it("moves within a 2 × 6 board and stops at its edges", () => {
    expect(gridMoveRC(0, "ArrowRight", 2, 6)).toBe(1);
    expect(gridMoveRC(5, "ArrowRight", 2, 6)).toBe(5);
    expect(gridMoveRC(2, "ArrowDown", 2, 6)).toBe(8);
    expect(gridMoveRC(8, "ArrowDown", 2, 6)).toBe(8);
    expect(gridMoveRC(8, "ArrowUp", 2, 6)).toBe(2);
    expect(gridMoveRC(9, "Home", 2, 6)).toBe(6);
    expect(gridMoveRC(6, "End", 2, 6)).toBe(11);
    expect(gridMoveRC(3, "PageDown", 2, 6)).toBe(9);
    expect(gridMoveRC(9, "PageUp", 2, 6)).toBe(3);
  });
  it("a single row: up and down stay put, left and right step", () => {
    expect(gridMoveRC(3, "ArrowUp", 1, 7)).toBe(3);
    expect(gridMoveRC(3, "ArrowDown", 1, 7)).toBe(3);
    expect(gridMoveRC(0, "ArrowLeft", 1, 7)).toBe(0);
    expect(gridMoveRC(6, "ArrowRight", 1, 7)).toBe(6);
    expect(gridMoveRC(2, "End", 1, 7)).toBe(6);
  });
  it("other keys are left to the square's own button", () => {
    expect(gridMoveRC(0, "Enter", 2, 6)).toBeNull();
    expect(gridMoveRC(0, " ", 2, 6)).toBeNull();
  });
});
