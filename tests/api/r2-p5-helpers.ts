import { expect } from "vitest";
import crownfall from "@/games/crownfall/logic";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { admin, BASE, guest, uniq } from "./helpers";

/** Shared helpers for the R2-P5 API tests (challenges, story cards, streak shield, school leagues). */

export async function png(path: string) {
  const res = await fetch(BASE + path);
  const buf = Buffer.from(await res.arrayBuffer());
  const isPng = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return {
    status: res.status,
    type: res.headers.get("content-type"),
    width: isPng ? buf.readUInt32BE(16) : 0,
    height: isPng ? buf.readUInt32BE(20) : 0,
  };
}

/** The full board for a free Crownfall attempt, rebuilt from its server seed. */
export async function crownfallSolution(attemptId: string) {
  const { data: att } = await admin().from("attempts").select("free_seed").eq("id", attemptId).single();
  const [seed, diff] = att!.free_seed!.split("|");
  const gen = crownfall.generate(createRng(seed), diff as Difficulty);
  const n = gen.puzzle.size;
  const state = new Array(n * n).fill(0);
  gen.solution.forEach((c, r) => (state[r * n + c] = 2));
  return state;
}

/** A guest with a verified free Crownfall clear (6.4 s, no slips). */
export async function clearCrownfall(prefix = "cl_", g?: Awaited<ReturnType<typeof guest>>) {
  g ??= await guest(uniq(prefix));
  const start = await g.api("/api/v1/attempts", { json: { game: "crownfall", mode: "free", difficulty: "easy" } });
  const state = await crownfallSolution(start.data.attemptId);
  await new Promise((r) => setTimeout(r, 6500)); // above the human floor in wall time
  const fin = await g.api(`/api/v1/attempts/${start.data.attemptId}/finish`, { json: { state, activeMs: 6400, mistakes: 0 } });
  expect(fin.data.status).toBe("cleared");
  return { g, attemptId: start.data.attemptId as string };
}

/** A guest with a verified free Crownfall clear and a challenge made from it. */
export async function clearAndChallenge(prefix = "ch_") {
  const { g, attemptId } = await clearCrownfall(prefix);
  const ch = await g.api("/api/v1/challenges", { json: { attemptId } });
  expect(ch.status).toBe(200);
  return { g, attemptId, code: ch.data.code as string };
}
