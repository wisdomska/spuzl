import { describe, expect, it } from "vitest";
import { chooseLeague, evenGroupSizes, type LeagueCandidate } from "./grouping";

const opts = { size: 30, minGroup: 8, fillWithFriends: true };
const c = (id: string, over: Partial<LeagueCandidate> = {}): LeagueCandidate => ({
  id,
  tier: 0,
  members: 10,
  friends: 0,
  avgLevel: 3,
  ...over,
});

describe("chooseLeague (SPZ-21)", () => {
  const newbie = { tier: 0, level: 2, isNew: true };

  it("puts a new player with friends first, at any tier, most friends wins", () => {
    const pick = chooseLeague(newbie, [c("a"), c("b", { tier: 2, friends: 1 }), c("c", { tier: 1, friends: 3 })], opts);
    expect(pick).toBe("c");
  });

  it("skips friend groups that are full", () => {
    expect(chooseLeague(newbie, [c("a"), c("b", { friends: 2, members: 30 })], opts)).toBe("a");
  });

  it("ignores friends when the setting is off or the player is not new", () => {
    const groups = [c("lvl", { avgLevel: 2 }), c("fr", { tier: 0, friends: 2, avgLevel: 20 })];
    expect(chooseLeague(newbie, groups, { ...opts, fillWithFriends: false })).toBe("lvl");
    expect(chooseLeague({ ...newbie, isNew: false }, groups, opts)).toBe("lvl");
  });

  it("level-matches within the player's tier, topping up groups under minGroup first", () => {
    const groups = [
      c("close", { avgLevel: 2, members: 20 }),
      c("small", { avgLevel: 9, members: 3 }),
      c("other-tier", { tier: 1, members: 2 }),
    ];
    expect(chooseLeague(newbie, groups, opts)).toBe("small");
    expect(chooseLeague(newbie, groups, { ...opts, minGroup: 2 })).toBe("close");
  });

  it("prefers the closest average level, then the fuller group", () => {
    const groups = [
      c("far", { avgLevel: 12 }),
      c("near-small", { avgLevel: 3, members: 12 }),
      c("near-full", { avgLevel: 1, members: 25 }),
    ];
    expect(chooseLeague(newbie, groups, opts)).toBe("near-full");
  });

  it("returns null when nothing fits, so a new group opens", () => {
    expect(chooseLeague(newbie, [], opts)).toBeNull();
    expect(chooseLeague(newbie, [c("full", { members: 30 }), c("t3", { tier: 3 })], opts)).toBeNull();
  });
});

describe("evenGroupSizes", () => {
  it("splits evenly and never leaves a straggler", () => {
    expect(evenGroupSizes(0, 30)).toEqual([]);
    expect(evenGroupSizes(5, 30)).toEqual([5]);
    expect(evenGroupSizes(30, 30)).toEqual([30]);
    expect(evenGroupSizes(31, 30)).toEqual([16, 15]);
    expect(evenGroupSizes(61, 30)).toEqual([21, 20, 20]);
  });
});
