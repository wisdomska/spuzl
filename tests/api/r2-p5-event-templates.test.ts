import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, guest, uniq } from "./helpers";
import { adminSession, type AdminSession } from "./admin-helpers";
import { setSetting } from "./setup";
import { GHANA_HISTORY } from "@/games/quickfire/ghana-history";

/**
 * R2-P5 seasonal templates: one click adds a ready-made event as a draft (audited); drafts never run; Schedule makes
 * it live (audited); the 6 March Quiz features the Ghana history rounds in Quickfire free play while it is live.
 */
const made: string[] = [];
let editor: AdminSession;
let owner: AdminSession;

const lastAudit = async (actor: string, action: string, target: string) =>
  (
    await admin()
      .from("audit_log")
      .select("action, detail")
      .eq("actor_id", actor)
      .eq("action", action)
      .eq("target", target)
      .order("id", { ascending: false })
      .limit(1)
  ).data?.[0];

beforeAll(async () => {
  editor = await adminSession("content_editor");
  owner = await adminSession("owner");
  await setSetting("features.seasonal", true);
}, 120_000);

afterAll(async () => {
  for (const id of made) await owner.aal2(`/api/admin/events/${id}`, { method: "DELETE" });
});

async function addTemplate(template: string) {
  const r = await editor.aal2("/api/admin/events/templates", { json: { template } });
  expect(r.status, JSON.stringify(r.data)).toBe(200);
  made.push(r.data.id);
  return r.data as { id: string; name: string; draft: boolean; quiz: string | null; template: string; starts_at: string; ends_at: string };
}

describe("admin: ready-made seasonal events", () => {
  it("lists the four templates with their next dates", async () => {
    const r = await editor.aal2("/api/admin/events/templates");
    expect(r.data.rows.map((t: { id: string }) => t.id)).toEqual(["detty-december", "exam-season", "afcon-week", "march-sixth"]);
    expect(r.data.rows[0]).toMatchObject({ name: "Detty December", accent: "gold" });
    expect((await (await adminSession("moderator")).aal2("/api/admin/events/templates")).data.error).toBe("forbidden");
  });

  it("adds a template as an audited draft that never runs until scheduled", async () => {
    for (const t of ["detty-december", "exam-season", "afcon-week", "march-sixth"]) {
      const e = await addTemplate(t);
      expect(e).toMatchObject({ draft: true, template: t });
      expect((await lastAudit(editor.userId, "event.template", `event:${e.id}`))?.detail).toMatchObject({ template: t });
    }
    const list = await editor.aal2("/api/admin/events?status=draft&pageSize=50");
    expect(list.data.rows.every((r: { status: string }) => r.status === "draft")).toBe(true);
    expect((await editor.aal2("/api/admin/events/templates", { json: { template: "christmas" } })).status).toBe(400);
  });

  it("keeps a draft dark even inside its dates; Schedule makes it live; Back to draft stops it", async () => {
    const e = await addTemplate("march-sixth");
    const at = (ms: number) => new Date(Date.now() + ms).toISOString();
    const patch = await editor.aal2(`/api/admin/events/${e.id}`, { method: "PATCH", json: { startsAt: at(-1000), endsAt: at(3_600_000) } });
    expect(patch.status, JSON.stringify(patch.data)).toBe(200);
    const g = await guest(uniq("ev_"));
    expect((await g.api("/api/v1/events/current")).data.event?.id).not.toBe(e.id);

    const s = await editor.aal2(`/api/admin/events/${e.id}/schedule`, { json: { scheduled: true } });
    expect(s.data).toMatchObject({ draft: false });
    expect(await lastAudit(editor.userId, "event.schedule", `event:${e.id}`)).toBeTruthy();
    const cur = await g.api("/api/v1/events/current");
    expect(cur.data.event).toMatchObject({ id: e.id, name: "6 March Quiz" });

    // Quickfire free play serves the Ghana history rounds while it is live.
    const q = await g.api("/api/v1/attempts", { json: { game: "quickfire", mode: "free", difficulty: "easy" } });
    expect(q.status, JSON.stringify(q.data)).toBe(200);
    const texts = GHANA_HISTORY.map((x) => x.q);
    // R4-23: a scored board carries no questions; each comes on its open. The first is a Ghana history round.
    const open = await g.api("/api/games/quickfire/guess", { json: { ref: q.data.puzzle.ref, guess: { q: 0, open: true } } });
    expect(open.status, JSON.stringify(open.data)).toBe(200);
    expect(texts).toContain((open.data.question as { q: string }).q);
    const { data: att } = await admin().from("attempts").select("free_seed").eq("id", q.data.attemptId).single();
    expect(att!.free_seed).toMatch(/^quiz:ghana-1957:/);

    const back = await editor.aal2(`/api/admin/events/${e.id}/schedule`, { json: { scheduled: false } });
    expect(back.data.draft).toBe(true);
    expect(await lastAudit(editor.userId, "event.unschedule", `event:${e.id}`)).toBeTruthy();
    expect((await g.api("/api/v1/events/current")).data.event?.id).not.toBe(e.id);
    const after = await g.api("/api/v1/attempts", { json: { game: "quickfire", mode: "free", difficulty: "easy" } });
    const { data: att2 } = await admin().from("attempts").select("free_seed").eq("id", after.data.attemptId).single();
    expect(att2!.free_seed).not.toMatch(/^quiz:/);
  });

  it("refuses to schedule an event that would already be over", async () => {
    const e = await addTemplate("afcon-week");
    await admin()
      .from("events")
      .update({ starts_at: new Date(Date.now() - 3 * 86_400_000).toISOString(), ends_at: new Date(Date.now() - 86_400_000).toISOString() })
      .eq("id", e.id);
    const r = await editor.aal2(`/api/admin/events/${e.id}/schedule`, { json: { scheduled: true } });
    expect(r.status).toBe(422);
  });

  it("shows nothing on Home with seasonal on and no live event", async () => {
    const g = await guest(uniq("ev_"));
    const r = await g.api("/api/v1/events/current");
    expect(r.status).toBe(200);
    // Either a live scheduled event from another suite, or null: never a draft.
    if (r.data.event) {
      const { data } = await admin().from("events").select("draft").eq("id", r.data.event.id).single();
      expect(data!.draft).toBe(false);
    }
  });
});
