import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FINE_POINTER_QUERY,
  KEYS_PREF_KEY,
  hasPhysicalKeyboard,
  resetInputModeForTests,
  setKeysPref,
  showOnScreenKeys,
} from "@/components/game/useInputMode";

describe("physical keyboard detection", () => {
  it("asks for a precise pointer that can hover, never the user agent", () => {
    expect(FINE_POINTER_QUERY).toBe("(pointer: fine) and (hover: hover)");
  });

  it("a mouse or trackpad means a physical keyboard, until a touch lands on the screen", () => {
    expect(hasPhysicalKeyboard({ fine: true, touched: false })).toBe(true);
    // A touch laptop or a tablet with a trackpad: the finger wins.
    expect(hasPhysicalKeyboard({ fine: true, touched: true })).toBe(false);
    // Phones and tablets (coarse pointer).
    expect(hasPhysicalKeyboard({ fine: false, touched: false })).toBe(false);
    expect(hasPhysicalKeyboard({ fine: false, touched: true })).toBe(false);
  });
});

describe("the on-screen letter keyboard", () => {
  it("hides on a computer and shows on touch devices", () => {
    expect(showOnScreenKeys({ fine: true, touched: false, pref: null })).toBe(false);
    expect(showOnScreenKeys({ fine: false, touched: false, pref: null })).toBe(true);
    expect(showOnScreenKeys({ fine: true, touched: true, pref: null })).toBe(true);
  });

  it("follows the player's own choice over the device", () => {
    // "Show keyboard" on a computer.
    expect(showOnScreenKeys({ fine: true, touched: false, pref: "show" })).toBe(true);
    // "Hide keyboard" sticks even after a touch.
    expect(showOnScreenKeys({ fine: true, touched: true, pref: "hide" })).toBe(false);
    expect(showOnScreenKeys({ fine: false, touched: false, pref: "hide" })).toBe(false);
  });

  describe("remembering the choice", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      resetInputModeForTests();
    });

    it("stores it in localStorage and survives storage that throws", () => {
      const store = new Map<string, string>();
      vi.stubGlobal("localStorage", { setItem: (k: string, v: string) => store.set(k, v), getItem: (k: string) => store.get(k) ?? null });
      setKeysPref("show");
      expect(store.get(KEYS_PREF_KEY)).toBe("show");
      vi.stubGlobal("localStorage", {
        setItem: () => {
          throw new Error("private mode");
        },
        getItem: () => null,
      });
      expect(() => setKeysPref("hide")).not.toThrow();
    });
  });
});
