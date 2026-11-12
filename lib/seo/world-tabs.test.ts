import { describe, expect, it } from "vitest";
import { tabFromHash, tabIndexForKey } from "./world-tabs";

const IDS = ["logic", "word", "reflex", "board"];

describe("world tabs (R6)", () => {
  it("opens the tab the hash names, with or without #, any case", () => {
    expect(tabFromHash("#word", IDS)).toBe("word");
    expect(tabFromHash("board", IDS)).toBe("board");
    expect(tabFromHash("#Reflex", IDS)).toBe("reflex");
  });

  it("falls back to the first tab for an empty or unknown hash", () => {
    expect(tabFromHash("", IDS)).toBe("logic");
    expect(tabFromHash("#faq", IDS)).toBe("logic");
    expect(tabFromHash("#%E0", IDS.slice(1))).toBe("word");
    expect(tabFromHash("#x", [])).toBeUndefined();
  });

  it("moves with the arrow keys (wrapping) and jumps with Home and End", () => {
    expect(tabIndexForKey("ArrowRight", 0, 4)).toBe(1);
    expect(tabIndexForKey("ArrowRight", 3, 4)).toBe(0);
    expect(tabIndexForKey("ArrowLeft", 0, 4)).toBe(3);
    expect(tabIndexForKey("ArrowDown", 1, 4)).toBe(2);
    expect(tabIndexForKey("ArrowUp", 1, 4)).toBe(0);
    expect(tabIndexForKey("Home", 2, 4)).toBe(0);
    expect(tabIndexForKey("End", 0, 4)).toBe(3);
    expect(tabIndexForKey("Enter", 0, 4)).toBeNull();
    expect(tabIndexForKey("ArrowRight", 0, 0)).toBeNull();
  });
});
