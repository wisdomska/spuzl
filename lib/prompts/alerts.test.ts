import { describe, expect, it } from "vitest";
import { alertsStateFrom, dueTrigger, emptyAlertsState, fireTrigger, markAsked, parseAlertsState, streakReached } from "./alerts";
import { DEFAULTS } from "@/lib/game-settings/schema";

const DAY = 24 * 3600_000;
const T0 = Date.UTC(2026, 10, 6, 12);
const opts = (now: number, enabled: readonly string[] = DEFAULTS["prompts.alertsTriggers"]) => ({
  enabled,
  cooldownDays: DEFAULTS["prompts.alertsCooldownDays"],
  now,
});

describe("notification ask triggers (R2-04)", () => {
  it("defaults: all three triggers, 7 days apart, a 3-day streak", () => {
    expect([...DEFAULTS["prompts.alertsTriggers"]].sort()).toEqual(["friend", "invite", "streak"]);
    expect(DEFAULTS["prompts.alertsCooldownDays"]).toBe(7);
    expect(DEFAULTS["prompts.alertsStreakDays"]).toBe(3);
  });

  it("never asks cold: a new player has no trigger", () => {
    expect(dueTrigger(emptyAlertsState(), opts(T0))).toBeNull();
  });

  it("asks after a trigger, once", () => {
    let s = fireTrigger(emptyAlertsState(), "friend", T0);
    expect(dueTrigger(s, opts(T0))).toBe("friend");
    s = markAsked(s, T0 + 1000);
    expect(dueTrigger(s, opts(T0 + 1000))).toBeNull();
    // the same trigger again changes nothing, even weeks later
    expect(fireTrigger(s, "friend", T0 + 30 * DAY)).toBe(s);
    expect(dueTrigger(s, opts(T0 + 30 * DAY))).toBeNull();
  });

  it("after the ask, waits the cooldown and a new trigger", () => {
    let s = markAsked(fireTrigger(emptyAlertsState(), "friend", T0), T0);
    s = fireTrigger(s, "invite", T0 + 2 * DAY);
    expect(dueTrigger(s, opts(T0 + 6 * DAY))).toBeNull();
    expect(dueTrigger(s, opts(T0 + 7 * DAY))).toBe("invite");
    s = markAsked(s, T0 + 7 * DAY);
    s = fireTrigger(s, "streak", T0 + 8 * DAY);
    expect(dueTrigger(s, opts(T0 + 13 * DAY))).toBeNull();
    expect(dueTrigger(s, opts(T0 + 14 * DAY))).toBe("streak");
    // three triggers, three asks at most
    s = markAsked(s, T0 + 14 * DAY);
    expect(dueTrigger(s, opts(T0 + 100 * DAY))).toBeNull();
  });

  it("counts only the triggers the admin has on, and picks the latest", () => {
    let s = fireTrigger(emptyAlertsState(), "streak", T0);
    s = fireTrigger(s, "invite", T0 + 1000);
    expect(dueTrigger(s, opts(T0 + 2000))).toBe("invite");
    expect(dueTrigger(s, opts(T0 + 2000, ["streak"]))).toBe("streak");
    expect(dueTrigger(s, opts(T0 + 2000, []))).toBeNull();
    expect(dueTrigger(s, { ...opts(T0 + 2000), cooldownDays: 1 })).toBe("invite");
  });

  it("reads stored state safely, and the old Not now record seeds the cooldown", () => {
    expect(parseAlertsState("garbage")).toEqual(emptyAlertsState());
    expect(parseAlertsState(JSON.stringify({ fired: { friend: T0, bogus: 1, invite: "x" }, lastAskAt: T0 }))).toEqual({
      fired: { friend: T0 },
      lastAskAt: T0,
    });
    expect(parseAlertsState(null, JSON.stringify({ n: 2, at: T0 })).lastAskAt).toBe(T0);
    expect(parseAlertsState(null, "1").lastAskAt).toBe(0);
    expect(alertsStateFrom(`legacy:${JSON.stringify({ n: 1, at: T0 })}`).lastAskAt).toBe(T0);
    expect(alertsStateFrom("legacy:")).toEqual(emptyAlertsState());
    // storage blocked: never asks (a Not now couldn't be remembered)
    const blocked = alertsStateFrom(null);
    expect(dueTrigger(fireTrigger(blocked, "friend", T0), opts(T0))).toBeNull();
  });

  it("knows when a streak earns it", () => {
    expect(streakReached(3, 3)).toBe(true);
    expect(streakReached(2, 3)).toBe(false);
    expect(streakReached(undefined, 3)).toBe(false);
  });
});
