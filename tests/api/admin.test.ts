import fs from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { can, ROLES, type Permission } from "@/lib/admin/roles";
import { admin, BASE, guest, uniq } from "./helpers";
import { adminSession, type AdminSession, type Role } from "./admin-helpers";

/**
 * Admin API integration (FR-AD-01 to FR-AD-08) against a running dev server (API_BASE) and local Supabase.
 * Every route: unauthenticated 401, non-admin 403, AAL1 (password only) 403, forbidden roles 403, and the
 * allowed roles succeed. Run: API_BASE=http://localhost:3203 pnpm vitest run -c vitest.api.config.mts tests/api/admin.test.ts
 */

const NIL = "00000000-0000-0000-0000-000000000000";
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

interface Route {
  method: "GET" | "POST" | "PATCH" | "PUT";
  path: string;
  perm: Permission | null;
}
/** Every admin route and the permission its gate checks. */
const ROUTES: Route[] = [
  { method: "GET", path: "/api/admin/me", perm: null },
  { method: "POST", path: "/api/admin/me", perm: null },
  { method: "GET", path: "/api/admin/calendar", perm: "calendar.read" },
  { method: "GET", path: `/api/admin/dailies?date=${day(1)}&game=sixer`, perm: "calendar.read" },
  { method: "GET", path: "/api/admin/puzzles", perm: "calendar.read" },
  { method: "GET", path: `/api/admin/puzzles/${NIL}`, perm: "calendar.read" },
  { method: "PATCH", path: `/api/admin/puzzles/${NIL}`, perm: "calendar.write" },
  { method: "POST", path: `/api/admin/puzzles/${NIL}/check`, perm: "calendar.write" },
  { method: "POST", path: `/api/admin/puzzles/${NIL}/verify`, perm: "calendar.read" },
  { method: "POST", path: `/api/admin/puzzles/${NIL}/approve`, perm: "calendar.write" },
  { method: "POST", path: "/api/admin/dailies/regenerate", perm: "calendar.write" },
  { method: "POST", path: "/api/admin/dailies/lock", perm: "calendar.write" },
  { method: "POST", path: "/api/admin/dailies/swap", perm: "daily.swap" },
  { method: "POST", path: "/api/admin/dailies/fill", perm: "calendar.write" },
  { method: "POST", path: "/api/admin/dailies/schedule", perm: "calendar.write" },
  { method: "GET", path: "/api/admin/content", perm: "content.read" },
  { method: "POST", path: "/api/admin/content", perm: "content.write" },
  { method: "GET", path: `/api/admin/content/${NIL}`, perm: "content.read" },
  { method: "PATCH", path: `/api/admin/content/${NIL}`, perm: "content.write" },
  { method: "POST", path: `/api/admin/content/${NIL}/review`, perm: "content.approve" },
  { method: "GET", path: "/api/admin/content/files", perm: "content.read" },
  { method: "POST", path: "/api/admin/content/files", perm: "content.owner_review" },
  { method: "GET", path: "/api/admin/moderation", perm: "moderation.read" },
  { method: "GET", path: `/api/admin/moderation/reports/${NIL}`, perm: "moderation.read" },
  { method: "POST", path: `/api/admin/moderation/reports/${NIL}`, perm: "moderation.write" },
  { method: "GET", path: `/api/admin/moderation/flagged/${NIL}`, perm: "moderation.read" },
  { method: "POST", path: `/api/admin/moderation/flagged/${NIL}`, perm: "moderation.write" },
  { method: "GET", path: `/api/admin/players/${NIL}`, perm: "moderation.read" },
  { method: "POST", path: `/api/admin/players/${NIL}`, perm: "moderation.write" },
  { method: "GET", path: "/api/admin/schools", perm: "schools.read" },
  { method: "POST", path: `/api/admin/schools/${NIL}`, perm: "schools.write" },
  { method: "GET", path: "/api/admin/liveops", perm: "liveops.read" },
  { method: "GET", path: "/api/admin/flags", perm: "flags.read" },
  { method: "PUT", path: "/api/admin/flags", perm: "flags.write" },
  { method: "GET", path: "/api/admin/catalog/quests", perm: "catalog.read" },
  { method: "PATCH", path: "/api/admin/catalog/quests", perm: "catalog.write" },
  { method: "POST", path: "/api/admin/catalog/quests", perm: "catalog.write" },
  { method: "GET", path: "/api/admin/audit", perm: "audit.read" },
  { method: "GET", path: "/api/admin/team", perm: "team.manage" },
  { method: "POST", path: "/api/admin/team", perm: "team.manage" },
  { method: "PATCH", path: `/api/admin/team/${NIL}`, perm: "team.manage" },
];

const S = {} as Record<Role, AdminSession>;
let plain: AdminSession;
const call = (r: Route, s: AdminSession, aal: "aal1" | "aal2" = "aal2") =>
  s[aal](r.path, { method: r.method, json: r.method === "GET" ? undefined : {} });
const lastAudit = async (actor: string, action: string) =>
  (
    await admin()
      .from("audit_log")
      .select("id, action, target, detail")
      .eq("actor_id", actor)
      .eq("action", action)
      .order("id", { ascending: false })
      .limit(1)
  ).data?.[0];

beforeAll(async () => {
  for (const r of ROLES) S[r] = await adminSession(r);
  plain = await adminSession(null);
}, 120_000);

describe("admin gate", () => {
  it("covers every route file under app/api/admin", () => {
    const files: string[] = [];
    const walk = (d: string) =>
      fs
        .readdirSync(d, { withFileTypes: true })
        .forEach((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : e.name === "route.ts" && files.push(d)));
    walk("app/api/admin");
    const covered = new Set(
      ROUTES.map((r) =>
        r.path
          .split("?")[0]
          .replace(NIL, "[id]")
          .replace(/catalog\/quests/, "catalog/[kind]"),
      ),
    );
    const routes = files.map((f) => f.replace("app", "")).filter((p) => p !== "/api/admin/bootstrap");
    expect(routes.filter((p) => !covered.has(p))).toEqual([]);
  });

  it("refuses requests without a session (401)", async () => {
    for (const r of ROUTES) {
      const res = await fetch(BASE + r.path, {
        method: r.method,
        headers: { "content-type": "application/json" },
        body: r.method === "GET" ? undefined : "{}",
      });
      expect(res.status, `${r.method} ${r.path}`).toBe(401);
    }
  });

  it("refuses signed-in users who are not admins, and player guests (403 not_admin)", async () => {
    const g = await guest();
    for (const r of ROUTES) {
      const a = await call(r, plain);
      expect([a.status, a.data?.error], `${r.method} ${r.path}`).toEqual([403, "not_admin"]);
      const b = await g.api(r.path, { method: r.method, json: r.method === "GET" ? undefined : {} });
      expect(b.status, `guest ${r.method} ${r.path}`).toBe(403);
    }
  });

  it("requires the TOTP second factor (AAL2) on every route, for every role", async () => {
    for (const role of ROLES)
      for (const r of ROUTES) {
        const res = await call(r, S[role], "aal1");
        expect([res.status, res.data?.error], `${role} AAL1 ${r.method} ${r.path}`).toEqual([403, "aal2_required"]);
      }
  });

  it("forbids each role what it does not hold (403 forbidden), server side", async () => {
    for (const role of ROLES)
      for (const r of ROUTES.filter((x) => x.perm && !can(role, x.perm))) {
        const res = await call(r, S[role]);
        expect([res.status, res.data?.error], `${role} ${r.method} ${r.path}`).toEqual([403, "forbidden"]);
      }
  });

  it("lets every allowed role through to the handler on GET routes", async () => {
    for (const role of ROLES)
      for (const r of ROUTES.filter((x) => x.method === "GET" && (!x.perm || can(role, x.perm)) && !x.path.includes(NIL))) {
        const res = await call(r, S[role]);
        expect(res.status, `${role} ${r.path}`).toBe(200);
      }
  });

  it("returns the role and permissions on /me", async () => {
    const me = await S.moderator.aal2("/api/admin/me");
    expect(me.data.role).toBe("moderator");
    expect(me.data.permissions).toContain("moderation.write");
    expect(me.data.permissions).not.toContain("calendar.write");
    expect((await S.analyst.aal2("/api/admin/me", { json: {} })).status).toBe(200);
  });

  it("takes effect at once when an owner disables an admin", async () => {
    const x = await adminSession("analyst");
    expect((await x.aal2("/api/admin/liveops")).status).toBe(200);
    expect((await S.owner.aal2(`/api/admin/team/${x.userId}`, { method: "PATCH", json: { disabled: true } })).status).toBe(200);
    expect((await x.aal2("/api/admin/liveops")).data.error).toBe("not_admin");
    expect((await S.owner.aal2(`/api/admin/team/${S.owner.userId}`, { method: "PATCH", json: { role: "analyst" } })).status).toBe(409);
  });
});

describe("calendar, preview and solve-check (FR-AD-02, FR-AD-07)", () => {
  let puzzleId: string;
  beforeAll(async () => {
    const { data } = await admin().from("dailies").select("puzzle_id").eq("game_id", "sixer").eq("date", day(1)).single();
    puzzleId = data!.puzzle_id;
  });

  it("shows a week of Dailies per game", async () => {
    const r = await S.analyst.aal2(`/api/admin/calendar?week=${day(0)}&world=logic`);
    expect(r.data.days).toHaveLength(7);
    const sixer = r.data.rows.find((x: { game: string }) => x.game === "sixer");
    expect(sixer.cells.every((c: { state: string }) => ["verified", "review", "missing"].includes(c.state))).toBe(true);
    expect((await S.analyst.aal2("/api/admin/calendar?week=nope")).status).toBe(400);
  });

  it("returns the answer key only to admins, and solve-checks with countSolutions and verify", async () => {
    const d = await S.analyst.aal2(`/api/admin/puzzles/${puzzleId}`);
    expect(d.data.puzzle.solution).toBeTruthy();
    for (const role of ["owner", "content_editor"] as const) {
      const c = await S[role].aal2(`/api/admin/puzzles/${puzzleId}/check?date=${day(1)}`, { json: {} });
      expect(c.status).toBe(200);
      const byId = Object.fromEntries(c.data.checks.map((x: { id: string; status: string }) => [x.id, x.status]));
      expect(byId).toMatchObject({ unique: "pass", verify: "pass", hash: "pass" });
    }
    expect((await lastAudit(S.content_editor.userId, "puzzle.check"))?.target).toBe(`puzzle:${puzzleId}`);
  });

  it("play test: the server's verify() judges a submitted board", async () => {
    const { data } = await admin().from("puzzles").select("solution").eq("id", puzzleId).single();
    const good = { values: data!.solution as number[], notes: new Array(36).fill(0) };
    for (const role of ROLES) {
      const ok = await S[role].aal2(`/api/admin/puzzles/${puzzleId}/verify`, { json: { state: good } });
      expect(ok.data.ok, role).toBe(true);
    }
    const bad = await S.analyst.aal2(`/api/admin/puzzles/${puzzleId}/verify`, { json: { state: { values: [], notes: [] } } });
    expect(bad.data.ok).toBe(false);
  });

  it("saves reviewer notes and approves only after a passing check", async () => {
    for (const role of ["owner", "content_editor"] as const) {
      expect((await S[role].aal2(`/api/admin/puzzles/${puzzleId}`, { method: "PATCH", json: { note: `ok by ${role}` } })).status).toBe(200);
      const a = await S[role].aal2(`/api/admin/puzzles/${puzzleId}/approve`, { json: { date: day(1) } });
      expect(a.status).toBe(200);
      expect(a.data.report.ok).toBe(true);
    }
    const { data } = await admin().from("puzzles").select("status, reviewed_by, reviewer_note").eq("id", puzzleId).single();
    expect(data).toMatchObject({ status: "scheduled", reviewed_by: S.content_editor.userId, reviewer_note: "ok by content_editor" });
  });

  it("regenerates an unlocked future Daily into review, and refuses locked ones", async () => {
    for (const role of ["owner", "content_editor"] as const) {
      const date = day(rand(9, 20));
      const r = await S[role].aal2("/api/admin/dailies/regenerate", { json: { date, game: "sixer" } });
      expect(r.status, `${role} ${JSON.stringify(r.data)}`).toBe(200);
      const { data } = await admin()
        .from("dailies")
        .select("puzzle_id, puzzles!dailies_puzzle_id_fkey(status)")
        .eq("date", date)
        .eq("game_id", "sixer")
        .single();
      expect(data!.puzzle_id).toBe(r.data.puzzleId);
      expect((data!.puzzles as unknown as { status: string }).status).toBe("in_review");
    }
    const locked = await S.owner.aal2("/api/admin/dailies/regenerate", { json: { date: day(2), game: "sixer" } });
    expect([locked.status, locked.data.error]).toEqual([409, "locked"]);
  }, 60_000);

  it("locks Dailies, keeps the next 7 days locked, and the database refuses edits to locked ones", async () => {
    const date = day(15);
    for (const role of ["owner", "content_editor"] as const) {
      expect((await S[role].aal2("/api/admin/dailies/lock", { json: { date, game: "dusk", locked: true } })).status).toBe(200);
    }
    const { data: d } = await admin().from("dailies").select("locked, puzzle_id").eq("date", date).eq("game_id", "dusk").single();
    expect(d!.locked).toBe(true);
    const { error } = await admin().from("dailies").update({ puzzle_id: NIL }).eq("date", date).eq("game_id", "dusk");
    expect(error?.message).toMatch(/locked/);
    expect((await S.owner.aal2("/api/admin/dailies/lock", { json: { date, game: "dusk", locked: false } })).status).toBe(200);
    const inside = await S.owner.aal2("/api/admin/dailies/lock", { json: { date: day(3), game: "dusk", locked: false } });
    expect([inside.status, inside.data.error]).toEqual([409, "inside_lock_window"]);
    const bulk = await S.content_editor.aal2("/api/admin/dailies/lock", { json: { through: day(7) } });
    expect(bulk.status).toBe(200);
  });

  it("swaps a Daily for a fresh verified puzzle and keeps swapped_from (today and a later locked one)", async () => {
    for (const [role, date] of [
      ["content_editor", day(rand(2, 6))],
      ["owner", day(0)],
    ] as const) {
      const before = (await admin().from("dailies").select("puzzle_id").eq("date", date).eq("game_id", "sixer").single()).data!;
      const r = await S[role].aal2("/api/admin/dailies/swap", { json: { game: "sixer", date, reason: "test: broken region" } });
      expect(r.status, JSON.stringify(r.data)).toBe(200);
      expect(r.data.report.ok).toBe(true);
      const after = (
        await admin().from("dailies").select("puzzle_id, swapped_from, locked").eq("date", date).eq("game_id", "sixer").single()
      ).data!;
      expect(after).toMatchObject({ puzzle_id: r.data.to, swapped_from: before.puzzle_id, locked: true });
      const old = (await admin().from("puzzles").select("status").eq("id", before.puzzle_id).single()).data!;
      expect(old.status).toBe("retired");
      expect((await lastAudit(S[role].userId, "daily.swap"))?.target).toBe(`sixer:${date}`);
    }
    const noReason = await S.owner.aal2("/api/admin/dailies/swap", { json: { game: "sixer" } });
    expect(noReason.status).toBe(400);
  }, 60_000);

  it("fills gaps with the solver-checked scheduler", async () => {
    for (const role of ["owner", "content_editor"] as const) {
      const r = await S[role].aal2("/api/admin/dailies/fill", { json: { days: 1 } });
      expect(r.status).toBe(200);
      expect(r.data).toHaveProperty("made");
    }
  });
});

describe("content editor and two-person approval (FR-AD-03)", () => {
  const hunch = () => ({
    id: uniq("t-"),
    category: "Things with a test",
    accept: ["test"],
    warm: ["exam"],
    clues: ["One", "Two", "Three", "Four", "Five"],
    tier: 1,
  });

  it("validates payloads per game type", async () => {
    const bad = await S.content_editor.aal2("/api/admin/content", { json: { game: "rungs", payload: { words: ["ABCD"], clues: [] } } });
    expect(bad.status).toBe(422);
    expect(bad.data.issues.length).toBeGreaterThan(0);
    const dash = await S.content_editor.aal2("/api/admin/content", {
      json: { game: "hunch", payload: { ...hunch(), category: "Em — dash" } },
    });
    expect(dash.status).toBe(422);
    const notContent = await S.content_editor.aal2("/api/admin/content", { json: { game: "crownfall", payload: {} } });
    expect(notContent.status).toBe(400);
  });

  it("drafts, submits, refuses self-approval, approves by a second person, then schedules", async () => {
    for (const [author, reviewer] of [
      ["content_editor", "owner"],
      ["owner", "content_editor"],
    ] as const) {
      const c = await S[author].aal2("/api/admin/content", { json: { game: "hunch", payload: hunch(), notes: "first draft" } });
      expect(c.status).toBe(200);
      const id = c.data.id;
      expect((await S[reviewer].aal2(`/api/admin/content/${id}`, { method: "PATCH", json: { notes: "hijack" } })).status).toBe(
        reviewer === "owner" ? 200 : 403,
      );
      expect((await S[author].aal2(`/api/admin/content/${id}`, { method: "PATCH", json: { submit: true } })).data.status).toBe("in_review");
      const self = await S[author].aal2(`/api/admin/content/${id}/review`, { json: { decision: "approve" } });
      expect([self.status, self.data.error]).toEqual([403, "own_item"]);
      const ok = await S[reviewer].aal2(`/api/admin/content/${id}/review`, { json: { decision: "approve", notes: "checked" } });
      expect(ok.data).toMatchObject({ status: "approved", reviewer_id: S[reviewer].userId });
      const date = day(rand(25, 55));
      await admin().from("dailies").update({ locked: false }).eq("date", date).eq("game_id", "hunch");
      const sch = await S[author].aal2("/api/admin/dailies/schedule", { json: { itemId: id, date } });
      expect(sch.status, JSON.stringify(sch.data)).toBe(200);
      const daily = (await admin().from("dailies").select("puzzle_id").eq("date", date).eq("game_id", "hunch").single()).data!;
      expect(daily.puzzle_id).toBe(sch.data.puzzleId);
      const pz = (await admin().from("puzzles").select("source, content_item_id, data").eq("id", sch.data.puzzleId).single()).data!;
      expect(pz).toMatchObject({ source: "human", content_item_id: id });
      expect((await S.owner.aal2(`/api/admin/content/${id}`)).data.status).toBe("scheduled");
    }
  }, 60_000);

  it("refuses unapproved items and schedules guess games (checked by attempt)", async () => {
    const c = await S.content_editor.aal2("/api/admin/content", { json: { game: "hunch", payload: hunch() } });
    const r = await S.owner.aal2("/api/admin/dailies/schedule", { json: { itemId: c.data.id, date: day(40) } });
    expect([r.status, r.data.error]).toEqual([409, "not_approved"]);
    const coil = await S.content_editor.aal2("/api/admin/content", {
      json: { game: "coil", payload: { theme: "Test", words: ["ABCDEF", "GHIJKL", "MNOPQR", "STUVWX", "YZABCD"] } },
    });
    expect(coil.status).toBe(200);
    await S.content_editor.aal2(`/api/admin/content/${coil.data.id}`, { method: "PATCH", json: { submit: true } });
    await S.owner.aal2(`/api/admin/content/${coil.data.id}/review`, { json: { decision: "approve" } });
    const g = await S.owner.aal2("/api/admin/dailies/schedule", { json: { itemId: coil.data.id, date: day(40) } });
    // Guess games resolve guesses against the attempt's stored puzzle, so they schedule like any other
    // (a made-up item may still fail the solve check, which answers 422 check_failed).
    expect(g.data.error).not.toBe("guess_route_pending");
    expect([200, 422]).toContain(g.status);
  });

  it("lists content.ts entries flagged needsReview and records the owner's approval", async () => {
    const list = await S.content_editor.aal2("/api/admin/content/files?game=quads");
    expect(list.data.canApprove).toBe(false);
    const g = list.data.games[0];
    expect(g.entries.length).toBe(g.total);
    const r = await S.owner.aal2("/api/admin/content/files", {
      json: { game: "quads", indexes: [0, 1], decision: "approve", notes: "read through" },
    });
    expect(r.status).toBe(200);
    const after = await S.owner.aal2("/api/admin/content/files?game=quads");
    expect(after.data.games[0].entries.slice(0, 2).map((e: { state: string }) => e.state)).toEqual(["approved", "approved"]);
    const { data } = await admin().from("content_items").select("status, reviewer_id, source").eq("source_ref", "quads:0").single();
    expect(data).toMatchObject({ status: "approved", reviewer_id: S.owner.userId, source: "content_file" });
  });
});

describe("moderation (FR-AD-05)", () => {
  let target: Awaited<ReturnType<typeof guest>>;
  let reporter: Awaited<ReturnType<typeof guest>>;
  const flagged: string[] = [];
  const reports: string[] = [];

  beforeAll(async () => {
    target = await guest(uniq("mt_"));
    reporter = await guest(uniq("mr_"));
    const db = admin();
    for (let i = 0; i < 3; i++) {
      const { data } = await db
        .from("attempts")
        .insert({
          player_id: target.userId,
          game_id: "sixer",
          mode: "free",
          status: "flagged",
          time_ms: 900,
          flag_reason: "below human floor",
          finished_at: new Date().toISOString(),
          moves: [{ t: 0 }, { t: 180 }, { t: 360 }],
        })
        .select("id")
        .single();
      flagged.push(data!.id);
    }
    for (const reason of ["nickname", "harassment"]) {
      const { data } = await db
        .from("reports")
        .insert({
          reporter_id: reporter.userId,
          target_type: reason === "nickname" ? "nickname" : "player",
          target_id: target.userId,
          reason,
        })
        .select("id")
        .single();
      reports.push(data!.id);
    }
  });

  it("lists reports, nickname reports and flagged scores with replay data", async () => {
    for (const role of ["owner", "moderator"] as const) {
      const f = await S[role].aal2("/api/admin/moderation?tab=flagged");
      expect(f.data.rows.some((r: { id: string }) => r.id === flagged[0])).toBe(true);
      const n = await S[role].aal2("/api/admin/moderation?tab=nicknames");
      expect(n.data.rows.some((r: { id: string }) => r.id === reports[0])).toBe(true);
      const d = await S[role].aal2(`/api/admin/moderation/flagged/${flagged[0]}`);
      expect(d.data.attempt.flag_reason).toBe("below human floor");
      expect(d.data.gaps).toEqual([180, 180]);
      expect((await S[role].aal2(`/api/admin/moderation/reports/${reports[1]}`)).data.target.id).toBe(target.userId);
      expect((await S[role].aal2(`/api/admin/players/${target.userId}`)).data.flagged).toBeGreaterThanOrEqual(1);
    }
  });

  it("clears a flagged score (published) or rejects it, once", async () => {
    const c = await S.moderator.aal2(`/api/admin/moderation/flagged/${flagged[0]}`, { json: { decision: "clear", note: "legit" } });
    expect(c.status).toBe(200);
    const r = await S.owner.aal2(`/api/admin/moderation/flagged/${flagged[1]}`, { json: { decision: "reject" } });
    expect(r.status).toBe(200);
    const again = await S.owner.aal2(`/api/admin/moderation/flagged/${flagged[1]}`, { json: { decision: "clear" } });
    expect([again.status, again.data.error]).toEqual([409, "not_flagged"]);
    const { data } = await admin().from("attempts").select("id, status").in("id", flagged.slice(0, 2));
    expect(Object.fromEntries(data!.map((a) => [a.id, a.status]))).toEqual({ [flagged[0]]: "cleared", [flagged[1]]: "failed" });
    expect((await lastAudit(S.moderator.userId, "flagged.clear"))?.target).toBe(`attempt:${flagged[0]}`);
  });

  it("renames, bans, resets and restores players; a banned player is locked out", async () => {
    const rn = await S.moderator.aal2(`/api/admin/players/${target.userId}`, { json: { action: "rename" } });
    expect(rn.data.nickname).toMatch(/^Puzzler\d{4}$/);
    const rude = await S.moderator.aal2(`/api/admin/players/${target.userId}`, { json: { action: "rename", nickname: "fuckface" } });
    expect(rude.status).toBe(422);
    expect((await S.owner.aal2(`/api/admin/players/${target.userId}`, { json: { action: "revoke_ranking" } })).status).toBe(200);
    expect((await S.moderator.aal2(`/api/admin/players/${target.userId}`, { json: { action: "reset" } })).status).toBe(200);
    expect(
      (await S.moderator.aal2(`/api/admin/players/${target.userId}`, { json: { action: "ban", days: 7, reason: "test" } })).status,
    ).toBe(200);
    expect((await target.api("/api/v1/me")).status).toBe(403);
    const rej = await S.moderator.aal2(`/api/admin/moderation/flagged/${flagged[2]}`, {
      json: { decision: "reject", ban: { days: 7 }, note: "bot-like" },
    });
    expect(rej.status).toBe(200);
    expect((await S.owner.aal2(`/api/admin/players/${target.userId}`, { json: { action: "unban" } })).status).toBe(200);
    expect((await S.owner.aal2(`/api/admin/players/${target.userId}`, { json: { action: "restore_ranking" } })).status).toBe(200);
    expect((await target.api("/api/v1/me")).status).toBe(200);
    const { data } = await admin().from("players").select("banned_at, ranking_revoked").eq("id", target.userId).single();
    expect(data).toEqual({ banned_at: null, ranking_revoked: false });
    expect((await lastAudit(S.moderator.userId, "player.ban"))?.target).toBe(`player:${target.userId}`);
  });

  it("closes reports as dismissed or actioned", async () => {
    expect(
      (await S.moderator.aal2(`/api/admin/moderation/reports/${reports[0]}`, { json: { decision: "actioned", note: "renamed" } })).status,
    ).toBe(200);
    expect((await S.owner.aal2(`/api/admin/moderation/reports/${reports[1]}`, { json: { decision: "dismiss" } })).status).toBe(200);
    const { data } = await admin().from("reports").select("id, status, handled_by").in("id", reports);
    expect(data!.find((r) => r.id === reports[0])).toMatchObject({ status: "actioned", handled_by: S.moderator.userId });
  });

  it("verifies schools", async () => {
    const { data: s } = await admin()
      .from("schools")
      .insert({ name: uniq("Test College "), code: uniq("C").toUpperCase() })
      .select("id")
      .single();
    expect((await S.moderator.aal2(`/api/admin/schools/${s!.id}`, { json: { decision: "verify" } })).status).toBe(200);
    expect((await S.owner.aal2(`/api/admin/schools/${s!.id}`, { json: { decision: "unverify" } })).status).toBe(200);
  });
});

describe("live ops, flags, catalogue, audit and team (FR-AD-04, 06, 07, 08)", () => {
  it("serves the live-ops numbers from the admin RPCs", async () => {
    const r = await S.analyst.aal2("/api/admin/liveops");
    expect(r.data.kpis).toHaveProperty("dau");
    expect(r.data.kpis).toHaveProperty("flagged");
    expect(r.data.retention).toHaveProperty("d1");
    expect(r.data.retention).toHaveProperty("d7");
    expect(r.data.series).toHaveLength(48);
    expect(r.data.streaks.length).toBe(7);
    expect(r.data.byGame.length).toBeGreaterThan(10);
  });

  it("toggles feature flags (owner only) and logs before and after", async () => {
    const key = `test.${uniq("f")}`;
    expect((await S.owner.aal2("/api/admin/flags", { method: "PUT", json: { key, enabled: true, payload: { pct: 10 } } })).status).toBe(
      200,
    );
    expect((await S.owner.aal2("/api/admin/flags", { method: "PUT", json: { key, enabled: false } })).status).toBe(200);
    const a = await lastAudit(S.owner.userId, "flag.update");
    expect(a?.detail).toMatchObject({ before: { enabled: true }, after: { enabled: false } });
    expect((await S.owner.aal2("/api/admin/flags", { method: "PUT", json: { key: "Bad Key!", enabled: true } })).status).toBe(400);
  });

  it("edits quests, badges and cosmetics; only the owner changes Sparks prices", async () => {
    const quests = await S.content_editor.aal2("/api/admin/catalog/quests");
    const q = quests.data.rows[0];
    expect(
      (await S.content_editor.aal2("/api/admin/catalog/quests", { method: "PATCH", json: { id: q.id, patch: { sparks: q.sparks } } }))
        .status,
    ).toBe(200);
    const cos = (await S.owner.aal2("/api/admin/catalog/cosmetics")).data.rows[0];
    const ed = await S.content_editor.aal2("/api/admin/catalog/cosmetics", {
      method: "PATCH",
      json: { id: cos.id, patch: { price_sparks: cos.price_sparks + 1 } },
    });
    expect([ed.status, ed.data.error]).toEqual([403, "forbidden"]);
    expect(
      (
        await S.owner.aal2("/api/admin/catalog/cosmetics", {
          method: "PATCH",
          json: { id: cos.id, patch: { price_sparks: cos.price_sparks } },
        })
      ).status,
    ).toBe(200);
    expect((await lastAudit(S.owner.userId, "cosmetics.price"))?.target).toBe(`cosmetics:${cos.id}`);
    const unknown = await S.owner.aal2("/api/admin/catalog/quests", { method: "PATCH", json: { id: q.id, patch: { kind: "weekly" } } });
    expect(unknown.status).toBe(400);
    const id = uniq("q-test-");
    const made = await S.content_editor.aal2("/api/admin/catalog/quests", {
      json: { id, kind: "daily", title: "Clear 2 Dailies", goal: { clears: 2 } },
    });
    expect(made.data).toMatchObject({ id, active: false });
  });

  it("filters the audit log by actor, action prefix and date", async () => {
    const r = await S.analyst.aal2(`/api/admin/audit?actor=${S.owner.userId}&action=flag.&from=${day(0)}`);
    expect(r.status).toBe(200);
    expect(r.data.rows.length).toBeGreaterThan(0);
    expect(
      r.data.rows.every((x: { actor_id: string; action: string }) => x.actor_id === S.owner.userId && x.action.startsWith("flag.")),
    ).toBe(true);
    expect((await S.analyst.aal2("/api/admin/audit?action=DROP TABLE")).status).toBe(400);
    const { error } = await admin().from("audit_log").delete().eq("actor_id", S.owner.userId);
    expect(error?.message).toMatch(/append-only/);
  });

  it("adds admins by email with a reset email (no password), and refuses self-service changes", async () => {
    const email = `${uniq("new")}@admin.test`;
    const r = await S.owner.aal2("/api/admin/team", { json: { email, role: "analyst" } });
    expect(r.data).toMatchObject({ createdUser: true, createdAdmin: true, resetSent: true, role: "analyst" });
    const again = await S.owner.aal2("/api/admin/team", { json: { email, role: "analyst" } });
    expect(again.data).toMatchObject({ createdUser: false, createdAdmin: false });
    const list = await S.owner.aal2("/api/admin/team");
    expect(list.data.rows.some((a: { email: string }) => a.email === email)).toBe(true);
  });
});

describe("owner bootstrap server path", () => {
  const secret = (() => {
    const line = fs
      .readFileSync(".env.local", "utf8")
      .split("\n")
      .find((l) => l.startsWith("CRON_SECRET="));
    return line?.slice("CRON_SECRET=".length) ?? "";
  })();

  it("needs the cron secret and is idempotent", async () => {
    expect((await fetch(`${BASE}/api/admin/bootstrap`, { method: "POST" })).status).toBe(401);
    expect((await fetch(`${BASE}/api/admin/bootstrap`, { method: "POST", headers: { authorization: "Bearer wrong" } })).status).toBe(401);
    const first = await fetch(`${BASE}/api/admin/bootstrap`, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
    expect(first.status).toBe(200);
    const second = await (
      await fetch(`${BASE}/api/admin/bootstrap`, { method: "POST", headers: { authorization: `Bearer ${secret}` } })
    ).json();
    expect(second).toMatchObject({ role: "owner", createdUser: false, createdAdmin: false, resetSent: false });
    expect(JSON.stringify(second)).not.toMatch(/password/i);
  });
});
