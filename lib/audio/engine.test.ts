import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetForTests, configure, isUnlocked, play, unlock } from "./index";
import { setHapticsEnabled } from "@/lib/haptics";

/** A WebAudio stand-in that records which nodes were made. */
function fakeAudio(state: "running" | "suspended" = "running") {
  const made: string[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  });
  const node = (kind: string) => {
    made.push(kind);
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      gain: param(),
      frequency: param(),
      Q: param(),
      pan: param(),
      threshold: param(),
      knee: param(),
      ratio: param(),
      attack: param(),
      release: param(),
      type: "",
      buffer: null,
      loop: false,
    };
  };
  class FakeContext {
    state = state;
    currentTime = 0;
    sampleRate = 8000;
    destination = {};
    resume = vi.fn(() => Promise.resolve());
    createGain = () => node("gain");
    createBiquadFilter = () => node("filter");
    createDynamicsCompressor = () => node("compressor");
    createOscillator = () => node("osc");
    createBufferSource = () => node("noise");
    createStereoPanner = () => node("panner");
    createBuffer = (_c: number, len: number) => ({ duration: len / 8000, getChannelData: () => new Float32Array(len) });
  }
  return { FakeContext, made };
}

const fx: { sound: string; played: boolean; haptic: number[] | null }[] = [];
const vibrate = vi.fn();
let activation = { hasBeenActive: false, isActive: false };

function install(state: "running" | "suspended" = "running") {
  const audio = fakeAudio(state);
  const win = new EventTarget() as EventTarget & { AudioContext: unknown };
  win.AudioContext = audio.FakeContext;
  win.addEventListener("spuzl:fx", (e) => fx.push((e as CustomEvent).detail));
  vi.stubGlobal("window", win);
  vi.stubGlobal("navigator", { vibrate, userActivation: activation });
  return audio;
}

beforeEach(() => {
  vi.useFakeTimers();
  fx.length = 0;
  vibrate.mockClear();
  activation = { hasBeenActive: false, isActive: false };
  __resetForTests();
  setHapticsEnabled(true);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("audio engine", () => {
  it("stays silent and never throws while locked", () => {
    const { made } = install();
    expect(() => play("introThump")).not.toThrow();
    expect(made).toHaveLength(0);
    expect(fx.at(-1)).toMatchObject({ sound: "thump", played: false });
    expect(isUnlocked()).toBe(false);
  });

  it("plays after unlock, through a compressor and a limiter", () => {
    const { made } = install();
    activation.hasBeenActive = true;
    activation.isActive = true;
    unlock();
    play("tap");
    expect(made.filter((k) => k === "compressor")).toHaveLength(2);
    expect(made).toContain("osc");
    expect(fx.at(-1)).toMatchObject({ sound: "tick", played: true });
  });

  it("unlocks from sticky activation left by a tap on an earlier page", () => {
    install();
    activation.hasBeenActive = true;
    play("letterLand", { step: 1 });
    expect(fx.at(-1)).toMatchObject({ sound: "letter", played: true });
  });

  it("skips a suspended context outside a gesture instead of queueing a burst", () => {
    install("suspended");
    activation.hasBeenActive = true;
    unlock();
    play("clear");
    expect(fx.at(-1)).toMatchObject({ played: false });
    activation.isActive = true;
    play("success");
    expect(fx.at(-1)).toMatchObject({ played: true });
  });

  it("respects the sound setting but still fires the haptic", () => {
    const { made } = install();
    activation.hasBeenActive = true;
    unlock();
    const before = made.length;
    configure({ sfx: false });
    play("place");
    expect(made.length).toBe(before);
    expect(vibrate).toHaveBeenCalledWith([16]);
  });

  it("respects the haptics setting", () => {
    install();
    activation.hasBeenActive = true;
    setHapticsEnabled(false);
    play("error");
    expect(vibrate).not.toHaveBeenCalled();
    setHapticsEnabled(true);
    play("error", { silentHaptic: true });
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("pans when asked and delays the haptic with the sound", () => {
    const { made } = install();
    activation.hasBeenActive = true;
    unlock();
    play("introSwoosh", { pan: 0.5, panTo: 0, duration: 0.4 });
    expect(made).toContain("panner");
    play("introThump", { delay: 0.2 });
    expect(vibrate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(vibrate).toHaveBeenCalledWith([16]);
  });

  it("drops a doubled tap from two listeners in the same instant", () => {
    install();
    activation.hasBeenActive = true;
    unlock();
    play("tap");
    play("tap");
    expect(fx.map((f) => f.played)).toEqual([true, false]);
  });

  it("ignores unknown names", () => {
    install();
    play("not-a-sound");
    expect(fx).toHaveLength(0);
  });
});
