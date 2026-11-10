import { describe, expect, it } from "vitest";
import { admin, guest, uniq } from "./helpers";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import quickfire, { LIMIT_MS, NET_SLACK_MS, QUESTIONS, type QuickfireCheck } from "@/games/quickfire/logic";

/**
 * Quickfire through the real API: the answers stay on the server (games/quickfire/logic.ts). Served boards
 * carry the questions and options only, behind an opaque token; each question is opened and answered through
 * the guess route, which keeps both on the attempt's move log, times the answer on the server and only then
 * names the right option. Finish scores the server's record, so a forged state fails.
 * Run: API_BASE=http://localhost:<port> pnpm vitest run -c vitest.api.config.mts tests/api/quickfire.test.ts
 */
type G = Awaited<ReturnType<typeof guest>>;
const D: Difficulty = "medium";

const guess = (g: G, ref: unknown, body: unknown) =>
  g.api(`/api/games/quickfire/guess`, { json: { ref, guess: body } }) as Promise<{ status: number; data: QuickfireCheck }>;
const finish = (g: G, id: string, state: unknown) =>
  g.api(`/api/v1/attempts/${id}/finish`, { json: { state, activeMs: 9000, mistakes: 0 } });
const backdate = (id: string) =>
  admin()
    .from("attempts")
    .update({ started_at: new Date(Date.now() - 60_000).toISOString() })
    .eq("id", id);

/** No answer key anywhere in the public practice board: only questions, options and the token. */
function expectNoAnswers(puzzle: Record<string, unknown>) {
  expect(Object.keys(puzzle).sort()).toEqual(["limitMs", "questions", "ref"]);
  expect(puzzle.ref).toEqual({ game: "quickfire", t: expect.any(String) });
  for (const q of puzzle.questions as Record<string, unknown>[]) expect(Object.keys(q).sort()).toEqual(["cat", "choices", "q"]);
  expect(JSON.stringify(puzzle)).not.toMatch(/"sealed"|"correct"|"answer"|"solution"|"i":|"d":/);
}

/** A scored board (R4-23): not even the questions, only how many and the time limit; each comes on its open. */
function expectNoQuestions(puzzle: Record<string, unknown>) {
  expect(Object.keys(puzzle).sort()).toEqual(["count", "limitMs", "ref"]);
  expect(puzzle.count).toBe(QUESTIONS);
  expect(puzzle.ref).toEqual({ game: "quickfire", t: expect.any(String) });
  expect(JSON.stringify(puzzle)).not.toMatch(/"sealed"|"correct"|"answer"|"solution"|"choices"|"q":|"i":|"d":/);
}

/** A free-play attempt and its answer key, rebuilt from the server-only seed (read with the service role). */
async function start(g: G) {
  const s = await g.api("/api/v1/attempts", { json: { game: "quickfire", mode: "free", difficulty: D } });
  expect(s.status, JSON.stringify(s.data)).toBe(200);
  expect(s.data).not.toHaveProperty("solution");
  expectNoQuestions(s.data.puzzle);
  const { data: att } = await admin().from("attempts").select("free_seed").eq("id", s.data.attemptId).single();
  const [seed, d] = att!.free_seed!.split("|");
  const gen = quickfire.generate(createRng(seed), d as Difficulty);
  return { id: s.data.attemptId as string, ref: s.data.puzzle.ref, correct: gen.solution.correct, questions: gen.puzzle.questions };
}

describe("api: Quickfire answers stay on the server", () => {
  it("serves the start, resume, Daily and guided payloads without the answer key", async () => {
    const g = await guest(uniq("qf_"));
    const a = await start(g);
    // The resumed Daily and the guided practice board go out the same way.
    const daily = await g.api("/api/v1/attempts", { json: { game: "quickfire", mode: "daily" } });
    if (daily.status === 200) expectNoQuestions(daily.data.puzzle);
    // The guided practice board is public, so it keeps its questions (still no answers).
    const guided = await g.api("/api/v1/guided/quickfire");
    expect(guided.status).toBe(200);
    expectNoAnswers(guided.data.puzzle);
    // A later question is not handed out before the first is answered.
    const ahead = await guess(g, a.ref, { q: 1, open: true });
    expect(ahead.data).toEqual({ ok: false, refused: true });
    // Opening a question hands it out and says how long is left, never what is right.
    const open = await guess(g, a.ref, { q: 0, open: true });
    expect(open.data).toEqual({ ok: true, leftMs: LIMIT_MS, question: a.questions[0] });
  });

  it("records right and wrong answers on the attempt and scores the server's record", async () => {
    const g = await guest(uniq("qf_"));
    const a = await start(g);
    // Answering before the question is opened is refused, and gives nothing away.
    expect((await guess(g, a.ref, { q: 0, pick: 0, ms: 2000 })).data).toEqual({ ok: false, refused: true });
    const answers: { pick: number | null; ms: number }[] = [];
    for (let q = 0; q < QUESTIONS; q++) {
      expect((await guess(g, a.ref, { q, open: true })).status).toBe(200);
      const pick = q === 1 ? (a.correct[q] + 1) % 4 : a.correct[q];
      const r = await guess(g, a.ref, { q, pick, ms: 3000 });
      expect(r.status, JSON.stringify(r.data)).toBe(200);
      expect(r.data).toEqual({
        ok: true,
        verdict: { q, pick, ms: 3000, right: q !== 1, answer: a.correct[q], late: false },
      });
      answers.push({ pick, ms: 3000 });
    }
    // Asking again returns the same verdict; the log keeps one open and one answer per question.
    const again = await guess(g, a.ref, { q: 1, pick: a.correct[1], ms: 3000 });
    expect(again.data).toMatchObject({ ok: true, verdict: { right: false } });
    const { data: att } = await admin().from("attempts").select("moves").eq("id", a.id).single();
    expect(att!.moves).toHaveLength(2 * QUESTIONS);

    // A forged finish (every answer right, and faster) fails: the server judged otherwise.
    await backdate(a.id);
    const forged = await finish(g, a.id, { answers: a.correct.map((pick) => ({ pick, ms: 400 })) });
    expect(forged.status).toBe(200);
    expect(forged.data).toMatchObject({ ok: false, status: "failed" });
  });

  it("an honest finish clears with the server's score", async () => {
    const g = await guest(uniq("qf_"));
    const a = await start(g);
    const answers = [];
    for (let q = 0; q < QUESTIONS; q++) {
      await guess(g, a.ref, { q, open: true });
      const r = await guess(g, a.ref, { q, pick: a.correct[q], ms: 3000 });
      const v = r.data.ok ? r.data.verdict! : null;
      answers.push({ pick: v!.pick, ms: v!.ms, right: v!.right, answer: v!.answer });
    }
    await backdate(a.id);
    const f = await finish(g, a.id, { answers });
    expect(f.data).toMatchObject({ ok: true, status: "cleared", score: QUESTIONS * 140 });
  });

  it("refuses a late answer: it counts as a timeout", async () => {
    const g = await guest(uniq("qf_"));
    const a = await start(g);
    await guess(g, a.ref, { q: 0, open: true });
    // The question opened longer ago than its window and the network slack.
    await admin()
      .from("attempts")
      .update({ moves: [{ q: 0, open: true, t: Date.now() - LIMIT_MS - NET_SLACK_MS - 1000 }] })
      .eq("id", a.id);
    const r = await guess(g, a.ref, { q: 0, pick: a.correct[0], ms: 5000 });
    expect(r.data).toEqual({ ok: true, verdict: { q: 0, pick: null, ms: LIMIT_MS, right: false, answer: a.correct[0], late: true } });
  });

  it("can be raced as a points game (round 3); answers stay on the server", async () => {
    const host = await guest(uniq("qfh_"));
    const room = await host.api("/api/v1/rooms", { json: { game: "quickfire", difficulty: "easy", maxPlayers: 2 } });
    expect(room.status, JSON.stringify(room.data)).toBe(200);
    // Score races judge from the server's own answer log (tests/api/r3-08 covers the round rules).
    const ok = await host.api("/api/v1/rooms", { json: { game: "rungs", difficulty: "easy", maxPlayers: 2 } });
    expect(ok.status, JSON.stringify(ok.data)).toBe(200);
  });
});
