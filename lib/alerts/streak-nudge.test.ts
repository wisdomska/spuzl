import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/push/server", () => ({ pushTo: vi.fn(async () => 0) }));
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULTS } from "@/lib/game-settings/schema";
import { inQuietHours, localHour, nudgeMessage, nudgeVerdict, zoneFor, type NudgeCandidate, type NudgeSettings } from "./streak-nudge";
import { runStreakNudge } from "./streak-nudge.server";

const S: NudgeSettings = {
  "streakNudge.enabled": true,
  "streakNudge.hour": 19,
  "streakNudge.minStreak": 2,
  "alerts.quietStart": 22,
  "alerts.quietEnd": 8,
  "alerts.quietStartUnder16": 21,
};
const at = (iso: string) => new Date(iso);
const cand = (over: Partial<NudgeCandidate> = {}): NudgeCandidate => ({
  player_id: "p1",
  country: "GH",
  band: "18+",
  streak: 12,
  freezes: 0,
  ...over,
});

describe("streak nudge: local time", () => {
  it("uses the stored country, GMT when none or unknown", () => {
    expect(zoneFor("GH")).toBe("Africa/Accra");
    expect(zoneFor("ng")).toBe("Africa/Lagos");
    expect(zoneFor(null)).toBe("UTC");
    expect(zoneFor("ZZ")).toBe("UTC");
    const now = at("2026-11-09T19:10:00Z");
    expect(localHour("GH", now)).toBe(19);
    expect(localHour("NG", now)).toBe(20);
    expect(localHour("KE", now)).toBe(22);
    expect(localHour(null, now)).toBe(19);
  });
  it("quiet hours wrap midnight, and equal start and end means none", () => {
    expect(inQuietHours(23, 22, 8)).toBe(true);
    expect(inQuietHours(3, 22, 8)).toBe(true);
    expect(inQuietHours(8, 22, 8)).toBe(false);
    expect(inQuietHours(19, 22, 8)).toBe(false);
    expect(inQuietHours(14, 13, 15)).toBe(true);
    expect(inQuietHours(5, 6, 6)).toBe(false);
  });
});

describe("streak nudge: who gets it", () => {
  const seven = at("2026-11-09T19:05:00Z"); // 19:05 in Accra, 20:05 in Lagos, 22:05 in Nairobi
  it("sends at the local send hour", () => {
    expect(nudgeVerdict(cand(), S, seven)).toBe("send");
    expect(nudgeVerdict(cand({ country: null }), S, seven)).toBe("send");
  });
  it("catches up one hour after a missed run, never later or earlier", () => {
    expect(nudgeVerdict(cand({ country: "NG" }), S, seven)).toBe("send");
    expect(nudgeVerdict(cand(), S, at("2026-11-09T21:00:00Z"))).toBe("not_yet");
    expect(nudgeVerdict(cand(), S, at("2026-11-09T18:59:00Z"))).toBe("not_yet");
  });
  it("needs a streak of at least the minimum (and never below 2)", () => {
    expect(nudgeVerdict(cand({ streak: 1 }), { ...S, "streakNudge.minStreak": 2 }, seven)).toBe("short_streak");
    expect(nudgeVerdict(cand({ streak: 4 }), { ...S, "streakNudge.minStreak": 5 }, seven)).toBe("short_streak");
    expect(nudgeVerdict(cand({ streak: 5 }), { ...S, "streakNudge.minStreak": 5 }, seven)).toBe("send");
  });
  it("never in quiet hours, and under-16s go quiet earlier", () => {
    const late = { ...S, "streakNudge.hour": 21 };
    const nine = at("2026-11-09T21:10:00Z");
    expect(nudgeVerdict(cand(), late, nine)).toBe("send");
    expect(nudgeVerdict(cand({ band: "13-15" }), late, nine)).toBe("quiet");
    expect(nudgeVerdict(cand({ band: "16-17" }), late, nine)).toBe("send");
    expect(nudgeVerdict(cand(), { ...S, "alerts.quietStart": 18 }, seven)).toBe("quiet");
  });
  it("sends nothing while the admin switch is off", () => {
    expect(nudgeVerdict(cand(), { ...S, "streakNudge.enabled": false }, seven)).toBe("off");
  });
  it("ships with defaults that send at 19:00, outside every quiet window", () => {
    const d = DEFAULTS;
    const s: NudgeSettings = {
      "streakNudge.enabled": d["streakNudge.enabled"],
      "streakNudge.hour": d["streakNudge.hour"],
      "streakNudge.minStreak": d["streakNudge.minStreak"],
      "alerts.quietStart": d["alerts.quietStart"],
      "alerts.quietEnd": d["alerts.quietEnd"],
      "alerts.quietStartUnder16": d["alerts.quietStartUnder16"],
    };
    expect(nudgeVerdict(cand({ band: "13-15" }), s, seven)).toBe("send");
  });
  it("says what's at stake, warmly", () => {
    expect(nudgeMessage(12, 0)).toEqual({
      title: "Your 12-day streak needs you",
      body: "Your 12-day streak ends at midnight. One quick game keeps it.",
      url: "/",
      tag: "streak-nudge",
    });
    expect(nudgeMessage(3, 1).body).toMatch(/Freeze can cover you/);
  });
});

/** A fake service-role client: the candidates RPC and an in-memory send log with its primary key. */
function fakeDb(rows: Record<string, unknown>[]) {
  const log = new Map<string, Record<string, unknown>>();
  const db = {
    rpc: vi.fn(async () => ({ data: rows, error: null })),
    from: () => ({
      insert: async (r: Record<string, unknown>) => {
        const k = `${r.player_id}|${r.day}`;
        if (log.has(k)) return { error: { code: "23505" } };
        log.set(k, { ...r, devices: 0 });
        return { error: null };
      },
      update: (u: Record<string, unknown>) => ({
        eq: (_c: string, id: string) => ({
          eq: async (_d: string, day: string) => {
            const k = `${id}|${day}`;
            if (log.has(k)) log.set(k, { ...log.get(k), ...u });
            return { error: null };
          },
        }),
      }),
    }),
  };
  return { db: db as unknown as SupabaseClient, log, rpc: db.rpc };
}

const row = (id: string, over: Record<string, unknown> = {}) => ({
  player_id: id,
  country: "GH",
  age_band: "18+",
  birth_year: 1996,
  birth_month: 1,
  streak: 12,
  freezes: 0,
  ...over,
});

describe("streak nudge job", () => {
  const now = at("2026-11-09T19:05:00Z");
  it("claims before sending, so a second run (or a racing one) never sends twice", async () => {
    const { db, log } = fakeDb([row("a"), row("b", { country: "KE" }), row("c", { streak: 1 })]);
    const send = vi.fn(async () => 1);
    const first = await runStreakNudge(db, S, now, send);
    expect(first).toMatchObject({ day: "2026-11-09", candidates: 3, sent: 1, already: 0 });
    expect(first.skipped).toEqual({ not_yet: 1, short_streak: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]).toEqual([db, "a", nudgeMessage(12, 0)]);
    expect(log.get("a|2026-11-09")).toMatchObject({ devices: 1, streak: 12 });
    const again = await runStreakNudge(db, S, now, send);
    expect(again).toMatchObject({ sent: 0, already: 1 });
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("counts a push no device took as undelivered (devices stay 0)", async () => {
    const { db, log } = fakeDb([row("a")]);
    const r = await runStreakNudge(db, S, now, async () => 0);
    expect(r).toMatchObject({ sent: 0, undelivered: 1 });
    expect(log.get("a|2026-11-09")?.devices).toBe(0);
  });
  it("derives the age band from birth month and year (quiet hours for under-16s)", async () => {
    const { db } = fakeDb([row("kid", { age_band: "18+", birth_year: 2012, birth_month: 6 })]);
    const r = await runStreakNudge(db, { ...S, "streakNudge.hour": 21 }, at("2026-11-09T21:05:00Z"), async () => 1);
    expect(r).toMatchObject({ sent: 0, skipped: { quiet: 1 } });
  });
  it("reads nothing while switched off", async () => {
    const { db, rpc } = fakeDb([row("a")]);
    expect(await runStreakNudge(db, { ...S, "streakNudge.enabled": false }, now, async () => 1)).toMatchObject({ off: true, sent: 0 });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("asks the database for today's candidates with the admin minimum", async () => {
    const { db, rpc } = fakeDb([]);
    await runStreakNudge(db, { ...S, "streakNudge.minStreak": 4 }, now, async () => 1);
    expect(rpc).toHaveBeenCalledWith("svc_streak_nudge_candidates", { p_today: "2026-11-09", p_min: 4, p_limit: 5000 });
  });
  it("leaves the rest for the next run when out of time", async () => {
    const { db } = fakeDb([row("a"), row("b")]);
    const r = await runStreakNudge(db, S, now, async () => 1, -1);
    expect(r).toMatchObject({ sent: 0, deferred: 2 });
  });
});
