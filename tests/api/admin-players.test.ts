import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { ANON, BASE, SB_URL, admin, guest, uniq } from "./helpers";
import { adminSession, type AdminSession, type Role } from "./admin-helpers";

/**
 * Admin Players (owner request) against a running dev server (API_BASE) and local Supabase: role gates (analyst
 * views but never acts, moderator bans but cannot delete, move Sparks, export or see emails), the audit row behind
 * every action, the typed confirmation on delete, list filters, sorting and paging, bulk actions and export.
 * Run: API_BASE=http://localhost:3203 pnpm vitest run -c vitest.api.config.mts tests/api/admin-players.test.ts
 */

const S = {} as Record<Role, AdminSession>;

/** A signed-in (email) player with a profile, and their bearer-token caller. */
async function emailPlayer(prefix: string) {
  const db = admin();
  const email = `${uniq(prefix)}@player.test`;
  const password = randomBytes(18).toString("base64url");
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const sb = createClient(SB_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: s, error: e2 } = await sb.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  const token = s.session!.access_token;
  const nickname = uniq(prefix);
  const res = await fetch(`${BASE}/api/v1/profile`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ nickname, ageBand: "18+", color: "#2FD3E0" }),
  });
  if (res.status !== 200) throw new Error(`profile ${res.status}`);
  return { userId: data.user.id, email, nickname, token };
}

const lastAudit = async (action: string, target: string) =>
  (
    await admin()
      .from("audit_log")
      .select("id, actor_id, action, target, detail")
      .eq("action", action)
      .eq("target", target)
      .order("id", { ascending: false })
      .limit(1)
  ).data?.[0];

const act = (who: Role, id: string, json: object) => S[who].aal2(`/api/admin/players/${id}/actions`, { json });

beforeAll(async () => {
  for (const r of ["owner", "content_editor", "moderator", "analyst"] as Role[]) S[r] = await adminSession(r);
}, 120_000);

describe("players: role gates", () => {
  let target: Awaited<ReturnType<typeof guest>>;
  beforeAll(async () => {
    target = await guest(uniq("pg_"));
  });

  it("lets analysts and moderators view the list, detail and overview, but not content editors", async () => {
    for (const role of ["owner", "moderator", "analyst"] as Role[]) {
      expect((await S[role].aal2("/api/admin/players")).status, role).toBe(200);
      expect((await S[role].aal2(`/api/admin/players/${target.userId}/detail`)).status, role).toBe(200);
      expect((await S[role].aal2("/api/admin/overview")).status, role).toBe(200);
    }
    expect((await S.content_editor.aal2("/api/admin/players")).data.error).toBe("forbidden");
  });

  it("never lets an analyst act, alone or in bulk, or export", async () => {
    for (const json of [
      { action: "ban", reason: "analyst try" },
      { action: "freeze", reason: "analyst try" },
      { action: "sparks", amount: 10, reason: "analyst try" },
      { action: "delete", confirm: "x", reason: "analyst try" },
    ]) {
      const r = await act("analyst", target.userId, json);
      expect([r.status, r.data.error], JSON.stringify(json)).toEqual([403, "forbidden"]);
    }
    expect(
      (await S.analyst.aal2("/api/admin/players/bulk", { json: { action: "ban", ids: [target.userId], reason: "nope" } })).status,
    ).toBe(403);
    expect((await S.analyst.aal2("/api/admin/players/export", { json: {} })).status).toBe(403);
  });

  it("lets a moderator ban but not delete, move Sparks or export", async () => {
    const ban = await act("moderator", target.userId, { action: "ban", days: 3, reason: "mod test ban" });
    expect(ban.status).toBe(200);
    expect((await act("moderator", target.userId, { action: "unban", reason: "mod test unban" })).status).toBe(200);
    for (const json of [
      { action: "delete", confirm: target.userId, reason: "mod try" },
      { action: "sparks", amount: 50, reason: "mod try" },
    ]) {
      const r = await act("moderator", target.userId, json);
      expect([r.status, r.data.error], JSON.stringify(json)).toEqual([403, "forbidden"]);
    }
    expect((await S.moderator.aal2("/api/admin/players/export", { json: {} })).status).toBe(403);
    const { data } = await admin().from("players").select("id").eq("id", target.userId).maybeSingle();
    expect(data?.id).toBe(target.userId);
  });

  it("requires a reason on every action", async () => {
    const r = await act("owner", target.userId, { action: "freeze" });
    expect(r.status).toBe(400);
    expect((await act("owner", target.userId, { action: "freeze", reason: "  " })).status).toBe(400);
  });
});

describe("players: personal data", () => {
  let p: Awaited<ReturnType<typeof emailPlayer>>;
  beforeAll(async () => {
    p = await emailPlayer("pe_");
  });

  it("shows the email to the owner and masks it for everyone else, in the list and the detail", async () => {
    const q = `/api/admin/players?q=${p.nickname}`;
    const own = await S.owner.aal2(q);
    expect(own.data.rows[0]).toMatchObject({ nickname: p.nickname, account_type: "email", email: p.email });
    for (const role of ["moderator", "analyst"] as Role[]) {
      const r = await S[role].aal2(q);
      expect(r.data.rows[0].email, role).toMatch(/^.•••@•••\.test$/);
      expect(JSON.stringify(r.data), role).not.toContain(p.email);
      const d = await S[role].aal2(`/api/admin/players/${p.userId}/detail`);
      expect(JSON.stringify(d.data), role).not.toContain(p.email);
      expect(d.data.account.type).toBe("email");
    }
    expect((await S.owner.aal2(`/api/admin/players/${p.userId}/detail`)).data.account.email).toBe(p.email);
  });

  it("allows exact email search only for the owner", async () => {
    const own = await S.owner.aal2(`/api/admin/players?q=${encodeURIComponent(p.email.toUpperCase())}`);
    expect(own.data.rows.map((r: { id: string }) => r.id)).toEqual([p.userId]);
    expect((await S.moderator.aal2(`/api/admin/players?q=${encodeURIComponent(p.email)}`)).data.error).toBe("forbidden");
    const partial = await S.owner.aal2(`/api/admin/players?q=${encodeURIComponent(p.email.slice(1))}`);
    expect(partial.data.total).toBe(0);
  });

  it("never returns location or school", async () => {
    await admin().from("players").update({ city: "Kumasi", country: "GH" }).eq("id", p.userId);
    const d = await S.owner.aal2(`/api/admin/players/${p.userId}/detail`);
    const l = await S.owner.aal2(`/api/admin/players?q=${p.nickname}`);
    for (const body of [JSON.stringify(d.data), JSON.stringify(l.data)]) {
      expect(body).not.toContain("Kumasi");
      expect(body).not.toMatch(/"(city|country|school_id)"/);
    }
  });
});

describe("players: every action writes an audit row", () => {
  let g: Awaited<ReturnType<typeof guest>>;
  let e: Awaited<ReturnType<typeof emailPlayer>>;
  beforeAll(async () => {
    g = await guest(uniq("pa_"));
    e = await emailPlayer("ps_");
  });

  it("audits reset nickname, Sparks, freeze, ban, unban, ranking and sign-out with the reason", async () => {
    const target = `player:${g.userId}`;
    const cases: [Role, object, string][] = [
      ["moderator", { action: "reset_nickname", reason: "rude name" }, "player.rename"],
      ["owner", { action: "sparks", amount: 500, reason: "refund" }, "player.sparks"],
      ["owner", { action: "sparks", amount: -200, reason: "refund correction" }, "player.sparks"],
      ["moderator", { action: "freeze", reason: "outage day" }, "player.freeze"],
      ["moderator", { action: "ban", days: null, reason: "harassment" }, "player.ban"],
      ["owner", { action: "unban", reason: "appeal upheld" }, "player.unban"],
      ["moderator", { action: "revoke_ranking", reason: "suspicious times" }, "player.revoke_ranking"],
      ["moderator", { action: "restore_ranking", reason: "cleared" }, "player.restore_ranking"],
      ["moderator", { action: "signout", reason: "shared device" }, "player.signout"],
    ];
    for (const [who, json, action] of cases) {
      const before = (await lastAudit(action, target))?.id ?? 0;
      const r = await act(who, g.userId, json);
      expect([r.status, JSON.stringify(json)]).toEqual([200, JSON.stringify(json)]);
      const row = await lastAudit(action, target);
      expect(row && row.id > before, action).toBe(true);
      expect(row!.actor_id).toBe(S[who].userId);
      expect(row!.detail.reason).toBe((json as { reason: string }).reason);
    }
    const { data } = await admin().from("players").select("nickname, sparks, banned_at, ranking_revoked").eq("id", g.userId).single();
    expect(String(data!.nickname)).toMatch(/^Puzzler\d{4}$/);
    expect(data!.banned_at).toBeNull();
    expect(data!.ranking_revoked).toBe(false);
  });

  it("bounds Sparks and never takes the balance below zero", async () => {
    expect((await act("owner", g.userId, { action: "sparks", amount: 10_001, reason: "too much" })).status).toBe(400);
    expect((await act("owner", g.userId, { action: "sparks", amount: 0, reason: "nothing" })).status).toBe(400);
    const { data } = await admin().from("players").select("sparks").eq("id", g.userId).single();
    const r = await act("owner", g.userId, { action: "sparks", amount: -(Number(data!.sparks) + 1), reason: "overdraw" });
    expect([r.status, r.data.error]).toEqual([409, "not_enough_sparks"]);
  });

  it("caps Streak Freezes at two", async () => {
    await act("owner", g.userId, { action: "freeze", reason: "second" });
    const r = await act("owner", g.userId, { action: "freeze", reason: "third" });
    expect([r.status, r.data.error]).toEqual([409, "freeze_full"]);
  });

  it("force sign-out ends the player's sessions", async () => {
    const r = await act("moderator", e.userId, { action: "signout", reason: "lost phone" });
    expect(r.status).toBe(200);
    expect(r.data.sessions).toBeGreaterThanOrEqual(1);
    const again = await act("moderator", e.userId, { action: "signout", reason: "check none left" });
    expect(again.data.sessions).toBe(0);
  });

  it("shows the actions in the player's moderation history and audit trail", async () => {
    const d = await S.analyst.aal2(`/api/admin/players/${g.userId}/detail`);
    const actions = d.data.audit.map((a: { action: string }) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["player.sparks", "player.freeze", "player.ban", "player.signout"]));
    expect(d.data.moderation.map((a: { action: string }) => a.action)).not.toContain("player.sparks");
    expect(d.data.sparks.some((s: { source: string; amount: number }) => s.source === "admin" && s.amount === 500)).toBe(true);
  });
});

describe("players: delete", () => {
  it("requires the typed nickname, uses the account deletion path and is audited first", async () => {
    const p = await emailPlayer("pd_");
    const wrong = await act("owner", p.userId, { action: "delete", confirm: p.nickname.slice(0, -1), reason: "user asked by email" });
    expect([wrong.status, wrong.data.error]).toEqual([422, "confirm"]);
    expect((await act("owner", p.userId, { action: "delete", reason: "user asked by email" })).status).toBe(400);
    expect((await admin().from("players").select("id").eq("id", p.userId).maybeSingle()).data?.id).toBe(p.userId);

    const ok = await act("owner", p.userId, { action: "delete", confirm: p.nickname.toUpperCase(), reason: "user asked by email" });
    expect(ok.status).toBe(200);
    expect((await admin().from("players").select("id").eq("id", p.userId).maybeSingle()).data).toBeNull();
    expect((await admin().auth.admin.getUserById(p.userId)).data.user).toBeNull();
    const row = await lastAudit("player.delete", `player:${p.userId}`);
    expect(row?.detail).toMatchObject({ nickname: p.nickname, reason: "user asked by email" });
    expect((await S.owner.aal2(`/api/admin/players/${p.userId}/detail`)).status).toBe(404);
  });

  it("refuses to delete or sign out an admin account", async () => {
    const db = admin();
    await db.from("players").insert({ id: S.analyst.userId, nickname: uniq("adm_"), age_band: "18+" });
    const { data } = await db.from("players").select("nickname").eq("id", S.analyst.userId).single();
    const del = await act("owner", S.analyst.userId, { action: "delete", confirm: String(data!.nickname), reason: "should not work" });
    expect([del.status, del.data.error]).toEqual([409, "is_admin"]);
    const out = await act("owner", S.analyst.userId, { action: "signout", reason: "should not work" });
    expect([out.status, out.data.error]).toEqual([409, "is_admin"]);
  });
});

describe("players: list filters, sort and paging", () => {
  const tag = uniq("zl");
  const made: string[] = [];
  beforeAll(async () => {
    for (let i = 0; i < 12; i++) {
      const g = await guest(`${tag}${String(i).padStart(2, "0")}`);
      made.push(g.userId);
      await admin()
        .from("players")
        .update({ sparks: i * 10, age_band: i % 3 === 0 ? "13-15" : "18+" })
        .eq("id", g.userId);
    }
  }, 120_000);
  const list = (qs: string) => S.analyst.aal2(`/api/admin/players?q=${tag}&${qs}`);

  it("validates sort, filters and page params", async () => {
    for (const bad of [
      "sort=email",
      "sort=nickname;drop",
      "dir=up",
      "account=facebook",
      "age=12",
      "status=gone",
      "joinedFrom=02/01/2031",
      "pageSize=7",
    ]) {
      const r = await list(bad);
      expect([bad, r.status]).toEqual([bad, 400]);
    }
  });

  it("sorts on the server and pages without repeats", async () => {
    const asc = await list("sort=sparks&dir=asc&pageSize=10");
    expect(asc.data.total).toBe(12);
    expect(asc.data.rows.map((r: { sparks: number }) => r.sparks)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
    const p2 = await list("sort=sparks&dir=asc&pageSize=10&page=2");
    expect(p2.data.rows.map((r: { sparks: number }) => r.sparks)).toEqual([100, 110]);
    const desc = await list("sort=nickname&dir=desc&pageSize=25");
    const names = desc.data.rows.map((r: { nickname: string }) => r.nickname);
    expect(names).toEqual([...names].sort().reverse());
  });

  it("filters by account type, age band and status", async () => {
    expect((await list("account=guest")).data.total).toBe(12);
    expect((await list("account=email")).data.total).toBe(0);
    expect((await list("age=13-15")).data.total).toBe(4);
    await S.moderator.aal2("/api/admin/players/bulk", { json: { action: "revoke_ranking", ids: made.slice(0, 2), reason: "bulk test" } });
    expect((await list("status=ranking_revoked")).data.total).toBe(2);
    expect((await list("status=active")).data.total).toBe(10);
    const today = new Date().toISOString().slice(0, 10);
    expect((await list(`joinedFrom=${today}`)).data.total).toBe(12);
    expect((await list("joinedTo=2020-01-01")).data.total).toBe(0);
  });

  it("bulk actions audit each player and the batch", async () => {
    const ids = made.slice(2, 5);
    const r = await S.moderator.aal2("/api/admin/players/bulk", { json: { action: "ban", ids, reason: "spam ring", days: 7 } });
    expect([r.status, r.data.done]).toEqual([200, 3]);
    for (const id of ids) expect((await lastAudit("player.ban", `player:${id}`))?.detail.reason).toBe("spam ring");
    const batch = await admin()
      .from("audit_log")
      .select("detail")
      .eq("action", "player.bulk")
      .eq("actor_id", S.moderator.userId)
      .order("id", { ascending: false })
      .limit(1);
    expect(batch.data?.[0].detail).toMatchObject({ action: "ban", reason: "spam ring", players: ids });
    expect((await S.moderator.aal2("/api/admin/players/bulk", { json: { action: "delete", ids, reason: "nope" } })).status).toBe(400);
  });

  it("exports the filtered list (owner only, audited, emails only for the owner)", async () => {
    const r = await S.owner.aal2("/api/admin/players/export", { json: { search: `q=${tag}&sort=sparks&dir=desc` } });
    expect(r.status).toBe(200);
    const lines = r.data.csv.trim().split("\r\n");
    expect(lines[0].split(",")).toContain("email");
    expect(lines).toHaveLength(13);
    expect(lines[1]).toContain(`${tag}11`);
    const sel = await S.owner.aal2("/api/admin/players/export", { json: { ids: made.slice(0, 2) } });
    expect(sel.data.count).toBe(2);
    const row = await admin()
      .from("audit_log")
      .select("detail")
      .eq("action", "players.export")
      .eq("actor_id", S.owner.userId)
      .order("id", { ascending: false })
      .limit(1);
    expect(row.data?.[0].detail).toMatchObject({ count: 2, ids: 2, with_email: true });
  });
});
