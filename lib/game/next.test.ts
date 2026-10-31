import { describe, expect, it } from "vitest";
import { LAUNCH_IDS } from "@/lib/catalog";
import { nextInPath, nextLabel } from "./next";

describe("nextInPath", () => {
  const all = () => true;
  it("follows the Home path after the current game and skips cleared games", () => {
    const [a, b, c] = LAUNCH_IDS;
    expect(nextInPath(a, {}, all)).toBe(b);
    expect(nextInPath(a, { [b]: 1000 }, all)).toBe(c);
  });
  it("never returns the game just played", () => {
    const cleared = Object.fromEntries(LAUNCH_IDS.map((id) => [id, 1]));
    const n = nextInPath(LAUNCH_IDS[0], cleared, all);
    expect(n).not.toBe(LAUNCH_IDS[0]);
  });
  it("names the destination", () => {
    expect(nextLabel("dusk")).toBe("Next in Logic Lab: Dusk");
  });
});
