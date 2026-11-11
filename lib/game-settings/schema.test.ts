import { describe, expect, it } from "vitest";
import { DEFAULTS, SETTINGS, SETTING_GROUPS, SETTING_LIST_MAX, mergeSettings, sameSetting, validateSetting } from "./schema";

describe("game settings schema", () => {
  it("every default passes its own validation", () => {
    for (const [k, d] of Object.entries(SETTINGS)) expect(validateSetting(k, d.default), k).toBeNull();
  });
  it("enforces ranges, types and known keys", () => {
    expect(validateSetting("hints.dailyXpKeptPct", 101)).toMatch(/between 0 and 100/);
    expect(validateSetting("hints.dailyXpKeptPct", 12.5)).toMatch(/whole number/);
    expect(validateSetting("perf.prefetch", "yes")).toMatch(/on or off/);
    expect(validateSetting("nope", 1)).toMatch(/Unknown/);
    expect(validateSetting("free.xpDailyCap", 5001)).toMatch(/between 0 and 5000/);
    expect(validateSetting("free.sparksPerClear", -1)).toMatch(/between 0 and 50/);
  });
  it("checks choice settings against their options (Daily Five difficulty)", () => {
    expect(validateSetting("dailyFive.difficulty", "medium")).toBeNull();
    expect(validateSetting("dailyFive.difficulty", "mega")).toMatch(/one of: easy, medium, hard/);
    expect(validateSetting("dailyFive.difficulty", 1)).toMatch(/one of/);
    expect(validateSetting("dailyFive.resetHour", 24)).toMatch(/between 0 and 23/);
  });
  it("ships the Daily Five on, resetting at midnight GMT, on easy", () => {
    expect(DEFAULTS["dailyFive.enabled"]).toBe(true);
    expect(DEFAULTS["dailyFive.resetHour"]).toBe(0);
    expect(DEFAULTS["dailyFive.difficulty"]).toBe("easy");
  });
  it("free-play economy defaults match the original design (+10 XP, +5 Sparks, 300 XP a day)", () => {
    expect(DEFAULTS["free.xpPerClear"]).toBe(10);
    expect(DEFAULTS["free.sparksPerClear"]).toBe(5);
    expect(DEFAULTS["free.xpDailyCap"]).toBe(300);
  });
  it("prompt timing settings (R2-04): ranges and a set of triggers", () => {
    expect(validateSetting("prompts.alertsCooldownDays", 0)).toMatch(/between 1 and 30/);
    expect(validateSetting("prompts.alertsCooldownDays", 31)).toMatch(/between 1 and 30/);
    expect(validateSetting("prompts.alertsStreakDays", 1)).toMatch(/between 2 and 14/);
    expect(validateSetting("prompts.lowDataThresholdMs", 1999)).toMatch(/between 2000 and 15000/);
    expect(validateSetting("prompts.lowDataSlowLoads", 6)).toMatch(/between 1 and 5/);
    expect(validateSetting("prompts.alertsTriggers", ["friend", "streak"])).toBeNull();
    expect(validateSetting("prompts.alertsTriggers", [])).toBeNull();
    expect(validateSetting("prompts.alertsTriggers", ["friend", "friend"])).toMatch(/at most once/);
    expect(validateSetting("prompts.alertsTriggers", ["birthday"])).toMatch(/list of/);
    expect(validateSetting("prompts.alertsTriggers", "friend")).toMatch(/list of/);
    expect(validateSetting("prompts.alertsTriggers", 3)).toMatch(/list of/);
    const s = mergeSettings([
      { key: "prompts.alertsTriggers", value: ["invite"] },
      { key: "prompts.lowDataSlowLoads", value: 3 },
    ]);
    expect(s["prompts.alertsTriggers"]).toEqual(["invite"]);
    expect(s["prompts.lowDataSlowLoads"]).toBe(3);
    expect(mergeSettings([{ key: "prompts.alertsTriggers", value: ["nope"] }])["prompts.alertsTriggers"]).toEqual(
      DEFAULTS["prompts.alertsTriggers"],
    );
    expect(sameSetting(["streak", "friend"], ["friend", "streak"])).toBe(true);
    expect(sameSetting(["friend"], ["friend", "streak"])).toBe(false);
    expect(sameSetting(3, 3)).toBe(true);
  });

  it("merges stored rows over defaults and ignores bad rows", () => {
    const s = mergeSettings([
      { key: "duel.roundResultMs", value: 3000 },
      { key: "quickfire.autoAdvanceMs", value: 99 },
      { key: "ghost.key", value: 1 },
    ]);
    expect(s["duel.roundResultMs"]).toBe(3000);
    expect(s["quickfire.autoAdvanceMs"]).toBe(DEFAULTS["quickfire.autoAdvanceMs"]);
    expect(Object.keys(s)).toEqual(Object.keys(DEFAULTS));
  });
});

describe("party.countdownSeconds (R2-03)", () => {
  it("defaults to 3 (3, 2, 1) and allows 2 to 5", () => {
    expect(DEFAULTS["party.countdownSeconds"]).toBe(3);
    expect(validateSetting("party.countdownSeconds", 2)).toBeNull();
    expect(validateSetting("party.countdownSeconds", 5)).toBeNull();
    expect(validateSetting("party.countdownSeconds", 1)).toMatch(/between 2 and 5/);
    expect(validateSetting("party.countdownSeconds", 6)).toMatch(/between 2 and 5/);
    expect(SETTINGS["party.countdownSeconds"].help.length).toBeGreaterThan(20);
  });
});

describe("R2-07: practice.disabled", () => {
  it("is a set of game ids with practice boards, empty by default", () => {
    expect(DEFAULTS["practice.disabled"]).toEqual([]);
    expect(validateSetting("practice.disabled", ["dusk", "crownfall"])).toBeNull();
    expect(validateSetting("practice.disabled", [])).toBeNull();
    expect(validateSetting("practice.disabled", ["not-a-game"])).toMatch(/Must be a list/);
    expect(validateSetting("practice.disabled", "dusk")).toMatch(/Must be a list/);
    expect(SETTINGS["practice.disabled"].help.length).toBeGreaterThan(40);
  });

  it("every option of every multi-pick setting can be ticked at once through the admin API (R2-ADMIN)", () => {
    for (const [key, def] of Object.entries(SETTINGS)) {
      if (def.kind !== "set") continue;
      expect(def.options.length, key).toBeLessThanOrEqual(SETTING_LIST_MAX);
      expect(
        validateSetting(
          key,
          def.options.map((o) => o.id),
        ),
        key,
      ).toBeNull();
    }
    // Practice boards today: more games than the old cap of 20.
    expect(SETTINGS["practice.disabled"].options.length).toBeGreaterThan(20);
  });
});

describe("Game state: the lab switch moved to the Games page", () => {
  it("drops features.labGames: an old stored row is ignored and never becomes a key", () => {
    expect("features.labGames" in SETTINGS).toBe(false);
    expect(validateSetting("features.labGames", [])).toBe("Unknown setting");
    const s = mergeSettings([{ key: "features.labGames", value: ["five", "dara", "twotruths"] }]);
    expect(Object.keys(s)).not.toContain("features.labGames");
  });

  it("carries the games' runtime switch with the settings, every game On by default", () => {
    expect(DEFAULTS["games.testing"]).toEqual([]);
    expect(DEFAULTS["games.off"]).toEqual([]);
    expect(DEFAULTS["games.noVersus"]).toEqual([]);
    const s = mergeSettings([]);
    expect(s["games.off"]).toEqual([]);
    // The switch is not a setting: the settings API can't write it (the Games page owns it).
    expect(validateSetting("games.off", ["crownfall"])).toBe("Unknown setting");
  });

  it("keeps practice.disabled as storage, edited on the Games page, not on Game settings", () => {
    expect(SETTINGS["practice.disabled"].editedOn).toBe("games");
    expect(validateSetting("practice.disabled", ["crownfall"])).toBeNull();
    const onSettingsPage = Object.entries(SETTINGS)
      .filter(([, d]) => !("editedOn" in d))
      .map(([k]) => k);
    expect(onSettingsPage).not.toContain("practice.disabled");
    expect(onSettingsPage.length).toBeGreaterThan(20);
  });

  it("every setting has a plain label, a one-line help and a known section", () => {
    const groups = SETTING_GROUPS.map((g) => g.name as string);
    for (const [key, d] of Object.entries(SETTINGS)) {
      expect(groups, key).toContain(d.group);
      expect(d.label.length, key).toBeGreaterThan(3);
      // One short line; the rest belongs in `more`.
      expect(d.help.length, key).toBeLessThanOrEqual(150);
      // No setting keys or developer units in what the owner reads.
      for (const text of [d.label, d.help, "more" in d ? (d.more ?? "") : ""])
        expect(text, key).not.toMatch(/\bms\b|[a-z]+\.[a-z]+[A-Z]|\/[a-z]+\//);
    }
  });

  it("replaces features.newGames, whose stored row is now ignored", () => {
    expect("features.newGames" in SETTINGS).toBe(false);
    const s = mergeSettings([{ key: "features.newGames", value: true }]);
    expect(Object.keys(s)).not.toContain("features.newGames");
  });
});
