import { describe, expect, it } from "vitest";
import { solvedStates, SOLVED_STATE } from "@/lib/admin/solved-state";
import { LOGIC } from "@/games/logic-registry";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { judge, check, type BeatPuzzle, type BeatState } from "@/games/beattap/logic";
import { tally, type PenaltyPuzzle, type PenaltySolution, type PenaltyState } from "@/games/penalty/logic";
import { replay as hiloReplay, type HiloSolution, type HiloState } from "@/games/hilo/logic";

const GAMES = ["penalty", "beattap", "hilo", "lightup", "killer", "dara"] as const;
const LEVELS: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];

describe("solved states for the newer games", () => {
  it("each has its own adapter", () => {
    for (const g of GAMES) expect(SOLVED_STATE[g], g).toBeTypeOf("function");
  });

  it("make verify() accept the stored solution at every level", async () => {
    for (const game of GAMES) {
      const logic = (await LOGIC[game]()).default;
      for (const d of LEVELS) {
        for (const seed of ["a", "b", "c"]) {
          const g = logic.generate(createRng(`solved:${game}:${d}:${seed}`), d);
          const [first] = solvedStates(game, g.puzzle, g.solution);
          expect(first.via, `${game} ${d}`).toBe("adapter");
          const r = logic.verify(g.puzzle, g.solution, first.state as never);
          expect(r.ok, `${game} ${d} ${seed}: ${r.reason}`).toBe(true);
        }
      }
    }
  }, 120_000);

  it("play the best run: every call right, every beat perfect, every kick a goal", async () => {
    const hilo = (await LOGIC.hilo()).default;
    const h = hilo.generate(createRng("solved:hilo"), "hard");
    const hs = solvedStates("hilo", h.puzzle, h.solution)[0].state as HiloState;
    expect(hiloReplay((h.solution as HiloSolution).values, hs.calls)).toMatchObject({ slips: 0, right: 10 });

    const beat = (await LOGIC.beattap()).default;
    const b = beat.generate(createRng("solved:beat"), "mega");
    const bp = b.puzzle as BeatPuzzle;
    const bs = solvedStates("beattap", bp, b.solution)[0].state as BeatState;
    expect(check(bp, bs).ok).toBe(true);
    expect(judge(bp.beats, bs.taps)).toMatchObject({ perfect: bp.beats.length, strays: 0 });

    const pen = (await LOGIC.penalty()).default;
    for (const d of LEVELS) {
      const k = pen.generate(createRng(`solved:pen:${d}`), d);
      const st = solvedStates("penalty", k.puzzle, k.solution)[0].state as PenaltyState;
      const t = tally(k.puzzle as PenaltyPuzzle, k.solution as PenaltySolution, st);
      expect(t.goals, d).toBe(5);
    }
  });

  it("fall back to the solution itself when the stored answer key is malformed", () => {
    const states = solvedStates("lightup", { size: 3, grid: [] }, null);
    expect(states).toEqual([]);
    expect(solvedStates("dara", { board: [], goal: "three2" }, { from: 0, to: 1, takes: [] }).map((s) => s.via)).toEqual(["solution"]);
  });
});
