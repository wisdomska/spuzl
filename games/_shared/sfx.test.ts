// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __resetForTests } from "@/lib/audio";
import { sfx } from "./sfx";

type Fx = { sound: string; haptic: readonly number[] | null };
let heard: Fx[] = [];
const listen = (e: Event) => heard.push((e as CustomEvent<Fx>).detail);

beforeEach(() => {
  __resetForTests();
  heard = [];
  window.addEventListener("spuzl:fx", listen);
});
afterEach(() => window.removeEventListener("spuzl:fx", listen));

describe("board sfx vocabulary", () => {
  it("maps each board action to one palette voice with its haptic", () => {
    sfx.place(3);
    sfx.remove();
    sfx.select();
    sfx.move();
    sfx.capture();
    expect(heard.map((h) => h.sound)).toEqual(["pop", "tick", "tick", "clack", "capture"]);
    expect(heard[0].haptic).toEqual([16]); // placements knock (medium)
    expect(heard[1].haptic).toEqual([8]); // removals tick (light)
  });

  it("keeps drag steps off the hand and misses free of the rule-break warning", () => {
    sfx.trace(4);
    sfx.miss();
    expect(heard).toEqual([
      { sound: "synth", played: false, haptic: null },
      { sound: "fizzle", played: false, haptic: null },
    ]);
  });

  it("plays a cascade as n chimes with a single haptic", () => {
    sfx.cascade(4);
    expect(heard.map((h) => h.sound)).toEqual(["chime", "chime", "chime", "chime"]);
  });
});
