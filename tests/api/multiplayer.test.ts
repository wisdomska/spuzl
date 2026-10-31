import { describe, expect, it } from "vitest";
import { admin, guest, uniq } from "./helpers";
import { createRng } from "@/lib/rng";
import crownfall from "@/games/crownfall/logic";
import type { Difficulty } from "@/games/types";

/**
 * Multiplayer through the real API: matchmaking, server-validated progress, round resolution,
 * simultaneous finishes, disconnects, Party rooms, Board Bay legality and async challenges.
 * Needs `supabase start` and the dev server (API_BASE).
 */
type G = Awaited<ReturnType<typeof guest>>;

const solve = (matchId: string, setNo: number, round: number, difficulty: string) => {
  const g = crownfall.generate(createRng(`mp:${matchId}:${setNo}:${round}`), difficulty as Difficulty);
  const n = g.puzzle.size;
  const state = new Array(n * n).fill(0);
  g.solution.forEach((c, r) => (state[r * n + c] = 2));
  return { state, n };
};

/** Skip the versus intro and countdown: start the current round now. */
const startNow = (id: string, agoMs = 1000) =>
  admin()
    .from("matches")
    .update({ round_started_at: new Date(Date.now() - agoMs).toISOString() })
    .eq("id", id);

async function pairDuel(): Promise<{ a: G; b: G; id: string }> {
  const a = await guest(uniq("da_"));
  const b = await guest(uniq("db_"));
  const qa = await a.api("/api/v1/duel/queue", { json: { game: "crownfall" } });
  expect(qa.status).toBe(200);
  const qb = await b.api("/api/v1/duel/queue", { json: { game: "crownfall" } });
  expect(qb.data.status).toBe("matched");
  const pa = await a.api("/api/v1/duel/queue");
  expect(pa.data).toMatchObject({ status: "matched", matchId: qb.data.matchId });
  return { a, b, id: qb.data.matchId };
}

describe("api: duel", () => {
  it("pairs two players, hides the puzzle until the countdown, and validates progress on the server", async () => {
    const { a, b, id } = await pairDuel();
    const v = await a.api(`/api/v1/matches/${id}`);
    expect(v.status).toBe(200);
    expect(v.data.players).toHaveLength(2);
    expect(v.data.rated).toBe(true);
    expect(v.data.puzzle).toBeNull(); // versus intro
    expect(JSON.stringify(v.data)).not.toContain("solution");

    // A stranger can't read it.
    const c = await guest(uniq("dc_"));
    expect((await c.api(`/api/v1/matches/${id}`)).status).toBe(403);

    // Too early to finish.
    const { state, n } = solve(id, 1, 1, v.data.difficulty);
    expect((await a.api(`/api/v1/matches/${id}/finish`, { json: { round: 1, state, mistakes: 0 } })).status).toBe(409);

    await startNow(id);
    const live = await b.api(`/api/v1/matches/${id}`);
    expect(live.data.puzzle.game).toBe("crownfall");
    const empty = new Array(n * n).fill(0);
    const p0 = await a.api(`/api/v1/matches/${id}/progress`, { json: { round: 1, state: empty, mistakes: 0 } });
    expect(p0.data.progress).toBe(0);
    // Half the crowns: the server computes the fraction from the state, whatever the client claims.
    const half = empty.slice();
    state.forEach((v2, i) => v2 === 2 && i < (n * n) / 2 && (half[i] = 2));
    const p1 = await a.api(`/api/v1/matches/${id}/progress`, { json: { round: 1, state: half, mistakes: 1 } });
    expect(p1.data.progress).toBeGreaterThan(0);
    expect(p1.data.progress).toBeLessThan(1);
    expect(p1.data.mistakes).toBe(1);
    // Mistakes never go down; garbage states are refused.
    const p2 = await a.api(`/api/v1/matches/${id}/progress`, { json: { round: 1, state: half, mistakes: 0 } });
    expect(p2.data.mistakes).toBe(1);
    const huge = await a.api(`/api/v1/matches/${id}/progress`, { json: { round: 1, state: "x".repeat(70_000), mistakes: 1 } });
    expect(huge.status).toBe(422);
    const wrongRound = await a.api(`/api/v1/matches/${id}/progress`, { json: { round: 2, state: half, mistakes: 1 } });
    expect(wrongRound.status).toBe(409);

    // A wrong "solved" board is rejected; the real solution wins the round.
    expect((await a.api(`/api/v1/matches/${id}/finish`, { json: { round: 1, state: half, mistakes: 1 } })).status).toBe(422);
    const fin = await a.api(`/api/v1/matches/${id}/finish`, { json: { round: 1, state, mistakes: 1 } });
    expect(fin.status).toBe(200);
    expect(fin.data.round).toBe(2);
    expect(fin.data.players.find((p: { id: string }) => p.id === a.userId).roundsWon).toBe(1);
    expect(fin.data.rounds.find((r: { playerId: string; round: number }) => r.round === 1 && r.playerId === a.userId).won).toBe(true);
    // The loser's late finish is refused: the round is over.
    expect((await b.api(`/api/v1/matches/${id}/finish`, { json: { round: 1, state, mistakes: 0 } })).status).toBe(409);
  });

  it("settles simultaneous finishes once, the same for both players", async () => {
    const { a, b, id } = await pairDuel();
    await startNow(id, 4000);
    const v = await a.api(`/api/v1/matches/${id}`);
    const { state } = solve(id, 1, 1, v.data.difficulty);
    const [ra, rb] = await Promise.all([
      a.api(`/api/v1/matches/${id}/finish`, { json: { round: 1, state, mistakes: 0 } }),
      b.api(`/api/v1/matches/${id}/finish`, { json: { round: 1, state, mistakes: 0 } }),
    ]);
    expect([ra.status, rb.status].filter((s) => s === 200).length).toBeGreaterThanOrEqual(1);
    const after = (await b.api(`/api/v1/matches/${id}`)).data;
    expect(after.round).toBe(2);
    const r1 = after.rounds.filter((r: { round: number }) => r.round === 1);
    const winners = r1.filter((r: { won: boolean }) => r.won);
    const times = r1.map((r: { timeMs: number | null }) => r.timeMs).filter((t: number | null) => t !== null);
    // Same tenth with equal slips is a drawn round; otherwise exactly one winner.
    if (times.length === 2 && Math.floor(times[0] / 100) === Math.floor(times[1] / 100)) expect(winners.length).toBe(0);
    else expect(winners.length).toBe(1);
    const total = after.players.reduce((s: number, p: { roundsWon: number }) => s + p.roundsWon, 0);
    expect(total).toBe(winners.length);
  });

  it("pauses for a dropped player and gives the win after 20 s (abandoning is a loss), with ratings", async () => {
    const { a, b, id } = await pairDuel();
    await startNow(id, 2000);
    await admin()
      .from("match_players")
      .update({ last_seen_at: new Date(Date.now() - 8000).toISOString() })
      .eq("match_id", id)
      .eq("player_id", b.userId);
    const t1 = await a.api(`/api/v1/matches/${id}/tick`, { json: {} });
    expect(t1.data.pausedAt).not.toBeNull();
    expect(t1.data.players.find((p: { id: string }) => p.id === b.userId).stale).toBe(true);
    // B comes back inside the window: clocks resume.
    const back = await b.api(`/api/v1/matches/${id}/tick`, { json: {} });
    expect(back.data.pausedAt).toBeNull();
    expect(back.data.pauseMs).toBeGreaterThan(0);
    // B drops for good.
    await admin()
      .from("match_players")
      .update({ last_seen_at: new Date(Date.now() - 25_000).toISOString() })
      .eq("match_id", id)
      .eq("player_id", b.userId);
    const t2 = await a.api(`/api/v1/matches/${id}/tick`, { json: {} });
    expect(t2.data.status).toBe("finished");
    expect(t2.data.result).toBe("abandon");
    expect(t2.data.winnerId).toBe(a.userId);
    const me = t2.data.players.find((p: { id: string }) => p.id === a.userId);
    expect(me.ratingAfter).toBeGreaterThan(me.ratingBefore);
  });

  it("leaving counts as a loss; a rematch needs both players", async () => {
    const { a, b, id } = await pairDuel();
    await b.api(`/api/v1/matches/${id}/leave`, { json: {} });
    const v = (await a.api(`/api/v1/matches/${id}`)).data;
    expect(v).toMatchObject({ status: "finished", result: "left", winnerId: a.userId });
    const r1 = await a.api(`/api/v1/matches/${id}/rematch`, { json: {} });
    expect(r1.data.waiting).toBe(true);
    const r2 = await b.api(`/api/v1/matches/${id}/rematch`, { json: {} });
    expect(r2.data.matchId).toBeTruthy();
    expect((await a.api(`/api/v1/matches/${id}/rematch`, { json: {} })).data.matchId).toBe(r2.data.matchId);
  });

  it("offers the Practice bot only after 20 s, unrated", async () => {
    const a = await guest(uniq("bt_"));
    await a.api("/api/v1/duel/queue", { json: { game: "crownfall" } });
    expect((await a.api("/api/v1/duel/bot", { json: {} })).status).toBe(409);
    await admin()
      .from("matchmaking_queue")
      .update({ enqueued_at: new Date(Date.now() - 21_000).toISOString() })
      .eq("player_id", a.userId);
    const bot = await a.api("/api/v1/duel/bot", { json: {} });
    expect(bot.status).toBe(200);
    const v = (await a.api(`/api/v1/matches/${bot.data.matchId}`)).data;
    expect(v).toMatchObject({ isBot: true, rated: false });
    expect(v.bot.name).toBe("Practice bot");
  });

  it("keeps 13 to 15 year olds out of Quick Match", async () => {
    const g = await guest();
    await g.api("/api/v1/profile", { json: { nickname: uniq("yg_"), ageBand: "13-15", color: "#2FD3E0" } });
    expect((await g.api("/api/v1/duel/queue", { json: {} })).status).toBe(403);
  });
});

describe("api: party rooms", () => {
  it("creates a room, joins case-insensitively, needs everyone ready, and moves the host on leave", async () => {
    const host = await guest(uniq("ph_"));
    const room = await host.api("/api/v1/rooms", { json: { game: "crownfall", difficulty: "easy", maxPlayers: 3 } });
    expect(room.status).toBe(200);
    const code: string = room.data.code;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
    const p2 = await guest(uniq("p2_"));
    const p3 = await guest(uniq("p3_"));
    const p4 = await guest(uniq("p4_"));
    const preview = await p2.api(`/api/v1/rooms/${code.toLowerCase()}`);
    expect(preview.data).toMatchObject({ member: false, room: { count: 1, max: 3 } });
    expect((await p2.api(`/api/v1/rooms/${code.toLowerCase()}/join`, { json: {} })).status).toBe(200);
    expect((await p3.api(`/api/v1/rooms/${code}/join`, { json: {} })).status).toBe(200);
    expect((await p4.api(`/api/v1/rooms/${code}/join`, { json: {} })).status).toBe(409); // full
    expect((await p2.api("/api/v1/rooms/0O1I/join", { json: {} })).status).toBe(404);

    expect((await p2.api(`/api/v1/rooms/${code}/start`, { json: {} })).status).toBe(403); // host only
    const notReady = await host.api(`/api/v1/rooms/${code}/start`, { json: {} });
    expect(notReady.status).toBe(409);
    await p2.api(`/api/v1/rooms/${code}/ready`, { json: { ready: true } });
    await p3.api(`/api/v1/rooms/${code}/ready`, { json: { ready: true } });

    // The host leaves in the lobby: the earliest joiner takes over.
    await host.api(`/api/v1/matches/${room.data.matchId}/leave`, { json: {} });
    const v = (await p2.api(`/api/v1/rooms/${code}`)).data.view;
    expect(v.hostId).toBe(p2.userId);
    expect((await p2.api(`/api/v1/rooms/${code}/start`, { json: {} })).status).toBe(200);
    const live = (await p3.api(`/api/v1/matches/${room.data.matchId}`)).data;
    expect(live.status).toBe("playing");
    expect(live.games).toHaveLength(3);

    // Race: both finish; places and points come from server times.
    await startNow(room.data.matchId);
    const s = solve(room.data.matchId, live.setNo, 1, "easy").state;
    const f2 = await p2.api(`/api/v1/matches/${room.data.matchId}/finish`, { json: { round: 1, state: s, mistakes: 0 } });
    expect(f2.status).toBe(200);
    const f3 = await p3.api(`/api/v1/matches/${room.data.matchId}/finish`, { json: { round: 1, state: s, mistakes: 2 } });
    expect(f3.data.status).toBe("round_end");
    const pts = f3.data.players.filter((p: { left: boolean }) => !p.left).map((p: { points: number }) => p.points);
    expect(Math.min(...pts)).toBeGreaterThan(0);
    expect((await p2.api(`/api/v1/rooms/${code}/next`, { json: {} })).status).toBe(200);
    expect((await p3.api(`/api/v1/matches/${room.data.matchId}`)).data.round).toBe(2);
  });
});

describe("api: board bay", () => {
  it("validates every move on the server and rejects illegal ones", async () => {
    const a = await guest(uniq("ba_"));
    const b = await guest(uniq("bb_"));
    const m = await a.api("/api/v1/bay", { json: { game: "chess", mode: "live" } });
    expect(m.status).toBe(200);
    expect(m.data.status).toBe("waiting");
    expect((await b.api(`/api/v1/bay/${m.data.id}/join`, { json: { code: "ZZZZ" } })).status).toBe(409);
    const j = await b.api(`/api/v1/bay/${m.data.id}/join`, { json: { code: m.data.inviteCode.toLowerCase() } });
    expect(j.data.status).toBe("active");
    expect(j.data.clockMs).toEqual([300000, 300000]);

    const illegal = await a.api(`/api/v1/bay/${m.data.id}/move`, { json: { ply: 0, move: "e2e5" } });
    expect(illegal.status).toBe(422);
    expect(illegal.data.error).toBe("illegal_move");
    expect((await b.api(`/api/v1/bay/${m.data.id}/move`, { json: { ply: 0, move: "e7e5" } })).data.error).toBe("not_your_turn");
    const ok = await a.api(`/api/v1/bay/${m.data.id}/move`, { json: { ply: 0, move: "e2e4" } });
    expect(ok.status).toBe(200);
    expect(ok.data.ply).toBe(1);
    expect((await a.api(`/api/v1/bay/${m.data.id}/move`, { json: { ply: 0, move: "d2d4" } })).status).toBe(409); // stale ply
    expect((await b.api(`/api/v1/bay/${m.data.id}/move`, { json: { ply: 1, move: "e7e5" } })).status).toBe(200);

    // Takeback (unranked): requester's last move is undone once the other side accepts.
    await b.api(`/api/v1/bay/${m.data.id}/action`, { json: { action: "takeback_request" } });
    const tb = await a.api(`/api/v1/bay/${m.data.id}/action`, { json: { action: "takeback_accept" } });
    expect(tb.data.ply).toBe(1);
    expect(tb.data.turn).toBe(1);

    // Draw offer and resign.
    await a.api(`/api/v1/bay/${m.data.id}/action`, { json: { action: "draw_offer" } });
    expect((await a.api(`/api/v1/bay/${m.data.id}/action`, { json: { action: "draw_accept" } })).status).toBe(409);
    const r = await b.api(`/api/v1/bay/${m.data.id}/action`, { json: { action: "resign" } });
    expect(r.data).toMatchObject({ status: "finished", result: "resign", winnerId: a.userId });

    const inbox = await a.api("/api/v1/bay");
    expect(inbox.data.games.find((g: { id: string }) => g.id === m.data.id).status).toBe("finished");
  });

  it("plays the Practice bot and refuses nudges before 12 h", async () => {
    const a = await guest(uniq("bo_"));
    const m = await a.api("/api/v1/bay", { json: { game: "fourup", mode: "async", bot: true } });
    expect(m.data.status).toBe("active");
    const mv = await a.api(`/api/v1/bay/${m.data.id}/move`, { json: { ply: 0, move: 3 } });
    expect(mv.data.ply).toBe(2); // the bot replied
    expect(mv.data.moveDeadline - mv.data.serverNow).toBeGreaterThan(23 * 3_600_000);
    const b = await guest(uniq("bn_"));
    const inv = await b.api("/api/v1/bay", { json: { game: "oware", mode: "async" } });
    const c = await guest(uniq("bc_"));
    await c.api(`/api/v1/bay/${inv.data.id}/join`, { json: { code: inv.data.inviteCode } });
    await b.api(`/api/v1/bay/${inv.data.id}/move`, { json: { ply: 0, move: 2 } });
    expect((await b.api(`/api/v1/bay/${inv.data.id}/action`, { json: { action: "nudge" } })).status).toBe(409);
  });
});

describe("api: async challenge", () => {
  it("links the exact puzzle and records the head-to-head", async () => {
    const a = await guest(uniq("ca_"));
    const b = await guest(uniq("cb_"));
    const start = await a.api("/api/v1/attempts", { json: { game: "crownfall", mode: "free", difficulty: "easy" } });
    const { data: att } = await admin().from("attempts").select("free_seed").eq("id", start.data.attemptId).single();
    const [seed, diff] = att!.free_seed!.split("|");
    const g = crownfall.generate(createRng(seed), diff as Difficulty);
    const n = g.puzzle.size;
    const state = new Array(n * n).fill(0);
    g.solution.forEach((c, r) => (state[r * n + c] = 2));
    await new Promise((r) => setTimeout(r, 6500));
    const fin = await a.api(`/api/v1/attempts/${start.data.attemptId}/finish`, { json: { state, activeMs: 6400, mistakes: 1 } });
    expect(fin.data.status).toBe("cleared");
    const ch = await a.api("/api/v1/challenges", {
      json: { attemptId: start.data.attemptId, timeline: [{ ms: 1000, state: new Array(n * n).fill(0) }] },
    });
    expect(ch.status).toBe(200);
    const card = await b.api(`/api/v1/challenges/${ch.data.code}`);
    expect(card.data).toMatchObject({ game: "crownfall", senderMs: 6400, mistakes: 1, mine: false });
    expect(card.data.senderTimeline.at(-1)).toEqual([6400, 1]);
    expect((await a.api(`/api/v1/challenges/${ch.data.code}/accept`, { json: {} })).status).toBe(409);
    const acc = await b.api(`/api/v1/challenges/${ch.data.code}/accept`, { json: {} });
    expect(acc.data.puzzle).toEqual(g.puzzle);
    await new Promise((r) => setTimeout(r, 6500));
    await b.api(`/api/v1/attempts/${acc.data.attemptId}/finish`, { json: { state, activeMs: 6200, mistakes: 0 } });
    const res = await b.api(`/api/v1/challenges/${ch.data.code}/result`, { json: { attemptId: acc.data.attemptId } });
    expect(res.data.result).toMatchObject({ timeMs: 6200, won: true });
  });
});
