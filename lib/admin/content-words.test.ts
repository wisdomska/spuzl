import { describe, expect, it } from "vitest";
import { ago, clockToSec, durationWords, exactTime, plainCheck, plural, shortDate } from "./content-words";

const NOW = Date.parse("2026-11-11T14:05:00Z");

describe("content words", () => {
  it("writes dates and exact times in GMT", () => {
    expect(shortDate("2026-11-11")).toBe("Wed 11 Nov");
    expect(shortDate("2026-11-11T23:59:00Z")).toBe("Wed 11 Nov");
    expect(exactTime("2026-11-11T09:03:00Z")).toBe("Wed 11 Nov 2026, 09:03 GMT");
  });

  it("says how long ago", () => {
    expect(ago("2026-11-11T14:04:40Z", NOW)).toBe("just now");
    expect(ago("2026-11-11T14:00:00Z", NOW)).toBe("5 min ago");
    expect(ago("2026-11-11T13:00:00Z", NOW)).toBe("1 hour ago");
    expect(ago("2026-11-11T02:00:00Z", NOW)).toBe("12 hours ago");
    expect(ago("2026-11-10T12:00:00Z", NOW)).toBe("yesterday");
    expect(ago("2026-11-08T12:00:00Z", NOW)).toBe("3 days ago");
    expect(ago("2026-10-01T12:00:00Z", NOW)).toBe("Thu 1 Oct");
    // a clock a little ahead never says "in the future"
    expect(ago("2026-11-11T14:06:00Z", NOW)).toBe("just now");
  });

  it("writes durations", () => {
    expect(durationWords(45)).toBe("45 s");
    expect(durationWords(80)).toBe("1 min 20 s");
    expect(durationWords(120)).toBe("2 min");
    expect(durationWords(-1)).toBe("");
    expect(clockToSec("1:44")).toBe(104);
    expect(clockToSec("soon")).toBeNull();
    expect(plural(1, "player")).toBe("1 player");
    expect(plural(1200, "player")).toBe("1,200 players");
  });

  it("puts every solve-check line in plain words", () => {
    expect(plainCheck({ id: "unique", label: "Unique solution", status: "pass", value: "solver 12 ms" })).toEqual({
      label: "Only one correct answer",
      status: "pass",
      value: "Yes",
    });
    expect(plainCheck({ id: "unique", label: "", status: "fail", value: "2 or more" }).value).toMatch(/Don't publish/);
    expect(plainCheck({ id: "unique", label: "", status: "warn", value: "2 or more" }).value).toMatch(/allowed/);
    expect(plainCheck({ id: "unique", label: "", status: "info", value: "not required" }).value).toBe("Not needed for this game");
    expect(plainCheck({ id: "verify", label: "", status: "warn", value: "needs play test" }).value).toMatch(/Play test/);
    expect(plainCheck({ id: "hash", label: "", status: "fail", value: "mismatch" }).value).toMatch(/damaged/);
    expect(plainCheck({ id: "difficulty", label: "", status: "pass", value: "6.2 / hard" }).value).toBe("Hard, 6.2 out of 10");
    expect(plainCheck({ id: "difficulty", label: "", status: "warn", value: "3.0 / easy, day wants hard" }).value).toBe(
      "Easy, 3.0 out of 10. This day usually gets hard.",
    );
    expect(plainCheck({ id: "seed", label: "", status: "info", value: "written content" }).value).toMatch(/Written by a person/);
    expect(plainCheck({ id: "duplicate", label: "", status: "warn", value: "same as 2026-03-06" }).value).toBe(
      "No: it's the same puzzle as Fri 6 Mar",
    );
    expect(plainCheck({ id: "duplicate", label: "", status: "pass", value: "none" }).value).toBe("Yes");
    expect(plainCheck({ id: "median", label: "", status: "info", value: "1:20 (n=3)" }).value).toBe("1 min 20 s (from 3 players)");
    expect(plainCheck({ id: "median", label: "", status: "info", value: "no clears yet" }).value).toBe("Nobody has finished it yet");
    expect(plainCheck({ id: "new", label: "Something new", status: "info", value: "x" })).toEqual({
      label: "Something new",
      status: "info",
      value: "x",
    });
  });
});
