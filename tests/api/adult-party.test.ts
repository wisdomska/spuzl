import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ANON, BASE, SB_URL, admin, guest, uniq } from "./helpers";
import { adminSession } from "./admin-helpers";
import { setSetting } from "./setup";

/**
 * 18+ party games (Draw It, Two Truths) through the real API: the admin switch, the age gate (guests,
 * under-18s), join-time enforcement, the adults-only notice, the text filter, reports with snapshots, and a
 * moderator's action blocking the player from 18+ rooms.
 * Needs `supabase start`, the 20261112000001 migration and the dev server (API_BASE). Switches
 * "features.adultParty" on for the file and puts the previous value back afterwards.
 * Run: API_BASE=http://localhost:3000 pnpm vitest run -c vitest.api.config.mts tests/api/adult-party.test.ts
 */

type Caller = Awaited<ReturnType<typeof guest>>["api"];
interface Player {
  userId: string;
  api: Caller;
}

/** A signed-in email account (not an anonymous guest) with a profile in the given age band. */
async function member(ageBand: "13-15" | "16-17" | "18+"): Promise<Player> {
  const email = `${uniq("party")}@adult.test`;
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
  const p = await api("/api/v1/profile", { json: { nickname: uniq("ap_"), ageBand, color: "#2FD3E0" } });
  if (p.status !== 200) throw new Error(`profile: ${p.status} ${JSON.stringify(p.data)}`);
  return { userId: created.user.id, api };
}

const draw = { mode: "draw", maxPlayers: 4, adultNotice: true };
let before: unknown = undefined;

beforeAll(async () => {
  const { data } = await admin().from("game_settings").select("value").eq("key", "features.adultParty").maybeSingle();
  before = data?.value;
  await setSetting("features.adultParty", true);
}, 60_000);

afterAll(async () => {
  if (before === undefined) await admin().from("game_settings").delete().eq("key", "features.adultParty");
  else await setSetting("features.adultParty", before);
});

describe("18+ party: who may create, see and join", () => {
  it("refuses everyone while features.adultParty is off, and race rooms still open", async () => {
    const a = await member("18+");
    await setSetting("features.adultParty", false);
    try {
      const r = await a.api("/api/v1/rooms", { json: draw });
      expect(r.status).toBe(403);
      expect(r.data.error).toBe("adult_party_off");
      expect((await a.api("/api/v1/rooms", { json: { game: null } })).status).toBe(200);
    } finally {
      await setSetting("features.adultParty", true);
    }
  });

  it("refuses guests and under-18s with 403, and asks an adult host to confirm the notice once", async () => {
    const g = await guest(uniq("apg_")); // anonymous, even with an 18+ profile
    const g1 = await g.api("/api/v1/rooms", { json: draw });
    expect(g1.status).toBe(403);
    expect(g1.data.error).toBe("adults_signed_in");
    for (const band of ["16-17", "13-15"] as const) {
      const kid = await member(band);
      const r = await kid.api("/api/v1/rooms", { json: { ...draw, mode: "truths" } });
      expect(r.status, band).toBe(403);
      expect(r.data.error).toBe("adults_only");
    }
    const a = await member("18+");
    const noNotice = await a.api("/api/v1/rooms", { json: { ...draw, adultNotice: false } });
    expect(noNotice.status).toBe(409);
    expect(noNotice.data.error).toBe("needs_adult_notice");
    expect((await a.api("/api/v1/rooms", { json: draw })).status).toBe(200);
    // Confirmed once: later rooms open without it.
    expect((await a.api("/api/v1/rooms", { json: { ...draw, adultNotice: false } })).status).toBe(200);
  });

  it("enforces the gate at join time and on the room card", async () => {
    const host = await member("18+");
    const { data } = await host.api("/api/v1/rooms", { json: draw });
    const code = data.code as string;
    const teen = await member("16-17");
    const g = await guest(uniq("apj_"));
    for (const p of [teen.api, g.api]) {
      expect((await p(`/api/v1/rooms/${code}`)).status).toBe(403);
      expect((await p(`/api/v1/rooms/${code}/join`, { json: {} })).status).toBe(403);
    }
    const { data: rows } = await admin().from("match_players").select("player_id").eq("match_id", data.matchId);
    expect(rows).toHaveLength(1);
    const adult = await member("18+");
    const card = await adult.api(`/api/v1/rooms/${code}`);
    expect(card.status).toBe(200);
    expect(card.data.room.mode).toBe("draw");
    expect((await adult.api(`/api/v1/rooms/${code}/join`, { json: {} })).status).toBe(200);
  });
});

describe("18+ party: Draw It round, text filter, reports and moderation", () => {
  it("plays a round, filters guesses, snapshots reports and blocks a reported player once actioned", async () => {
    const host = await member("18+");
    const guesser = await member("18+");
    const { data } = await host.api("/api/v1/rooms", { json: draw });
    const code = data.code as string;
    const matchId = data.matchId as string;
    expect((await guesser.api(`/api/v1/rooms/${code}/join`, { json: {} })).status).toBe(200);
    expect((await guesser.api(`/api/v1/rooms/${code}/ready`, { json: { ready: true } })).status).toBe(200);
    expect((await host.api(`/api/v1/rooms/${code}/start`, { json: {} })).status).toBe(200);
    await new Promise((r) => setTimeout(r, 4300)); // countdown

    // The host (seat 0) draws first and sees the word; the guesser sees only the blanks.
    const hv = await host.api(`/api/v1/matches/${matchId}`);
    const gv = await guesser.api(`/api/v1/matches/${matchId}`);
    expect(hv.data.mode).toBe("draw");
    expect(hv.data.party.leadId).toBe(host.userId);
    const word = hv.data.party.word as string;
    expect(word).toBeTruthy();
    expect(gv.data.party.word).toBeNull();
    expect(JSON.stringify(gv.data)).not.toContain(`"${word}"`);

    // Strokes only, from the drawer only.
    const stroke = { c: 0, w: 1, p: [100, 100, 500, 500, 900, 100] };
    expect((await host.api(`/api/v1/rooms/${code}/party/draw`, { json: { round: 1, op: "add", strokes: [stroke] } })).status).toBe(200);
    expect((await guesser.api(`/api/v1/rooms/${code}/party/draw`, { json: { round: 1, op: "add", strokes: [stroke] } })).status).toBe(403);
    const img = await host.api(`/api/v1/rooms/${code}/party/draw`, {
      json: { round: 1, op: "add", strokes: [{ ...stroke, img: "data:image/png;base64,AAAA" }] },
    });
    expect(img.status).toBe(400);

    // Guesses: filtered and length-limited.
    const contact = await guesser.api(`/api/v1/rooms/${code}/party/guess`, { json: { round: 1, text: "call 0244123456" } });
    expect(contact.status).toBe(422);
    expect(contact.data.message).toMatch(/phone|links/i);
    const rude = await guesser.api(`/api/v1/rooms/${code}/party/guess`, { json: { round: 1, text: "shit" } });
    expect(rude.status).toBe(422);
    const long = await guesser.api(`/api/v1/rooms/${code}/party/guess`, { json: { round: 1, text: "x".repeat(31) } });
    expect(long.status).toBe(422);
    const wrong = await guesser.api(`/api/v1/rooms/${code}/party/guess`, { json: { round: 1, text: "zebra crossing" } });
    expect(wrong.data.result).toBe("wrong");

    // Report the drawing (by the guesser) and the guess (by the host): the server snapshots both.
    expect(
      (await guesser.api(`/api/v1/rooms/${code}/party/report`, { json: { round: 1, kind: "drawing", reason: "harassment" } })).status,
    ).toBe(200);
    const feed = (await host.api(`/api/v1/matches/${matchId}`)).data.party.guesses as { id: number; text: string }[];
    const g = feed.find((x) => x.text === "zebra crossing")!;
    expect(
      (await host.api(`/api/v1/rooms/${code}/party/report`, { json: { round: 1, kind: "guess", guessId: g.id, reason: "spam" } })).status,
    ).toBe(200);
    // Reporting your own content is refused.
    expect((await host.api(`/api/v1/rooms/${code}/party/report`, { json: { round: 1, kind: "drawing", reason: "other" } })).status).toBe(
      400,
    );
    const { data: reports } = await admin()
      .from("reports")
      .select("id, target_id, target_type, snapshot")
      .eq("target_type", "party")
      .in("target_id", [host.userId, guesser.userId]);
    const drawingReport = reports!.find((r) => r.target_id === host.userId)!;
    expect(drawingReport.snapshot.kind).toBe("drawing");
    expect(drawingReport.snapshot.strokes).toEqual([stroke]);
    expect(reports!.find((r) => r.target_id === guesser.userId)!.snapshot.text).toBe("zebra crossing");

    // A correct guess closes the round (everyone got it) and pays both players.
    const right = await guesser.api(`/api/v1/rooms/${code}/party/guess`, { json: { round: 1, text: word } });
    expect(right.data.result).toBe("correct");
    const reveal = (await guesser.api(`/api/v1/matches/${matchId}`)).data.party;
    expect(reveal.phase).toBe("reveal");
    expect(reveal.word).toBe(word);
    expect(reveal.awards[guesser.userId]).toBeGreaterThanOrEqual(50);
    expect(reveal.awards[host.userId]).toBe(50);

    // The moderation queue lists it under Party content; actioning blocks the player from 18+ rooms.
    const mod = await adminSession("moderator");
    const q = await mod.aal2("/api/admin/moderation?tab=party&status=open&pageSize=100");
    expect(q.status).toBe(200);
    expect(q.data.rows.some((r: { id: string }) => r.id === drawingReport.id)).toBe(true);
    const detail = await mod.aal2(`/api/admin/moderation/reports/${drawingReport.id}`);
    expect(detail.data.report.snapshot.kind).toBe("drawing");
    const act = await mod.aal2(`/api/admin/moderation/reports/${drawingReport.id}`, { json: { decision: "actioned", note: "test" } });
    expect(act.status).toBe(200);
    expect(act.data.blockedUntil).toBeTruthy();
    const blocked = await host.api("/api/v1/rooms", { json: draw });
    expect(blocked.status).toBe(403);
    expect(blocked.data.error).toBe("adult_party_blocked");
    expect((await host.api(`/api/v1/matches/${matchId}`)).status).toBe(403);
  }, 60_000);

  it("lets the host remove a player, who can't rejoin, and closes rooms when the switch goes off", async () => {
    const host = await member("18+");
    const other = await member("18+");
    const { data } = await host.api("/api/v1/rooms", { json: { ...draw, mode: "truths" } });
    const code = data.code as string;
    await other.api(`/api/v1/rooms/${code}/join`, { json: {} });
    expect((await other.api(`/api/v1/rooms/${code}/kick`, { json: { playerId: host.userId } })).status).toBe(403);
    expect((await host.api(`/api/v1/rooms/${code}/kick`, { json: { playerId: other.userId } })).status).toBe(200);
    const again = await other.api(`/api/v1/rooms/${code}/join`, { json: {} });
    expect(again.status).toBe(403);
    expect(again.data.error).toBe("kicked");
    await setSetting("features.adultParty", false);
    try {
      expect((await host.api(`/api/v1/matches/${data.matchId}`)).status).toBe(403);
      expect((await host.api(`/api/v1/rooms/${code}/party/vote`, { json: { round: 1, pick: 0 } })).status).toBe(403);
    } finally {
      await setSetting("features.adultParty", true);
    }
  });
});
