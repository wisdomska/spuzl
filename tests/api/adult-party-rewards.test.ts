import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ANON, BASE, SB_URL, admin, birthFor, guest, uniq } from "./helpers";
import { setSetting } from "./setup";

/**
 * XP and Sparks for the 18+ party games through the real API: paid once per player per room set (per round
 * played, plus a winner bonus), never to players who left or were removed, nothing in rooms where fewer than
 * three played to the end, nothing for sitting idle, and the daily cap.
 * Needs `supabase start`, the 20261120000001 migration and the dev server running this code (API_BASE), with
 * settings read uncached. Sets the "adultParty.*" reward settings for the file and puts them back afterwards.
 * Run: API_BASE=http://localhost:3000 pnpm vitest run -c vitest.api.config.mts tests/api/adult-party-rewards.test.ts
 */

type Caller = Awaited<ReturnType<typeof guest>>["api"];
interface Player {
  userId: string;
  api: Caller;
}

/** A signed-in 18+ email account (anonymous guests can't play 18+ rooms). */
async function adult(): Promise<Player> {
  const email = `${uniq("apr")}@adult.test`;
  const password = randomBytes(18).toString("base64url");
  const { data: created, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const sb = createClient(SB_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: s, error: e2 } = await sb.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  const token = s.session!.access_token;
  const api: Caller = async (path, init = {}) => {
    const res = await fetch(BASE + path, {
      ...init,
      method: init.method ?? (init.json !== undefined ? "POST" : "GET"),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
    });
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : null };
  };
  const p = await api("/api/v1/profile", { json: { nickname: uniq("apr_"), ...birthFor("18+"), color: "#2FD3E0" } });
  if (p.status !== 200) throw new Error(`profile: ${p.status} ${JSON.stringify(p.data)}`);
  return { userId: created.user.id, api };
}

const ECONOMY = {
  "adultParty.xpPerRound": 5,
  "adultParty.sparksPerRound": 1,
  "adultParty.winXp": 20,
  "adultParty.winSparks": 5,
  "adultParty.xpDailyCap": 150,
  "adultParty.revealSec": 3,
};
const before: Record<string, unknown> = {};

beforeAll(async () => {
  const keys = ["features.adultParty", ...Object.keys(ECONOMY)];
  const { data } = await admin().from("game_settings").select("key, value").in("key", keys);
  for (const k of keys) before[k] = data?.find((r) => r.key === k)?.value;
  await setSetting("features.adultParty", true);
  for (const [k, v] of Object.entries(ECONOMY)) await setSetting(k, v);
}, 60_000);

afterAll(async () => {
  for (const [k, v] of Object.entries(before)) {
    if (v === undefined) await admin().from("game_settings").delete().eq("key", k);
    else await setSetting(k, v);
  }
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Opens a Two Truths room hosted by players[0], everyone joins and readies, and the host starts it. */
async function openRoom(players: Player[]) {
  const [host, ...rest] = players;
  const { data } = await host.api("/api/v1/rooms", { json: { mode: "truths", maxPlayers: 8, adultNotice: true } });
  const code = data.code as string;
  const matchId = data.matchId as string;
  for (const p of rest) {
    expect((await p.api(`/api/v1/rooms/${code}/join`, { json: {} })).status).toBe(200);
    expect((await p.api(`/api/v1/rooms/${code}/ready`, { json: { ready: true } })).status).toBe(200);
  }
  const start = await host.api(`/api/v1/rooms/${code}/start`, { json: {} });
  expect(start.status, JSON.stringify(start.data)).toBe(200);
  await sleep(4300); // countdown
  return { code, matchId };
}

/** Ends the current phase now (as if its clock ran out) and lets the server resolve it. */
async function expire(matchId: string, by: Player) {
  await admin()
    .from("party_rounds")
    .update({ phase_ends_at: new Date(Date.now() - 1000).toISOString() })
    .eq("match_id", matchId)
    .neq("phase", "done");
  return by.api(`/api/v1/matches/${matchId}/tick`, { json: {} });
}

/**
 * Plays every round: the lead writes (unless idle), the others vote (unless idle), then the reveal ends.
 * `beforeRound` runs at the start of each round (to leave or kick). Everyone still in ticks each round, so
 * nobody present looks disconnected.
 */
async function playAll(
  room: { code: string; matchId: string },
  players: Player[],
  opts: { idle?: Set<string>; out?: Set<string>; beforeRound?: (round: number) => Promise<void> } = {},
) {
  for (let round = 1; round <= 8; round++) {
    await opts.beforeRound?.(round);
    const here = players.filter((p) => !opts.out?.has(p.userId));
    for (const p of here) expect((await p.api(`/api/v1/matches/${room.matchId}/tick`, { json: {} })).status).toBe(200);
    const v = (await here[0].api(`/api/v1/matches/${room.matchId}`)).data;
    if (v.status === "finished") return v;
    expect(v.party.round).toBe(round);
    const lead = v.party.leadId as string;
    const leader = here.find((p) => p.userId === lead);
    if (leader && !opts.idle?.has(lead)) {
      const w = await leader.api(`/api/v1/rooms/${room.code}/party/statements`, {
        json: { round, statements: ["I like rice", "I can swim", "I have a cat"], lie: 0 },
      });
      expect(w.status, JSON.stringify(w.data)).toBe(200);
      for (const p of here)
        if (p.userId !== lead && !opts.idle?.has(p.userId)) {
          const r = await p.api(`/api/v1/rooms/${room.code}/party/vote`, { json: { round, pick: p === here[0] ? 0 : 1 } });
          expect(r.status, JSON.stringify(r.data)).toBe(200);
        }
    }
    // Close voting (or the skipped write phase), then the reveal.
    let s = (await here[0].api(`/api/v1/matches/${room.matchId}`)).data;
    if (s.status === "playing" && s.party?.round === round && s.party.phase !== "reveal") await expire(room.matchId, here[0]);
    s = (await here[0].api(`/api/v1/matches/${room.matchId}`)).data;
    if (s.status === "playing" && s.party?.round === round) await expire(room.matchId, here[0]);
  }
  return (await players[0].api(`/api/v1/matches/${room.matchId}`)).data;
}

async function ledger(matchId: string, ids: string[], setNo = 1) {
  const ref = `${matchId}:${setNo}`;
  const [{ data: xp }, { data: sp }] = await Promise.all([
    admin().from("xp_ledger").select("player_id, amount").eq("source", "party_adult").eq("ref_id", ref).in("player_id", ids),
    admin().from("sparks_ledger").select("player_id, amount").eq("source", "party_adult").eq("ref_id", ref).in("player_id", ids),
  ]);
  const by = (rows: { player_id: string; amount: number }[] | null, id: string) => (rows ?? []).filter((r) => r.player_id === id);
  return Object.fromEntries(ids.map((id) => [id, { xp: by(xp, id), sparks: by(sp, id) }]));
}

describe("18+ party rewards", () => {
  it("pays per round played and a winner bonus, once, and shows it on the podium", async () => {
    const players = [await adult(), await adult(), await adult()];
    const room = await openRoom(players);
    const end = await playAll(room, players);
    expect(end.status).toBe("finished");
    const ids = players.map((p) => p.userId);
    const paid = await ledger(room.matchId, ids);
    for (const p of players) {
      const rows = paid[p.userId];
      expect(rows.xp).toHaveLength(1);
      // 3 rounds each (wrote once, voted twice); first place adds the bonus.
      const won = end.players.find((x: { id: string }) => x.id === p.userId).place === 1;
      expect(rows.xp[0].amount).toBe(3 * 5 + (won ? 20 : 0));
      expect(rows.sparks[0].amount).toBe(3 + (won ? 5 : 0));
      const v = (await p.api(`/api/v1/matches/${room.matchId}`)).data;
      expect(v.reward).toEqual({ xp: rows.xp[0].amount, sparks: rows.sparks[0].amount });
    }
    // More requests after the end pay nothing more.
    for (const p of players) await p.api(`/api/v1/matches/${room.matchId}/tick`, { json: {} });
    const again = await ledger(room.matchId, ids);
    for (const id of ids) expect(again[id].xp).toHaveLength(1);
  }, 90_000);

  it("pays nothing to players who left or were removed, and nothing for sitting idle", async () => {
    const players = [await adult(), await adult(), await adult(), await adult(), await adult(), await adult()];
    const [host, a, b, leaver, kicked, idle] = players;
    const room = await openRoom(players);
    const out = new Set<string>();
    const end = await playAll(room, players, {
      idle: new Set([idle.userId]),
      out,
      beforeRound: async (round) => {
        if (round !== 2) return;
        out.add(leaver.userId).add(kicked.userId);
        expect((await leaver.api(`/api/v1/matches/${room.matchId}/leave`, { json: {} })).status).toBe(200);
        expect((await host.api(`/api/v1/rooms/${room.code}/kick`, { json: { playerId: kicked.userId } })).status).toBe(200);
      },
    });
    expect(end.status).toBe("finished");
    const paid = await ledger(
      room.matchId,
      players.map((p) => p.userId),
    );
    for (const p of [leaver, kicked, idle]) {
      expect(paid[p.userId].xp, p === idle ? "idle" : "left or removed").toHaveLength(0);
      expect(paid[p.userId].sparks).toHaveLength(0);
    }
    for (const p of [host, a, b]) expect(paid[p.userId].xp[0]?.amount ?? 0).toBeGreaterThan(0);
  }, 120_000);

  it("pays nothing in a room where fewer than three play to the end", async () => {
    const players = [await adult(), await adult()];
    const room = await openRoom(players);
    const end = await playAll(room, players);
    expect(end.status).toBe("finished");
    const paid = await ledger(
      room.matchId,
      players.map((p) => p.userId),
    );
    for (const p of players) {
      expect(paid[p.userId].xp).toHaveLength(0);
      expect((await p.api(`/api/v1/matches/${room.matchId}`)).data.reward).toBeNull();
    }
  }, 90_000);

  it("keeps to the daily cap: the room that reaches it pays what is left, then nothing", async () => {
    const players = [await adult(), await adult(), await adult()];
    const [near, at] = players;
    // Earned today from other 18+ rooms: one player 10 XP short of the cap, one at it.
    await admin()
      .from("xp_ledger")
      .insert([
        { player_id: near.userId, source: "party_adult", ref_id: "earlier:1", amount: 140 },
        { player_id: at.userId, source: "party_adult", ref_id: "earlier:1", amount: 150 },
      ]);
    const room = await openRoom(players);
    const end = await playAll(room, players);
    expect(end.status).toBe("finished");
    const paid = await ledger(room.matchId, [near.userId, at.userId]);
    expect(paid[near.userId].xp[0].amount).toBe(10);
    expect(paid[near.userId].sparks[0].amount).toBeGreaterThan(0);
    expect(paid[at.userId].xp[0].amount).toBe(0); // marks the room as paid
    expect(paid[at.userId].sparks).toHaveLength(0);
    expect((await at.api(`/api/v1/matches/${room.matchId}`)).data.reward).toEqual({ xp: 0, sparks: 0 });
  }, 90_000);
});
