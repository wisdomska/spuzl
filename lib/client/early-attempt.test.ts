import { afterEach, describe, expect, it, vi } from "vitest";

const start = vi.fn(() => Promise.resolve({ attemptId: "a" }));
vi.mock("./api", () => ({ startAttempt: (...a: unknown[]) => start(...(a as [])) }));
vi.mock("./resume", () => ({ resumeIdFor: () => undefined }));
vi.mock("@/lib/perf/quiet", () => ({ markPlayTap: () => {} }));

import { parsePlayHref, primableLink, primeAttempt, setPrimeGate, takePrimed } from "./early-attempt";

describe("attempt priming (SPZ-01, R2-01)", () => {
  it("reads daily, free play and level links", () => {
    expect(parsePlayHref("/play/crownfall")).toEqual({ game: "crownfall", mode: "daily" });
    expect(parsePlayHref("/play/dusk?mode=free&difficulty=hard")).toEqual({ game: "dusk", mode: "free", difficulty: "hard" });
    // Daily Five links prime too; the server picks the day and the puzzle, so no difficulty rides along.
    expect(parsePlayHref("/play/remix?mode=five&difficulty=hard")).toEqual({ game: "remix", mode: "five", difficulty: undefined });
    // R2-01: Continue opens ladder games in level mode; those taps are primed too
    expect(parsePlayHref("/play/dusk?mode=level")).toEqual({ game: "dusk", mode: "level", level: undefined });
    expect(parsePlayHref("/play/dusk?mode=level&level=12")).toEqual({ game: "dusk", mode: "level", level: 12 });
    expect(parsePlayHref("/play/dusk?mode=level&level=x")).toEqual({ game: "dusk", mode: "level", level: undefined });
  });

  it("primes only a plain left click on a Play link, never a sheet link (R2-12 Library rows)", () => {
    const plain = { defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
    const link = { getAttribute: () => "/play/dusk" };
    const el = (sel: Record<string, unknown>) => ({ closest: (s: string) => (sel[s] as Element | undefined) ?? null });
    const play = el({ "a[href^='/play/']": link });
    const sheet = el({ "a[href^='/play/']": link, "[data-sheet-link]": link });
    expect(primableLink(play, plain)).toBe(link);
    expect(primableLink(sheet, plain)).toBeNull();
    expect(primableLink(play, { ...plain, ctrlKey: true })).toBeNull();
    expect(primableLink(play, { ...plain, metaKey: true })).toBeNull();
    expect(primableLink(play, { ...plain, shiftKey: true })).toBeNull();
    expect(primableLink(play, { ...plain, button: 1 })).toBeNull();
    expect(primableLink(play, { ...plain, defaultPrevented: true })).toBeNull();
    expect(primableLink(el({}), plain)).toBeNull();
  });

  it("leaves other links alone", () => {
    expect(parsePlayHref("/play/dusk?mode=archive&date=2026-10-01")).toBeNull();
    expect(parsePlayHref("/play/chess/bot")).toBeNull();
    expect(parsePlayHref("/library")).toBeNull();
  });
});

describe("R2-07: no priming before a practice round", () => {
  afterEach(() => {
    setPrimeGate(null);
    start.mockClear();
  });

  it("skips a game the gate says is not learned, and primes the rest", () => {
    setPrimeGate((game) => game !== "dusk");
    primeAttempt("/play/dusk?mode=level");
    expect(start).not.toHaveBeenCalled();
    expect(takePrimed("dusk", "level")).toBeNull();
    primeAttempt("/play/nine?mode=free");
    expect(start).toHaveBeenCalledTimes(1);
    expect(takePrimed("nine", "free")).not.toBeNull();
  });

  it("primes everything when no gate is set", () => {
    primeAttempt("/play/crownfall?mode=level&level=3");
    expect(start).toHaveBeenCalledTimes(1);
  });
});
