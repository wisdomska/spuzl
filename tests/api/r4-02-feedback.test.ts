import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, BASE, guest, uniq } from "./helpers";
import { adminSession, type AdminSession, type Role } from "./admin-helpers";

/**
 * R4-02: feedback from /contact through the real API. Signed out and signed in, validation, the honeypot, the
 * rate limit (5 an hour per player, else per hashed address), the player's own rows in the account export, and the
 * admin Feedback page's list, marks and CSV export by role (emails masked without players.pii). Needs
 * `supabase start` and the dev server (API_BASE).
 * Run: API_BASE=http://localhost:3203 pnpm vitest run -c vitest.api.config.mts tests/api/r4-02-feedback.test.ts
 */

/** A fresh client address per signed-out caller, so each test has its own rate-limit bucket. */
const ip = () => `10.${randomBytes(3).join(".")}`;

async function signedOut(json: unknown, addr = ip(), ua?: string) {
  const res = await fetch(`${BASE}/api/v1/feedback`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": addr, ...(ua ? { "user-agent": ua } : {}) },
    body: JSON.stringify(json),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

const tag = () => `qa-${uniq("fb")}`;
const rowsWith = async (marker: string) =>
  (await admin().from("feedback").select("*").like("message", `%${marker}%`).order("created_at", { ascending: false })).data ?? [];

const created: string[] = [];
afterAll(async () => {
  if (created.length) await admin().from("feedback").delete().in("id", created);
});
const remember = (rows: { id: string }[]) => created.push(...rows.map((r) => r.id));

describe("api: POST /api/v1/feedback (R4-02)", () => {
  it("stores a signed-out message with no player, the sanitised path and a short user agent", async () => {
    const m = tag();
    const r = await signedOut(
      { message: `The timer froze on Crownfall ${m}`, kind: "bug", from: "/games/crownfall?x=1#y", email: "ama@example.com" },
      ip(),
      "UA/".padEnd(400, "x"),
    );
    expect(r.status).toBe(201);
    const [row] = await rowsWith(m);
    remember([row]);
    expect(row).toMatchObject({
      player_id: null,
      age_band: null,
      kind: "bug",
      from_path: "/games/crownfall",
      email: "ama@example.com",
      status: "new",
    });
    expect(row.user_agent.length).toBe(200);
  });

  it("stores a signed-in player's id and age band, never their birth month or year", async () => {
    const g = await guest(uniq("fbin_"), "16-17");
    const m = tag();
    const r = await g.api("/api/v1/feedback", { json: { message: `More word games please ${m}`, kind: "idea", from: "/settings" } });
    expect(r.status).toBe(201);
    const [row] = await rowsWith(m);
    remember([row]);
    expect(row).toMatchObject({ player_id: g.userId, age_band: "16-17", kind: "idea", from_path: "/settings", email: null });
    expect(Object.keys(row)).not.toContain("birth_year");
    expect(Object.keys(row)).not.toContain("birth_month");
  });

  it("defaults the kind, and drops a from that isn't a same-site path", async () => {
    const m = tag();
    expect((await signedOut({ message: `Just saying hello ${m}`, from: "https://evil.example/x" })).status).toBe(201);
    const [row] = await rowsWith(m);
    remember([row]);
    expect(row.kind).toBe("other");
    expect(row.from_path).toBeNull();
  });

  it("refuses bad input with 400", async () => {
    for (const bad of [
      {},
      { message: "too short" },
      { message: "x".repeat(2001) },
      { message: "A perfectly fine message.", email: "not-an-email" },
      { message: "A perfectly fine message.", kind: "rant" },
    ]) {
      const r = await signedOut(bad);
      expect(r.status, JSON.stringify(bad).slice(0, 60)).toBe(400);
    }
    const res = await fetch(`${BASE}/api/v1/feedback`, { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
    expect(res.status).toBe(400);
  });

  it("thanks a filled honeypot and stores nothing", async () => {
    const m = tag();
    const r = await signedOut({ message: `Buy cheap followers now ${m}`, website: "http://spam.example" });
    expect(r.status).toBe(201);
    expect(await rowsWith(m)).toHaveLength(0);
  });

  it("rate limits to 5 an hour per address when signed out, and per player when signed in", async () => {
    const addr = ip();
    const m = tag();
    for (let i = 0; i < 5; i++) expect((await signedOut({ message: `Message number ${i} ${m}` }, addr)).status).toBe(201);
    const sixth = await signedOut({ message: `Message number 6 ${m}` }, addr);
    expect(sixth.status).toBe(429);
    expect(sixth.data.error).toBe("rate_limited");
    // Another address is a separate bucket.
    expect((await signedOut({ message: `From somewhere else ${m}` })).status).toBe(201);

    const g = await guest(uniq("fbrl_"));
    for (let i = 0; i < 5; i++)
      expect((await g.api("/api/v1/feedback", { json: { message: `Signed in number ${i} ${m}` } })).status).toBe(201);
    expect((await g.api("/api/v1/feedback", { json: { message: `Signed in number 6 ${m}` } })).status).toBe(429);
    remember(await rowsWith(m));
  });

  it("includes the player's own feedback in the account export, and nobody else's", async () => {
    const g = await guest(uniq("fbex_"));
    const mine = tag();
    const theirs = tag();
    await g.api("/api/v1/feedback", { json: { message: `My own message ${mine}`, email: "me@example.com" } });
    await signedOut({ message: `Someone else's message ${theirs}` });
    remember([...(await rowsWith(mine)), ...(await rowsWith(theirs))]);
    const r = await g.api("/api/v1/account/export");
    expect(r.status).toBe(200);
    const messages = (r.data.feedback as { message: string }[]).map((f) => f.message).join("\n");
    expect(messages).toContain(mine);
    expect(messages).not.toContain(theirs);
  });

  it("deletes a player's feedback with their account (on delete cascade)", async () => {
    const g = await guest(uniq("fbdel_"));
    const m = tag();
    await g.api("/api/v1/feedback", { json: { message: `Delete me with the account ${m}` } });
    expect(await rowsWith(m)).toHaveLength(1);
    await admin().auth.admin.deleteUser(g.userId);
    expect(await rowsWith(m)).toHaveLength(0);
  });
});

describe("admin: Feedback page (R4-02)", () => {
  const S = {} as Record<Role, AdminSession>;
  let id = "";
  let marker = "";
  beforeAll(async () => {
    for (const r of ["owner", "moderator", "content_editor", "analyst"] as Role[]) S[r] = await adminSession(r);
    marker = tag();
    await signedOut({ message: `Admin view check ${marker}`, kind: "puzzle", email: "kofi.boateng@example.com", from: "/daily" });
    const [row] = await rowsWith(marker);
    remember([row]);
    id = row.id;
  });

  const lastAudit = async (actor: string, action: string) =>
    (
      await admin()
        .from("audit_log")
        .select("action, target, detail")
        .eq("actor_id", actor)
        .eq("action", action)
        .order("id", { ascending: false })
        .limit(1)
    ).data?.[0];

  it("lists newest first with filters, masking the email unless the role holds players.pii", async () => {
    const owner = await S.owner.aal2("/api/admin/feedback?status=new&kind=puzzle&pageSize=100");
    expect(owner.status).toBe(200);
    const o = owner.data.rows.find((r: { id: string }) => r.id === id);
    expect(o).toMatchObject({ email: "kofi.boateng@example.com", emailVisible: true, from_path: "/daily", kind: "puzzle" });
    const times = owner.data.rows.map((r: { created_at: string }) => r.created_at);
    expect([...times].sort().reverse()).toEqual(times);
    for (const role of ["moderator", "content_editor", "analyst"] as Role[]) {
      const r = await S[role].aal2("/api/admin/feedback?status=new&kind=puzzle&pageSize=100");
      expect(r.status, role).toBe(200);
      const row = r.data.rows.find((x: { id: string }) => x.id === id);
      expect(row.email, role).toBe("k•••@•••.com");
      expect(row.emailVisible).toBe(false);
    }
    expect((await S.owner.aal2("/api/admin/feedback?status=open")).status).toBe(400);
    expect((await S.owner.aal2("/api/admin/feedback?kind=idea&pageSize=100")).data.rows.some((r: { id: string }) => r.id === id)).toBe(
      false,
    );
  });

  it("lets owners and moderators mark read and done (audited); content editors and analysts can't", async () => {
    for (const role of ["content_editor", "analyst"] as Role[])
      expect((await S[role].aal2(`/api/admin/feedback/${id}`, { json: { status: "read" } })).status, role).toBe(403);
    expect((await S.moderator.aal2(`/api/admin/feedback/${id}`, { json: { status: "read" } })).status).toBe(200);
    expect((await lastAudit(S.moderator.userId, "feedback.read"))?.target).toBe(`feedback:${id}`);
    expect((await S.owner.aal2(`/api/admin/feedback/${id}`, { json: { status: "done" } })).status).toBe(200);
    const { data } = await admin().from("feedback").select("status, handled_by, handled_at").eq("id", id).single();
    expect(data).toMatchObject({ status: "done", handled_by: S.owner.userId });
    expect(data!.handled_at).toBeTruthy();
    expect((await S.owner.aal2(`/api/admin/feedback/${id}`, { json: { status: "closed" } })).status).toBe(400);
    expect((await S.owner.aal2("/api/admin/feedback/00000000-0000-0000-0000-000000000000", { json: { status: "read" } })).status).toBe(404);
  });

  it("exports CSV for every reading role, masked without players.pii, and audits it", async () => {
    const mod = await S.moderator.aal2("/api/admin/feedback", { json: { status: "done" } });
    expect(mod.status).toBe(200);
    expect(mod.data.csv).toContain(marker);
    expect(mod.data.csv).not.toContain("kofi.boateng@example.com");
    expect((await lastAudit(S.moderator.userId, "feedback.export"))?.detail).toMatchObject({ status: "done", emails: "masked" });
    const owner = await S.owner.aal2("/api/admin/feedback", { json: { status: "done" } });
    expect(owner.data.csv).toContain("kofi.boateng@example.com");
    expect((await S.analyst.aal2("/api/admin/feedback", { json: {} })).status).toBe(200);
  });

  it("shows a New feedback count on the Overview", async () => {
    const r = await S.owner.aal2("/api/admin/overview");
    expect(r.status).toBe(200);
    expect(typeof r.data.newFeedback).toBe("number");
  });
});
