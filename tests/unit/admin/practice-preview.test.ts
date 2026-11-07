import { describe, expect, it } from "vitest";
import { solvedStates } from "@/lib/admin/solved-state";
import { LOGIC } from "@/games/logic-registry";
import { createRng } from "@/lib/rng";

/**
 * R2-ADMIN: the admin Library page previews each game's practice board (GET /api/admin/games/practice, which calls
 * loadFree(game, "tutorial:<game>", "easy")). The preview is only useful if that board is the one players get: the
 * same every time, and its solution shows as a solved board where the game has a solved-state adapter.
 */
const practice = async (game: string) => {
  const logic = (await LOGIC[game]()).default;
  // Mirrors lib/game/service.ts loadFree for the guided seed: the game's own practice board, else the seeded easy one.
  return { logic, g: logic.practice ? logic.practice() : logic.generate(createRng(`tutorial:${game}`), "easy") };
};

describe("practice board preview", () => {
  for (const game of ["dusk", "nine", "sixer", "quads", "lightup"]) {
    it(`${game}: the same board every time, and Show solution renders a board the game accepts`, async () => {
      const a = await practice(game);
      const b = await practice(game);
      expect(JSON.stringify(b.g.puzzle)).toBe(JSON.stringify(a.g.puzzle));
      const [first] = solvedStates(game, a.g.puzzle, a.g.solution);
      if (first?.via === "adapter") {
        const r = a.logic.verify(a.g.puzzle, a.g.solution, first.state as never);
        expect(r.ok, `${game}: ${r.reason}`).toBe(true);
      } else {
        // No adapter: the preview shows the solution as JSON, which needs it to serialise.
        expect(() => JSON.stringify(a.g.solution)).not.toThrow();
      }
    });
  }
});
