import { describe, expect, it } from "vitest";
import { admin, BASE, guest, uniq } from "./helpers";
import { setSetting } from "./setup";
import { png } from "./r2-p5-helpers";
import { recapWeeks } from "@/lib/recap/weekly";

/**
 * R3-10 weekly recap: GET /api/v1/me/weekly-recap computes last GMT week from existing rows (clears, the fastest
 * timed clear, Sparks earned), hands out a signed 1080 × 1920 card link, and is refused with the admin switch
 * "weeklyRecap.enabled" off. Rows are seeded straight into last week with the service role.
 */
const { recapWeek } = recapWeeks(new Date());
const at = (dayOffset: number, hour = 12) =>
  new Date(Date.parse(`${recapWeek}T00:00:00Z`) + dayOffset * 86_400_000 + hour * 3_600_000).toISOString();

async function seededWeek() {
  const g = await guest(uniq("wr_"));
  const db = admin();
  const { error } = await db.from("attempts").insert([
    { player_id: g.userId, game_id: "crownfall", mode: "free", status: "cleared", started_at: at(0), finished_at: at(0), time_ms: 61_000 },
    { player_id: g.userId, game_id: "crownfall", mode: "free", status: "cleared", started_at: at(3), finished_at: at(3), time_ms: 42_000 },
    // not counted: flagged, tutorial, and a clear this week
    { player_id: g.userId, game_id: "crownfall", mode: "free", status: "flagged", started_at: at(4), finished_at: at(4), time_ms: 3_000 },
    {
      player_id: g.userId,
      game_id: "crownfall",
      mode: "tutorial",
      status: "cleared",
      started_at: at(5),
      finished_at: at(5),
      time_ms: 9_000,
    },
    { player_id: g.userId, game_id: "crownfall", mode: "free", status: "cleared", started_at: at(8), finished_at: at(8), time_ms: 5_000 },
  ]);
  if (error) throw error;
  // Earned, then spent (spending is not subtracted from the week's Sparks).
  for (const [ref, amount, day] of [
    ["a", 25, 1],
    ["b", -10, 2],
  ] as const) {
    const { error: e } = await db
      .from("sparks_ledger")
      .insert({ player_id: g.userId, source: "test", ref_id: `wr-${ref}-${g.userId}`, amount, created_at: at(day) });
    if (e) throw e;
  }
  return g;
}

describe("api: weekly recap", () => {
  it("needs a player", async () => {
    expect((await fetch(`${BASE}/api/v1/me/weekly-recap`)).status).toBe(401);
  });

  it("is empty for a player with nothing last week", async () => {
    const g = await guest(uniq("we_"));
    const r = await g.api("/api/v1/me/weekly-recap");
    expect(r).toMatchObject({ status: 200, data: { week: recapWeek, recap: null, card: null } });
  });

  it("sums up last week from existing rows, with a signed story card", async () => {
    const g = await seededWeek();
    const r = await g.api("/api/v1/me/weekly-recap");
    expect(r.status, JSON.stringify(r.data)).toBe(200);
    expect(r.data.recap).toMatchObject({ week: recapWeek, cleared: 2, best: { game: "crownfall", ms: 42_000 }, sparks: 25 });
    expect(r.data.stats.map((s: { id: string }) => s.id)).toContain("best");
    expect(r.data.card).toMatchObject({ width: 1080, height: 1920 });
    expect(r.data.card.image).toMatch(new RegExp(`^/api/og/recap/${g.userId}\\.${recapWeek.replace(/-/g, "")}\\.[\\w-]+$`));
    expect(r.data.card.text).toMatch(/^My week on SPUZL: 2 games cleared\./);
    expect(await png(r.data.card.image)).toMatchObject({ status: 200, type: "image/png", width: 1080, height: 1920 });
    expect(await png(`${r.data.card.image}?size=small`)).toMatchObject({ width: 540, height: 960 });
    // A link for another week, or an unsigned one, draws nothing.
    expect((await png(r.data.card.image.replace(/\.\d{8}\./, ".20200106."))).status).toBe(404);
    expect((await png(`/api/og/recap/${g.userId}`)).status).toBe(404);
  });

  it("stores nothing new about the player", async () => {
    const g = await seededWeek();
    const before = await admin().from("audit_log").select("id", { count: "exact", head: true }).eq("target", `player:${g.userId}`);
    await g.api("/api/v1/me/weekly-recap");
    const after = await admin().from("audit_log").select("id", { count: "exact", head: true }).eq("target", `player:${g.userId}`);
    expect(after.count).toBe(before.count);
  });

  it("is refused, and its image 404s, with weeklyRecap.enabled off", async () => {
    const g = await seededWeek();
    const r = await g.api("/api/v1/me/weekly-recap");
    await setSetting("weeklyRecap.enabled", false);
    try {
      expect((await g.api("/api/v1/me/weekly-recap")).status).toBe(404);
      expect((await png(r.data.card.image)).status).toBe(404);
    } finally {
      await admin().from("game_settings").delete().eq("key", "weeklyRecap.enabled");
    }
  });

  it("accepts the recap's prompt metrics", async () => {
    const send = (b: unknown) =>
      fetch(`${BASE}/api/v1/metrics`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    expect((await send({ name: "prompt_shown", mode: "weekly_recap", kind: "week" })).status).toBe(204);
    expect((await send({ name: "share", kind: "recap" })).status).toBe(204);
    expect((await send({ name: "prompt_shown", mode: "weekly_recap", kind: "friend" })).status).toBe(400);
  });
});
