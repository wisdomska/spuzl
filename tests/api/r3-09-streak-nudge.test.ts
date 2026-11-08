import fs from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { admin, BASE, guest, uniq } from "./helpers";
import { setSetting } from "./setup";
import { COUNTRY_TZ, localHour } from "@/lib/alerts/streak-nudge";

/** A country whose local hour is now inside the admin send-hour range (12 to 22), and that hour. */
function eveningSomewhere(now = new Date()) {
  for (const c of [null, ...Object.keys(COUNTRY_TZ)]) {
    const h = localHour(c, now);
    if (h >= 12 && h <= 22) return { country: c, hour: h };
  }
  throw new Error("no country in the send-hour range now");
}

/**
 * R3-09 streak-at-risk nudge: the hourly job needs the cron secret, sends at most once per player per GMT day, and
 * follows the player's Streak reminders switch (PUT /api/v1/push/prefs) and the admin switch.
 * The test player's country is one where it is now between 12:00 and 22:59 (the send hour's range), the send hour is
 * set to that local hour, and quiet hours are off.
 */
const secret = (() => {
  const line = fs.existsSync(".env.local")
    ? fs
        .readFileSync(".env.local", "utf8")
        .split("\n")
        .find((l) => l.startsWith("CRON_SECRET="))
    : undefined;
  return process.env.CRON_SECRET ?? line?.slice("CRON_SECRET=".length) ?? "";
})();

const cron = (auth?: string) => fetch(`${BASE}/api/cron/streak-nudge`, { headers: auth === undefined ? {} : { authorization: auth } });

const KEYS = ["streakNudge.enabled", "streakNudge.hour", "streakNudge.minStreak", "alerts.quietStart", "alerts.quietEnd"];

async function atRiskPlayer(prefix: string) {
  const g = await guest(uniq(prefix));
  await admin().from("players").update({ country: eveningSomewhere().country }).eq("id", g.userId);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await admin()
    .from("streaks")
    .upsert({ player_id: g.userId, current: 6, best: 6, last_clear_date: yesterday }, { onConflict: "player_id" });
  await admin()
    .from("push_subscriptions")
    .insert({ endpoint: `https://push.example/${g.userId}`, player_id: g.userId, p256dh: "p256dh-test-key", auth: "auth-test-key" });
  return { g, today };
}

async function nudgeRows(playerId: string, day: string) {
  const { data } = await admin().from("streak_nudges").select("day, streak").eq("player_id", playerId).eq("day", day);
  return data ?? [];
}

async function sendHourNow() {
  await setSetting("streakNudge.enabled", true);
  await setSetting("streakNudge.hour", eveningSomewhere().hour);
  await setSetting("streakNudge.minStreak", 2);
  await setSetting("alerts.quietStart", 0);
  await setSetting("alerts.quietEnd", 0);
}

afterAll(async () => {
  await admin().from("game_settings").delete().in("key", KEYS);
});

describe("api: streak nudge cron", () => {
  it("needs the cron secret", async () => {
    expect((await cron()).status).toBe(401);
    expect((await cron("Bearer wrong")).status).toBe(401);
    expect((await cron(secret)).status).toBe(401);
  });

  it("nudges an at-risk player once per GMT day, however often it runs", async () => {
    const { g, today } = await atRiskPlayer("sn_");
    await sendHourNow();
    const first = await cron(`Bearer ${secret}`);
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ day: today });
    const second = await (await cron(`Bearer ${secret}`)).json();
    expect(second).toMatchObject({ day: today });
    const rows = await nudgeRows(g.userId, today);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ streak: 6 });
  });

  it("follows the player's Streak reminders switch", async () => {
    const { g, today } = await atRiskPlayer("so_");
    expect((await g.api("/api/v1/push/prefs")).data).toEqual({ streakNudge: true });
    expect((await g.api("/api/v1/push/prefs", { method: "PUT", json: { streakNudge: "no" } })).status).toBe(400);
    const off = await g.api("/api/v1/push/prefs", { method: "PUT", json: { streakNudge: false } });
    expect(off).toMatchObject({ status: 200, data: { streakNudge: false } });
    expect((await g.api("/api/v1/push/prefs")).data).toEqual({ streakNudge: false });
    await sendHourNow();
    expect((await cron(`Bearer ${secret}`)).status).toBe(200);
    expect(await nudgeRows(g.userId, today)).toHaveLength(0);
  });

  it("sends nothing while the admin switch is off", async () => {
    const { g, today } = await atRiskPlayer("sa_");
    await sendHourNow();
    await setSetting("streakNudge.enabled", false);
    const r = await (await cron(`Bearer ${secret}`)).json();
    expect(r).toMatchObject({ off: true, sent: 0 });
    expect(await nudgeRows(g.userId, today)).toHaveLength(0);
  });

  it("alert switches need a player", async () => {
    expect((await fetch(`${BASE}/api/v1/push/prefs`)).status).toBe(401);
  });
});
