import { describe, expect, it } from "vitest";
import { admin, guest, uniq } from "./helpers";

/**
 * R2-02: under-16 Duel. Every Play live queue endpoint refuses a 13 to 15 account (403 age_restricted), read from the
 * effective band. R3-06: Duel Quick Match is open to 13 to 15, who are only ever paired with other 13 to 15 players
 * (and chat stays preset-only); Challenge a friend works with no game picked (Any game); and the
 * server records duel_created by band and kind for the admin Metrics page.
 * Needs `supabase start` and the dev server (API_BASE).
 */
type G = Awaited<ReturnType<typeof guest>>;

// R3-06: Duel Quick Match is open to 13 to 15 (band-only pairing, below); Board Bay Play live stays 16+.
const LIVE_ENDPOINTS: { name: string; call: (p: G) => ReturnType<G["api"]> }[] = [
  { name: "POST /api/v1/bay/queue (join Play live)", call: (p) => p.api("/api/v1/bay/queue", { json: { game: "chess" } }) },
  { name: "GET /api/v1/bay/queue (poll Play live)", call: (p) => p.api("/api/v1/bay/queue") },
];

async function duelCreatedCount(kind: "friend" | "quick", band: string) {
  const { count, error } = await admin()
    .from("client_metrics")
    .select("id", { count: "exact", head: true })
    .eq("name", "duel_created")
    .eq("kind", kind)
    .eq("band", band);
  if (error) throw error;
  return count ?? 0;
}

describe("api: under-16 Play live (R2-02)", () => {
  for (const ep of LIVE_ENDPOINTS)
    it(`a 13-15 account gets 403 on ${ep.name}`, async () => {
      const kid = await guest(uniq("u2_"), "13-15");
      const r = await ep.call(kid);
      expect(r.status).toBe(403);
      expect(r.data.error).toBe("age_restricted");
    });

  it("16-17 and 18+ accounts may join Quick Match and Play live", async () => {
    for (const band of ["16-17", "18+"] as const) {
      const p = await guest(uniq("u3_"), band);
      expect((await p.api("/api/v1/duel/queue", { json: { game: "crownfall", rulesSeen: true } })).status).toBe(200);
      expect((await p.api("/api/v1/duel/queue")).status).toBe(200);
      expect((await p.api("/api/v1/duel/queue", { method: "DELETE" })).status).toBe(200);
      expect((await p.api("/api/v1/bay/queue", { json: { game: "draughts" } })).status).toBe(200);
      expect((await p.api("/api/v1/bay/queue", { method: "DELETE" })).status).toBe(200);
    }
  });

  it("reads the effective band: a stale stored 18+ never lets a 15-year-old into Play live", async () => {
    const kid = await guest(uniq("u4_"), "13-15");
    // Write the stored column straight past the API, as a stale row would look; the birth month and year still say 15.
    await admin().from("players").update({ age_band: "18+" }).eq("id", kid.userId);
    expect((await kid.api("/api/v1/bay/queue", { json: { game: "chess" } })).status).toBe(403);
  });

  it("cancelling a queue stays open to everyone (it never widens access)", async () => {
    const kid = await guest(uniq("u5_"), "13-15");
    expect((await kid.api("/api/v1/duel/queue", { method: "DELETE" })).status).toBe(200);
    expect((await kid.api("/api/v1/bay/queue", { method: "DELETE" })).status).toBe(200);
  });
});

describe("api: under-16 Quick Match, band-only (R3-06)", () => {
  /** Only these test players wait, so a pairing can only be with each other. */
  const clearQueue = () => admin().from("matchmaking_queue").delete().is("match_id", null);
  const queueGame = { game: "crownfall", rulesSeen: true };

  it("an adult and a 13-15 player queued together are never matched, however long they wait", async () => {
    await clearQueue();
    const adult = await guest(uniq("q1_"), "18+");
    const kid = await guest(uniq("q2_"), "13-15");
    expect((await adult.api("/api/v1/duel/queue", { json: queueGame })).data.status).toBe("searching");
    const k = await kid.api("/api/v1/duel/queue", { json: queueGame });
    expect(k.status).toBe(200);
    expect(k.data.status).toBe("searching");
    // Both waited a long time: the rating window is at its widest, and still no pair.
    const old = new Date(Date.now() - 100_000).toISOString();
    await admin().from("matchmaking_queue").update({ enqueued_at: old }).in("player_id", [adult.userId, kid.userId]);
    for (const p of [adult, kid, adult, kid]) expect((await p.api("/api/v1/duel/queue")).data.status).toBe("searching");
    const { data: rows } = await admin()
      .from("matchmaking_queue")
      .select("player_id, pool, match_id")
      .in("player_id", [adult.userId, kid.userId]);
    expect(rows).toEqual(
      expect.arrayContaining([
        { player_id: adult.userId, pool: "open", match_id: null },
        { player_id: kid.userId, pool: "u16", match_id: null },
      ]),
    );
    await adult.api("/api/v1/duel/queue", { method: "DELETE" });
    await kid.api("/api/v1/duel/queue", { method: "DELETE" });
  });

  it("two 13-15 players are matched, and the duel is recorded under 13-15", async () => {
    await clearQueue();
    const a = await guest(uniq("q3_"), "13-15");
    const b = await guest(uniq("q4_"), "13-15");
    const before = await duelCreatedCount("quick", "13-15");
    expect((await a.api("/api/v1/duel/queue", { json: queueGame })).data.status).toBe("searching");
    const m = await b.api("/api/v1/duel/queue", { json: queueGame });
    expect(m.data.status).toBe("matched");
    expect((await a.api("/api/v1/duel/queue")).data).toMatchObject({ status: "matched", matchId: m.data.matchId });
    const v = (await a.api(`/api/v1/matches/${m.data.matchId}`)).data;
    expect(v.players.map((p: { id: string }) => p.id).sort()).toEqual([a.userId, b.userId].sort());
    expect(await duelCreatedCount("quick", "13-15")).toBe(before + 1);
  });

  it("a 16-17 player is matched with an adult, never with a 13-15 player waiting first", async () => {
    await clearQueue();
    const kid = await guest(uniq("q5_"), "13-15");
    const teen = await guest(uniq("q6_"), "16-17");
    const adult = await guest(uniq("q7_"), "18+");
    expect((await kid.api("/api/v1/duel/queue", { json: queueGame })).data.status).toBe("searching");
    expect((await teen.api("/api/v1/duel/queue", { json: queueGame })).data.status).toBe("searching");
    const m = await adult.api("/api/v1/duel/queue", { json: queueGame });
    expect(m.data.status).toBe("matched");
    expect((await teen.api("/api/v1/duel/queue")).data).toMatchObject({ status: "matched", matchId: m.data.matchId });
    expect((await kid.api("/api/v1/duel/queue")).data.status).toBe("searching");
    await kid.api("/api/v1/duel/queue", { method: "DELETE" });
  });

  it("a stale stored 18+ never puts a 15-year-old in the adult pool", async () => {
    await clearQueue();
    const kid = await guest(uniq("q8_"), "13-15");
    await admin().from("players").update({ age_band: "18+" }).eq("id", kid.userId);
    expect((await kid.api("/api/v1/duel/queue", { json: queueGame })).status).toBe(200);
    const { data } = await admin().from("matchmaking_queue").select("pool").eq("player_id", kid.userId).single();
    expect(data?.pool).toBe("u16");
    await kid.api("/api/v1/duel/queue", { method: "DELETE" });
  });

  it("chat in an under-16 Quick Match stays preset-only", async () => {
    await clearQueue();
    const a = await guest(uniq("q9_"), "13-15");
    const b = await guest(uniq("qa_"), "13-15");
    await a.api("/api/v1/duel/queue", { json: queueGame });
    const m = await b.api("/api/v1/duel/queue", { json: queueGame });
    expect(m.data.status).toBe("matched");
    const typed = await a.api(`/api/v1/matches/${m.data.matchId}/chat`, { json: { text: "hello" } });
    expect(typed.status).toBe(403);
    expect((await a.api(`/api/v1/matches/${m.data.matchId}/chat`, { json: { quick: 0 } })).status).toBe(200);
  });
});

describe("api: Challenge a friend with Any game (R2-02)", () => {
  it("a 13-15 account makes a friend duel with no game picked, and the server records it by band", async () => {
    const kid = await guest(uniq("u6_"), "13-15");
    const before = await duelCreatedCount("friend", "13-15");
    const r = await kid.api("/api/v1/duel/friend", { json: {} });
    expect(r.status).toBe(200);
    expect(r.data.code).toMatch(/^[A-Z0-9]{4}$/);
    const { data: m } = await admin().from("matches").select("game_id, mix, rated").eq("id", r.data.matchId).single();
    expect(m).toMatchObject({ game_id: null, mix: true, rated: false });
    expect(await duelCreatedCount("friend", "13-15")).toBe(before + 1);
  });

  it("records a Quick Match pairing as kind quick with the band of the player whose search paired them", async () => {
    await admin().from("matchmaking_queue").delete().is("match_id", null);
    const a = await guest(uniq("u7_"), "18+");
    const b = await guest(uniq("u8_"), "18+");
    const before = await duelCreatedCount("quick", "18+");
    expect((await a.api("/api/v1/duel/queue", { json: { game: "crownfall", rulesSeen: true } })).data.status).toBe("searching");
    expect((await b.api("/api/v1/duel/queue", { json: { game: "crownfall", rulesSeen: true } })).data.status).toBe("matched");
    expect(await duelCreatedCount("quick", "18+")).toBe(before + 1);
  });

  it("clients cannot send duel_created themselves", async () => {
    const g = await guest(uniq("u9_"));
    expect((await g.api("/api/v1/metrics", { json: { name: "duel_created", kind: "friend" } })).status).toBe(400);
  });
});
