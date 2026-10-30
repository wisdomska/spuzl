import { describe, expect, it } from "vitest";
import { admin, guest, uniq } from "./helpers";

/** Full solo loop through the real API: guest → profile → Daily → finish → rewards, streak, results. */
describe("api: daily clear flow", () => {
  it("rejects anonymous access and unknown games", async () => {
    const r = await fetch("http://localhost:3000/api/v1/me");
    expect(r.status).toBe(401);
    const g = await guest(uniq("t_"));
    expect((await g.api("/api/v1/attempts", { json: { game: "nope", mode: "daily" } })).status).toBe(404);
  });

  it("rejects bad nicknames", async () => {
    const g = await guest();
    const bad = await g.api("/api/v1/profile", { json: { nickname: "fuckface", ageBand: "18+", color: "#2FD3E0" } });
    expect(bad.status).toBe(422);
    const short = await g.api("/api/v1/profile", { json: { nickname: "ab", ageBand: "18+", color: "#2FD3E0" } });
    expect(short.status).toBe(422);
  });

  it("clears a Daily once, grants rewards idempotently, never leaks the solution", async () => {
    const g = await guest(uniq("cf_"));
    const start = await g.api("/api/v1/attempts", { json: { game: "crownfall", mode: "daily" } });
    expect(start.status).toBe(200);
    expect(JSON.stringify(start.data)).not.toContain("solution");
    const { attemptId, puzzle } = start.data;
    // Read the solution with the service role (as an honest solver would find it).
    const { data: att } = await admin().from("attempts").select("puzzle_id").eq("id", attemptId).single();
    const { data: pz } = await admin().from("puzzles").select("solution").eq("id", att!.puzzle_id).single();
    const n = puzzle.size;
    const wrong = new Array(n * n).fill(0);
    const bad = await g.api(`/api/v1/attempts/${attemptId}/finish`, { json: { state: wrong, activeMs: 30_000, mistakes: 0 } });
    expect(bad.data.ok).toBe(false);

    // failed attempt closes it; daily is one attempt per day, so use a new player for the clear
    const h = await guest(uniq("cf_"));
    const s2 = await h.api("/api/v1/attempts", { json: { game: "crownfall", mode: "daily" } });
    const state = new Array(n * n).fill(0);
    (pz!.solution as number[]).forEach((c, r) => (state[r * n + c] = 2));
    const hint = await h.api(`/api/v1/attempts/${s2.data.attemptId}/hint`, { json: { state: new Array(n * n).fill(0) } });
    expect(hint.status).toBe(200);
    expect(hint.data.hint.text).toBeTruthy();
    await new Promise((r) => setTimeout(r, 6500)); // stay above the human floor in wall time
    const fin = await h.api(`/api/v1/attempts/${s2.data.attemptId}/finish`, {
      json: { state, activeMs: 6200, mistakes: 0, localHour: 14 },
    });
    expect(fin.status).toBe(200);
    expect(fin.data).toMatchObject({ ok: true, status: "cleared" });
    expect(fin.data.reward.xp).toBeGreaterThan(0);
    expect(fin.data.streak.current).toBe(1);
    expect(fin.data.unlocks.some((u: { id: string }) => u.id === "first-clear")).toBe(true);
    // second finish is rejected, and a new daily attempt is refused
    expect((await h.api(`/api/v1/attempts/${s2.data.attemptId}/finish`, { json: { state, activeMs: 6200, mistakes: 0 } })).status).toBe(
      409,
    );
    expect((await h.api("/api/v1/attempts", { json: { game: "crownfall", mode: "daily" } })).status).toBe(409);
    const me = await h.api("/api/v1/me");
    expect(me.data.today.cleared.crownfall).toBe(6200);
    expect(me.data.sparks).toBeGreaterThan(0);
  });

  it("flags impossible times instead of ranking them", async () => {
    const g = await guest(uniq("fast_"));
    const s = await g.api("/api/v1/attempts", { json: { game: "crownfall", mode: "daily" } });
    const { data: att } = await admin().from("attempts").select("puzzle_id").eq("id", s.data.attemptId).single();
    const { data: pz } = await admin().from("puzzles").select("solution").eq("id", att!.puzzle_id).single();
    const n = s.data.puzzle.size;
    const state = new Array(n * n).fill(0);
    (pz!.solution as number[]).forEach((c, r) => (state[r * n + c] = 2));
    const fin = await g.api(`/api/v1/attempts/${s.data.attemptId}/finish`, { json: { state, activeMs: 900, mistakes: 0 } });
    expect(fin.data.status).toBe("flagged");
    expect(fin.data.reward.xp).toBe(0);
    const { data: row } = await admin().from("daily_results").select("player_id").eq("player_id", g.userId);
    expect(row).toEqual([]);
  });

  it("free play gives +10 XP and +5 Sparks, server-generated", async () => {
    const g = await guest(uniq("free_"));
    const s = await g.api("/api/v1/attempts", { json: { game: "crownfall", mode: "free", difficulty: "easy" } });
    expect(s.status).toBe(200);
    expect(s.data.seed).toMatch(/^free:crownfall:/);
    const { generate } = await import("@/games/crownfall/logic");
    const { createRng } = await import("@/lib/rng");
    const gen = generate(createRng(s.data.seed), "easy");
    const n = gen.puzzle.size;
    const state = new Array(n * n).fill(0);
    gen.solution.forEach((c, r) => (state[r * n + c] = 2));
    await new Promise((r) => setTimeout(r, 6500));
    const fin = await g.api(`/api/v1/attempts/${s.data.attemptId}/finish`, { json: { state, activeMs: 6100, mistakes: 0 } });
    expect(fin.data.reward).toMatchObject({ xp: 10, sparks: 5 });
  });
});
