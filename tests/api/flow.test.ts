import { describe, expect, it } from "vitest";
import { BASE, admin, guest, uniq } from "./helpers";
import { setSetting } from "./setup";
import { TUTORIAL_PUZZLE, TUTORIAL_SOLUTION } from "@/games/crownfall/tutorial";

/** Full solo loop through the real API: guest → profile → Daily → finish → rewards, streak, results. */
describe("api: daily clear flow", () => {
  it("rejects anonymous access and unknown games", async () => {
    const r = await fetch(`${BASE}/api/v1/me`);
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

  it("spends Shop hint packs only after the 3 free hints, and only in free play", async () => {
    const g = await guest(uniq("hint_"));
    const s = await g.api("/api/v1/attempts", { json: { game: "crownfall", mode: "free", difficulty: "easy" } });
    expect(s.data.hintsBanked).toBe(0);
    const hint = () => g.api(`/api/v1/attempts/${s.data.attemptId}/hint`, { json: { state: null } });
    for (let i = 0; i < 3; i++) expect((await hint()).status).toBe(200);
    expect((await hint()).status).toBe(429); // free hints used, nothing banked

    await admin().from("players").update({ practice_hints: 1 }).eq("id", g.userId);
    expect((await hint()).status).toBe(200); // spends the banked hint
    expect((await hint()).status).toBe(429);
    const { data } = await admin().from("players").select("practice_hints").eq("id", g.userId).single();
    expect(data!.practice_hints).toBe(0);

    // The ranked Daily never uses banked hints.
    await admin().from("players").update({ practice_hints: 5 }).eq("id", g.userId);
    const d = await g.api("/api/v1/attempts", { json: { game: "crownfall", mode: "daily" } });
    expect(d.data.hintsBanked ?? 0).toBe(0);
    const dh = () => g.api(`/api/v1/attempts/${d.data.attemptId}/hint`, { json: { state: null } });
    for (let i = 0; i < 3; i++) expect((await dh()).status).toBe(200);
    expect((await dh()).status).toBe(429);
  });

  it("checks content-game guesses against the player's own attempt", async () => {
    const g = await guest(uniq("guess_"));
    const s = await g.api("/api/v1/attempts", { json: { game: "rungs", mode: "free", difficulty: "easy" } });
    expect(s.status).toBe(200);
    const ref = s.data.puzzle.ref;
    const guess = { rung: 1, word: "ZZZZ" };
    const byRef = await g.api("/api/games/rungs/guess", { json: { ref, guess } });
    const byAttempt = await g.api("/api/games/rungs/guess", { json: { ref, guess, attemptId: s.data.attemptId } });
    expect(byAttempt.status).toBe(200);
    expect(byAttempt.data).toEqual(byRef.data);
    // Someone else's attempt is not found; a different game is refused.
    const other = await guest(uniq("guess2_"));
    expect((await other.api("/api/games/rungs/guess", { json: { ref, guess, attemptId: s.data.attemptId } })).status).toBe(404);
    const c = await g.api("/api/v1/attempts", { json: { game: "crownfall", mode: "free", difficulty: "easy" } });
    expect((await g.api("/api/games/rungs/guess", { json: { ref, guess, attemptId: c.data.attemptId } })).status).toBe(400);
  });

  it("gives a hint before the first move (no state sent)", async () => {
    const g = await guest(uniq("first_"));
    const s = await g.api("/api/v1/attempts", { json: { game: "crownfall", mode: "free", difficulty: "easy" } });
    const r = await g.api(`/api/v1/attempts/${s.data.attemptId}/hint`, { json: {} });
    expect(r.status, JSON.stringify(r.data)).toBe(200);
    expect(r.data.hint?.text).toBeTruthy();
  });

  it("counts the onboarding lesson as today's first clear (SPZ-05)", async () => {
    const g = await guest(uniq("ls_"));
    const start = await g.api("/api/v1/attempts", { json: { game: "crownfall", mode: "tutorial" } });
    expect(start.status).toBe(200);
    const n = TUTORIAL_PUZZLE.size;
    const state = new Array(n * n).fill(0);
    TUTORIAL_SOLUTION.forEach((c: number, r: number) => (state[r * n + c] = 2));
    const fin = await g.api(`/api/v1/attempts/${start.data.attemptId}/finish`, { json: { state, activeMs: 8000, mistakes: 0 } });
    expect(fin.data).toMatchObject({ ok: true, status: "cleared" });
    expect(fin.data.streak.current).toBe(1);
    const me = await g.api("/api/v1/me");
    expect(me.data.streak.current).toBe(1);
    expect(me.data.today.counted).toBe(1);
    expect(me.data.today.cleared).toEqual({}); // no Daily is marked done by the lesson
  });

  it("with Dailies off: refuses Daily play, and a free-play clear lights the streak and counts as played", async () => {
    await setSetting("features.dailies", false);
    try {
      const g = await guest(uniq("fo_"));
      const daily = await g.api("/api/v1/attempts", { json: { game: "crownfall", mode: "daily" } });
      expect([daily.status, daily.data.error]).toEqual([404, "dailies_off"]);
      expect((await g.api("/api/v1/leaderboards/crownfall")).status).toBe(404);
      expect((await g.api("/api/v1/archive?game=crownfall")).status).toBe(404);
      const start = await g.api("/api/v1/attempts", { json: { game: "crownfall", mode: "free" } });
      expect(start.status).toBe(200);
      const { data: att } = await admin().from("attempts").select("free_seed").eq("id", start.data.attemptId).single();
      expect(att!.free_seed).toBeTruthy();
      const { solve } = await import("@/games/crownfall/logic");
      const sol = solve(start.data.puzzle)!;
      const n = start.data.puzzle.size;
      const state = new Array(n * n).fill(0);
      sol.forEach((c: number, r: number) => (state[r * n + c] = 2));
      await new Promise((r) => setTimeout(r, 6500)); // above the human floor
      const fin = await g.api(`/api/v1/attempts/${start.data.attemptId}/finish`, { json: { state, activeMs: 6200, mistakes: 0 } });
      expect(fin.data).toMatchObject({ ok: true, status: "cleared" });
      expect(fin.data.streak.current).toBe(1);
      const me = await g.api("/api/v1/me");
      expect(me.data.streak.current).toBe(1);
      expect(me.data.played).toContain("crownfall");
    } finally {
      await setSetting("features.dailies", true);
    }
  });
});
