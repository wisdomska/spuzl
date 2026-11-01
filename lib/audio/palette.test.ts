import { describe, expect, it } from "vitest";
import { ALIASES, canStart, clampPan, LENGTH_MS, MAX_VOICES, PALETTE, resolve, RETRIGGER_MS, variation, VOICES } from "./palette";
import { RECIPES } from "./voices";
import { HAPTIC_LEVEL, HAPTICS, LEVELS, PATTERNS } from "@/lib/haptics";

describe("sound palette", () => {
  it("has a recipe and a length for every voice", () => {
    for (const v of VOICES) {
      expect(RECIPES[v], v).toBeTypeOf("function");
      expect(LENGTH_MS[v], v).toBeGreaterThan(0);
    }
    expect(Object.keys(RECIPES).sort()).toEqual([...VOICES].sort());
  });

  it("keeps every voice short (under 1.3 s) and UI voices under 250 ms", () => {
    for (const v of VOICES) expect(LENGTH_MS[v], v).toBeLessThanOrEqual(1300);
    for (const e of ["tap", "toggle", "place", "nav", "sheetOpen", "sheetClose", "countdown", "partyJoin"] as const) {
      expect(LENGTH_MS[PALETTE[e]], e).toBeLessThanOrEqual(250);
    }
  });

  it("resolves palette events, Handoff aliases and raw voice names", () => {
    expect(resolve("tap")).toBe("tick");
    expect(resolve("clear")).toBe("jingle");
    expect(resolve("error")).toBe("buzz");
    expect(resolve("introThump")).toBe("thump");
    expect(resolve("introSwoosh")).toBe("rush");
    expect(resolve("win_jingle")).toBe("jingle");
    expect(resolve("thump")).toBe("thump");
    expect(resolve("nope")).toBeNull();
    for (const [event, voice] of Object.entries(PALETTE)) expect(resolve(event), event).toBe(voice);
    for (const [alias, voice] of Object.entries(ALIASES)) expect(resolve(alias), alias).toBe(voice);
  });

  it("varies pitch by a few cents and level by under 1 dB", () => {
    const lo = variation("tick", () => 0);
    const hi = variation("tick", () => 0.9999);
    expect(lo.rate).toBeLessThan(1);
    expect(hi.rate).toBeGreaterThan(1);
    expect(Math.abs(1200 * Math.log2(hi.rate))).toBeLessThanOrEqual(60);
    expect(lo.gain).toBeGreaterThanOrEqual(0.92);
    expect(hi.gain).toBeLessThanOrEqual(1.08);
    // tuned phrases barely move so chords stay in tune
    expect(Math.abs(1200 * Math.log2(variation("jingle", () => 1).rate))).toBeLessThanOrEqual(8.001);
    expect(variation("pop", () => 0.5)).toEqual({ rate: 1, gain: 1 });
  });

  it("drops voices past the cap and quick retriggers of the same voice", () => {
    expect(canStart({ active: MAX_VOICES, last: {} }, "tick", 0)).toBe(false);
    expect(canStart({ active: 0, last: { tick: 100 } }, "tick", 100 + RETRIGGER_MS - 1)).toBe(false);
    expect(canStart({ active: 0, last: { tick: 100 } }, "tick", 100 + RETRIGGER_MS)).toBe(true);
    expect(canStart({ active: 0, last: { tick: 100 } }, "pop", 101)).toBe(true);
  });

  it("clamps pan", () => {
    expect(clampPan(undefined)).toBe(0);
    expect(clampPan(Number.NaN)).toBe(0);
    expect(clampPan(3)).toBe(1);
    expect(clampPan(-0.4)).toBe(-0.4);
  });
});

describe("haptic map", () => {
  it("follows the light / medium / success / warning convention", () => {
    expect(HAPTIC_LEVEL[PALETTE.tap]).toBe("light");
    expect(HAPTIC_LEVEL[PALETTE.toggle]).toBe("light");
    expect(HAPTIC_LEVEL[PALETTE.nav]).toBe("light");
    expect(HAPTIC_LEVEL[PALETTE.place]).toBe("medium");
    expect(HAPTIC_LEVEL[PALETTE.introThump]).toBe("medium");
    expect(HAPTIC_LEVEL[PALETTE.clear]).toBe("success");
    expect(HAPTIC_LEVEL[PALETTE.error]).toBe("warning");
    expect(HAPTIC_LEVEL[PALETTE.levelUp]).toBe("celebrate");
    expect(HAPTICS.tick).toEqual(LEVELS.light);
    expect(PATTERNS.ruleBreak).toEqual(LEVELS.warning);
  });

  it("keeps ambient sounds off the hand", () => {
    for (const quiet of ["rush", "letter", "swoosh", "sheet_open", "sheet_close", "notify", "twinkle"] as const) {
      expect(HAPTICS[quiet], quiet).toBeUndefined();
    }
  });

  it("never vibrates longer than 200 ms in total for a single event", () => {
    for (const p of Object.values(LEVELS)) expect(p.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(200);
  });
});
