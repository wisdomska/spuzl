import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, guest, uniq } from "./helpers";
import { adminSession, type AdminSession } from "./admin-helpers";
import { setSetting } from "./setup";
import { clearCrownfall } from "./r2-p5-helpers";

/**
 * R2-P5 school and campus leagues: admins seed and edit schools (audited); players 16 and over find and join one
 * (once a week), under-16s only through a class code; the weekly table shows school names and aggregates only,
 * with small schools left out; the admin table and its audited CSV; the switch "features.schoolLeagues".
 */
let mod: AdminSession;
const schools: string[] = [];

beforeAll(async () => {
  mod = await adminSession("moderator");
  await setSetting("features.schoolLeagues", true);
  await setSetting("schoolLeagues.minPlayers", 3);
}, 120_000);

afterAll(async () => {
  await setSetting("features.schoolLeagues", false);
  if (schools.length) {
    await admin().from("players").update({ school_id: null }).in("school_id", schools);
    await admin().from("schools").delete().in("id", schools);
  }
});

async function seed(name = uniq("Test School "), kind: "school" | "campus" = "school") {
  const r = await mod.aal2("/api/admin/schools", { json: { name, city: "Kumasi", country: "Ghana", kind } });
  expect(r.status, JSON.stringify(r.data)).toBe(200);
  schools.push(r.data.id);
  return r.data as { id: string; name: string; code: string };
}

describe("admin: schools", () => {
  it("seeds a verified school or campus and edits it, both audited", async () => {
    const s = await seed(undefined, "campus");
    expect(s.code).toMatch(/^[2-9A-HJ-NP-Z]{6}$/);
    const { data: row } = await admin().from("schools").select("verified_by, kind").eq("id", s.id).single();
    expect(row).toMatchObject({ verified_by: mod.userId, kind: "campus" });
    const e = await mod.aal2(`/api/admin/schools/${s.id}`, { method: "PATCH", json: { name: `${s.name} Annex`, kind: "school" } });
    expect(e.data).toMatchObject({ name: `${s.name} Annex`, kind: "school" });
    const { data: audit } = await admin().from("audit_log").select("action").eq("target", `school:${s.id}`).order("id");
    expect(audit!.map((a) => a.action)).toEqual(["school.create", "school.update"]);
    expect((await (await adminSession("analyst")).aal2("/api/admin/schools", { json: { name: "Nope School" } })).data.error).toBe(
      "forbidden",
    );
  });
});

describe("api: school leagues", () => {
  it("lets 16+ players find and join a verified school, once a week", async () => {
    const s = await seed();
    const p = await guest(uniq("sl_"), "16-17");
    const found = await p.api(`/api/v1/schools?q=${encodeURIComponent(s.name.slice(-6))}`);
    expect(found.data.rows.map((r: { id: string }) => r.id)).toContain(s.id);
    expect((await p.api("/api/v1/schools/join", { json: { schoolId: s.id } })).data).toEqual({ schoolId: s.id });
    const other = await seed();
    const again = await p.api("/api/v1/schools/join", { json: { schoolId: other.id } });
    expect(again.status).toBe(409);
    expect(again.data.error).toBe("changed_recently");
    const mine = await p.api("/api/v1/schools/league");
    expect(mine.data).toMatchObject({ canSearch: true, mine: { id: s.id, name: s.name } });
  });

  it("refuses under-16s a search or a self-join; a class code is their only way in", async () => {
    const s = await seed();
    const kid = await guest(uniq("sk_"), "13-15");
    const q = await kid.api(`/api/v1/schools?q=${encodeURIComponent(s.name)}`);
    expect(q.status).toBe(403);
    expect(q.data.error).toBe("use_class_code");
    expect((await kid.api("/api/v1/schools/join", { json: { schoolId: s.id } })).data.error).toBe("use_class_code");
    expect((await kid.api("/api/v1/schools/league")).data.canSearch).toBe(false);
  });

  it("ranks schools by the average of their active players, names and aggregates only, small schools left out", async () => {
    const big = await seed();
    const small = await seed();
    const players = await Promise.all([0, 1, 2].map(() => guest(uniq("sp_"))));
    const kid = await guest(uniq("sq_"), "13-15");
    for (const p of players) await admin().from("players").update({ school_id: big.id }).eq("id", p.userId);
    await admin().from("players").update({ school_id: big.id }).eq("id", kid.userId); // as a class code would
    const lone = await guest(uniq("sr_"));
    await admin().from("players").update({ school_id: small.id }).eq("id", lone.userId);
    await Promise.all([...players, kid, lone].map((g) => clearCrownfall("x", g)));

    const t = await players[0].api("/api/v1/schools/league");
    expect(t.status).toBe(200);
    const mine = t.data.rows.find((r: { id: string }) => r.id === big.id);
    expect(mine).toMatchObject({ name: big.name, active: 4, total: 4, average: 1 });
    expect(t.data.rows.some((r: { id: string }) => r.id === small.id)).toBe(false);
    const text = JSON.stringify(t.data.rows);
    for (const g of [...players, kid]) expect(text).not.toContain(g.userId);
    expect(text).not.toMatch(/nickname/);

    const admin_ = await mod.aal2("/api/admin/schools/league");
    expect(admin_.data.rows.find((r: { id: string }) => r.id === big.id)).toMatchObject({ active: 4 });
    const csv = await mod.aal2("/api/admin/schools/league", { json: { week: admin_.data.week } });
    expect(csv.data.filename).toBe(`spuzl-school-league-${admin_.data.week}.csv`);
    expect(csv.data.csv).toContain(big.name);
    const { data: audit } = await admin()
      .from("audit_log")
      .select("action")
      .eq("actor_id", mod.userId)
      .eq("target", `school-league:${admin_.data.week}`);
    expect(audit!.length).toBeGreaterThan(0);
  });

  it("is refused while features.schoolLeagues is off", async () => {
    const p = await guest(uniq("so_"));
    await setSetting("features.schoolLeagues", false);
    try {
      expect((await p.api("/api/v1/schools/league")).data.error).toBe("school_leagues_off");
      expect((await p.api("/api/v1/schools?q=test")).status).toBe(404);
    } finally {
      await setSetting("features.schoolLeagues", true);
    }
  });
});
