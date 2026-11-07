import { describe, expect, it } from "vitest";
import { boardGameRow, houseRulesOf, roundRef, type BoardMatchRow } from "./player-games";

const ME = "11111111-1111-4111-8111-111111111111";
const THEM = "22222222-2222-4222-8222-222222222222";
const match = (over: Partial<BoardMatchRow> = {}): BoardMatchRow => ({
  id: "m1",
  game_id: "ludo",
  mode: "live",
  status: "finished",
  result: "all four home",
  winner_id: ME,
  rated: false,
  bot: false,
  created_at: "2026-12-01T10:00:00Z",
  opts: { backKick: true, homeKick: true },
  ...over,
});

describe("player detail: board games and house rules (R2-ADMIN)", () => {
  it("lists a Ludo match's house rules in the setup order; standard is an empty list; other games have none", () => {
    expect(houseRulesOf("ludo", { homeKick: true, backKick: true, sideKick: false })).toEqual(["backKick", "homeKick"]);
    expect(houseRulesOf("ludo", undefined)).toEqual([]);
    expect(houseRulesOf("ludo", { backKick: "yes" })).toEqual([]);
    expect(houseRulesOf("chess", { backKick: true })).toBeNull();
  });

  it("reads the outcome from the player's side, including a bot win (no winner id)", () => {
    expect(boardGameRow(match(), ME)).toMatchObject({ outcome: "won", house: ["backKick", "homeKick"] });
    expect(boardGameRow(match({ winner_id: THEM }), ME).outcome).toBe("lost");
    expect(boardGameRow(match({ game_id: "chess", winner_id: null, bot: true, result: "checkmate", opts: null }), ME)).toMatchObject({
      outcome: "lost",
      house: null,
    });
    expect(boardGameRow(match({ game_id: "chess", winner_id: null, bot: true, result: "stalemate" }), ME).outcome).toBe("draw");
    expect(boardGameRow(match({ status: "active", winner_id: null }), ME).outcome).toBeNull();
  });

  it("shortens a Duel or Party round reference", () => {
    expect(roundRef("0f8e2a6c-1111-4111-8111-111111111111:2:3")).toBe("0f8e2a6c · set 2 · round 3");
    expect(roundRef("odd")).toBe("odd");
  });
});
