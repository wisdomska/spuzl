import { afterAll, describe, expect, it } from "vitest";
import { admin, guest, uniq } from "./helpers";
import { setSetting } from "./setup";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import quickfire, { QUESTIONS, type QuickfireCheck } from "@/games/quickfire/logic";
import { roundSeed } from "@/lib/multiplayer/games";

/**
 * R3-08: Party score races through the real API. A score game (Quickfire here) can be picked for a Party while
 * "party.scoreRaces" is on; everyone plays the same seeded round; answers go through the guess route, which judges
 * them like a solo attempt on a server log per racer and round; the finish is checked against that log and the
 * round is placed by the server's score (then time). Lab score games need "features.labGames"; Duels never take them.
 * Run: API_BASE=http://localhost:<port> pnpm vitest run -c vitest.api.config.mts tests/api/r3-08-score-races.test.ts
 */
type G = Awaited<ReturnType<typeof guest>>;

const startNow = (id: string) =>
  admin()
    .from("matches")
    .update({ round_started_at: new Date(Date.now() - 1000).toISOString() })
    .eq("id", id);
const guess = (g: G, ref: unknown, body: unknown) =>
  g.api(`/api/games/quickfire/guess`, { json: { ref, guess: body } }) as Promise<{ status: number; data: QuickfireCheck }>;

async function quickfireRoom(n: number) {
  const host = await guest(uniq("sr_"));
  const room = await host.api("/api/v1/rooms", { json: { game: "quickfire", difficulty: "easy", maxPlayers: 4 } });
  expect(room.status, JSON.stringify(room.data)).toBe(200);
  const code: string = room.data.code;
  const id: string = room.data.matchId;
  const others: G[] = [];
  for (let i = 1; i < n; i++) {
    const p = await guest(uniq(`sr${i}_`));
    await p.api(`/api/v1/rooms/${code}/join`, { json: {} });
    await p.api(`/api/v1/rooms/${code}/ready`, { json: { ready: true } });
    others.push(p);
  }
  expect((await host.api(`/api/v1/rooms/${code}/start`, { json: {} })).status).toBe(200);
  await startNow(id);
  const v = (await host.api(`/api/v1/matches/${id}`)).data;
  expect(v.games).toEqual(["quickfire", "quickfire", "quickfire"]);
  const gen = quickfire.generate(createRng(roundSeed(id, v.setNo, 1)), v.difficulty as Difficulty);
  return { host, others, code, id, setNo: v.setNo as number, correct: gen.solution.correct };
}

/** Plays every question through the guess route; `right` decides which picks are correct. */
async function play(g: G, id: string, correct: number[], right: (q: number) => boolean) {
  const v = (await g.api(`/api/v1/matches/${id}`)).data;
  const ref = v.puzzle.data.ref;
  expect(ref).toEqual({ game: "quickfire", t: expect.any(String) });
  expect(JSON.stringify(v.puzzle)).not.toMatch(/"correct"|"solution"/);
  const answers: { pick: number | null; ms: number }[] = [];
  for (let q = 0; q < QUESTIONS; q++) {
    expect((await guess(g, ref, { q, open: true })).status).toBe(200);
    const pick = right(q) ? correct[q] : (correct[q] + 1) % 4;
    const r = await guess(g, ref, { q, pick, ms: 2500 });
    expect(r.status, JSON.stringify(r.data)).toBe(200);
    expect(r.data).toMatchObject({ ok: true, verdict: { q, pick, right: right(q) } });
    answers.push({ pick, ms: (r.data as { verdict: { ms: number } }).verdict.ms });
  }
  return { answers };
}

afterAll(async () => {
  await admin().from("game_settings").delete().in("key", ["party.scoreRaces", "features.labGames"]);
});

describe("api: Party score races (R3-08)", () => {
  it("judges answers on the server, refuses a forged finish, and places the round by score", async () => {
    await setSetting("party.scoreRaces", true);
    const { host, others, id, correct } = await quickfireRoom(3);
    const [good, forger] = others;

    // The host gets the first 3 right, `good` gets every one right but finishes later: points beat speed.
    const hostRun = await play(host, id, correct, (q) => q < 3);
    expect((await host.api(`/api/v1/matches/${id}/finish`, { json: { round: 1, state: hostRun, mistakes: 0 } })).status).toBe(200);
    const goodRun = await play(good, id, correct, () => true);
    // Asking again gives the same verdict and logs nothing new (one answer per question).
    const v = (await good.api(`/api/v1/matches/${id}`)).data;
    expect((await guess(good, v.puzzle.data.ref, { q: 0, pick: (correct[0] + 2) % 4, ms: 1000 })).data).toMatchObject({
      ok: true,
      verdict: { q: 0, pick: correct[0] },
    });

    // A state the server never judged doesn't finish.
    const forged = { answers: correct.map((pick) => ({ pick, ms: 400 })) };
    const f = await forger.api(`/api/v1/matches/${id}/finish`, { json: { round: 1, state: forged, mistakes: 0 } });
    expect([f.status, f.data.error]).toEqual([422, "not_solved"]);
    // Nobody can read a race log: the table has no client access.
    const { data: logs } = await admin().from("match_race_logs").select("player_id, log").eq("match_id", id);
    expect((logs ?? []).length).toBeGreaterThanOrEqual(2);

    expect((await forger.api(`/api/v1/matches/${id}/pass`, { json: { round: 1 } })).status).toBe(200);
    const end = await good.api(`/api/v1/matches/${id}/finish`, { json: { round: 1, state: goodRun, mistakes: 0 } });
    expect(end.status, JSON.stringify(end.data)).toBe(200);
    expect(end.data.status).toBe("round_end");
    const rows = end.data.rounds.filter((r: { round: number }) => r.round === 1);
    const row = (p: G) => rows.find((r: { playerId: string }) => r.playerId === p.userId);
    expect(row(good)).toMatchObject({ place: 1, won: true });
    expect(row(host).place).toBe(2);
    expect(row(forger)).toMatchObject({ place: 3, points: 0 });
    expect(row(good).score).toBeGreaterThan(row(host).score);
    expect(row(host).score).toBeGreaterThan(0);
    expect(row(forger).score).toBe(0);
  });

  it("is refused while the setting is off, and never in Duels", async () => {
    await setSetting("party.scoreRaces", false);
    try {
      const host = await guest(uniq("so_"));
      const r = await host.api("/api/v1/rooms", { json: { game: "quickfire", difficulty: "easy", maxPlayers: 4 } });
      expect([r.status, r.data.error]).toEqual([400, "game_not_raceable"]);
      const picks = await host.api("/api/v1/rooms", { json: { games: ["crownfall", "emojihits"], maxPlayers: 4 } });
      expect(picks.status).toBe(400);
    } finally {
      await setSetting("party.scoreRaces", true);
    }
    const p = await guest(uniq("sd_"));
    expect((await p.api("/api/v1/duel/queue", { json: { game: "quickfire", rulesSeen: true } })).data.error).toBe("game_not_duelable");
    expect((await p.api("/api/v1/duel/friend", { json: { game: "quickfire" } })).status).toBe(400);
  });

  it("takes a lab score game only while Lab games has it", async () => {
    await setSetting("party.scoreRaces", true);
    await setSetting("features.labGames", []);
    const host = await guest(uniq("sl_"));
    const off = await host.api("/api/v1/rooms", { json: { game: "twotruths", difficulty: "easy", maxPlayers: 4 } });
    expect(off.status).toBe(400);
    await setSetting("features.labGames", ["twotruths"]);
    const on = await host.api("/api/v1/rooms", { json: { game: "twotruths", difficulty: "easy", maxPlayers: 4 } });
    expect(on.status, JSON.stringify(on.data)).toBe(200);
    // Switched off again before the start: the room can't start that game.
    const p2 = await guest(uniq("sl2_"));
    await p2.api(`/api/v1/rooms/${on.data.code}/join`, { json: {} });
    await p2.api(`/api/v1/rooms/${on.data.code}/ready`, { json: { ready: true } });
    await setSetting("features.labGames", []);
    const start = await host.api(`/api/v1/rooms/${on.data.code}/start`, { json: {} });
    expect([start.status, start.data.error]).toEqual([409, "game_unavailable"]);
  });
});
