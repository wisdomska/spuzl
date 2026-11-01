import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, BASE, guest, uniq } from "./helpers";
import { adminSession, type AdminSession, type Role } from "./admin-helpers";
import { setSetting } from "./setup";

/**
 * Seasonal events (Phase 5, "features.seasonal"): admin CRUD with role gates, validation and audit; the public
 * current-event endpoint; the bonus quest in Quests, counted from free-play clears and claimed once.
 * Run: API_BASE=http://localhost:3143 pnpm vitest run -c vitest.api.config.mts tests/api/events.test.ts
 */

const MIN = 60_000;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();
const S = {} as Record<Role, AdminSession>;
const made: string[] = [];

const quest = { title: "Clear 2 free-play puzzles", kind: "free_clears", n: 2, xp: 40, sparks: 25 };
const event = (o: Record<string, unknown> = {}) => ({
  name: uniq("Harmattan "),
  startsAt: iso(-MIN),
  endsAt: iso(60 * MIN),
  accent: "gold",
  banner: "Harmattan Week is here. Clear 2 for a bonus.",
  quest,
  ...o,
});
const pick = (e: ReturnType<typeof event>) => ({ name: e.name, accent: e.accent, banner: e.banner, quest: e.quest });
async function create(o: Record<string, unknown> = {}) {
  const r = await S.content_editor.aal2("/api/admin/events", { json: event(o) });
  expect(r.status, JSON.stringify(r.data)).toBe(200);
  made.push(r.data.id);
  return r.data as { id: string; name: string };
}
const lastAudit = async (actor: string, action: string, target: string) =>
  (
    await admin()
      .from("audit_log")
      .select("action, target, detail")
      .eq("actor_id", actor)
      .eq("action", action)
      .eq("target", target)
      .order("id", { ascending: false })
      .limit(1)
  ).data?.[0];

async function freeClear(g: Awaited<ReturnType<typeof guest>>) {
  const s = await g.api("/api/v1/attempts", { json: { game: "crownfall", mode: "free", difficulty: "easy" } });
  expect(s.status).toBe(200);
  const { generate } = await import("@/games/crownfall/logic");
  const { createRng } = await import("@/lib/rng");
  const gen = generate(createRng(s.data.seed), "easy");
  const n = gen.puzzle.size;
  const state = new Array(n * n).fill(0);
  gen.solution.forEach((c, r) => (state[r * n + c] = 2));
  await new Promise((r) => setTimeout(r, 6500)); // above the human floor in wall time
  const fin = await g.api(`/api/v1/attempts/${s.data.attemptId}/finish`, { json: { state, activeMs: 6100, mistakes: 0 } });
  expect(fin.data.status).toBe("cleared");
  return fin.data as { unlocks?: { type: string; id: string }[] };
}

beforeAll(async () => {
  for (const r of ["owner", "content_editor", "analyst", "moderator"] as const) S[r] = await adminSession(r);
  await setSetting("features.seasonal", true);
}, 120_000);

afterAll(async () => {
  for (const id of made) await S.owner.aal2(`/api/admin/events/${id}`, { method: "DELETE" });
  await setSetting("features.seasonal", false);
});

describe("admin events: roles, validation, audit", () => {
  it("lets owners and content editors write, analysts read, and keeps moderators out", async () => {
    for (const r of ["owner", "content_editor", "analyst"] as const) expect((await S[r].aal2("/api/admin/events")).status).toBe(200);
    expect((await S.moderator.aal2("/api/admin/events")).data.error).toBe("forbidden");
    for (const r of ["analyst", "moderator"] as const)
      expect((await S[r].aal2("/api/admin/events", { json: event() })).data.error, r).toBe("forbidden");
    const own = await S.owner.aal2("/api/admin/events", { json: event() });
    expect(own.status).toBe(200);
    made.push(own.data.id);
    const e = await create();
    expect((await S.analyst.aal2(`/api/admin/events/${e.id}`, { method: "PATCH", json: { name: "Nope" } })).data.error).toBe("forbidden");
    expect((await S.analyst.aal2(`/api/admin/events/${e.id}`, { method: "DELETE" })).data.error).toBe("forbidden");
  });

  it("validates dates, accent and the quest goal", async () => {
    const post = (o: Record<string, unknown>) => S.owner.aal2("/api/admin/events", { json: event(o) });
    expect((await post({ endsAt: iso(-2 * MIN) })).data.error).toBe("bad_dates"); // ends before it starts
    expect((await post({ startsAt: iso(-3 * MIN), endsAt: iso(-2 * MIN) })).data.error).toBe("bad_dates"); // already over
    expect((await post({ endsAt: iso(63 * 24 * 60 * MIN) })).data.error).toBe("bad_dates"); // too long
    expect((await post({ startsAt: "next week" })).status).toBe(400);
    expect((await post({ accent: "hotpink" })).status).toBe(400);
    expect((await post({ quest: { ...quest, kind: "world_clears" } })).status).toBe(400); // world missing
    expect((await post({ quest: { ...quest, kind: "duels" } })).status).toBe(400);
    expect((await post({ banner: "x".repeat(141) })).status).toBe(400);
    const e = await create();
    const bad = await S.owner.aal2(`/api/admin/events/${e.id}`, { method: "PATCH", json: { endsAt: iso(-10 * MIN) } });
    expect(bad.data.error).toBe("bad_dates"); // merged with the stored start
    expect((await S.owner.aal2(`/api/admin/events/00000000-0000-4000-8000-000000000000`, { method: "PATCH", json: {} })).status).toBe(404);
  });

  it("edits the bonus quest when the body repeats the event id (console editor, quest catalogue)", async () => {
    const e = await create();
    const edited = { ...quest, xp: 55, sparks: 30 };
    const r = await S.content_editor.aal2(`/api/admin/events/${e.id}`, { method: "PATCH", json: { id: e.id, quest: edited } });
    expect(r.status, JSON.stringify(r.data)).toBe(200);
    expect(r.data.quest).toMatchObject({ xp: 55, sparks: 30 });
    const other = await S.content_editor.aal2(`/api/admin/events/${e.id}`, {
      method: "PATCH",
      json: { id: "00000000-0000-4000-8000-000000000000", quest: edited },
    });
    expect(other.data.error).toBe("id_mismatch");
    const tooRich = await S.content_editor.aal2(`/api/admin/events/${e.id}`, { method: "PATCH", json: { quest: { ...quest, xp: 5000 } } });
    expect(tooRich.status).toBe(400);
  });

  it("audits create, edit and delete, and lists pages", async () => {
    const e = await create();
    expect(await lastAudit(S.content_editor.userId, "event.create", `event:${e.id}`)).toBeTruthy();
    const r = await S.content_editor.aal2(`/api/admin/events/${e.id}`, { method: "PATCH", json: { banner: "New banner copy." } });
    expect(r.data.banner).toBe("New banner copy.");
    const upd = await lastAudit(S.content_editor.userId, "event.update", `event:${e.id}`);
    expect(upd?.detail).toMatchObject({ before: { banner: expect.any(String) }, after: { banner: "New banner copy." } });
    expect((await S.content_editor.aal2(`/api/admin/events/${e.id}`, { method: "DELETE" })).status).toBe(200);
    expect(await lastAudit(S.content_editor.userId, "event.delete", `event:${e.id}`)).toBeTruthy();
    expect((await S.content_editor.aal2(`/api/admin/events/${e.id}`, { method: "DELETE" })).status).toBe(404);

    const page = await S.analyst.aal2("/api/admin/events?page=1&pageSize=10");
    expect(page.data).toMatchObject({ page: 1, pageSize: 10 });
    expect(page.data.rows.length).toBeLessThanOrEqual(10);
    expect(page.data.rows[0]).toHaveProperty("status");
    expect((await S.analyst.aal2("/api/admin/events?pageSize=7")).data.error).toBe("bad_page");
  });
});

describe("player side", () => {
  it("serves the live event (latest start wins), never upcoming or ended ones", async () => {
    // An ended event (the API refuses to create one that is already over, so it goes straight in).
    const { data: ended } = await admin()
      .from("events")
      .insert({ ...pick(event()), starts_at: iso(-90 * MIN), ends_at: iso(-60 * MIN) })
      .select("id")
      .single();
    made.push(ended!.id);
    const older = await create({ startsAt: iso(-30 * MIN) });
    await create({ name: uniq("Upcoming "), startsAt: iso(30 * MIN), endsAt: iso(90 * MIN) });
    const newest = await create({ startsAt: iso(-10_000) });
    const r = await fetch(`${BASE}/api/v1/events/current`).then((x) => x.json());
    expect(r.event).toMatchObject({ id: newest.id, accent: "gold", quest: { id: `ev-${newest.id}`, target: 2 } });
    expect(r.event.id).not.toBe(older.id);
  });

  it("counts free-play clears toward the bonus quest, and pays the claim once", async () => {
    const e = await create({ startsAt: iso(-5_000) });
    const g = await guest(uniq("ev_"));
    const q0 = await g.api("/api/v1/quests");
    expect(q0.data.event).toMatchObject({ id: `ev-${e.id}`, kind: "event", progress: 0, target: 2, event: { id: e.id } });
    expect((await g.api(`/api/v1/quests/ev-${e.id}/claim`, { method: "POST" })).status).toBe(409);

    await freeClear(g);
    expect((await g.api("/api/v1/quests")).data.event).toMatchObject({ progress: 1, completed: false });
    const fin = await freeClear(g);
    expect(fin.unlocks?.some((u) => u.type === "quest" && u.id === `ev-${e.id}`)).toBe(true);
    expect((await g.api("/api/v1/quests")).data.event).toMatchObject({ progress: 2, completed: true, claimed: false });

    const c1 = await g.api(`/api/v1/quests/ev-${e.id}/claim`, { method: "POST" });
    expect(c1.data).toMatchObject({ xp: 40, already: false });
    expect(c1.data.sparks).toBeGreaterThanOrEqual(25);
    const c2 = await g.api(`/api/v1/quests/ev-${e.id}/claim`, { method: "POST" });
    expect(c2.data).toMatchObject({ xp: 0, sparks: 0, already: true });
    expect((await g.api("/api/v1/quests")).data.event.claimed).toBe(true);
  });

  it("shows, counts and pays nothing while features.seasonal is off", async () => {
    const e = await create({ startsAt: iso(-2_000) });
    const g = await guest(uniq("evoff_"));
    await setSetting("features.seasonal", false);
    try {
      expect((await fetch(`${BASE}/api/v1/events/current`).then((x) => x.json())).event).toBeNull();
      expect((await g.api("/api/v1/quests")).data.event).toBeNull();
      await admin()
        .from("event_progress")
        .insert({ player_id: g.userId, event_id: e.id, progress: 2, target: 2, completed_at: iso(0) });
      expect((await g.api(`/api/v1/quests/ev-${e.id}/claim`, { method: "POST" })).status).toBe(404);
    } finally {
      await setSetting("features.seasonal", true);
    }
  });

  it("does not expose events or others' progress to clients directly (RLS)", async () => {
    const g = await guest(uniq("evrls_"));
    const { data: ev } = await g.sb.from("events").select("id");
    expect(ev ?? []).toEqual([]);
    const { data: pr } = await g.sb.from("event_progress").select("player_id");
    expect((pr ?? []).every((r) => r.player_id === g.userId)).toBe(true);
  });
});
