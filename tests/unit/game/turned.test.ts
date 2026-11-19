// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { layoutPoint, layoutTopOf, setTurned, turnedNow, viewportSize } from "@/components/game/turned";

/** An upright 390 x 844 phone. */
function upright() {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 844 });
}

describe("turned page (full screen on Gotcha or Dash when the phone won't turn)", () => {
  afterEach(() => setTurned(false));

  it("marks the page and swaps the viewport the layout reads", () => {
    upright();
    expect(viewportSize()).toEqual({ w: 390, h: 844 });
    setTurned(true);
    expect(document.documentElement.hasAttribute("data-turned")).toBe(true);
    expect(turnedNow()).toBe(true);
    expect(viewportSize()).toEqual({ w: 844, h: 390 });
    setTurned(false);
    expect(document.documentElement.hasAttribute("data-turned")).toBe(false);
    expect(viewportSize()).toEqual({ w: 390, h: 844 });
  });

  it("maps touches into the turned layout: the screen's left edge is the top, its bottom edge the left", () => {
    upright();
    setTurned(true);
    // The screen's bottom-left corner is the layout's top-left.
    expect(layoutPoint(0, 844)).toEqual({ x: 0, y: 0 });
    // A finger moving right across the upright screen moves down the turned page (Dash: swipe down to duck).
    const a = layoutPoint(100, 400),
      b = layoutPoint(160, 400);
    expect(b.y - a.y).toBe(60);
    expect(b.x).toBe(a.x);
    // Up the upright screen is right along the turned page.
    expect(layoutPoint(100, 300).x - layoutPoint(100, 400).x).toBe(100);
    expect(layoutTopOf({ left: 20, top: 500 } as DOMRect)).toBe(20);
  });

  it("does nothing once the phone is really sideways (the CSS only turns an upright screen)", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 844 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 390 });
    setTurned(true);
    expect(turnedNow()).toBe(false);
    expect(viewportSize()).toEqual({ w: 844, h: 390 });
    expect(layoutPoint(10, 20)).toEqual({ x: 10, y: 20 });
  });
});
