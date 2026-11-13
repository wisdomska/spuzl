import { describe, expect, it } from "vitest";
import { allGames, boardGameRow, filterGames, sortGames, NO_GAME_FILTER, type AttemptRow } from "./player-games";

const attempts: AttemptRow[] = [
  { id: "a1", game_id: "crownfall", mode: "daily", status: "cleared", time_ms: 42_000, started_at: "2026-11-10T10:00:00Z" },
  { id: "a2", game_id: "sixer", mode: "free", status: "failed", time_ms: 90_000, started_at: "2026-11-12T10:00:00Z" },
];
const boards = [
  boardGameRow(
    {
      id: "b1",
      game_id: "chess",
      mode: "live",
      status: "finished",
      result: "checkmate",
      winner_id: "me",
      rated: true,
      bot: false,
      created_at: "2026-11-11T10:00:00Z",
      players: ["me", "you"],
    },
    "me",
    { you: "Ama" },
  ),
];
const typeOf = (g: string) => (g === "chess" ? "board" : "logic");
const nameOf = (g: string) => g;

describe("one games table", () => {
  it("puts puzzles and board games together, newest first, with one result vocabulary", () => {
    const rows = allGames(attempts, boards);
    expect(rows.map((r) => r.id)).toEqual(["a2", "b1", "a1"]);
    expect(rows.map((r) => r.result)).toEqual(["not_solved", "won", "solved"]);
    expect(rows[1].against).toEqual({ kind: "people", players: [{ id: "you", nickname: "Ama" }] });
  });

  it("filters by game type, then by particular games, then by result", () => {
    const rows = allGames(attempts, boards);
    expect(filterGames(rows, { ...NO_GAME_FILTER, type: "board" }, typeOf).map((r) => r.id)).toEqual(["b1"]);
    expect(filterGames(rows, { ...NO_GAME_FILTER, type: "logic", games: ["sixer"] }, typeOf).map((r) => r.id)).toEqual(["a2"]);
    expect(filterGames(rows, { ...NO_GAME_FILTER, result: "solved" }, typeOf).map((r) => r.id)).toEqual(["a1"]);
  });

  it("sorts by any column, empty times last", () => {
    const rows = allGames(attempts, boards);
    expect(sortGames(rows, { sort: "game", dir: "asc" }, nameOf, typeOf).map((r) => r.game_id)).toEqual(["chess", "crownfall", "sixer"]);
    expect(sortGames(rows, { sort: "time", dir: "asc" }, nameOf, typeOf).map((r) => r.id)).toEqual(["a1", "a2", "b1"]);
    expect(sortGames(rows, { sort: "time", dir: "desc" }, nameOf, typeOf).map((r) => r.id)).toEqual(["a2", "a1", "b1"]);
    expect(sortGames(rows, { sort: "started", dir: "asc" }, nameOf, typeOf).map((r) => r.id)).toEqual(["a1", "b1", "a2"]);
  });
});
