import { describe, expect, it } from "vitest";
import { admin, guest, uniq } from "./helpers";
import emojihits from "@/games/emojihits/logic";
import { createRng } from "@/lib/rng";

/**
 * Content-game references through the real API (lib/game/guess-token.ts): every served content puzzle carries
 * an opaque token in place of its content index, bound to the player and to where it was served (their open
 * attempt, the current round of a race they are in, the public practice board). Bare references, forged or
 * borrowed tokens, and tokens used outside their context are refused.
 * Uses Emoji Hits (live since the 2026-11 catalogue change; Five, which these checks used before, is retired).
 * Run: API_BASE=http://localhost:<port> pnpm vitest run -c vitest.api.config.mts tests/api/guess-tokens.test.ts
 */

type G = Awaited<ReturnType<typeof guest>>;
const guess = (g: G, game: string, ref: unknown, body: unknown) => g.api(`/api/games/${game}/guess`, { json: { ref, guess: body } });
/** Flips one character in the token's body. */
const tamper = (t: string) => t.slice(0, -4) + (t.at(-4) === "A" ? "B" : "A") + t.slice(-3);

describe("api: content-game tokens", () => {
  it("serves an attempt's puzzle with an opaque token, never the content index", async () => {
    const g = await guest(uniq("tok_"));
    const s = await g.api("/api/v1/attempts", { json: { game: "emojihits", mode: "free", difficulty: "medium" } });
    expect(s.status, JSON.stringify(s.data)).toBe(200);
    const ref = s.data.puzzle.ref;
    expect(ref).toEqual({ game: "emojihits", t: expect.any(String) });
    expect(Object.keys(ref).sort()).toEqual(["game", "t"]);
    expect(JSON.stringify(s.data.puzzle)).not.toMatch(/"i":|"d":/);
    const miss = { round: 0, answer: "not a title at all" };
    expect((await guess(g, "emojihits", ref, miss)).status).toBe(200);

    // Bare references are refused, whatever the index; so are forged and tampered tokens.
    for (const i of [0, 1, 2]) expect((await guess(g, "emojihits", { game: "emojihits", i, d: "medium" }, miss)).status).toBe(400);
    expect((await guess(g, "emojihits", { game: "emojihits", t: "1.AAAA" }, miss)).status).toBe(400);
    expect((await guess(g, "emojihits", { game: "emojihits", t: tamper(ref.t) }, miss)).status).toBe(400);
    // The token is the player's: someone else can't use it.
    const other = await guest(uniq("tok2_"));
    expect((await guess(other, "emojihits", ref, miss)).status).toBe(403);
    // Another game's route: refused.
    expect((await guess(g, "coil", ref, miss)).status).toBe(404);

    // Once the attempt is closed, its token answers nothing more.
    await admin().from("attempts").update({ status: "failed" }).eq("id", s.data.attemptId);
    expect((await guess(g, "emojihits", ref, miss)).status).toBe(409);
  });

  it("answers the guided practice board as practice, and only that board", async () => {
    const g = await guest(uniq("tokp_"));
    const r = await g.api("/api/v1/guided/emojihits");
    expect(r.status).toBe(200);
    const ref = r.data.puzzle.ref;
    expect(ref).toEqual({ game: "emojihits", t: expect.any(String) });
    const board = emojihits.generate(createRng("tutorial:emojihits"), "easy");
    // Practice answers are public anyway: a reveal shows the title, with nothing kept anywhere.
    expect((await guess(g, "emojihits", ref, { round: 0, reveal: true })).data).toEqual({ reveal: board.solution.answers[0][0] });
    // Another player's copy of the practice board answers the same (the board is public).
    const other = await guest(uniq("tokp2_"));
    expect((await guess(other, "emojihits", ref, { round: 0, answer: board.solution.answers[0][0] })).data).toMatchObject({ ok: true });
    // A practice token belongs to its game's route only.
    expect((await guess(g, "coil", ref, { round: 0, reveal: true })).status).toBe(404);
  });

  it("answers a race round only while it is the current round, and only for its racers", async () => {
    const host = await guest(uniq("tokh_"));
    const p2 = await guest(uniq("tokr_"));
    const outsider = await guest(uniq("toko_"));
    const room = await host.api("/api/v1/rooms", { json: { game: "rungs", difficulty: "easy", maxPlayers: 2 } });
    expect(room.status, JSON.stringify(room.data)).toBe(200);
    const id = room.data.matchId as string;
    expect((await p2.api(`/api/v1/rooms/${room.data.code}/join`, { json: {} })).status).toBe(200);
    await p2.api(`/api/v1/rooms/${room.data.code}/ready`, { json: { ready: true } });
    expect((await host.api(`/api/v1/rooms/${room.data.code}/start`, { json: {} })).status).toBe(200);
    await admin()
      .from("matches")
      .update({ round_started_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", id);

    const v = (await p2.api(`/api/v1/matches/${id}`)).data;
    expect(v.puzzle.game).toBe("rungs");
    const ref = v.puzzle.data.ref;
    expect(ref).toEqual({ game: "rungs", t: expect.any(String) });
    const g = { rung: 1, word: "ZZZZ" };
    expect((await guess(p2, "rungs", ref, g)).status).toBe(200);
    // The host's own view has its own token; p2's is not the host's to use, nor an outsider's.
    expect((await guess(host, "rungs", ref, g)).status).toBe(403);
    expect((await guess(outsider, "rungs", ref, g)).status).toBe(403);
    const hostRef = (await host.api(`/api/v1/matches/${id}`)).data.puzzle.data.ref;
    expect((await guess(host, "rungs", hostRef, g)).status).toBe(200);

    // The round moves on: the old round's token is refused.
    await admin().from("matches").update({ round: 2 }).eq("id", id);
    expect((await guess(p2, "rungs", ref, g)).status).toBe(409);
  });
});
