import { describe, expect, it } from "vitest";
import { GAME_BY_ID, LAB_GAMES } from "@/lib/catalog";
import { createRng } from "@/lib/rng";
import { BOARDS } from "./board-registry";
import { hasLogic, loadLogic } from "./logic-registry";

/**
 * R2-P5: every lab game brought back from retirement had what the shell needs once "features.labGames" switched it
 * on: logic, a board, and a sensible practice round. The twelve graduated to live on 11 Nov 2026 and keep the check,
 * along with any game in testing now. The practice board is the game's own `practice()` or the
 * seeded easy board from `tutorial:<id>` (lib/game/service.ts guidedSeed and loadFree), the same one the server
 * serves on GET /api/v1/guided/<id>.
 */
const GRADUATED = ["five", "hilo", "penalty", "market", "lightup", "killer", "dara", "pinned", "flagged", "tripwire", "pixl", "twotruths"];

describe("R2-P5: lab and graduated games' practice boards", () => {
  for (const meta of [...GRADUATED.map((id) => GAME_BY_ID[id]), ...LAB_GAMES]) {
    it(`${meta.id}: has logic and a board, and a deterministic practice board`, async () => {
      expect(hasLogic(meta.id)).toBe(true);
      expect(BOARDS[meta.id], meta.id).toBeDefined();
      const logic = await loadLogic(meta.id);
      const make = () => (logic.practice ? logic.practice() : logic.generate(createRng(`tutorial:${meta.id}`), "easy"));
      const a = make();
      const b = make();
      expect(a.puzzle).toBeDefined();
      expect(a.solution).toBeDefined();
      // The same board for every player (its answers are effectively public; it is never ranked).
      expect(JSON.stringify(a.puzzle)).toBe(JSON.stringify(b.puzzle));
      // Logic puzzles keep their one-answer promise on the practice board too, so hints never mislead.
      if (meta.unique && logic.countSolutions) expect(logic.countSolutions(a.puzzle, 2), meta.id).toBe(1);
      // A hint on the untouched board never throws (the guided round offers one after a pause).
      if (logic.hint) expect(() => logic.hint!(a.puzzle, a.solution, undefined)).not.toThrow();
      // The untouched board shows no progress.
      expect(() => logic.progress(a.puzzle, a.solution, undefined)).not.toThrow();
    });
  }
});
