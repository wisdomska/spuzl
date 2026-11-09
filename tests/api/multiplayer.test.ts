import { describe, expect, it } from "vitest";
import { admin, birthFor, guest, uniq } from "./helpers";
import { setSetting } from "./setup";
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
  const qa = await a.api("/api/v1/duel/queue", { json: { game: "crownfall", rulesSeen: true } });
  expect(qa.status).toBe(200);
  const qb = await b.api("/api/v1/duel/queue", { json: { game: "crownfall", rulesSeen: true } });
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

  it("counts every round played against a person towards that game's category rank, once", async () => {
    const { a, b, id } = await pairDuel();
    await startNow(id, 4000);
    const v = await a.api(`/api/v1/matches/${id}`);
    const { state } = solve(id, 1, 1, v.data.difficulty);
    expect((await a.api(`/api/v1/matches/${id}/finish`, { json: { round: 1, state, mistakes: 0 } })).status).toBe(200);
    await startNow(id, 4000);
    await a.api(`/api/v1/matches/${id}/tick`, { json: {} });
    // b walks out: the match ends and its rounds count
    await b.api(`/api/v1/matches/${id}/leave`, { json: {} });
    const rows = async (who: string) =>
      (await admin().from("ratings").select("rating, games").eq("player_id", who).eq("track", "logic").maybeSingle()).data;
    const [ra, rb] = [await rows(a.userId), await rows(b.userId)];
    expect(ra?.games).toBeGreaterThanOrEqual(1);
    expect(rb?.games).toBeGreaterThanOrEqual(1);
    expect(Number(ra!.rating)).toBeGreaterThan(Number(rb!.rating));
    const { data: refs } = await admin().from("rank_contributions").select("ref").eq("player_id", a.userId);
    expect(new Set((refs ?? []).map((r) => r.ref)).size).toBe((refs ?? []).length);
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

  it("asks for the rules on a game never cleared, shows only live queue data, and offers the bot at once (SPZ-12)", async () => {
    const n = await guest(uniq("nr_"));
    const first = await n.api("/api/v1/duel/queue", { json: { game: "crownfall" } });
    expect([first.status, first.data.error]).toEqual([409, "needs_rules"]);
    expect(first.data.message).toBeTruthy();
    const second = await n.api("/api/v1/duel/queue", { json: { game: "crownfall", rulesSeen: true } });
    expect(second.status).toBe(200);
    if (second.data.status === "searching") {
      expect(second.data.usualWaitMs).toBeUndefined();
      expect(typeof second.data.searching).toBe("number");
    }
    await n.api("/api/v1/duel/queue", { method: "DELETE" });
  });

  it("offers the Practice bot from the start, unrated", async () => {
    const a = await guest(uniq("bt_"));
    await a.api("/api/v1/duel/queue", { json: { game: "crownfall", rulesSeen: true } });
    const bot = await a.api("/api/v1/duel/bot", { json: {} });
    expect(bot.status).toBe(200);
    const v = (await a.api(`/api/v1/matches/${bot.data.matchId}`)).data;
    expect(v).toMatchObject({ isBot: true, rated: false });
    expect(v.bot.name).toBe("Practice bot");
  });

  it("lets 13 to 15 year olds into Quick Match, in their own pool (round 3, owner decision)", async () => {
    const g = await guest();
    await g.api("/api/v1/profile", { json: { nickname: uniq("yg_"), ...birthFor("13-15"), color: "#2FD3E0" } });
    expect((await g.api("/api/v1/duel/queue", { json: {} })).status).not.toBe(403);
    await g.api("/api/v1/duel/queue", { method: "DELETE" });
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

describe("api: skipping a Party round", () => {
  it("a skipped round scores 0, the round ends without waiting, and the skipper plays the next game", async () => {
    const host = await guest(uniq("sh_"));
    const room = await host.api("/api/v1/rooms", { json: { game: "crownfall", difficulty: "easy", maxPlayers: 3 } });
    const code: string = room.data.code;
    const id: string = room.data.matchId;
    const p2 = await guest(uniq("s2_"));
    const p3 = await guest(uniq("s3_"));
    await p2.api(`/api/v1/rooms/${code}/join`, { json: {} });
    await p3.api(`/api/v1/rooms/${code}/join`, { json: {} });
    await p2.api(`/api/v1/rooms/${code}/ready`, { json: { ready: true } });
    await p3.api(`/api/v1/rooms/${code}/ready`, { json: { ready: true } });
    await host.api(`/api/v1/rooms/${code}/ready`, { json: { ready: true } });
    expect((await host.api(`/api/v1/rooms/${code}/start`, { json: {} })).status).toBe(200);
    expect((await p3.api(`/api/v1/matches/${id}/pass`, { json: { round: 1 } })).status).toBe(409); // too early
    await startNow(id);
    const live = (await host.api(`/api/v1/matches/${id}`)).data;

    const skipped = await p3.api(`/api/v1/matches/${id}/pass`, { json: { round: 1 } });
    expect(skipped.status).toBe(200);
    expect(skipped.data.players.find((p: { id: string }) => p.id === p3.userId).passed).toBe(true);
    const s = solve(id, live.setNo, 1, "easy").state;
    // a skipped round can't be finished after all
    expect((await p3.api(`/api/v1/matches/${id}/finish`, { json: { round: 1, state: s, mistakes: 0 } })).status).toBe(409);
    await host.api(`/api/v1/matches/${id}/finish`, { json: { round: 1, state: s, mistakes: 0 } });
    // the last racer still in finishes: the round ends at once, without waiting on the skipper
    const f2 = await p2.api(`/api/v1/matches/${id}/finish`, { json: { round: 1, state: s, mistakes: 0 } });
    expect(f2.data.status).toBe("round_end");
    const r3 = f2.data.rounds.find((r: { round: number; playerId: string }) => r.round === 1 && r.playerId === p3.userId);
    expect(r3).toMatchObject({ points: 0, place: 3 });
    expect((await host.api(`/api/v1/rooms/${code}/next`, { json: {} })).status).toBe(200);
    const next = (await p3.api(`/api/v1/matches/${id}`)).data;
    expect(next.round).toBe(2);
    expect(next.players.find((p: { id: string }) => p.id === p3.userId).passed).toBe(false);
  });
});

describe("api: Party round start (R2-03)", () => {
  it("starts after the countdown setting plus a buffer, shows the puzzle, and refuses moves until the real start", async () => {
    await setSetting("party.countdownSeconds", 5);
    try {
      const host = await guest(uniq("rh_"));
      const room = await host.api("/api/v1/rooms", { json: { game: "crownfall", difficulty: "easy", maxPlayers: 2 } });
      const code: string = room.data.code;
      const id: string = room.data.matchId;
      const p2 = await guest(uniq("r2_"));
      await p2.api(`/api/v1/rooms/${code}/join`, { json: {} });
      await p2.api(`/api/v1/rooms/${code}/ready`, { json: { ready: true } });
      const t0 = Date.now();
      expect((await host.api(`/api/v1/rooms/${code}/start`, { json: {} })).status).toBe(200);
      const v = (await p2.api(`/api/v1/matches/${id}`)).data;
      // 5 beats of 800 ms + SPUZL! 1.6 s = 5.6 s, plus the start buffer
      expect(v.countdownMs).toBe(5600);
      expect(v.roundStartedAt - t0).toBeGreaterThanOrEqual(5600);
      expect(v.roundStartedAt - t0).toBeLessThan(5600 + 1500 + 2000);
      // the board can be drawn during the countdown, but nothing it sends counts yet
      expect(v.puzzle).not.toBeNull();
      const s = solve(id, v.setNo, 1, "easy").state;
      const early = await p2.api(`/api/v1/matches/${id}/progress`, { json: { round: 1, state: s, mistakes: 0 } });
      expect([early.status, early.data.error]).toEqual([409, "too_early"]);
      expect((await p2.api(`/api/v1/matches/${id}/finish`, { json: { round: 1, state: s, mistakes: 0 } })).status).toBe(409);
      // the same for the next game of the set
      await startNow(id);
      await host.api(`/api/v1/matches/${id}/finish`, { json: { round: 1, state: s, mistakes: 0 } });
      const f = await p2.api(`/api/v1/matches/${id}/finish`, { json: { round: 1, state: s, mistakes: 0 } });
      expect(f.data.status).toBe("round_end");
      expect((await host.api(`/api/v1/rooms/${code}/next`, { json: {} })).status).toBe(200);
      const s2 = solve(id, v.setNo, 2, "easy").state;
      expect((await p2.api(`/api/v1/matches/${id}/finish`, { json: { round: 2, state: s2, mistakes: 0 } })).status).toBe(409);
    } finally {
      await admin().from("game_settings").delete().eq("key", "party.countdownSeconds");
    }
  });
});

describe("api: a friend's code", () => {
  it("sends any code where it leads: a Duel challenge, a Party room or a Board Games invite, and nothing else", async () => {
    const host = await guest(uniq("ch_"));
    const friend = await guest(uniq("cf_"));
    const duel = await host.api("/api/v1/duel/friend", { json: { game: "crownfall" } });
    expect((await friend.api("/api/v1/codes", { json: { code: duel.data.code.toLowerCase() } })).data).toEqual({
      kind: "duel",
      code: duel.data.code,
    });
    const room = await host.api("/api/v1/rooms", { json: { game: "crownfall", difficulty: "easy", maxPlayers: 3 } });
    expect((await friend.api("/api/v1/codes", { json: { code: room.data.code } })).data).toEqual({ kind: "party", code: room.data.code });
    const bay = await host.api("/api/v1/bay", { json: { game: "chess", mode: "live" } });
    expect((await friend.api("/api/v1/codes", { json: { code: ` ${bay.data.inviteCode} ` } })).data).toEqual({
      kind: "bay",
      id: bay.data.id,
      code: bay.data.inviteCode,
    });
    // joining the duel by its code closes it: the code no longer leads anywhere
    expect((await friend.api("/api/v1/duel/friend/join", { json: { code: duel.data.code } })).status).toBe(200);
    expect((await friend.api("/api/v1/codes", { json: { code: duel.data.code } })).status).toBe(404);
    expect((await friend.api("/api/v1/codes", { json: { code: "O0I1" } })).status).toBe(400);
  });
});

describe("api: inviting a friend", () => {
  it("invites only friends, only into your own open game, and the invite stops when the game closes", async () => {
    const hName = uniq("ih_");
    const fName = uniq("if_");
    const host = await guest(hName);
    const friend = await guest(fName);
    const stranger = await guest(uniq("is_"));
    await host.api("/api/v1/friends", { json: { nickname: fName } });
    expect((await friend.api("/api/v1/friends", { json: { nickname: hName } })).data.status).toBe("friends");
    const friendId = friend.userId;
    const strangerId = stranger.userId;

    const duel = await host.api("/api/v1/duel/friend", { json: { game: "crownfall" } });
    const send = (who: G, to: string, kind: string, target: string) => who.api("/api/v1/game-invites", { json: { to, kind, target } });
    expect((await send(host, friendId, "duel", duel.data.matchId)).data).toEqual({ sent: true });
    expect((await send(host, strangerId, "duel", duel.data.matchId)).status).toBe(403); // not a friend
    expect((await send(friend, host.userId, "duel", duel.data.matchId)).status).toBe(409); // not yours

    const bay = await host.api("/api/v1/bay", { json: { game: "ludo", mode: "async" } });
    expect((await send(host, friendId, "bay", bay.data.id)).data).toEqual({ sent: true });

    const room = await host.api("/api/v1/rooms", { json: { game: "crownfall", difficulty: "easy", maxPlayers: 3 } });
    expect((await send(host, friendId, "party", room.data.code)).data).toEqual({ sent: true });

    // the duel starts: its invite is closed
    expect((await friend.api("/api/v1/duel/friend/join", { json: { code: duel.data.code } })).status).toBe(200);
    expect((await send(host, friendId, "duel", duel.data.matchId)).status).toBe(409);
  });
});

describe("api: board games chat and rematches", () => {
  it("players chat in a board game (not strangers), and can rematch again and again", async () => {
    const a = await guest(uniq("ca_"));
    const b = await guest(uniq("cb_"));
    const c = await guest(uniq("cc_"));
    const m = await a.api("/api/v1/bay", { json: { game: "fourup", mode: "live" } });
    await b.api(`/api/v1/bay/${m.data.id}/join`, { json: { code: m.data.inviteCode } });
    expect((await a.api(`/api/v1/bay/${m.data.id}/chat`, { json: { quick: 0 } })).status).toBe(200);
    const seen = await b.api(`/api/v1/bay/${m.data.id}/chat`);
    expect(seen.data.messages).toHaveLength(1);
    expect(seen.data.messages[0].from).toBe(a.userId);
    expect((await c.api(`/api/v1/bay/${m.data.id}/chat`)).status).toBe(403);
    expect((await c.api(`/api/v1/bay/${m.data.id}/chat`, { json: { quick: 0 } })).status).toBe(403);

    // resign, rematch; resign the rematch, rematch again
    let id: string = m.data.id;
    for (let i = 0; i < 2; i++) {
      expect((await a.api(`/api/v1/bay/${id}/action`, { json: { action: "resign" } })).data.status).toBe("finished");
      const r = await b.api(`/api/v1/bay/${id}/action`, { json: { action: "rematch" } });
      expect(r.status).toBe(200);
      expect(r.data.id).not.toBe(id);
      expect(r.data.status).toBe("active");
      id = r.data.id;
    }
  });
});

describe("api: push alerts", () => {
  it("saves a device for push, keeps it to the player, and turns it off", async () => {
    const a = await guest(uniq("pa_"));
    const key = await a.api("/api/v1/push");
    expect(key.status).toBe(200);
    expect(key.data.publicKey === null || typeof key.data.publicKey === "string").toBe(true);
    const sub = { endpoint: `https://push.example.test/${uniq("ep_")}`, keys: { p256dh: "B".repeat(87), auth: "A".repeat(22) } };
    expect((await a.api("/api/v1/push", { json: sub })).data).toEqual({ on: true });
    const { data: row } = await admin().from("push_subscriptions").select("player_id").eq("endpoint", sub.endpoint).single();
    expect(row!.player_id).toBe(a.userId);
    expect((await a.api("/api/v1/push", { json: { ...sub, endpoint: "http://insecure.test/x" } })).status).toBe(400);
    expect((await a.api("/api/v1/push", { method: "DELETE", json: { endpoint: sub.endpoint } })).data).toEqual({ on: false });
    const { data: gone } = await admin().from("push_subscriptions").select("endpoint").eq("endpoint", sub.endpoint);
    expect(gone).toHaveLength(0);
  });
});

describe("api: Ludo house rules", () => {
  it("keeps the chosen house rules in the match and in its rematch", async () => {
    const a = await guest(uniq("lh_"));
    const m = await a.api("/api/v1/bay", { json: { game: "ludo", mode: "async", bot: true, ludo: { backKick: true, homeKick: true } } });
    expect(m.status).toBe(200);
    expect(m.data.state.opts).toEqual({ backKick: true, homeKick: true });
    const plain = await a.api("/api/v1/bay", { json: { game: "ludo", mode: "async", bot: true } });
    expect(plain.data.state.opts).toBeUndefined();
    await a.api(`/api/v1/bay/${m.data.id}/action`, { json: { action: "resign" } });
    const re = await a.api(`/api/v1/bay/${m.data.id}/action`, { json: { action: "rematch" } });
    expect(re.data.state.opts).toEqual({ backKick: true, homeKick: true });
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

    // Draw offer, withdrawn by the one who made it only, then offered again; then resign.
    await a.api(`/api/v1/bay/${m.data.id}/action`, { json: { action: "draw_offer" } });
    expect((await b.api(`/api/v1/bay/${m.data.id}/action`, { json: { action: "draw_withdraw" } })).status).toBe(409);
    const wd = await a.api(`/api/v1/bay/${m.data.id}/action`, { json: { action: "draw_withdraw" } });
    expect(wd.data.drawOffer).toBeNull();
    expect((await b.api(`/api/v1/bay/${m.data.id}/action`, { json: { action: "draw_accept" } })).status).toBe(409);
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

describe("api: ghost race track", () => {
  const today = () => new Date().toISOString().slice(0, 10);
  const puzzleOf = async (attemptId: string) => {
    const { data } = await admin().from("attempts").select("puzzle_id, mode").eq("id", attemptId).single();
    return data!;
  };

  it("races today's Daily track while Dailies are on", async () => {
    const g = await guest(uniq("gh_"));
    const r = await g.api("/api/v1/ghosts/dash", { json: {} });
    expect(r.status, JSON.stringify(r.data)).toBe(200);
    expect(JSON.stringify(r.data)).not.toContain("solution");
    const a = await puzzleOf(r.data.attemptId);
    expect(a.mode).toBe("challenge");
    const { data: daily } = await admin().from("dailies").select("puzzle_id").eq("game_id", "dash").eq("date", today()).single();
    expect(a.puzzle_id).toBe(daily!.puzzle_id);
  });

  it("with Dailies off: races a track of the day that is not a Daily, the same for everyone", async () => {
    await setSetting("features.dailies", false);
    try {
      const g = await guest(uniq("gh_"));
      const h = await guest(uniq("gh_"));
      const r1 = await g.api("/api/v1/ghosts/dash", { json: {} });
      const r2 = await h.api("/api/v1/ghosts/dash", { json: {} });
      expect([r1.status, r2.status]).toEqual([200, 200]);
      const a1 = await puzzleOf(r1.data.attemptId);
      const a2 = await puzzleOf(r2.data.attemptId);
      expect(a1.puzzle_id).toBeTruthy();
      expect(a2.puzzle_id).toBe(a1.puzzle_id);
      expect(r2.data.puzzle).toEqual(r1.data.puzzle);
      const { data: pz } = await admin().from("puzzles").select("seed").eq("id", a1.puzzle_id!).single();
      expect(pz!.seed).toBe(`ghost:dash:${today()}`);
      // Racing never publishes a Daily.
      const { data: daily } = await admin().from("dailies").select("date").eq("puzzle_id", a1.puzzle_id!);
      expect(daily).toEqual([]);
    } finally {
      await setSetting("features.dailies", true);
    }
  });
});

describe("api: Party start readiness (R3-01)", () => {
  it("refuses a plain Start while someone is not ready; Start without them seats them as spectators until Run it back", async () => {
    const host = await guest(uniq("rr_"));
    const room = await host.api("/api/v1/rooms", { json: { game: "crownfall", difficulty: "easy", maxPlayers: 4 } });
    const code: string = room.data.code;
    const id: string = room.data.matchId;
    const p2 = await guest(uniq("r2r_"));
    const p3 = await guest(uniq("r3r_"));
    await p2.api(`/api/v1/rooms/${code}/join`, { json: {} });
    await p3.api(`/api/v1/rooms/${code}/join`, { json: {} });

    // Only the host is ready: no plain start, and too few ready players to start without the rest.
    const plain = await host.api(`/api/v1/rooms/${code}/start`, { json: {} });
    expect([plain.status, plain.data.error]).toEqual([409, "not_ready"]);
    const tooFew = await host.api(`/api/v1/rooms/${code}/start`, { json: { readyOnly: true } });
    expect([tooFew.status, tooFew.data.error]).toEqual([409, "need_ready"]);

    await p2.api(`/api/v1/rooms/${code}/ready`, { json: { ready: true } });
    expect((await host.api(`/api/v1/rooms/${code}/start`, { json: {} })).status).toBe(409);
    // only the host may ask for it, and only with a real flag
    expect((await p2.api(`/api/v1/rooms/${code}/start`, { json: { readyOnly: true } })).status).toBe(403);
    expect((await host.api(`/api/v1/rooms/${code}/start`, { json: { readyOnly: "yes" } })).status).toBe(400);

    expect((await host.api(`/api/v1/rooms/${code}/start`, { json: { readyOnly: true } })).status).toBe(200);
    const live = (await p3.api(`/api/v1/matches/${id}`)).data;
    expect(live.status).toBe("playing");
    expect(live.players.find((p: { id: string }) => p.id === p3.userId)).toMatchObject({ spectator: true, satOut: true });
    // the sat-out player can't race this set
    await startNow(id);
    const s = solve(id, live.setNo, 1, "easy").state;
    expect((await p3.api(`/api/v1/matches/${id}/finish`, { json: { round: 1, state: s, mistakes: 0 } })).status).toBe(403);

    // Run it back: everyone races again.
    await admin().from("matches").update({ status: "finished" }).eq("id", id);
    expect((await host.api(`/api/v1/rooms/${code}/reset`, { json: {} })).status).toBe(200);
    const lobby = (await p3.api(`/api/v1/matches/${id}`)).data;
    expect(lobby.players.find((p: { id: string }) => p.id === p3.userId)).toMatchObject({ spectator: false, satOut: false });
  });

  it("keeps a classroom host a spectator through Start without them and Run it back", async () => {
    const host = await guest(uniq("rc_"));
    const room = await host.api("/api/v1/rooms", {
      json: { game: "crownfall", difficulty: "easy", maxPlayers: 4, classroom: true },
    });
    const code: string = room.data.code;
    const id: string = room.data.matchId;
    const [a, b, c] = [await guest(uniq("rca_")), await guest(uniq("rcb_")), await guest(uniq("rcc_"))];
    for (const p of [a, b, c]) await p.api(`/api/v1/rooms/${code}/join`, { json: {} });
    await a.api(`/api/v1/rooms/${code}/ready`, { json: { ready: true } });
    await b.api(`/api/v1/rooms/${code}/ready`, { json: { ready: true } });
    expect((await host.api(`/api/v1/rooms/${code}/start`, { json: { readyOnly: true } })).status).toBe(200);
    await admin().from("matches").update({ status: "finished" }).eq("id", id);
    expect((await host.api(`/api/v1/rooms/${code}/reset`, { json: {} })).status).toBe(200);
    const v = (await a.api(`/api/v1/matches/${id}`)).data;
    expect(v.players.find((p: { id: string }) => p.id === host.userId).spectator).toBe(true);
    expect(v.players.find((p: { id: string }) => p.id === c.userId).spectator).toBe(false);
  });
});
