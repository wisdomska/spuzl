import { afterAll, describe, expect, it } from "vitest";
import { admin, BASE, guest, uniq } from "./helpers";
import { setSetting } from "./setup";

/** Share card images (FR-RS-03): sizes, content type, and that only server data reaches the card. */

async function png(path: string) {
  const res = await fetch(BASE + path);
  const buf = Buffer.from(await res.arrayBuffer());
  const isPng = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return {
    status: res.status,
    type: res.headers.get("content-type"),
    cache: res.headers.get("cache-control"),
    width: isPng ? buf.readUInt32BE(16) : 0,
    height: isPng ? buf.readUInt32BE(20) : 0,
    buf,
  };
}

async function clearCrownfallDaily() {
  const g = await guest(uniq("og_"));
  const s = await g.api("/api/v1/attempts", { json: { game: "crownfall", mode: "daily" } });
  expect(s.status).toBe(200);
  const { data: att } = await admin().from("attempts").select("puzzle_id").eq("id", s.data.attemptId).single();
  const { data: pz } = await admin().from("puzzles").select("solution").eq("id", att!.puzzle_id).single();
  const n = s.data.puzzle.size;
  const state = new Array(n * n).fill(0);
  (pz!.solution as number[]).forEach((c, r) => (state[r * n + c] = 2));
  return { g, attemptId: s.data.attemptId as string, state };
}

describe("api: share card images", () => {
  it("renders every frame at its designed size as PNG", async () => {
    for (const kind of ["daily", "full", "duel", "party"]) {
      const story = await png(`/api/og/sample/${kind}`);
      expect(story).toMatchObject({ status: 200, type: "image/png", width: 1080, height: 1920 });
      const square = await png(`/api/og/sample/${kind}?format=square`);
      expect(square).toMatchObject({ status: 200, type: "image/png", width: 1080, height: 1080 });
    }
    expect(await png("/api/og/sample/daily?size=small")).toMatchObject({ width: 540, height: 960 });
  });

  it("404s unknown, malformed and unfinished ids", async () => {
    for (const p of ["/api/og/daily/nope", "/api/og/daily/00000000-0000-4000-8000-000000000000", "/api/og/match/xyz"]) {
      expect((await png(p)).status).toBe(404);
    }
    const { attemptId } = await clearCrownfallDaily(); // started, not finished
    expect((await png(`/api/og/daily/${attemptId}`)).status).toBe(404);
  });

  it("draws a cleared Daily from the attempt and ignores query-string scores", async () => {
    const { g, attemptId, state } = await clearCrownfallDaily();
    await new Promise((r) => setTimeout(r, 6500)); // above the human floor in wall time
    const fin = await g.api(`/api/v1/attempts/${attemptId}/finish`, { json: { state, activeMs: 6200, mistakes: 0 } });
    expect(fin.data.status).toBe("cleared");

    const story = await png(`/api/og/daily/${attemptId}`);
    expect(story).toMatchObject({ status: 200, type: "image/png", width: 1080, height: 1920 });
    expect(story.cache).toContain("public");
    expect(await png(`/api/og/daily/${attemptId}?format=square`)).toMatchObject({ width: 1080, height: 1080 });

    const forged = await png(`/api/og/daily/${attemptId}?time=0:01&timeMs=1000&big=0:01&streak=999&percentile=100&line=hacked`);
    expect(forged.status).toBe(200);
    expect(forged.buf.equals(story.buf)).toBe(true);

    // One Daily is not a Full Spuzl.
    expect((await png(`/api/og/full/${attemptId}`)).status).toBe(404);
  });

  it("refuses flagged clears", async () => {
    const { g, attemptId, state } = await clearCrownfallDaily();
    const fin = await g.api(`/api/v1/attempts/${attemptId}/finish`, { json: { state, activeMs: 900, mistakes: 0 } });
    expect(fin.data.status).toBe("flagged");
    expect((await png(`/api/og/daily/${attemptId}`)).status).toBe(404);
  });

  it("draws Duel wins and Party podiums from match rows", async () => {
    const a = await guest(uniq("ogd_"));
    const b = await guest(uniq("ogd_"));
    const c = await guest(uniq("ogd_"));
    const db = admin();
    const { data: duel } = await db
      .from("matches")
      .insert({ kind: "duel", game_id: "sixer", status: "finished", round: 3, best_of: 3, winner_id: a.userId })
      .select("id")
      .single();
    await db.from("match_players").insert([
      { match_id: duel!.id, player_id: a.userId, rounds_won: 2, rating_before: 1420, rating_after: 1438 },
      { match_id: duel!.id, player_id: b.userId, rounds_won: 1, rating_before: 1400, rating_after: 1382 },
    ]);
    expect(await png(`/api/og/match/${duel!.id}`)).toMatchObject({ status: 200, type: "image/png", width: 1080, height: 1920 });
    expect(await png(`/api/og/match/${duel!.id}?format=square`)).toMatchObject({ width: 1080, height: 1080 });

    const code = Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
    const { data: race } = await db
      .from("matches")
      .insert({ kind: "race", code, status: "finished", round: 3, best_of: 3, winner_id: c.userId, mix: true })
      .select("id")
      .single();
    await db.from("match_players").insert([
      { match_id: race!.id, player_id: c.userId, place: 1 },
      { match_id: race!.id, player_id: a.userId, place: 2 },
      { match_id: race!.id, player_id: b.userId, place: 3 },
    ]);
    const winner = await png(`/api/og/match/${race!.id}`);
    expect(winner).toMatchObject({ status: 200, width: 1080, height: 1920 });
    const second = await png(`/api/og/match/${race!.id}?p=${a.userId}`);
    expect(second.status).toBe(200);
    expect(second.buf.equals(winner.buf)).toBe(false); // "2nd", not "1st"

    // Unfinished matches have no card.
    const { data: live } = await db.from("matches").insert({ kind: "duel", status: "playing" }).select("id").single();
    expect((await png(`/api/og/match/${live!.id}`)).status).toBe(404);
  });
});

describe("api: status share cards (features.statusCards)", () => {
  afterAll(() => setSetting("features.statusCards", false));

  it("renders the design sample at 1080 × 1350", async () => {
    expect(await png("/api/og/sample/status")).toMatchObject({ status: 200, type: "image/png", width: 1080, height: 1350 });
  });

  it("is refused while the setting is off, card and link alike", async () => {
    await setSetting("features.statusCards", true);
    const g = await guest(uniq("st_"));
    const on = await g.api("/api/v1/me/status-card");
    expect(on.status).toBe(200);
    await setSetting("features.statusCards", false);
    expect((await g.api("/api/v1/me/status-card")).status).toBe(404);
    expect((await png(on.data.image)).status).toBe(404);
  });

  it("renders 1080 × 1350 from live rows, behind a signed link", async () => {
    await setSetting("features.statusCards", true);
    const g = await guest(uniq("st_"));
    await admin().from("players").update({ hat: "crown", level: 7 }).eq("id", g.userId);
    const r = await g.api("/api/v1/me/status-card");
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ width: 1080, height: 1350 });
    expect(r.data.image).toMatch(new RegExp(`^/api/og/status/${g.userId}\\.[A-Za-z0-9_-]+$`));
    expect(r.data.text).toContain("Lv 7");
    expect(r.data.text).toContain("spuzl.gg");
    expect(await png(r.data.image)).toMatchObject({ status: 200, type: "image/png", width: 1080, height: 1350 });
    expect(await png(`${r.data.image}?size=small`)).toMatchObject({ width: 540, height: 675 });
    // A bare player id, or someone else's id under this signature, is not a card.
    expect((await png(`/api/og/status/${g.userId}`)).status).toBe(404);
    const other = await guest(uniq("st_"));
    expect((await png(r.data.image.replace(g.userId, other.userId))).status).toBe(404);
    expect((await fetch(`${BASE}/api/v1/me/status-card`)).status).toBe(401);
  });

  it("follows the privacy rules: no level under 16, no streak or world while activity is hidden, never the city", async () => {
    await setSetting("features.statusCards", true);
    const g = await guest();
    await g.api("/api/v1/profile", { json: { nickname: uniq("sty_"), ageBand: "13-15", color: "#FF8A3D" } });
    await admin().from("players").update({ city: "Kumasi", hide_activity: true }).eq("id", g.userId);
    await admin().from("streaks").update({ current: 9 }).eq("player_id", g.userId);
    const r = await g.api("/api/v1/me/status-card");
    expect(r.status).toBe(200);
    expect(r.data.text).not.toMatch(/Lv |🔥|Kumasi|Favourite/);
    expect(r.data.alt).not.toMatch(/Level|Streak|Kumasi|Rank/);
    expect((await png(r.data.image)).status).toBe(200);
  });
});
