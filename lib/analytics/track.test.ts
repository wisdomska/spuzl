import { describe, expect, it, vi } from "vitest";
import { firstPartyBody, KEY_EVENTS, sanitize, track } from "./track";
import { tapToBoard } from "./tap-to-board";

describe("analytics", () => {
  it("covers every SRS key event", () => {
    for (const e of ["app_open", "attempt_clear", "share", "streak_change", "league_result", "challenge_sent"]) {
      expect(KEY_EVENTS).toContain(e);
    }
  });

  it("keeps short primitives and drops anything personal", () => {
    expect(
      sanitize({
        game: "crownfall",
        timeMs: 72_000,
        hints: 0,
        relaxed: false,
        nickname: "Ama",
        email: "a@b.co",
        playerId: "u1",
        user_id: "u1",
        city: "Accra",
        note: "mail me at a@b.co",
        long: "x".repeat(65),
        nan: Number.NaN,
        nothing: null,
        "bad key": 1,
      }),
    ).toEqual({ game: "crownfall", timeMs: 72_000, hints: 0, relaxed: false });
  });

  it("caps the number of properties", () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i]));
    expect(Object.keys(sanitize(many))).toHaveLength(16);
  });

  it("is a no-op without a PostHog key", () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    expect(() => track("app_open", { a: 1 })).not.toThrow();
    vi.unstubAllEnvs();
  });
});

describe("first-party metrics", () => {
  it("forwards only the Metrics events, with labels and a clamped duration", () => {
    expect(firstPartyBody("app_open", {})).toBeNull();
    expect(firstPartyBody("share", { target: "x", kind: "daily", lowData: false })).toEqual({
      name: "share",
      game: undefined,
      mode: undefined,
      kind: "daily",
      ms: undefined,
    });
    expect(firstPartyBody("tap_to_board", { game: "crownfall", mode: "daily", kind: "tap", ms: 999_999.4 })).toMatchObject({
      game: "crownfall",
      kind: "tap",
      ms: 120_000,
    });
    expect(firstPartyBody("hint_cancel", { game: "Bad Game!", mode: "free" })).toMatchObject({ game: undefined, mode: "free" });
  });
});

describe("tap to board", () => {
  const t = { mount: 10_000, ready: 10_400, origin: 1, sinceNav: 2_000 };
  it("measures from a tap made before the Play screen mounted", () => {
    expect(tapToBoard({ at: 9_900, origin: 1 }, t)).toEqual({ kind: "tap", ms: 500 });
    // across a full page load the stamp carries the old document's origin
    expect(tapToBoard({ at: 9_900, origin: 0 }, t)).toEqual({ kind: "tap", ms: 500 });
  });
  it("falls back to navigation start on a cold load, and ignores stale or later taps", () => {
    expect(tapToBoard(null, t)).toEqual({ kind: "load", ms: 2_000 });
    expect(tapToBoard(null, { ...t, sinceNav: 60_000 })).toBeNull();
    expect(tapToBoard({ at: 10_200, origin: 1 }, t)).toBeNull();
    expect(tapToBoard({ at: 1_000, origin: 1 }, { ...t, ready: 30_000 })).toBeNull();
  });
});
