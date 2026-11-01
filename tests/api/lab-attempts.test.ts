import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, guest, uniq } from "./helpers";
import { setSetting } from "./setup";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import five from "@/games/five/logic";
import { ANSWERS } from "@/games/five/content";
import emojihits from "@/games/emojihits/logic";
import penalty, { replayKick, type KickInput, type PenaltyPuzzle } from "@/games/penalty/logic";

/**
 * Attempt-level checks for the guess-transport lab games (behind "features.newGames"), through the real API:
 * Five and Emoji Hits reveals answer only on the player's own open attempt and a shown answer can't then clear;
 * Penalty King answers each shot with the keeper's dive only once the shot is kept on the attempt, and finish
 * audits the final kicks against those shots. Medium boards, so an attempt is never the public practice board.
 * Run: API_BASE=http://localhost:<port> pnpm vitest run -c vitest.api.config.mts tests/api/lab-attempts.test.ts
 */
type G = Awaited<ReturnType<typeof guest>>;
const D: Difficulty = "medium";

let before: unknown = undefined;
beforeAll(async () => {
  const { data } = await admin().from("game_settings").select("value").eq("key", "features.newGames").maybeSingle();
  before = data?.value;
  await setSetting("features.newGames", true);
});
afterAll(async () => {
  if (before === undefined) await admin().from("game_settings").delete().eq("key", "features.newGames");
  else await setSetting("features.newGames", before);
});

/** A free-play attempt, plus its solution rebuilt from the server-only seed (read with the service role). */
async function start<P, S>(
  g: G,
  game: string,
  logic: { generate: (rng: ReturnType<typeof createRng>, d: Difficulty) => { puzzle: P; solution: S } },
) {
  const s = await g.api("/api/v1/attempts", { json: { game, mode: "free", difficulty: D } });
  expect(s.status, JSON.stringify(s.data)).toBe(200);
  expect(s.data).not.toHaveProperty("seed");
  const { data: att } = await admin().from("attempts").select("free_seed").eq("id", s.data.attemptId).single();
  const [seed, d] = att!.free_seed!.split("|");
  const gen = logic.generate(createRng(seed), d as Difficulty);
  expect(s.data.puzzle).toEqual(gen.puzzle);
  return { id: s.data.attemptId as string, puzzle: gen.puzzle, solution: gen.solution };
}

const guess = (g: G, game: string, ref: unknown, body: unknown, attemptId?: string) =>
  g.api(`/api/games/${game}/guess`, { json: attemptId ? { ref, guess: body, attemptId } : { ref, guess: body } });
const finish = (g: G, id: string, state: unknown, activeMs = 5000) =>
  g.api(`/api/v1/attempts/${id}/finish`, { json: { state, activeMs, mistakes: 0 } });
const movesOf = async (id: string) => {
  const { data } = await admin().from("attempts").select("moves").eq("id", id).single();
  return (data!.moves ?? []) as Record<string, unknown>[];
};
/** Wall time above the client time sent at finish, without waiting. */
const backdate = (id: string, ms = 20_000) =>
  admin()
    .from("attempts")
    .update({ started_at: new Date(Date.now() - ms).toISOString() })
    .eq("id", id);

describe("api: Five reveals", () => {
  it("shows the answer only on the player's own open attempt, after six counted misses, and it can't clear", async () => {
    const g = await guest(uniq("five_"));
    const other = await guest(uniq("five2_"));
    const a = await start(g, "five", five);
    const answer = a.solution.answer;
    const misses = ANSWERS.map((w) => w.toUpperCase())
      .filter((w) => w !== answer)
      .slice(0, 6);
    const reveal = { reveal: misses };

    // Bare reference (no attempt): refused. Before the misses are checked on the attempt: refused too.
    expect((await guess(g, "five", a.puzzle.ref, reveal)).data).toEqual({ ok: false, refused: true });
    expect((await guess(g, "five", a.puzzle.ref, reveal, a.id)).data).toEqual({ ok: false, refused: true });
    // Someone else's attempt is not found.
    expect((await guess(other, "five", a.puzzle.ref, reveal, a.id)).status).toBe(404);

    for (const w of misses) {
      const r = await guess(g, "five", a.puzzle.ref, w, a.id);
      expect(r.status).toBe(200);
      expect(r.data).toMatchObject({ ok: false, word: w });
    }
    const shown = await guess(g, "five", a.puzzle.ref, reveal, a.id);
    expect(shown.data).toEqual({ reveal: answer });
    expect((await movesOf(a.id)).filter((e) => e.reveal === true)).toHaveLength(1);

    // Five misses then the shown answer would verify on its own; the audit fails it.
    await backdate(a.id);
    const fin = await finish(g, a.id, { guesses: [...misses.slice(0, 5), answer] });
    expect(fin.status).toBe(200);
    expect(fin.data).toMatchObject({ ok: false, status: "failed" });
    // The attempt is closed now: no more reveals on it.
    expect((await guess(g, "five", a.puzzle.ref, reveal, a.id)).status).toBe(409);
  });

  it("a clean solve on another attempt still clears", async () => {
    const g = await guest(uniq("five3_"));
    const a = await start(g, "five", five);
    const r = await guess(g, "five", a.puzzle.ref, a.solution.answer, a.id);
    expect(r.data).toMatchObject({ ok: true });
    await backdate(a.id);
    const fin = await finish(g, a.id, { guesses: [a.solution.answer] });
    expect(fin.data.ok).toBe(true);
  });
});

describe("api: Emoji Hits reveals", () => {
  const LIMIT = 45_000;
  const played = (round0: string[]) => ({
    rounds: [{ tries: round0, ms: 5000 }, ...Array.from({ length: 4 }, () => ({ tries: [], ms: LIMIT }))],
  });

  it("shows a title only on the player's own open attempt, and a shown round can't count as found", async () => {
    const g = await guest(uniq("emo_"));
    const other = await guest(uniq("emo2_"));
    const a = await start(g, "emojihits", emojihits);
    const title = a.solution.answers[0][0];

    expect((await guess(g, "emojihits", a.puzzle.ref, { round: 0, reveal: true })).data).toEqual({ ok: false, invalid: true });
    expect((await guess(other, "emojihits", a.puzzle.ref, { round: 0, reveal: true }, a.id)).status).toBe(404);

    const shown = await guess(g, "emojihits", a.puzzle.ref, { round: 0, reveal: true }, a.id);
    expect(shown.data).toEqual({ reveal: title });
    expect((await movesOf(a.id)).map((e) => e.reveal)).toEqual([0]);

    await backdate(a.id);
    const fin = await finish(g, a.id, played([title]));
    expect(fin.data).toMatchObject({ ok: false, status: "failed" });
    expect((await guess(g, "emojihits", a.puzzle.ref, { round: 1, reveal: true }, a.id)).status).toBe(409);
  });

  it("the same run without a reveal clears", async () => {
    const g = await guest(uniq("emo3_"));
    const a = await start(g, "emojihits", emojihits);
    const title = a.solution.answers[0][0];
    expect((await guess(g, "emojihits", a.puzzle.ref, { round: 0, answer: title }, a.id)).data).toMatchObject({ ok: true });
    await backdate(a.id);
    const fin = await finish(g, a.id, played([title]));
    expect(fin.data.ok).toBe(true);
  });
});

describe("api: Penalty King shots", () => {
  /** Taps that vary from kick to kick (a person's scatter, so the bot check stays quiet). */
  const kick = (k: number, nudge = 0): KickInput => ({ aimAt: 400 + 173 * k + nudge, powerAt: 600 + 89 * k, stepped: false });
  const shoot = (g: G, p: PenaltyPuzzle, id: string | undefined, k: number, input: KickInput) =>
    guess(g, "penalty", p.ref, { kick: k, input }, id);

  it("never sends the keeper's dives before a shot, and answers a shot only on the player's own open attempt", async () => {
    const g = await guest(uniq("pk_"));
    const other = await guest(uniq("pk2_"));
    const s = await g.api("/api/v1/attempts", { json: { game: "penalty", mode: "free", difficulty: D } });
    expect(JSON.stringify(s.data)).not.toContain("dives");
    const a = await start(g, "penalty", penalty);

    // A bare reference gets no dive; nor does someone else's attempt; a kick that timed out has no keeper.
    expect((await shoot(g, a.puzzle, undefined, 0, kick(0))).data).toEqual({ ok: false, refused: true });
    expect((await shoot(other, a.puzzle, a.id, 0, kick(0))).status).toBe(404);
    expect((await shoot(g, a.puzzle, a.id, 0, { aimAt: 400, powerAt: null })).data).toEqual({ ok: false, invalid: true });
    expect(await movesOf(a.id)).toEqual([]);

    // The shot is kept on the attempt, then answered with the dive and the outcome.
    const r = await shoot(g, a.puzzle, a.id, 0, kick(0));
    expect(r.data).toEqual({ ok: true, dive: a.solution.dives[0], outcome: replayKick(a.puzzle, a.solution, 0, kick(0)) });
    expect(await movesOf(a.id)).toMatchObject([{ kick: 0, aimAt: kick(0).aimAt, powerAt: kick(0).powerAt }]);
    // The same taps again (a resume) get the same answer; different taps for that kick are refused.
    expect((await shoot(g, a.puzzle, a.id, 0, kick(0))).data).toMatchObject({ ok: true, dive: a.solution.dives[0] });
    expect((await shoot(g, a.puzzle, a.id, 0, kick(0, 40))).data).toEqual({ ok: false, refused: true });
    // A later kick, then an earlier one: refused.
    expect((await shoot(g, a.puzzle, a.id, 2, kick(2))).data).toMatchObject({ ok: true });
    expect((await shoot(g, a.puzzle, a.id, 1, kick(1))).data).toEqual({ ok: false, refused: true });
  });

  it("finish fails a shot changed after the keeper moved, or one the server never saw", async () => {
    const g = await guest(uniq("pk3_"));
    const all = [0, 1, 2, 3, 4];

    const changed = await start(g, "penalty", penalty);
    for (const k of all) expect((await shoot(g, changed.puzzle, changed.id, k, kick(k))).data.ok).toBe(true);
    await backdate(changed.id);
    const f1 = await finish(g, changed.id, { kicks: all.map((k) => kick(k, k === 0 ? 40 : 0)) }, 1000);
    expect(f1.data).toMatchObject({ ok: false, status: "failed" });

    const unseen = await start(g, "penalty", penalty);
    for (const k of all.slice(0, 4)) expect((await shoot(g, unseen.puzzle, unseen.id, k, kick(k))).data.ok).toBe(true);
    await backdate(unseen.id);
    const f2 = await finish(g, unseen.id, { kicks: all.map((k) => kick(k)) }, 1000);
    expect(f2.data).toMatchObject({ ok: false, status: "failed" });

    const honest = await start(g, "penalty", penalty);
    for (const k of all) expect((await shoot(g, honest.puzzle, honest.id, k, kick(k))).data.ok).toBe(true);
    await backdate(honest.id);
    const f3 = await finish(g, honest.id, { kicks: all.map((k) => kick(k)) }, 1000);
    expect(f3.data.ok).toBe(true);
  });
});
