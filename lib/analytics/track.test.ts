import { describe, expect, it, vi } from "vitest";
import { KEY_EVENTS, sanitize, track } from "./track";

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
