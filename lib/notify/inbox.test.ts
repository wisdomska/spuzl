import { describe, expect, it } from "vitest";
import { buildInbox, unseenCount } from "./inbox";

describe("notifications list", () => {
  it("puts moves and friend requests first, then the roundup and new games", () => {
    const items = buildInbox({
      week: { id: "2026-11-02", cleared: 38 },
      newGames: { key: "a,b", unplayed: 2 },
      friendRequests: { names: ["Ama", "Kofi", "Esi"] },
      yourMove: [{ id: "g1", opponent: "Yaw", detail: "22 h left." }],
    });
    expect(items.map((i) => i.kind)).toEqual(["your_move", "friends", "week", "new_games"]);
    expect(items[0]).toMatchObject({ title: "Your move against Yaw", href: "/bay/g1", removable: false });
    expect(items[1]).toMatchObject({ title: "3 friend requests", detail: "From Ama, Kofi and 1 more.", href: "/friends" });
    expect(items[2]).toMatchObject({ title: "Your week: 38 games cleared", removable: true });
    expect(items[2].href).toBeUndefined();
    expect(items[3]).toMatchObject({ title: "2 new games to try", href: "/library?filter=new" });
  });

  it("leaves out empty sources and removed items", () => {
    expect(buildInbox({ newGames: { key: "a", unplayed: 0 }, friendRequests: { names: [] } })).toEqual([]);
    expect(buildInbox({ week: { id: "w", cleared: 1 }, removed: ["week:w"] })).toEqual([]);
  });

  it("counts only what this device hasn't seen", () => {
    const items = buildInbox({ week: { id: "w", cleared: 1 }, newGames: { key: "a", unplayed: 1 } });
    expect(unseenCount(items, [])).toBe(2);
    expect(unseenCount(items, ["week:w"])).toBe(1);
  });
});
