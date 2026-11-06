import { describe, expect, it } from "vitest";
import { admin, guest, uniq } from "./helpers";

/**
 * R2-02: under-16 Duel. Every Quick Match and Play live queue endpoint refuses a 13 to 15 account (403
 * age_restricted), read from the effective band; Challenge a friend works with no game picked (Any game); and the
 * server records duel_created by band and kind for the admin Metrics page.
 * Needs `supabase start` and the dev server (API_BASE).
 */
type G = Awaited<ReturnType<typeof guest>>;

const LIVE_ENDPOINTS: { name: string; call: (p: G) => ReturnType<G["api"]> }[] = [
  { name: "POST /api/v1/duel/queue (join Quick Match)", call: (p) => p.api("/api/v1/duel/queue", { json: {} }) },
  {
    name: "POST /api/v1/duel/queue with a game and rules seen",
    call: (p) => p.api("/api/v1/duel/queue", { json: { game: "crownfall", rulesSeen: true } }),
  },
  { name: "GET /api/v1/duel/queue (poll Quick Match)", call: (p) => p.api("/api/v1/duel/queue") },
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

describe("api: under-16 Quick Match and Play live (R2-02)", () => {
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

  it("reads the effective band: a stale stored 18+ never lets a 15-year-old in", async () => {
    const kid = await guest(uniq("u4_"), "13-15");
    // Write the stored column straight past the API, as a stale row would look; the birth month and year still say 15.
    await admin().from("players").update({ age_band: "18+" }).eq("id", kid.userId);
    expect((await kid.api("/api/v1/duel/queue", { json: {} })).status).toBe(403);
    expect((await kid.api("/api/v1/bay/queue", { json: { game: "chess" } })).status).toBe(403);
  });

  it("cancelling a queue stays open to everyone (it never widens access)", async () => {
    const kid = await guest(uniq("u5_"), "13-15");
    expect((await kid.api("/api/v1/duel/queue", { method: "DELETE" })).status).toBe(200);
    expect((await kid.api("/api/v1/bay/queue", { method: "DELETE" })).status).toBe(200);
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
