import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { ANON, BASE, SB_URL, admin, guest, uniq } from "./helpers";

/** Social and meta routes against the running dev server (API_BASE) and local Supabase. */
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

async function minor(nickname: string) {
  const g = await guest();
  const r = await g.api("/api/v1/profile", { json: { nickname, ageBand: "13-15", color: "#FF8A3D" } });
  if (r.status !== 200) throw new Error(`profile ${r.status}`);
  return g;
}

/** A signed-in (non-anonymous) adult, for flows that need a real account. */
async function member(nickname: string) {
  const email = `${nickname.toLowerCase()}@spuzl.test`;
  const { data, error } = await admin().auth.admin.createUser({ email, password: "pass-" + nickname, email_confirm: true });
  if (error) throw error;
  const sb = createClient(SB_URL, ANON, { auth: { persistSession: false } });
  const { data: s, error: e2 } = await sb.auth.signInWithPassword({ email, password: "pass-" + nickname });
  if (e2) throw e2;
  const token = s.session!.access_token;
  const api = async (path: string, init: RequestInit & { json?: unknown } = {}) => {
    const res = await fetch(BASE + path, {
      ...init,
      method: init.method ?? (init.json !== undefined ? "POST" : "GET"),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
    });
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : null };
  };
  const r = await api("/api/v1/profile", { json: { nickname, ageBand: "18+", color: "#8B7CFF" } });
  if (r.status !== 200) throw new Error(`profile ${r.status} ${JSON.stringify(r.data)}`);
  return { api, userId: data.user.id };
}

describe("api: friends, blocks and reports", () => {
  it("requests by username, accepts, lists with presence, and removes", async () => {
    const a = await guest(uniq("fa_"));
    const bName = uniq("fb_");
    const b = await guest(bName);
    expect((await a.api("/api/v1/friends", { json: { nickname: bName.toUpperCase() } })).data.status).toBe("requested");
    const inbox = await b.api("/api/v1/friends");
    expect(inbox.data.incoming.map((x: { id: string }) => x.id)).toContain(a.userId);
    expect((await b.api(`/api/v1/friends/${a.userId}/accept`, { method: "POST" })).status).toBe(200);
    await b.api("/api/v1/presence", { json: { playing: "crownfall" } });
    const list = await a.api("/api/v1/friends");
    const f = list.data.friends.find((x: { id: string }) => x.id === b.userId);
    expect(f.presence).toEqual({ online: true, label: "Playing Crownfall" });
    expect(list.data.online).toBe(1);
    expect((await a.api(`/api/v1/friends/${b.userId}`, { method: "DELETE" })).status).toBe(200);
    expect((await a.api("/api/v1/friends")).data.friends).toHaveLength(0);
  });

  it("a reverse request makes you friends straight away", async () => {
    const aName = uniq("ra_");
    const bName = uniq("rb_");
    const a = await guest(aName);
    const b = await guest(bName);
    await a.api("/api/v1/friends", { json: { nickname: bName } });
    expect((await b.api("/api/v1/friends", { json: { nickname: aName } })).data.status).toBe("friends");
  });

  it("under-16s add friends by invite link only", async () => {
    const kidName = uniq("kid_");
    const kid = await minor(kidName);
    const adult = await guest(uniq("ad_"));
    expect((await adult.api("/api/v1/friends", { json: { nickname: kidName } })).status).toBe(403);
    expect((await kid.api("/api/v1/friends", { json: { nickname: "nobody_here_x" } })).status).toBe(403);
    const inv = await kid.api("/api/v1/friends/invite");
    expect(inv.data.url).toMatch(/\/i\/[2-9A-HJ-NP-Z]{6}$/);
    expect((await kid.api("/api/v1/friends/invite")).data.code).toBe(inv.data.code); // stable
    const acc = await adult.api("/api/v1/friends/invite/accept", { json: { code: inv.data.code.toLowerCase() } });
    expect(acc.status).toBe(200);
    expect(acc.data.nickname).toBe(kidName);
    expect((await kid.api("/api/v1/friends")).data.friends).toHaveLength(1);
    expect((await kid.api("/api/v1/friends/invite/accept", { json: { code: inv.data.code } })).status).toBe(400);
  });

  it("block ends the friendship and hides you; report with block", async () => {
    const aName = uniq("ba_");
    const bName = uniq("bb_");
    const a = await guest(aName);
    const b = await guest(bName);
    const inv = await a.api("/api/v1/friends/invite");
    await b.api("/api/v1/friends/invite/accept", { json: { code: inv.data.code } });
    const rep = await a.api("/api/v1/reports", { json: { playerId: b.userId, reason: "nickname", block: true } });
    expect(rep.status).toBe(200);
    const { data: reports } = await admin().from("reports").select("reason, target_type").eq("reporter_id", a.userId);
    expect(reports).toEqual([{ reason: "nickname", target_type: "nickname" }]);
    expect((await a.api("/api/v1/friends")).data.friends).toHaveLength(0);
    // blocked players can't find, add or view you
    expect((await b.api("/api/v1/friends", { json: { nickname: aName } })).status).toBe(404);
    expect((await b.api(`/api/v1/players/${aName}`)).status).toBe(404);
    expect((await b.api("/api/v1/friends/invite/accept", { json: { code: inv.data.code } })).status).toBe(403);
    expect((await a.api("/api/v1/blocks")).data.blocked.map((x: { id: string }) => x.id)).toEqual([b.userId]);
    expect((await a.api(`/api/v1/blocks/${b.userId}`, { method: "DELETE" })).status).toBe(200);
    expect((await b.api(`/api/v1/players/${aName}`)).status).toBe(200);
    expect((await a.api("/api/v1/reports", { json: { playerId: b.userId, reason: "free text" } })).status).toBe(400);
  });
});

describe("api: feed and reactions", () => {
  it("shows friends' events, takes preset reactions only, respects hide activity", async () => {
    const a = await guest(uniq("ea_"));
    const b = await guest(uniq("eb_"));
    const c = await guest(uniq("ec_"));
    const inv = await a.api("/api/v1/friends/invite");
    await b.api("/api/v1/friends/invite/accept", { json: { code: inv.data.code } });
    const { data: ev } = await admin()
      .from("feed_events")
      .insert({ player_id: b.userId, kind: "clear", game_id: "crownfall", payload: { timeMs: 65000, hints: 0 } })
      .select("id")
      .single();
    const feed = await a.api("/api/v1/feed");
    const item = feed.data.items.find((i: { id: number }) => i.id === ev!.id);
    expect(item.player.id).toBe(b.userId);
    expect((await a.api(`/api/v1/feed/${ev!.id}/react`, { json: { reaction: "fire" } })).status).toBe(200);
    expect((await a.api(`/api/v1/feed/${ev!.id}/react`, { json: { reaction: "nice one!" } })).status).toBe(400);
    expect((await c.api(`/api/v1/feed/${ev!.id}/react`, { json: { reaction: "fire" } })).status).toBe(404);
    const again = (await a.api("/api/v1/feed")).data.items.find((i: { id: number }) => i.id === ev!.id);
    expect(again.counts.fire).toBe(1);
    expect(again.mine).toBe("fire");
    await a.api(`/api/v1/feed/${ev!.id}/react`, { json: { reaction: null } });
    expect((await a.api("/api/v1/feed")).data.items.find((i: { id: number }) => i.id === ev!.id).counts.fire).toBe(0);
    await b.api("/api/v1/profile", { method: "PATCH", json: { hideActivity: true } });
    expect((await a.api("/api/v1/feed")).data.items.find((i: { id: number }) => i.id === ev!.id)).toBeUndefined();
  });
});

describe("api: leaderboards", () => {
  it("ranks friends, pins you, hides flagged and test accounts", async () => {
    const a = await guest(uniq("la_"));
    const b = await guest(uniq("lb_"));
    const t = await guest(uniq("lt_"));
    const x = await guest(uniq("lx_"));
    for (const g of [b, t, x]) {
      const inv = await a.api("/api/v1/friends/invite");
      await g.api("/api/v1/friends/invite/accept", { json: { code: inv.data.code } });
    }
    await admin().from("players").update({ is_test: true }).eq("id", t.userId);
    const d = today();
    const now = new Date().toISOString();
    await admin()
      .from("daily_results")
      .insert([
        { date: d, game_id: "dusk", player_id: a.userId, time_ms: 70_000, finished_at: now },
        { date: d, game_id: "dusk", player_id: b.userId, time_ms: 50_000, finished_at: now },
        { date: d, game_id: "dusk", player_id: t.userId, time_ms: 10_000, finished_at: now },
        { date: d, game_id: "dusk", player_id: x.userId, time_ms: 9_000, finished_at: now },
      ]);
    await admin().from("attempts").insert({ player_id: x.userId, game_id: "dusk", mode: "daily", daily_date: d, status: "flagged" });
    const r = await a.api(`/api/v1/leaderboards/dusk?scope=friends&date=${d}`);
    expect(r.status).toBe(200);
    expect(r.data.rows.map((x: { id: string }) => x.id)).toEqual([b.userId, a.userId]);
    expect(r.data.me).toMatchObject({ pos: 2, me: true, top: 100 });
    const crew = await a.api("/api/v1/leaderboards/dusk?scope=crew");
    expect(crew.data.needs).toBe("crew");
    const overall = await a.api("/api/v1/leaderboards/overall?scope=friends");
    expect(overall.data.rows.length).toBeGreaterThanOrEqual(2);
    expect((await a.api("/api/v1/leaderboards/nope?scope=global")).status).toBe(404);
    expect((await a.api("/api/v1/leaderboards/dusk?scope=galaxy")).status).toBe(400);
  });
});

describe("api: shop", () => {
  it("buys once per request, refuses without Sparks, equips", async () => {
    const a = await guest(uniq("sh_"));
    await admin().from("players").update({ sparks: 500 }).eq("id", a.userId);
    const requestId = randomUUID();
    const buy = await a.api("/api/v1/shop/buy", { json: { itemId: "hat-party", requestId } });
    expect(buy.data).toMatchObject({ status: "bought", balance: 200 });
    const retry = await a.api("/api/v1/shop/buy", { json: { itemId: "hat-party", requestId } });
    expect(retry.data).toMatchObject({ status: "duplicate", balance: 200 });
    expect((await a.api("/api/v1/shop/buy", { json: { itemId: "hat-party", requestId: randomUUID() } })).status).toBe(409);
    const short = await a.api("/api/v1/shop/buy", { json: { itemId: "theme-neon", requestId: randomUUID() } });
    expect(short.status).toBe(402);
    expect(short.data.error).toBe("not_enough_sparks");
    expect((await a.api("/api/v1/shop/buy", { json: { itemId: "title-gridlord", requestId: randomUUID() } })).status).toBe(403);
    expect((await a.api("/api/v1/shop/equip", { json: { itemId: "hat-crown", equip: true } })).status).toBe(403);
    expect((await a.api("/api/v1/shop/equip", { json: { itemId: "hat-party", equip: true } })).status).toBe(200);
    const shop = await a.api("/api/v1/shop");
    expect(shop.data.sparks).toBe(200);
    expect(shop.data.wearing.hat).toBe("party");
    expect(shop.data.items.find((i: { id: string }) => i.id === "hat-party")).toMatchObject({ owned: true, equipped: true });
    const freeze = await a.api("/api/v1/shop/buy", { json: { itemId: "freeze", requestId: randomUUID() } });
    expect(freeze.data.status).toBe("bought");
    expect((await a.api("/api/v1/shop")).data.freezesHeld).toBe(1);
  });

  it("lists the starter hat first and charges the shop.starterPrice setting", async () => {
    const a = await guest(uniq("st_"));
    await admin().from("players").update({ sparks: 1000 }).eq("id", a.userId);
    const settings = await (await fetch(BASE + "/api/v1/settings/game")).json();
    const price = settings["shop.starterPrice"] as number;
    const shop = await a.api("/api/v1/shop");
    const hats = shop.data.items.filter((i: { type: string }) => i.type === "hat");
    expect(hats[0]).toMatchObject({ id: "hat-starter", starter: true, price });
    const buy = await a.api("/api/v1/shop/buy", { json: { itemId: "hat-starter", requestId: randomUUID() } });
    expect(buy.data).toMatchObject({ status: "bought", balance: 1000 - price });
  });
});

describe("api: guest clears (SPZ-20)", () => {
  it("counts a guest's clears on the server for the Save your streak prompt", async () => {
    const g = await guest(uniq("sv_"));
    expect((await g.api("/api/v1/me")).data.clears).toBe(0);
    const rows = ["cleared", "cleared", "failed"].map((status) => ({ player_id: g.userId, game_id: "crownfall", mode: "free", status }));
    const { error } = await admin().from("attempts").insert(rows);
    expect(error).toBeNull();
    const me = await g.api("/api/v1/me");
    expect(me.data).toMatchObject({ guest: true, clears: 2 });
  });
});

describe("api: quests", () => {
  it("claims a completed quest exactly once", async () => {
    const a = await guest(uniq("qa_"));
    const list = await a.api("/api/v1/quests");
    expect(list.data.daily).toHaveLength(3);
    expect(list.data.weekly).toHaveLength(5);
    const q = list.data.daily[0];
    expect((await a.api(`/api/v1/quests/${q.id}/claim`, { method: "POST" })).status).toBe(409);
    await admin().from("player_quests").insert({
      player_id: a.userId,
      quest_id: q.id,
      period: today(),
      progress: q.target,
      target: q.target,
      completed_at: new Date().toISOString(),
    });
    const [c1, c2] = await Promise.all([
      a.api(`/api/v1/quests/${q.id}/claim`, { method: "POST" }),
      a.api(`/api/v1/quests/${q.id}/claim`, { method: "POST" }),
    ]);
    expect([c1.status, c2.status]).toEqual([200, 200]);
    expect(c1.data.sparks + c2.data.sparks).toBe(q.sparks);
    const { data: p } = await admin().from("players").select("sparks").eq("id", a.userId).single();
    expect(p!.sparks).toBe(q.sparks);
    const after = await a.api("/api/v1/quests");
    expect(after.data.daily[0]).toMatchObject({ completed: true, claimed: true });
    expect((await a.api("/api/v1/quests/nope/claim", { method: "POST" })).status).toBe(404);
  });
});

describe("api: leagues", () => {
  it("joins after a Daily clear, shows zones, and pays the ceremony once", async () => {
    const a = await guest(uniq("lg_"));
    expect((await a.api("/api/v1/leagues/current")).data.league).toBeNull();
    await admin()
      .from("daily_results")
      .insert({ date: today(), game_id: "crownfall", player_id: a.userId, time_ms: 60_000, finished_at: new Date().toISOString() });
    const cur = await a.api("/api/v1/leagues/current");
    expect(cur.data.league.members.some((m: { me: boolean }) => m.me)).toBe(true);
    expect(cur.data.league.endsInMs).toBeGreaterThan(0);
    // last week: finalised, promoted from Silver Gear
    const { data: l } = await admin()
      .from("leagues")
      .insert({ tier: 1, week_start: daysAgo(7 + ((new Date().getUTCDay() + 6) % 7)), finalised_at: new Date().toISOString() })
      .select("id")
      .single();
    await admin().from("league_members").insert({ league_id: l!.id, player_id: a.userId, points: 900, final_rank: 3, result: "promoted" });
    const withCeremony = await a.api("/api/v1/leagues/current");
    expect(withCeremony.data.ceremony).toMatchObject({ result: "promoted", rank: 3, reward: 70 });
    expect(withCeremony.data.ceremony.to.name).toBe("Gold Crown");
    const c1 = await a.api("/api/v1/leagues/ceremony", { json: { leagueId: l!.id } });
    const c2 = await a.api("/api/v1/leagues/ceremony", { json: { leagueId: l!.id } });
    expect(c1.data.sparks).toBe(70);
    expect(c2.data.sparks).toBe(0);
    expect((await a.api("/api/v1/leagues/current")).data.ceremony).toBeNull();
  });

  it("puts a new player in a friend's league first (SPZ-21)", async () => {
    const f = await guest(uniq("lf_"));
    const n = await guest(uniq("ln_"));
    const week = daysAgo((new Date().getUTCDay() + 6) % 7);
    const { data: l } = await admin().from("leagues").insert({ tier: 2, week_start: week }).select("id").single();
    await admin().from("league_members").insert({ league_id: l!.id, player_id: f.userId });
    await admin().from("friendships").insert({ player_id: n.userId, friend_id: f.userId, status: "accepted" });
    await admin()
      .from("daily_results")
      .insert({ date: today(), game_id: "crownfall", player_id: n.userId, time_ms: 60_000, finished_at: new Date().toISOString() });
    const settings = await (await fetch(BASE + "/api/v1/settings/game")).json();
    const cur = await n.api("/api/v1/leagues/current");
    if (settings["leagues.fillWithFriends"]) {
      expect(cur.data.league).toMatchObject({ id: l!.id, tier: 2 });
      expect(cur.data.league.members.map((m: { id: string }) => m.id).sort()).toEqual([f.userId, n.userId].sort());
    } else expect(cur.data.league.id).not.toBe(l!.id);
  });
});

describe("api: crews", () => {
  it("creates, joins by code, shows the carry, and leaves", async () => {
    const a = await guest(uniq("ca_"));
    const b = await guest(uniq("cb_"));
    const name = `Crew ${uniq("")}`.slice(0, 20);
    const made = await a.api("/api/v1/crews", { json: { name } });
    expect(made.status).toBe(200);
    expect((await a.api("/api/v1/crews", { json: { name: name + "x" } })).status).toBe(409);
    expect((await b.api("/api/v1/crews/join", { json: { code: made.data.code.toLowerCase() } })).status).toBe(200);
    await admin().rpc("svc_grant_reward", { p_player: b.userId, p_source: "test", p_ref: "crew", p_xp: 120, p_sparks: 0 });
    const page = await a.api(`/api/v1/crews/${made.data.id}`);
    expect(page.data.size).toBe(2);
    expect(page.data.carry[0]).toMatchObject({ id: b.userId, xp: 120, pos: 1 });
    expect(page.data.code).toBe(made.data.code);
    const board = await a.api("/api/v1/leaderboards/crownfall?scope=crew");
    expect(board.data.needs).toBeNull();
    expect((await a.api("/api/v1/crews/leave", { method: "POST" })).status).toBe(200);
    expect((await b.api("/api/v1/crews")).data.crew).toMatchObject({ role: "captain" });
    expect((await a.api("/api/v1/crews", { json: { name: "ab" } })).status).toBe(400);
  });
});

describe("api: School Cup", () => {
  it("lets a signed-in adult set up a class and students join by code", async () => {
    const g = await guest(uniq("gs_"));
    expect((await g.api("/api/v1/school-cup")).data.canTeach).toBe(false);
    const teacher = await member(uniq("tch_"));
    const code = uniq("SC")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    await admin().from("schools").insert({ name: "Demo School", city: "Accra", country: "GH", code, verified_by: teacher.userId });
    const monday = (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
      return d.toISOString().slice(0, 10);
    })();
    const friday = new Date(Date.parse(monday) + 4 * 86_400_000).toISOString().slice(0, 10);
    const bad = await teacher.api("/api/v1/school-cup", {
      json: { schoolCode: code, className: "Form 2B", games: ["gotcha"], weekStart: monday, endsOn: friday },
    });
    expect(bad.status).toBe(422);
    expect(
      (
        await g.api("/api/v1/school-cup", {
          json: { schoolCode: code, className: "Form 2B", games: ["crownfall"], weekStart: monday, endsOn: friday },
        })
      ).status,
    ).toBe(403);
    const cup = await teacher.api("/api/v1/school-cup", {
      json: {
        schoolCode: code,
        className: "Form 2B",
        games: ["crownfall", "quads", "deadon"],
        weekStart: monday,
        endsOn: friday,
        relaxed: true,
      },
    });
    expect(cup.status).toBe(200);
    const kid = await minor(uniq("st_"));
    expect((await kid.api("/api/v1/school-cup/join", { json: { code: cup.data.code } })).status).toBe(200);
    const board = await kid.api(`/api/v1/school-cup/${cup.data.id}`);
    expect(board.data).toMatchObject({ className: "Form 2B", relaxed: true, code: null, isTeacher: false });
    expect(board.data.rows.map((r: { id: string }) => r.id)).toEqual([kid.userId]);
    expect((await g.api(`/api/v1/school-cup/${cup.data.id}`)).status).toBe(404);
    const { data: p } = await admin().from("players").select("school_id").eq("id", kid.userId).single();
    expect(p!.school_id).toBeTruthy();
  });
});

describe("api: profiles, archive, account", () => {
  it("shows a public subset and only nickname and avatar for under-16s", async () => {
    const kidName = uniq("pk_");
    await minor(kidName);
    const a = await guest(uniq("pa_"));
    const kid = await a.api(`/api/v1/players/${kidName}`);
    expect(kid.data).toMatchObject({ nickname: kidName, minor: true, public: false, level: null, title: null });
    expect(kid.data.streak).toBeUndefined();
    const self = await a.api("/api/v1/me/profile");
    expect(self.data.worlds).toHaveLength(9);
    expect(self.data.calendar.days.length).toBeGreaterThanOrEqual(28);
    expect(self.data.badges.families[0].family).toBe("starter");
    expect(self.data.badges.families.some((f: { family: string }) => f.family === "secret")).toBe(false);
    const arch = await a.api(`/api/v1/archive?game=crownfall&month=${today().slice(0, 7)}`);
    expect(arch.data.days.find((d: { date: string }) => d.date === today()).access).toBe("today");
  });

  it("exports JSON and deletes everything", async () => {
    const name = uniq("del_");
    const a = await guest(name);
    await admin().rpc("svc_grant_reward", { p_player: a.userId, p_source: "test", p_ref: "x", p_xp: 10, p_sparks: 5 });
    const ex = await fetch(BASE + "/api/v1/account/export", { headers: { authorization: `Bearer ${a.token}` } });
    expect(ex.headers.get("content-disposition")).toContain("attachment");
    const doc = await ex.json();
    expect(doc.player.nickname).toBe(name);
    expect(doc.xp_ledger).toHaveLength(1);
    expect((await a.api("/api/v1/account", { method: "DELETE", json: { confirm: "wrong" } })).status).toBe(422);
    expect((await a.api("/api/v1/account", { method: "DELETE", json: { confirm: name } })).status).toBe(200);
    const { data: gone } = await admin().from("players").select("id").eq("id", a.userId);
    expect(gone).toEqual([]);
    const { data: ledger } = await admin().from("xp_ledger").select("id").eq("player_id", a.userId);
    expect(ledger).toEqual([]);
  });
});
