import { describe, expect, it } from "vitest";
import { admin, guest, uniq } from "./helpers";
import { legalMoves } from "@/games/draughts/engine";

/**
 * Draughts board sizes through the real API (owner, 22 Nov 2026: International 10 × 10 is the default, English 8 × 8
 * stays as a choice). Needs `supabase start` and the dev server (API_BASE).
 */
type G = Awaited<ReturnType<typeof guest>>;
const boardOf = (v: { state: { board: number[] } }) => v.state.board.length;

describe("api: draughts board size", () => {
  it("a new match is 10 × 10 unless 8 × 8 is asked for; rematches keep the board", async () => {
    const a = await guest(uniq("dz_"));
    const def = await a.api("/api/v1/bay", { json: { game: "draughts", mode: "async", bot: true } });
    expect(def.status).toBe(200);
    expect(boardOf(def.data)).toBe(100);
    const ten = await a.api("/api/v1/bay", { json: { game: "draughts", mode: "async", bot: true, draughts: { size: 10 } } });
    expect(boardOf(ten.data)).toBe(100);
    const eight = await a.api("/api/v1/bay", { json: { game: "draughts", mode: "async", bot: true, draughts: { size: 8 } } });
    expect(boardOf(eight.data)).toBe(64);
    // a size draughts doesn't have is refused
    expect((await a.api("/api/v1/bay", { json: { game: "draughts", mode: "async", bot: true, draughts: { size: 12 } } })).status).toBe(400);

    for (const [m, n] of [
      [eight.data, 64],
      [def.data, 100],
    ] as const) {
      await a.api(`/api/v1/bay/${m.id}/action`, { json: { action: "resign" } });
      const re = await a.api(`/api/v1/bay/${m.id}/action`, { json: { action: "rematch" } });
      expect(re.status).toBe(200);
      expect(boardOf(re.data)).toBe(n);
    }
  });

  it("plays and takes back on an 8 × 8 friend game: the takeback replays from the 8 × 8 opening", async () => {
    const a = await guest(uniq("dt_"));
    const b = await guest(uniq("du_"));
    const m = await a.api("/api/v1/bay", { json: { game: "draughts", mode: "live", draughts: { size: 8 } } });
    const j = await b.api(`/api/v1/bay/${m.data.id}/join`, { json: { code: m.data.inviteCode } });
    expect(j.data.status).toBe("active");
    // seat 0 moves first: whoever holds it plays a legal opening move
    const mover = j.data.mySeat === 0 ? b : a;
    const other = mover === a ? b : a;
    const move = legalMoves(j.data.state.board, 0)[0].path;
    expect((await mover.api(`/api/v1/bay/${m.data.id}/move`, { json: { ply: 0, move } })).status).toBe(200);
    await mover.api(`/api/v1/bay/${m.data.id}/action`, { json: { action: "takeback_request" } });
    const tb = await other.api(`/api/v1/bay/${m.data.id}/action`, { json: { action: "takeback_accept" } });
    expect(tb.status).toBe(200);
    expect(tb.data.ply).toBe(0);
    expect(boardOf(tb.data)).toBe(64);
  });

  it("Play live pairs only players who picked the same board, and starts the match on it", async () => {
    await admin().from("board_queue").delete().eq("game_id", "draughts").is("match_id", null);
    const players: G[] = await Promise.all([guest(uniq("qa_")), guest(uniq("qb_")), guest(uniq("qc_"))]);
    const [a, b, c] = players;
    expect((await a.api("/api/v1/bay/queue", { json: { game: "draughts", draughts: { size: 8 } } })).data.status).toBe("searching");
    // the default board: not paired with a
    expect((await b.api("/api/v1/bay/queue", { json: { game: "draughts" } })).data.status).toBe("searching");
    const qc = await c.api("/api/v1/bay/queue", { json: { game: "draughts", draughts: { size: 8 } } });
    expect(qc.data.status).toBe("matched");
    const { data: row } = await admin().from("board_matches").select("players, state").eq("id", qc.data.matchId).single();
    expect((row!.players as string[]).sort()).toEqual([a.userId, c.userId].sort());
    expect((row!.state as { board: number[] }).board).toHaveLength(64);
    await b.api("/api/v1/bay/queue", { method: "DELETE" });
  });
});
