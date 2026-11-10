import { afterAll, describe, expect, it } from "vitest";
import { admin, guest, uniq } from "./helpers";
import { setSetting } from "./setup";
import { createRng } from "@/lib/rng";
import crownfall from "@/games/crownfall/logic";
import type { Difficulty } from "@/games/types";

/**
 * R4-25: Party Race XP comes from admin settings (party.winXp, party.playXp) and is capped per GMT day
 * (party.xpDailyCap), on the server (svc_grant_capped_reward, source "party"). A set that reaches the cap pays what
 * is left; past it a set pays 0 XP (a 0 row marks the set as paid, so it never pays later).
 * Run: API_BASE=http://localhost:3000 pnpm vitest run -c vitest.api.config.mts tests/api/r4-25-party-xp-cap.test.ts
 */
type G = Awaited<ReturnType<typeof guest>>;

const solve = (matchId: string, setNo: number, round: number, difficulty: string) => {
  const g = crownfall.generate(createRng(`mp:${matchId}:${setNo}:${round}`), difficulty as Difficulty);
  const n = g.puzzle.size;
  const state = new Array(n * n).fill(0);
  g.solution.forEach((c, r) => (state[r * n + c] = 2));
  return state;
};
const startNow = (id: string) =>
  admin()
    .from("matches")
    .update({ round_started_at: new Date(Date.now() - 1000).toISOString() })
    .eq("id", id);

afterAll(async () => {
  await admin().from("game_settings").delete().in("key", ["party.winXp", "party.playXp", "party.xpDailyCap"]);
});

/** A two-player Party set played to the end: the host finishes first in every game and wins. */
async function playSet(host: G, other: G) {
  const room = await host.api("/api/v1/rooms", { json: { game: "crownfall", difficulty: "easy", maxPlayers: 2 } });
  expect(room.status, JSON.stringify(room.data)).toBe(200);
  const code: string = room.data.code;
  const id: string = room.data.matchId;
  await other.api(`/api/v1/rooms/${code}/join`, { json: {} });
  await other.api(`/api/v1/rooms/${code}/ready`, { json: { ready: true } });
  expect((await host.api(`/api/v1/rooms/${code}/start`, { json: {} })).status).toBe(200);
  let v = (await host.api(`/api/v1/matches/${id}`)).data;
  for (let round = 1; round <= v.games.length; round++) {
    await startNow(id);
    const s = solve(id, v.setNo, round, "easy");
    await host.api(`/api/v1/matches/${id}/finish`, { json: { round, state: s, mistakes: 0 } });
    const f = await other.api(`/api/v1/matches/${id}/finish`, { json: { round, state: s, mistakes: 0 } });
    if (round < v.games.length) {
      expect(f.data.status).toBe("round_end");
      expect((await host.api(`/api/v1/rooms/${code}/next`, { json: {} })).status).toBe(200);
    }
  }
  v = (await host.api(`/api/v1/matches/${id}`)).data;
  expect(v.status).toBe("finished");
  return { id, ref: `${id}:${v.setNo}` };
}

const paid = async (player: string, ref: string) => {
  const { data } = await admin().from("xp_ledger").select("amount").eq("player_id", player).eq("source", "party").eq("ref_id", ref);
  return (data ?? []).map((r) => Number(r.amount));
};

describe("api: Party Race XP daily cap (R4-25)", () => {
  it("pays the settings' XP, clamps the set that reaches the cap and pays nothing past it", async () => {
    await setSetting("party.winXp", 30);
    await setSetting("party.playXp", 10);
    await setSetting("party.xpDailyCap", 100);
    const host = await guest(uniq("xh_"));
    const other = await guest(uniq("xo_"));
    // Earned today from earlier Parties: the host is 20 short of the cap, the other player already at it.
    await admin()
      .from("xp_ledger")
      .insert([
        { player_id: host.userId, source: "party", ref_id: "earlier:1", amount: 80 },
        { player_id: other.userId, source: "party", ref_id: "earlier:1", amount: 100 },
      ]);
    const set = await playSet(host, other);
    expect(await paid(host.userId, set.ref)).toEqual([20]);
    expect(await paid(other.userId, set.ref)).toEqual([0]);
    // Raising the cap later never pays that set again.
    await setSetting("party.xpDailyCap", 1000);
    const again = await playSet(host, other);
    expect(await paid(host.userId, again.ref)).toEqual([30]);
    expect(await paid(other.userId, again.ref)).toEqual([10]);
    expect(await paid(host.userId, set.ref)).toEqual([20]);
  }, 120_000);
});
