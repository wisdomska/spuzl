import { describe, expect, it, vi } from "vitest";
import { firstPartyBody, KEY_EVENTS, sanitize, track } from "./track";
import { isWarm, tapToBoard } from "./tap-to-board";
import { isPlayNav, PLAY_NAV } from "./play-nav";
import { ONBOARDING_STEPS, onboardingStepOf } from "./onboarding";

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
    // R2-03: Party start-to-first-move goes first party with its game and duration
    expect(firstPartyBody("party_first_move", { game: "sixer", mode: "race", ms: 1234.6 })).toEqual({
      name: "party_first_move",
      game: "sixer",
      mode: "race",
      kind: undefined,
      ms: 1235,
    });
  });

  it("forwards onboarding steps and hint requests and uses", () => {
    expect(firstPartyBody("onboarding_step", { kind: "too_young" })).toMatchObject({ name: "onboarding_step", kind: "too_young" });
    expect(firstPartyBody("hint_request", { game: "crownfall", mode: "free", kind: "confirm" })).toMatchObject({ kind: "confirm" });
    expect(firstPartyBody("hint_use", { game: "crownfall", mode: "free", kind: "direct" })).toMatchObject({ kind: "direct" });
  });

  it("forwards prompt events with the prompt as mode and the trigger as kind (R2-04)", () => {
    expect(firstPartyBody("prompt_shown", sanitize({ prompt: "alerts", trigger: "friend" }))).toEqual({
      name: "prompt_shown",
      game: undefined,
      mode: "alerts",
      kind: "friend",
      ms: undefined,
    });
    expect(firstPartyBody("prompt_accepted", { prompt: "low_data", trigger: "slow_loads" })).toMatchObject({
      mode: "low_data",
      kind: "slow_loads",
    });
    expect(firstPartyBody("prompt_dismissed", { prompt: "Bad!", trigger: "x".repeat(20) })).toMatchObject({
      mode: undefined,
      kind: undefined,
    });
  });

  it("maps Welcome steps to metric labels", () => {
    expect(onboardingStepOf("under13")).toBe("too_young");
    expect(onboardingStepOf("nickname")).toBe("nickname");
    expect(onboardingStepOf("somewhere")).toBeNull();
    for (const s of ONBOARDING_STEPS) expect(s).toMatch(/^[a-z_]{1,16}$/);
  });
});

describe("play navigation marker", () => {
  it("matches only elements inside a data-play-nav element", () => {
    const at = (hit: boolean) => ({ closest: (sel: string) => (sel === "[data-play-nav]" && hit ? ({} as Element) : null) });
    expect(isPlayNav(at(true))).toBe(true);
    expect(isPlayNav(at(false))).toBe(false);
    expect(isPlayNav(null)).toBe(false);
    expect(isPlayNav({} as Element)).toBe(false);
    expect(PLAY_NAV).toEqual({ "data-play-nav": "" });
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

describe("cold and warm tap to board (R2-ADMIN)", () => {
  it("the first board of the page session is cold, every later one warm", () => {
    expect(isWarm(0)).toBe(false);
    expect(isWarm(1)).toBe(true);
    expect(isWarm(7)).toBe(true);
  });
  it("sends warm first party for tap_to_board only", () => {
    expect(firstPartyBody("tap_to_board", { game: "crownfall", mode: "free", kind: "tap", ms: 800, warm: true })).toMatchObject({
      kind: "tap",
      warm: true,
    });
    expect(firstPartyBody("tap_to_board", { game: "crownfall", mode: "free", kind: "load", ms: 2400, warm: false })).toMatchObject({
      kind: "load",
      warm: false,
    });
    expect(firstPartyBody("tap_to_board", { kind: "tap", ms: 800 })?.warm).toBeUndefined();
    expect(firstPartyBody("share", { kind: "daily", warm: true })?.warm).toBeUndefined();
  });
  it("forwards practice round events with their game", () => {
    for (const e of ["practice_start", "practice_finish", "practice_skip"] as const) {
      expect(KEY_EVENTS).toContain(e);
      expect(firstPartyBody(e, { game: "dusk" })).toMatchObject({ name: e, game: "dusk" });
    }
  });
  it("forwards game_over with the game, bay or bot as mode and the outcome as kind", () => {
    expect(firstPartyBody("game_over", { game: "chess", mode: "bot", kind: "won" })).toMatchObject({
      name: "game_over",
      game: "chess",
      mode: "bot",
      kind: "won",
    });
  });
  it("forwards the R2-P5 growth events first party (school kind as kind)", () => {
    expect(firstPartyBody("party_tv_view", { status: "live" })).toMatchObject({ name: "party_tv_view" });
    expect(firstPartyBody("streak_shield", { status: "granted" })).toMatchObject({ name: "streak_shield" });
    expect(firstPartyBody("school_join", { via: "search", kind: "campus" })).toMatchObject({ name: "school_join", kind: "campus" });
  });
});
