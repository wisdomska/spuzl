import { describe, expect, it } from "vitest";
import {
  ALIASES,
  canStart,
  clampPan,
  LENGTH_MS,
  MAX_VOICES,
  PALETTE,
  prune,
  resolve,
  RETRIGGER_MS,
  variation,
  VOICES,
  type Scheduled,
} from "./palette";
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
    const busy = Array.from({ length: MAX_VOICES }, (_, i) => ({ name: "pop" as const, start: i * 40, end: 1000 }));
    expect(canStart(busy, "tick", 500)).toBe(false);
    expect(canStart(busy, "jingle", 500), "priority voices still sound").toBe(true);
    expect(canStart(busy, "tick", 1000), "free again once they end").toBe(true);
    const tap = [{ name: "tick" as const, start: 100, end: 160 }];
    expect(canStart(tap, "tick", 100 + RETRIGGER_MS - 1)).toBe(false);
    expect(canStart(tap, "tick", 100 + RETRIGGER_MS)).toBe(true);
    expect(canStart(tap, "pop", 101)).toBe(true);
  });

  it("lets a phrase scheduled ahead through: future voices don't block earlier ones", () => {
    let voices: Scheduled[] = [];
    for (let i = 0; i < 12; i++) {
      const start = 100 + i * 50;
      expect(canStart(voices, "pop", start), `tile ${i}`).toBe(true);
      voices.push({ name: "pop", start, end: start + LENGTH_MS.pop });
    }
    voices = prune(voices, 2000);
    expect(voices).toHaveLength(0);
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
