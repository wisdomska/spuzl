import { beforeAll, describe, expect, it } from "vitest";
import { admin } from "./helpers";
import { adminSession, type AdminSession } from "./admin-helpers";

/**
 * Round 4 admin content items through the real API:
 * - R4-14 Rebuild upcoming days (roles, shape, audit)
 * - R4-15 an approved Quads item joins and leaves free play in one click (audited; drafts refused)
 * - R4-16 the Quads pack export is built on the server and writes an audit row
 * Run: API_BASE=http://localhost:<port> pnpm vitest run -c vitest.api.config.mts tests/api/r4-admin-content.test.ts
 */

let editor: AdminSession;
let reviewer: AdminSession;
let analyst: AdminSession;

const QUADS = {
  groups: [
    { label: "Fruits", words: ["MANGO", "PAWPAW", "ORANGE", "PEAR"] },
    { label: "Colours", words: ["RED", "BLUE", "GREEN", "PINK"] },
    { label: "Days", words: ["MONDAY", "FRIDAY", "SUNDAY", "TUESDAY"] },
    { label: "Planets", words: ["MARS", "VENUS", "SATURN", "EARTH"] },
  ],
};

async function lastAudit(actor: string, action: string) {
  const { data } = await admin()
    .from("audit_log")
    .select("action, target, detail")
    .eq("actor_id", actor)
    .eq("action", action)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

beforeAll(async () => {
  [editor, reviewer, analyst] = await Promise.all([adminSession("content_editor"), adminSession("owner"), adminSession("analyst")]);
});

describe("R4-16 Quads pack export", () => {
  it("is built on the server and audited", async () => {
    const r = await editor.aal2("/api/admin/content/export?game=quads&status=approved");
    expect(r.status).toBe(200);
    expect(r.data.filename).toBe("spuzl-quads-approved.json");
    expect(JSON.parse(r.data.json)).toMatchObject({ app: "spuzl", kind: "quads", version: 1 });
    const a = await lastAudit(editor.userId, "content.export");
    expect(a?.detail).toMatchObject({ game: "quads", status: "approved", count: r.data.count });
  });

  it("refuses other games, bad filters and roles without content access", async () => {
    expect((await editor.aal2("/api/admin/content/export?game=coil")).status).toBe(400);
    expect((await editor.aal2("/api/admin/content/export?game=quads&status=nope")).status).toBe(400);
    expect((await analyst.aal2("/api/admin/content/export?game=quads")).status).toBe(403);
  });
});

describe("R4-15 Quads free-play pool", () => {
  it("adds an approved item in one click and takes it out again, audited; a draft is refused", async () => {
    const db = admin();
    const { data: items, error } = await db
      .from("content_items")
      .insert([
        { game_id: "quads", payload: QUADS, author_id: editor.userId, reviewer_id: reviewer.userId, status: "approved", source: "editor" },
        { game_id: "quads", payload: QUADS, author_id: editor.userId, status: "draft", source: "editor" },
      ])
      .select("id, status");
    if (error) throw error;
    const approved = items!.find((i) => i.status === "approved")!.id;
    const draft = items!.find((i) => i.status === "draft")!.id;

    const on = await editor.aal2(`/api/admin/content/${approved}/pool`, { json: { pooled: true } });
    expect(on.status).toBe(200);
    expect(on.data.pooled_at).toBeTruthy();
    expect((await lastAudit(editor.userId, "content.pool"))?.target).toBe(`content:${approved}`);

    expect((await editor.aal2(`/api/admin/content/${draft}/pool`, { json: { pooled: true } })).status).toBe(409);
    expect((await analyst.aal2(`/api/admin/content/${approved}/pool`, { json: { pooled: false } })).status).toBe(403);

    const off = await editor.aal2(`/api/admin/content/${approved}/pool`, { json: { pooled: false } });
    expect(off.status).toBe(200);
    expect(off.data.pooled_at).toBeNull();
    expect((await lastAudit(editor.userId, "content.unpool"))?.target).toBe(`content:${approved}`);
    await db.from("content_items").delete().in("id", [approved, draft]);
  });
});

describe("R4-14 Rebuild upcoming days", () => {
  it("rebuilds a content game's upcoming days and audits what it did", async () => {
    const r = await editor.aal2("/api/admin/content/rebuild", { json: { game: "quads" } });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ game: "quads", dailies: { rebuilt: expect.any(Array) }, five: { rebuilt: expect.any(Array) } });
    const a = await lastAudit(editor.userId, "content.rebuild_upcoming");
    expect(a?.target).toBe("game:quads");
    // Nothing changed is listed as changed: a second run finds every board the same.
    const again = await editor.aal2("/api/admin/content/rebuild", { json: { game: "quads" } });
    expect(again.data.dailies.rebuilt).toEqual([]);
    expect(again.data.five.rebuilt).toEqual([]);
  });

  it("is for content games and calendar editors only", async () => {
    expect((await editor.aal2("/api/admin/content/rebuild", { json: { game: "crownfall" } })).status).toBe(404);
    expect((await analyst.aal2("/api/admin/content/rebuild", { json: { game: "quads" } })).status).toBe(403);
  });
});
