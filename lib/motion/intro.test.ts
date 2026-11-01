import { describe, expect, it } from "vitest";
import { FINISH_AT, introCues, letterContact, SPUZ_AT, TAGLINE_AT, zImpact, zLaunch } from "./intro";

describe("logo intro timeline", () => {
  it("lands the thump exactly on the Z's impact keyframe", () => {
    const thump = introCues(false).find((c) => c.event === "introThump")!;
    expect(thump.at).toBeCloseTo(zImpact, 6);
  });

  it("stretches the swoosh over the Z's flight, panned right to centre", () => {
    const swoosh = introCues(false).find((c) => c.event === "introSwoosh")!;
    expect(swoosh.at).toBeCloseTo(zLaunch, 6);
    expect(swoosh.at + swoosh.opts!.duration!).toBeCloseTo(zImpact, 6);
    expect(swoosh.opts!.pan).toBeGreaterThan(0);
    expect(swoosh.opts!.panTo).toBe(0);
  });

  it("taps once per letter on contact, in order, before the Z lands", () => {
    const taps = introCues(false).filter((c) => c.event === "letterLand");
    expect(taps.map((c) => c.opts!.step)).toEqual([0, 1, 2, 3]);
    taps.forEach((c, i) => expect(c.at).toBeCloseTo(letterContact(i), 6));
    expect(taps.at(-1)!.at).toBeLessThan(zImpact);
  });

  it("keeps beats in order: letters, Z, Spuz, tagline, hand-off", () => {
    expect(letterContact(3)).toBeLessThan(zImpact);
    expect(zImpact).toBeLessThan(SPUZ_AT);
    expect(SPUZ_AT).toBeLessThan(TAGLINE_AT);
    expect(TAGLINE_AT + 0.45).toBeLessThan(FINISH_AT);
    const cues = introCues(false);
    expect(cues.map((c) => c.at)).toEqual([...cues.map((c) => c.at)].sort((a, b) => a - b));
  });

  it("plays one gentle cue under reduced motion", () => {
    const cues = introCues(true);
    expect(cues).toHaveLength(1);
    expect(cues[0].event).toBe("introThump");
    expect(cues[0].opts!.gain).toBeLessThan(1);
  });
});
