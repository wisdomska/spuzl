import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, BASE, guest, uniq } from "./helpers";
import { setSetting } from "./setup";
import { adminSession, type AdminSession } from "./admin-helpers";
import { addDays } from "@/lib/admin/dates";
import { GAMES } from "@/lib/catalog";
import { MAX_SCORE, fiveDate, parseSchedule } from "@/lib/daily-five";

/**
 * R2-05 Daily Five through the real API (Dailies off, as in production): the same five for everyone, attempts on the
 * scheduled puzzle, progress, a server-checked finish, the combined score, fast solves flagged (and listed in the
 * moderation queue's Daily Five filter), and the admin scheduler (roles, lock, audit, JSON round trip).
 * Run: API_BASE=http://localhost:<port> pnpm vitest run -c vitest.api.config.mts tests/api/daily-five.test.ts
 */

type Five = {
  enabled: boolean;
  date: string;
  games: { slot: number; world: string; game: string; state: string; points: number; timeMs: number | null }[];
  done: number;
  total: number;
  score: number;
  maxScore: number;
  complete: boolean;
};

const keys = ["features.dailies", "dailyFive.enabled", "dailyFive.resetHour"] as const;
const before: Record<string, unknown> = {};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeAll(async () => {
  const { data } = await admin()
    .from("game_settings")
    .select("key, value")
    .in("key", [...keys]);
  for (const r of data ?? []) before[r.key] = r.value;
  await setSetting("features.dailies", false);
  await setSetting("dailyFive.enabled", true);
  await setSetting("dailyFive.resetHour", 0);
});
afterAll(async () => {
  for (const k of keys)
    if (before[k] === undefined) await admin().from("game_settings").delete().eq("key", k);
    else await setSetting(k, before[k]);
  // The shared setup puts Dailies back on for the other files.
  await setSetting("features.dailies", true);
});

/**
 * Puts Crownfall (a game the test can solve) in today's Puzzles slot, on a board made from a known seed, so the
 * finish below sends a real solution. Only the test database is touched.
 */
async function crownfallToday(date: string): Promise<{ size: number; solution: number[] }> {
  const db = admin();
  const { generate } = await import("@/games/crownfall/logic");
  const { createRng } = await import("@/lib/rng");
  const seed = `five:crownfall:${date}:apitest`;
  const g = generate(createRng(seed), "easy");
  const { data: pz, error } = await db
    .from("puzzles")
    .upsert(
      {
        game_id: "crownfall",
        seed,
        difficulty: "easy",
        grade: g.grade,
        data: g.puzzle,
        solution: g.solution,
        solution_hash: seed,
        status: "scheduled",
      },
      { onConflict: "game_id,seed,difficulty" },
    )
    .select("id")
    .single();
  if (error) throw error;
  const { data: rows } = await db.from("daily_five").select("slot, game_id, world").eq("date", date).order("slot");
  const has = rows?.find((r) => r.game_id === "crownfall");
  const slot = has?.slot ?? rows!.find((r) => r.world === "logic")!.slot;
  // Unlock first in case an earlier run locked the day, then point the slot at the known board.
  await db.from("daily_five").update({ locked: false }).eq("date", date);
  const { error: e2 } = await db.from("daily_five").update({ game_id: "crownfall", puzzle_id: pz!.id }).eq("date", date).eq("slot", slot);
  if (e2) throw e2;
  return { size: g.puzzle.size, solution: g.solution };
}

const crownState = (b: { size: number; solution: number[] }) => {
  const s = new Array(b.size * b.size).fill(0);
  b.solution.forEach((c, r) => (s[r * b.size + c] = 2));
  return s;
};

describe("api: Daily Five", () => {
  it("serves the same five to two players and to a visitor", async () => {
    const a = await guest(uniq("d5a_"));
    const b = await guest(uniq("d5b_"));
    const ra = await a.api("/api/v1/daily-five");
    const rb = await b.api("/api/v1/daily-five");
    const anon = (await fetch(`${BASE}/api/v1/daily-five`).then((r) => r.json())) as Five;
    expect(ra.status).toBe(200);
    const fa = ra.data as Five;
    expect(fa.enabled).toBe(true);
    expect(fa.date).toBe(fiveDate(new Date(), 0));
    expect(fa.total).toBe(5);
    expect(fa.maxScore).toBe(MAX_SCORE);
    const ids = (f: Five) => f.games.map((g) => [g.slot, g.game]);
    expect(ids(rb.data)).toEqual(ids(fa));
    expect(ids(anon)).toEqual(ids(fa));
    // One per visible world, then a bonus; every game is live.
    expect(fa.games.slice(0, 4).map((g) => g.world)).toEqual(["logic", "word", "reflex", "board"]);
    for (const g of fa.games) expect(GAMES.some((x) => x.id === g.game)).toBe(true);
    expect(fa.games.every((g) => g.state === "new" && g.points === 0)).toBe(true);
    expect(fa.score).toBe(0);
  });

  it("plays on the scheduled puzzle, the same for everyone, and refuses games outside the five", async () => {
    const a = await guest(uniq("d5p_"));
    const b = await guest(uniq("d5q_"));
    const five = (await a.api("/api/v1/daily-five")).data as Five;
    const game = five.games[1].game;
    const sa = await a.api("/api/v1/attempts", { json: { game, mode: "five" } });
    const sb = await b.api("/api/v1/attempts", { json: { game, mode: "five" } });
    expect([sa.status, sb.status]).toEqual([200, 200]);
    expect(sa.data).toMatchObject({ five: true, date: five.date });
    expect(JSON.stringify(sa.data)).not.toContain("solution");
    const { data: rows } = await admin()
      .from("attempts")
      .select("puzzle_id, mode, daily_date, daily_five")
      .in("id", [sa.data.attemptId, sb.data.attemptId]);
    const { data: slot } = await admin().from("daily_five").select("puzzle_id").eq("date", five.date).eq("game_id", game).single();
    expect(rows).toHaveLength(2);
    for (const r of rows!) expect(r).toEqual({ puzzle_id: slot!.puzzle_id, mode: "daily", daily_date: five.date, daily_five: true });
    // Starting again resumes the same attempt (one go per game per day).
    const again = await a.api("/api/v1/attempts", { json: { game, mode: "five" } });
    expect(again.data).toMatchObject({ attemptId: sa.data.attemptId, resumed: true });
    // A game not in today's five is refused, and Dailies (off) stay refused.
    const outside = GAMES.find((g) => !five.games.some((x) => x.game === g.id))!.id;
    const no = await a.api("/api/v1/attempts", { json: { game: outside, mode: "five" } });
    expect([no.status, no.data?.error]).toEqual([404, "not_in_daily_five"]);
    const daily = await a.api("/api/v1/attempts", { json: { game, mode: "daily" } });
    expect([daily.status, daily.data?.error]).toEqual([404, "dailies_off"]);
  });

  it("records progress, a server-checked finish and the combined score, and keeps the streak", async () => {
    const g = await guest(uniq("d5f_"));
    const date = ((await g.api("/api/v1/daily-five")).data as Five).date;
    const board = await crownfallToday(date);
    const start = await g.api("/api/v1/attempts", { json: { game: "crownfall", mode: "five" } });
    expect(start.status).toBe(200);
    await wait(6500); // above Crownfall's human floor in wall time
    const fin = await g.api(`/api/v1/attempts/${start.data.attemptId}/finish`, {
      json: { state: crownState(board), activeMs: 6200, mistakes: 0 },
    });
    expect(fin.status).toBe(200);
    expect(fin.data).toMatchObject({ ok: true, status: "cleared" });
    expect(fin.data.streak.current).toBeGreaterThanOrEqual(1);
    expect(fin.data.dailyFive).toMatchObject({ done: 1, total: 5, complete: false });
    expect(fin.data.dailyFive.score).toBeGreaterThan(100);
    expect(fin.data.dailyFive.next.game).not.toBe("crownfall");
    // A second finish is refused; the game cannot be started again today.
    expect(
      (await g.api(`/api/v1/attempts/${start.data.attemptId}/finish`, { json: { state: crownState(board), activeMs: 6200 } })).status,
    ).toBe(409);
    expect((await g.api("/api/v1/attempts", { json: { game: "crownfall", mode: "five" } })).data?.error).toBe("daily_done");

    const view = (await g.api("/api/v1/daily-five")).data as Five;
    const cf = view.games.find((x) => x.game === "crownfall")!;
    expect(cf).toMatchObject({ state: "cleared", timeMs: 6200 });
    expect(cf.points).toBe(fin.data.dailyFive.score);
    expect(view).toMatchObject({ done: 1, score: cf.points, complete: false });

    // The other four: started and finished through the API with an empty board, which the server verifies as a
    // miss (the test cannot solve every game). Each one still counts as played.
    const rest = view.games.filter((x) => x.game !== "crownfall");
    for (const [i, x] of rest.entries()) {
      const s = await g.api("/api/v1/attempts", { json: { game: x.game, mode: "five" } });
      expect(s.status, x.game).toBe(200);
      const f = await g.api(`/api/v1/attempts/${s.data.attemptId}/finish`, { json: { state: null, activeMs: 30_000, mistakes: 0 } });
      expect([x.game, f.status, f.data.ok]).toEqual([x.game, 200, false]);
      expect(f.data.dailyFive).toMatchObject({ done: 2 + i, complete: i === rest.length - 1 });
    }
    const done = (await g.api("/api/v1/daily-five")).data as Five;
    expect(done).toMatchObject({ done: 5, total: 5, complete: true, score: cf.points });
    expect(done.games.filter((x) => x.state === "failed")).toHaveLength(4);
  });

  it("flags a fast solve like any Daily and lists it under the Daily Five filter in moderation", async () => {
    const g = await guest(uniq("d5x_"));
    const date = ((await g.api("/api/v1/daily-five")).data as Five).date;
    const board = await crownfallToday(date);
    const s = await g.api("/api/v1/attempts", { json: { game: "crownfall", mode: "five" } });
    const fin = await g.api(`/api/v1/attempts/${s.data.attemptId}/finish`, {
      json: { state: crownState(board), activeMs: 900, mistakes: 0 },
    });
    expect(fin.data.status).toBe("flagged");
    expect(fin.data.reward.xp).toBe(0);
    const { data: row } = await admin().from("attempts").select("status, daily_five, flag_reason").eq("id", s.data.attemptId).single();
    expect(row).toMatchObject({ status: "flagged", daily_five: true });
    expect(row!.flag_reason).toMatch(/below human floor/);
    // Flagged earns no points until a moderator clears it.
    const view = (await g.api("/api/v1/daily-five")).data as Five;
    expect(view.games.find((x) => x.game === "crownfall")).toMatchObject({ state: "flagged", points: 0 });

    const mod = await adminSession("moderator");
    const q = await mod.aal2("/api/admin/moderation?tab=flagged&five=1&pageSize=100");
    expect(q.status).toBe(200);
    expect(q.data.rows.some((r: { id: string; title: string }) => r.id === s.data.attemptId && /Daily Five/.test(r.title))).toBe(true);
    // A flagged free-play clear is not in the Daily Five filter.
    const all = await mod.aal2("/api/admin/moderation?tab=flagged&pageSize=100");
    expect(all.data.total).toBeGreaterThanOrEqual(q.data.total);
  });

  it("refuses Daily Five play while it is switched off", async () => {
    const g = await guest(uniq("d5o_"));
    await setSetting("dailyFive.enabled", false);
    try {
      expect(((await g.api("/api/v1/daily-five")).data as Five).enabled).toBe(false);
      const r = await g.api("/api/v1/attempts", { json: { game: "crownfall", mode: "five" } });
      expect([r.status, r.data?.error]).toEqual([404, "daily_five_off"]);
    } finally {
      await setSetting("dailyFive.enabled", true);
    }
  });
});

describe("api: Daily Five scheduler (admin)", () => {
  let editor: AdminSession;
  let analyst: AdminSession;
  beforeAll(async () => {
    editor = await adminSession("content_editor");
    analyst = await adminSession("analyst");
  }, 60_000);

  it("previews days ahead, lets editors pick, lock and re-pick, and audits every action", async () => {
    const today = fiveDate(new Date(), 0);
    const day = addDays(today, 20);
    await admin().from("daily_five").update({ locked: false }).eq("date", day); // a rerun starts from an open day
    const view = await analyst.aal2(`/api/admin/daily-five?from=${day}&days=3`);
    expect(view.status).toBe(200);
    expect(view.data.days).toHaveLength(3);
    // Analysts read but cannot change the schedule.
    expect((await analyst.aal2("/api/admin/daily-five", { json: { action: "lock", date: day, locked: true } })).status).toBe(403);

    const games = view.data.games.slice(0, 5).map((g: { id: string }) => g.id);
    const pick = await editor.aal2("/api/admin/daily-five", { json: { action: "manual", date: day, games } });
    expect(pick.status).toBe(200);
    expect(pick.data.after).toEqual(games);
    const lock = await editor.aal2("/api/admin/daily-five", { json: { action: "lock", date: day, locked: true } });
    expect(lock.data.slots).toBe(5);
    // Locked: the auto-pick and the scheduler never change it.
    const repick = await editor.aal2("/api/admin/daily-five", { json: { action: "auto", date: day } });
    expect([repick.status, repick.data?.error]).toEqual([409, "locked"]);
    await editor.aal2("/api/admin/daily-five", { json: { action: "fill" } });
    const { data: rows } = await admin().from("daily_five").select("game_id, locked").eq("date", day).order("slot");
    expect(rows!.map((r) => r.game_id)).toEqual(games);
    expect(rows!.every((r) => r.locked)).toBe(true);
    // The database refuses a change to a locked day too.
    const { error } = await admin().from("daily_five").update({ game_id: "dusk" }).eq("date", day).eq("slot", 1);
    expect(error).not.toBeNull();

    const { data: log } = await admin()
      .from("audit_log")
      .select("action, target")
      .eq("actor_id", editor.userId)
      .in("action", ["daily_five.manual_pick", "daily_five.lock", "daily_five.fill"]);
    expect(new Set(log!.map((l) => l.action))).toEqual(new Set(["daily_five.manual_pick", "daily_five.lock", "daily_five.fill"]));

    await editor.aal2("/api/admin/daily-five", { json: { action: "lock", date: day, locked: false } });
    const auto = await editor.aal2("/api/admin/daily-five", { json: { action: "auto", date: day } });
    expect(auto.status).toBe(200);
    // Past days never change.
    const past = await editor.aal2("/api/admin/daily-five", { json: { action: "auto", date: addDays(today, -1) } });
    expect(past.data?.error).toBe("past_day");
  });

  it("exports the schedule as JSON and imports it back unchanged", async () => {
    const today = fiveDate(new Date(), 0);
    const from = addDays(today, 30);
    const games = GAMES.slice(0, 5).map((g) => g.id);
    await admin().from("daily_five").update({ locked: false }).eq("date", from);
    await editor.aal2("/api/admin/daily-five", { json: { action: "manual", date: from, games } });
    const exp = await analyst.aal2(`/api/admin/daily-five/export?from=${from}&to=${addDays(from, 1)}`);
    expect(exp.status).toBe(200);
    const parsed = parseSchedule(exp.data.json, () => true);
    expect(parsed.ok && parsed.days.find((d) => d.date === from)?.games).toEqual(games);

    const dry = await editor.aal2("/api/admin/daily-five/import", { json: { json: exp.data.json, dryRun: true } });
    expect(dry.data.valid).toBeGreaterThanOrEqual(1);
    const imp = await editor.aal2("/api/admin/daily-five/import", { json: { json: exp.data.json } });
    expect(imp.status).toBe(200);
    expect(imp.data.saved).toContain(from);
    const again = await analyst.aal2(`/api/admin/daily-five/export?from=${from}&to=${addDays(from, 1)}`);
    expect(again.data.json).toBe(exp.data.json);

    const bad = await editor.aal2("/api/admin/daily-five/import", {
      json: { json: JSON.stringify({ kind: "daily-five", version: 1, days: [{ date: from, games: ["nope"] }] }) },
    });
    expect([bad.status, bad.data.error]).toEqual([422, "invalid_schedule"]);
    expect(bad.data.errors.length).toBeGreaterThan(0);
  });

  it("shows Daily Five starts, completions and shares on the Metrics page, with CSV", async () => {
    await fetch(`${BASE}/api/v1/metrics`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "daily5_start" }),
    });
    await fetch(`${BASE}/api/v1/metrics`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "daily5_share", kind: "copied" }),
    });
    const owner = await adminSession("owner");
    const m = await owner.aal2("/api/admin/metrics?days=7");
    expect(m.status).toBe(200);
    expect(m.data.total.daily5_starts).toBeGreaterThanOrEqual(1);
    expect(m.data.total.daily5_shares).toBeGreaterThanOrEqual(1);
    expect(m.data.total).toHaveProperty("daily5_completes");
    const csv = await owner.aal2("/api/admin/metrics", { json: { metric: "daily_five", days: 7 } });
    expect(csv.data.csv.split("\r\n")[0]).toBe(
      "date,daily5_start,daily5_complete,daily5_share,completion_pct,share_pct,players,full_fives",
    );
  });
});
