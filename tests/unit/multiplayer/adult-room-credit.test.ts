import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { adultRoomCredit } from "@/lib/multiplayer/server/rewards";
import { BADGES } from "@/lib/gamification/badges";
import { WEEKLY_CHAIN } from "@/lib/gamification/quests";

describe("18+ rooms count toward quests and badges (owner decision Q)", () => {
  it("a winner of a Draw It or Two Truths room advances the multiplayer-wins quest and earns the Party win badge", () => {
    for (const mode of ["draw", "truths"]) expect(adultRoomCredit(true, mode)).toEqual({ quests: ["mp_wins"], badges: ["party-1"] });
    // The ids it names are real.
    expect(WEEKLY_CHAIN.some((q) => q.goal.kind === "mp_wins")).toBe(true);
    expect(BADGES.some((b) => b.id === "party-1")).toBe(true);
  });

  it("nothing for other players, and nothing from Family Draw (16+) rooms, which the decision does not cover", () => {
    expect(adultRoomCredit(false, "draw")).toEqual({ quests: [], badges: [] });
    expect(adultRoomCredit(true, "drawfam")).toEqual({ quests: [], badges: [] });
    expect(adultRoomCredit(true, "race")).toEqual({ quests: [], badges: [] });
  });
});
