import { describe, expect, it } from "vitest";
import { isPrimaryPress } from "./reflex";

describe("isPrimaryPress (reflex pads)", () => {
  it("counts touch, pen and the main mouse button", () => {
    expect(isPrimaryPress({ pointerType: "touch", button: 0 })).toBe(true);
    expect(isPrimaryPress({ pointerType: "pen", button: 0 })).toBe(true);
    expect(isPrimaryPress({ pointerType: "mouse", button: 0 })).toBe(true);
  });
  it("ignores right and middle clicks", () => {
    expect(isPrimaryPress({ pointerType: "mouse", button: 2 })).toBe(false);
    expect(isPrimaryPress({ pointerType: "mouse", button: 1 })).toBe(false);
  });
});
