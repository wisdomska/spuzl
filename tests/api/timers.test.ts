import { describe, expect, it } from "vitest";
import { admin, guest, uniq } from "./helpers";

/**
 * R2-15 timers, server side. The client's clock now starts on the first move, so `activeMs` leaves out the thinking
 * before it; the client also sends `boardMs` (the board on screen, not paused, from load). The fast-solve floor reads
 * the look time (never more than the server's wall clock since `started_at`), and the wall-clock check still reads
 * `activeMs`. Run: API_BASE=http://localhost:3203 pnpm vitest run -c vitest.api.config.mts tests/api/timers.test.ts
 */
async function solvedFree() {
  const g = await guest(uniq("tm_"));
  const s = await g.api("/api/v1/attempts", { json: { game: "crownfall", mode: "free", difficulty: "easy" } });
  expect(s.status).toBe(200);
  const { data: att } = await admin().from("attempts").select("free_seed").eq("id", s.data.attemptId).single();
  const [seed] = att!.free_seed!.split("|");
  const { generate } = await import("@/games/crownfall/logic");
  const { createRng } = await import("@/lib/rng");
  const gen = generate(createRng(seed), "easy");
  const n = gen.puzzle.size;
  const state = new Array(n * n).fill(0);
  gen.solution.forEach((c: number, r: number) => (state[r * n + c] = 2));
  return { g, id: s.data.attemptId as string, state };
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("finish timing with the first-move clock (R2-15)", () => {
  it("studied the board, then solved fast: cleared, and ranked on the play time", async () => {
    const { g, id, state } = await solvedFree();
    await wait(6500); // the board was up this long (server wall clock)
    const fin = await g.api(`/api/v1/attempts/${id}/finish`, { json: { state, activeMs: 2_000, boardMs: 6_200, mistakes: 0 } });
    expect(fin.status).toBe(200);
    expect(fin.data).toMatchObject({ ok: true, status: "cleared", timeMs: 2_000 });
  });

  it("an older client without boardMs is judged as before", async () => {
    const { g, id, state } = await solvedFree();
    await wait(1000);
    const fin = await g.api(`/api/v1/attempts/${id}/finish`, { json: { state, activeMs: 2_000, mistakes: 0 } });
    expect(fin.data.status).toBe("flagged");
  });

  it("look time beyond the server's wall clock does not beat the floor", async () => {
    const { g, id, state } = await solvedFree();
    const fin = await g.api(`/api/v1/attempts/${id}/finish`, { json: { state, activeMs: 300, boardMs: 600_000, mistakes: 0 } });
    expect(fin.data.status).toBe("flagged");
    const { data: row } = await admin().from("attempts").select("flag_reason").eq("id", id).single();
    expect(row!.flag_reason).toMatch(/below human floor/);
  });

  it("client play time past the wall clock is still flagged", async () => {
    const { g, id, state } = await solvedFree();
    const fin = await g.api(`/api/v1/attempts/${id}/finish`, { json: { state, activeMs: 60_000, boardMs: 60_000, mistakes: 0 } });
    expect(fin.data.status).toBe("flagged");
    const { data: row } = await admin().from("attempts").select("flag_reason").eq("id", id).single();
    expect(row!.flag_reason).toMatch(/exceeds server wall time/);
  });

  it("refuses a malformed boardMs", async () => {
    const { g, id, state } = await solvedFree();
    expect((await g.api(`/api/v1/attempts/${id}/finish`, { json: { state, activeMs: 5_000, boardMs: -1, mistakes: 0 } })).status).toBe(400);
  });
});
