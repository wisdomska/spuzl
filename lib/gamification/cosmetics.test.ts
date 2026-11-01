import { describe, expect, it } from "vitest";
import { COSMETICS, isStarter } from "./cosmetics";
import { DEFAULTS } from "@/lib/game-settings/schema";

describe("starter cosmetic (SPZ-19)", () => {
  it("has exactly one starter, a hat whose fallback price matches the setting default", () => {
    const starters = COSMETICS.filter(isStarter);
    expect(starters).toHaveLength(1);
    expect(starters[0]).toMatchObject({ id: "hat-starter", type: "hat", price: DEFAULTS["shop.starterPrice"] });
    expect(isStarter({ payload: { hat: "party" } })).toBe(false);
  });
});
