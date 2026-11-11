import { describe, expect, it } from "vitest";
import { guest, uniq } from "./helpers";
import twotruths from "@/games/twotruths/logic";

/**
 * R2-P5 part B: Two Truths and a Lie through the real API. The board gets the statements and an opaque token,
 * never which one is the lie; each round is opened and judged on the server, which sends the lie and what is true
 * instead only once the round is answered. The practice board is judged as practice. A live game since it graduated
 * from the lab (11 Nov 2026), so no setting is needed.
 * Run: API_BASE=http://localhost:<port> pnpm vitest run -c vitest.api.config.mts tests/api/twotruths.test.ts
 */
type G = Awaited<ReturnType<typeof guest>>;
const ask = (g: G, ref: unknown, body: unknown) => g.api("/api/games/twotruths/guess", { json: { ref, guess: body } });

describe("api: Two Truths and a Lie", () => {
  it("serves statements without the lie and judges each round on the server", async () => {
    const g = await guest(uniq("tt_"));
    const s = await g.api("/api/v1/attempts", { json: { game: "twotruths", mode: "free", difficulty: "easy" } });
    expect(s.status, JSON.stringify(s.data)).toBe(200);
    const p = s.data.puzzle;
    expect(p.ref).toEqual({ game: "twotruths", t: expect.any(String) });
    expect(JSON.stringify(p)).not.toMatch(/"lie"|"fix"|"i":|"d":/);
    expect(p.rounds).toHaveLength(5);
    // An answer before the round opened is refused; once open it is judged with the lie and the fix.
    expect((await ask(g, p.ref, { q: 0, pick: 0, ms: 3000 })).data).toEqual({ ok: false, refused: true });
    expect((await ask(g, p.ref, { q: 0, open: true })).data).toMatchObject({ ok: true });
    const v = (await ask(g, p.ref, { q: 0, pick: 1, ms: 3000 })).data.verdict;
    expect(v).toMatchObject({ q: 0, pick: 1, answer: expect.any(Number), fix: expect.any(String) });
    expect(v.right).toBe(v.answer === 1);
    // The second answer to the same round returns the first verdict.
    expect((await ask(g, p.ref, { q: 0, pick: (v.answer + 1) % 3, ms: 3000 })).data.verdict).toMatchObject({ pick: 1 });
  });

  it("judges the practice board as practice", async () => {
    const g = await guest(uniq("ttp_"));
    const r = await g.api("/api/v1/guided/twotruths");
    expect(r.status).toBe(200);
    const board = twotruths.practice!();
    expect(r.data.puzzle.rounds).toEqual((board.puzzle as { rounds: unknown }).rounds);
    const lie = (board.solution as { lie: number[] }).lie[0];
    expect((await ask(g, r.data.puzzle.ref, { q: 0, pick: lie, ms: 2000 })).data.verdict).toMatchObject({ right: true });
  });
});
