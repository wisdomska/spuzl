import { describe, expect, it } from "vitest";
import { admin, birthFor, guest, uniq } from "./helpers";

/**
 * Board Bay "Play live" matchmaking through the real API: join, pair into a live match, cancel, one entry
 * per player, the block rule, the age rule, the search time limit, and refusals for Flip and unknown games.
 * Needs `supabase start` and the dev server (API_BASE). Each test uses its own game so searches don't cross.
 */
type G = Awaited<ReturnType<typeof guest>>;
const join = (p: G, game: string) => p.api("/api/v1/bay/queue", { json: { game } });
const poll = (p: G) => p.api("/api/v1/bay/queue");
const cancel = (p: G) => p.api("/api/v1/bay/queue", { method: "DELETE" });

/** Clears searches other runs left for a game, so only this test's players wait for it. */
const clearGame = (game: string) => admin().from("board_queue").delete().eq("game_id", game).is("match_id", null);

describe("api: board bay play live", () => {
  it("pairs two players of the same game into a live, rated match and sends both there", async () => {
    await clearGame("chess");
    const a = await guest(uniq("qa_"));
    const b = await guest(uniq("qb_"));
    const qa = await join(a, "chess");
    expect(qa.status).toBe(200);
    expect(qa.data).toMatchObject({ status: "searching", game: "chess", timeoutMs: 60_000 });
    const qb = await join(b, "chess");
    expect(qb.data.status).toBe("matched");
    const pa = await poll(a);
    expect(pa.data).toMatchObject({ status: "matched", matchId: qb.data.matchId });

    const v = await a.api(`/api/v1/bay/${qb.data.matchId}`);
    expect(v.status).toBe(200);
    expect(v.data).toMatchObject({ game: "chess", mode: "live", status: "active", rated: true, bot: false, seats: 2 });
    expect(v.data.clockMs).toEqual([300000, 300000]);
    expect(v.data.inviteCode).toBeNull();
    expect(v.data.players.map((p: { id: string }) => p.id).sort()).toEqual([a.userId, b.userId].sort());

    // A legal first move from whoever has seat 0 goes through; the server still validates every move.
    const first = v.data.players[0].id === a.userId ? a : b;
    const second = first === a ? b : a;
    expect((await second.api(`/api/v1/bay/${qb.data.matchId}/move`, { json: { ply: 0, move: "e7e5" } })).data.error).toBe("not_your_turn");
    expect((await first.api(`/api/v1/bay/${qb.data.matchId}/move`, { json: { ply: 0, move: "e2e4" } })).status).toBe(200);

    // A stranger can't read it, and nobody can join it by code.
    const c = await guest(uniq("qc_"));
    expect((await c.api(`/api/v1/bay/${qb.data.matchId}`)).status).toBe(403);

    // Ending the match forgets the pairing: the next poll is idle, not sent back to an old game.
    await first.api(`/api/v1/bay/${qb.data.matchId}/action`, { json: { action: "resign" } });
    expect((await poll(a)).data.status).toBe("idle");
  });

  it("cancels, keeps one entry per player, and keeps the place in line on a reconnect", async () => {
    await clearGame("draughts");
    await clearGame("fourup");
    const a = await guest(uniq("qd_"));
    const first = await join(a, "draughts");
    expect(first.data.status).toBe("searching");
    const { data: row1 } = await admin().from("board_queue").select("enqueued_at").eq("player_id", a.userId).single();
    // Rejoining the same game (a reload) keeps the original place.
    await join(a, "draughts");
    const { data: row2 } = await admin().from("board_queue").select("enqueued_at").eq("player_id", a.userId).single();
    expect(row2!.enqueued_at).toBe(row1!.enqueued_at);
    // Switching game replaces the entry: still one row.
    await join(a, "fourup");
    const { data: rows } = await admin().from("board_queue").select("game_id").eq("player_id", a.userId);
    expect(rows).toEqual([{ game_id: "fourup" }]);
    // A Duel Quick Match search ends the Board Bay one, and the other way round.
    await a.api("/api/v1/duel/queue", { json: { game: "crownfall", rulesSeen: true } });
    expect((await poll(a)).data.status).toBe("idle");
    await join(a, "fourup");
    const { data: duel } = await admin().from("matchmaking_queue").select("player_id").eq("player_id", a.userId).is("match_id", null);
    expect(duel).toEqual([]);

    expect((await cancel(a)).status).toBe(200);
    expect((await poll(a)).data.status).toBe("idle");
    // Nobody to pair with after a cancel.
    const b = await guest(uniq("qe_"));
    expect((await join(b, "fourup")).data.status).toBe("searching");
    await cancel(b);
  });

  it("never pairs players who block each other", async () => {
    await clearGame("oware");
    const a = await guest(uniq("qf_"));
    const b = await guest(uniq("qg_"));
    expect((await a.api("/api/v1/blocks", { json: { playerId: b.userId } })).status).toBe(200);
    expect((await join(a, "oware")).data.status).toBe("searching");
    const qb = await join(b, "oware");
    expect(qb.data.status).toBe("searching");
    expect((await poll(a)).data.status).toBe("searching");
    // A third player is paired with the one waiting longest.
    const c = await guest(uniq("qh_"));
    const qc = await join(c, "oware");
    expect(qc.data.status).toBe("matched");
    const v = await c.api(`/api/v1/bay/${qc.data.matchId}`);
    expect(v.data.players.map((p: { id: string }) => p.id)).toContain(a.userId);
    expect((await poll(b)).data.status).toBe("searching");
    await cancel(b);
  });

  it("stops searching after a minute and frees the entry", async () => {
    await clearGame("ludo");
    const a = await guest(uniq("qi_"));
    expect((await join(a, "ludo")).data.status).toBe("searching");
    await admin()
      .from("board_queue")
      .update({ enqueued_at: new Date(Date.now() - 61_000).toISOString() })
      .eq("player_id", a.userId);
    expect((await poll(a)).data).toMatchObject({ status: "timeout", game: "ludo" });
    expect((await poll(a)).data.status).toBe("idle");
  });

  it("refuses Flip and unknown games, for the queue and for new invites", async () => {
    const a = await guest(uniq("qj_"));
    const flip = await join(a, "flip");
    expect(flip.status).toBe(400);
    expect(flip.data.error).toBe("not_board_game");
    expect((await join(a, "crownfall")).status).toBe(400);
    expect((await join(a, "nope")).status).toBe(400);
    expect((await a.api("/api/v1/bay", { json: { game: "flip", mode: "live" } })).status).toBe(400);
    expect((await a.api("/api/v1/bay", { json: { game: "flip", mode: "async", bot: true } })).status).toBe(400);
    expect((await poll(a)).data.status).toBe("idle");
  });

  it("keeps 13 to 15 year olds out, the same as Duel Quick Match", async () => {
    const g = await guest();
    await g.api("/api/v1/profile", { json: { nickname: uniq("yb_"), ...birthFor("13-15"), color: "#2FD3E0" } });
    const r = await join(g, "chess");
    expect(r.status).toBe(403);
    expect(r.data.error).toBe("age_restricted");
  });
});
