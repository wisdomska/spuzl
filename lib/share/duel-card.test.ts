import { describe, expect, it } from "vitest";
import { duelAward, duelShareModel } from "./duel-card";

const side = (name: string, rounds: number) => ({ name, color: "#B8F23A", rounds });
const r = (n: number, mine: boolean | null) => ({ n, me: 30_000, them: 31_000, mine });

describe("duel share card", () => {
  it("gives one award from how the duel went", () => {
    expect(duelAward({ winner: "me", forfeit: false, me: side("A", 2), them: side("B", 0), rounds: [r(1, true), r(2, true)] }).title).toBe(
      "Clean sweep",
    );
    expect(
      duelAward({ winner: "me", forfeit: false, me: side("A", 2), them: side("B", 1), rounds: [r(1, false), r(2, true), r(3, true)] })
        .title,
    ).toBe("Comeback");
    expect(
      duelAward({ winner: "me", forfeit: false, me: side("A", 2), them: side("B", 1), rounds: [r(1, true), r(2, false), r(3, true)] })
        .title,
    ).toBe("Clutch");
    expect(duelAward({ winner: "me", forfeit: true, me: side("A", 0), them: side("Tracy", 0), rounds: [] })).toMatchObject({
      title: "Won by forfeit",
      sub: "Tracy left before the end",
    });
    expect(duelAward({ winner: null, forfeit: false, me: side("A", 1), them: side("B", 1), rounds: [] }).title).toBe("Dead heat");
    expect(duelAward({ winner: "them", forfeit: false, me: side("A", 1), them: side("B", 2), rounds: [] }).title).toBe(
      "Pushed them all the way",
    );
    expect(duelAward({ winner: "them", forfeit: false, me: side("A", 0), them: side("B", 2), rounds: [] }).title).toBe("Rematch incoming");
  });
  it("hides both names when asked, and words the banner", () => {
    const m = duelShareModel({
      me: side("Ama", 0),
      them: side("Tracy", 0),
      winner: "me",
      forfeit: true,
      gameName: "Coil",
      rounds: [],
      ratingBefore: null,
      ratingAfter: null,
      anon: true,
      h2h: { me: 3, them: 2 },
    });
    expect(m.me.name).toBe("Me");
    expect(m.them.name).toBe("Rival");
    expect(m.banner).toBe("WALKOVER!");
    expect(m.award.sub).toBe("Rival left before the end");
    expect(m.h2h).toEqual({ me: 3, them: 2 });
  });
});
