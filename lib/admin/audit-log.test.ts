import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { adminCopy } from "@/lib/copy/admin";
import { LAB_GAMES } from "@/lib/catalog";
import {
  AUDIT_TYPES,
  auditDayLabel,
  auditTime,
  byDay,
  collapseRepeats,
  describeAudit,
  describeEntry,
  playerIdsIn,
  type AuditNames,
  type AuditRow,
} from "./audit-log";

const OWNER = "11111111-1111-4111-8111-111111111111";
const MOD = "22222222-2222-4222-8222-222222222222";
const KOFI = "33333333-3333-4333-8333-333333333333";
const names: AuditNames = {
  actors: [
    { id: OWNER, email: "senya@example.com", role: "owner", nickname: "Senya" },
    { id: MOD, email: "mod@example.com", role: "moderator", nickname: null },
  ],
  players: { [KOFI]: "Kofi" },
};
let seq = 1;
const row = (
  action: string,
  target: string | null = null,
  detail: Record<string, unknown> = {},
  actor: string | null = OWNER,
): AuditRow => ({
  id: seq++,
  actor_id: actor,
  action,
  target,
  detail,
  created_at: "2026-11-11T14:05:00Z",
});
const say = (r: AuditRow) => {
  const l = describeAudit(r, names);
  return l.auto ? `Automatic: ${l.text}` : `${l.who} ${l.text}`;
};
const F = adminCopy.audit.say.fallback;
const FALLBACKS = new Set<string>(Object.values(F));

/** Every action string the code writes, with a typical target and detail (see lib/admin/audit-log.ts). */
const ACTIONS: [string, string | null, Record<string, unknown>, (string | null)?][] = [
  ["setting.update", "setting:dailyFive.enabled", { before: true, after: false }],
  ["daily_five.lab_repick", null, { off: ["pinned"], days: [{}], kept: [] }],
  ["flag.create", "flag:event.exam", { before: null, after: { enabled: false } }],
  ["flag.update", "flag:duels", { before: { enabled: true }, after: { enabled: false } }],
  ["admin.add", `admin:${MOD}`, { email: "mod@example.com", role: "moderator" }, null],
  ["admin.role", `admin:${MOD}`, { role: "owner" }],
  ["admin.disable", `admin:${MOD}`, {}],
  ["admin.enable", `admin:${MOD}`, {}],
  ["admin.reset_sent", `admin:${MOD}`, { email: "mod@example.com", role: "moderator" }],
  ["admin.email_code_verified", `admin:${OWNER}`, {}],
  ["admin.totp_enrolled", `admin:${OWNER}`, {}],
  ["player.ban", `player:${KOFI}`, { days: 7, reason: "spam" }],
  ["player.ban_void", `player:${KOFI}`, { reason: "cheating" }],
  ["player.unban", `player:${KOFI}`, {}],
  ["player.revoke_ranking", `player:${KOFI}`, {}],
  ["player.restore_ranking", `player:${KOFI}`, {}],
  ["player.reset", `player:${KOFI}`, {}],
  ["player.rename", `player:${KOFI}`, { from: "BadName", to: "Player_123" }],
  ["player.sparks", `player:${KOFI}`, { amount: 50 }],
  ["player.freeze", `player:${KOFI}`, {}],
  ["player.signout", `player:${KOFI}`, { sessions: 2 }],
  ["player.birth_correct", `player:${KOFI}`, { from_band: "16-17", to_band: "18+" }],
  ["player.adult_party_unblock", `player:${KOFI}`, { before: "2026-11-20", after: null }],
  ["player.shield", `player:${KOFI}`, { granted: true }, null],
  ["player.delete", `player:${KOFI}`, { nickname: "Kofi" }],
  ["player.delete_failed", `player:${KOFI}`, {}],
  ["player.bulk", null, { action: "ban", players: [KOFI], days: 3 }],
  ["players.export", null, { count: 40 }],
  ["report.dismiss", "report:1", { target: `player:${KOFI}` }],
  ["report.actioned", "report:1", { target: "party:abc" }],
  ["report.reopen", "report:1", { target: "content:x" }],
  ["flagged.clear", "attempt:1", { player: KOFI, game: "crownfall" }],
  ["flagged.reject", "attempt:1", { player: KOFI, game: "crownfall" }],
  ["metrics.export", "metric:daily_active", { from: "2026-11-01", to: "2026-11-10" }],
  ["feedback.export", "feedback", { rows: 3 }],
  ["feedback.read", "feedback:1", {}],
  ["feedback.done", "feedback:1", {}],
  ["feedback.new", "feedback:1", {}],
  ["joinlog.export", "join_requests", { rows: 9 }],
  ["content.create", "content:1", { game: "quickfire" }],
  ["content.edit", "content:1", { game: "quickfire" }],
  ["content.submit", "content:1", { game: "quickfire" }],
  ["content.approve", "content:1", { game: "quickfire" }],
  ["content.reject", "content:1", { game: "quickfire" }],
  ["content.pool", "content:1", { game: "quads" }],
  ["content.unpool", "content:1", { game: "quads" }],
  ["content.export", "quickfire.pack", { game: "quickfire", count: 12 }],
  ["content.import", "content:quickfire", { game: "quickfire", count: 12 }],
  ["content.rebuild_upcoming", "game:quads", {}],
  ["content.schedule", "content:1", { game: "quickfire", date: "2026-11-12" }],
  ["content_file.edit", "quads.content", { index: 1 }],
  ["content_file.approve", "quads.content", { indexes: [1, 2] }],
  ["content_file.retire", "quads.content", { indexes: [1] }],
  ["drawword.add", "drawword:1", { word: "kettle" }],
  ["drawword.edit", "drawword:1", { before: { word: "kettle" }, after: { word: "teapot" } }],
  ["drawword.retire", "drawword:1", { before: { word: "kettle" } }],
  ["drawword.restore", "drawword:1", { before: { word: "kettle" } }],
  ["drawword.import", "drawword:pack", { count: 40 }],
  ["daily.lock", "crownfall:2026-11-12", {}],
  ["daily.lock", "2026-11-12..2026-11-18", { locked: 7 }],
  ["daily.unlock", "crownfall:2026-11-12", {}],
  ["daily.fill", "next 14 days", { made: 3 }],
  ["daily.regenerate", "crownfall:2026-11-12", {}],
  ["daily.swap", "crownfall:2026-11-12", {}],
  ["cron.daily_autolock", "2026-11-12..2026-11-18", { locked: 4 }, null],
  ["daily_five.auto_pick", "daily_five:2026-11-12", {}],
  ["daily_five.manual_pick", "daily_five:2026-11-12", {}],
  ["daily_five.lock", "daily_five:2026-11-12", {}],
  ["daily_five.unlock", "daily_five:2026-11-12", {}],
  ["daily_five.fill", null, { made: 1, repicked: 0 }],
  ["daily_five.export", null, { days: 14 }],
  ["daily_five.import", null, { saved: 3 }],
  ["puzzle.note", "puzzle:1", { note: "too easy" }],
  ["puzzle.approve", "puzzle:1", { game: "crownfall", date: "2026-11-12" }],
  ["puzzle.check", "puzzle:1", { ok: false, failed: ["unique"] }],
  ["game_meta.update", "game:crownfall", {}],
  ["event.create", "event:1", { after: { name: "Exam season" } }],
  ["event.update", "event:1", { after: { name: "Exam season" } }],
  ["event.delete", "event:1", { before: { name: "Exam season" } }],
  ["event.schedule", "event:1", { after: { name: "Exam season" } }],
  ["event.unschedule", "event:1", { after: { name: "Exam season" } }],
  ["event.template", "event:1", { after: { name: "Exam season" } }],
  ["cosmetics.price", "cosmetics:hat-starter", { before: { price_sparks: 100 }, after: { price_sparks: 120 } }],
  ["cosmetics.update", "cosmetics:hat-starter", { after: { active: false } }],
  ["badges.update", "badges:first", { after: { secret: true } }],
  ["quests.update", "quests:q1", { after: { xp: 30 } }],
  ["quests.create", "quests:q1", { title: "Clear 2 Dailies" }],
  ["cron.streak_nudge", null, { sent: 1, candidates: 1 }, null],
  ["cron.daily_five", null, { made: 1, repicked: 0, kept: 13, through: "2026-11-24", closed: { days: [], kept: [] } }, null],
  ["cron.generate_puzzles", null, { made: 5, pending: 0 }, null],
  ["script.generate_puzzles", null, { days: 7, made: 21 }, null],
  ["cron.daily_rollover", null, { date: "2026-11-11", frozen: 2, lost: 5 }, null],
  ["cron.league_rollover", null, { week: "2026-11-09", groups: 4, merged: 1 }, null],
  ["cron.ban_expiry", null, { lifted: 1 }, null],
  ["cron.age_bands", null, { moved: 2 }, null],
];

/** Files under a folder, recursively. */
function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p, ext) : ext.test(f) ? [p] : [];
  });
}

describe("activity log sentences", () => {
  it("writes a real sentence (never the fallback) for every action in the code", () => {
    for (const [action, target, detail, actor] of ACTIONS) {
      const l = describeAudit(row(action, target, detail, actor === undefined ? OWNER : actor), names);
      expect(FALLBACKS.has(l.text), action).toBe(false);
      expect(l.text.length, action).toBeGreaterThan(5);
      expect(l.text, action).not.toMatch(/undefined|null|NaN|\[object/);
    }
  });

  it("covers every literal action string written in app/, lib/, scripts/ and the migrations", () => {
    const known = new Set(ACTIONS.map(([a]) => a));
    const found = new Set<string>();
    const root = process.cwd();
    const ts = [...files(join(root, "app"), /\.tsx?$/), ...files(join(root, "lib"), /\.tsx?$/), ...files(join(root, "scripts"), /\.m?ts$/)];
    for (const f of ts) {
      if (f.endsWith(".test.ts")) continue;
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/audit\(ctx,\s*"([a-z_]+\.[a-z_]+)"/g)) found.add(m[1]);
      for (const m of src.matchAll(/audit\(ctx,\s*[^"]*?\?\s*"([a-z_]+\.[a-z_]+)"\s*:\s*"([a-z_]+\.[a-z_]+)"/g)) found.add(m[1]).add(m[2]);
      if (src.includes("audit_log")) for (const m of src.matchAll(/action:\s*"([a-z_]+\.[a-z_]+)"/g)) found.add(m[1]);
    }
    for (const f of files(join(root, "supabase", "migrations"), /\.sql$/)) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/audit_log[^;]*?'((?:cron|player|daily|flagged)\.[a-z_]+)'/gs)) found.add(m[1]);
    }
    expect(found.size).toBeGreaterThan(20);
    expect([...found].filter((a) => !known.has(a))).toEqual([]);
  });

  it("falls back safely for unknown actions and odd details", () => {
    expect(say(row("test.pgabc.xyz"))).toBe(`Senya ${F.any}`);
    expect(say(row("cron.something_new", null, {}, null))).toBe(`Automatic: ${F.auto}`);
    expect(say(row("setting.update", "setting:not.a.key", {}))).toBe("Senya changed a game setting");
    expect(() => describeAudit({ ...row("player.ban"), detail: null as unknown as Record<string, unknown> }, names)).not.toThrow();
  });

  it("names people by nickname, then email, then a plain fallback", () => {
    expect(describeAudit(row("player.unban", `player:${KOFI}`), names).who).toBe("Senya");
    expect(describeAudit(row("player.unban", `player:${KOFI}`, {}, MOD), names).who).toBe("mod@example.com");
    expect(describeAudit(row("player.unban", `player:${KOFI}`, {}, "44444444-4444-4444-8444-444444444444"), names).who).toBe(
      adminCopy.audit.say.formerMember,
    );
    expect(say(row("player.ban", `player:${KOFI}`, { days: 7 }))).toBe("Senya banned Kofi for 7 days");
    // A deleted player keeps the nickname recorded with the row.
    expect(say(row("player.delete", `player:${MOD}`, { nickname: "Gone_1" }))).toBe("Senya deleted the account of Gone_1");
  });

  it("describes setting changes in plain words", () => {
    const [a, b] = LAB_GAMES;
    expect(say(row("setting.update", "setting:features.labGames", { before: null, after: [a.id, b.id] }))).toBe(
      `Senya switched on ${a.name} and ${b.name} in Games in testing (Lab games)`,
    );
    expect(say(row("setting.update", "setting:dailyFive.enabled", { before: true, after: false }))).toBe("Senya switched off Daily Five");
    expect(say(row("setting.update", "setting:quickfire.autoAdvanceMs", { before: 1500, after: 2000 }))).toBe(
      "Senya changed Quickfire: pause between questions from 1.5 seconds to 2 seconds",
    );
    expect(say(row("setting.update", "setting:streakNudge.hour", { before: null, after: 20 }))).toBe(
      "Senya changed Streak reminder: send at from 19:00 local time to 20:00 local time",
    );
  });

  it("writes automatic jobs as what happened", () => {
    expect(say(row("cron.streak_nudge", null, { sent: 1 }, null))).toBe("Automatic: sent 1 streak reminder");
    expect(say(row("cron.daily_five", null, { made: 1, repicked: 0, through: "2026-11-24" }, null))).toBe(
      "Automatic: picked the Daily Five for Tue 24 Nov",
    );
    expect(
      describeAudit(row("player.shield", `player:${KOFI}`, { granted: true, reason: "signed in: streak shield" }, null), names).note,
    ).toBeNull();
  });

  it("folds a day's streak reminder runs into one line, and keeps other rows apart", () => {
    const at = (h: number, action = "cron.streak_nudge", sent = 1, day = "11"): AuditRow => ({
      ...row(action, null, { sent }, action.startsWith("cron.") ? null : OWNER),
      created_at: `2026-11-${day}T${String(h).padStart(2, "0")}:00:00Z`,
    });
    const rows = [at(20), at(19, "setting.update"), at(18, "cron.streak_nudge", 2), at(17), at(20, "cron.streak_nudge", 4, "10")];
    const entries = collapseRepeats(rows);
    expect(entries.map((e) => e.rows.length)).toEqual([3, 1, 1]);
    expect(describeEntry(entries[0], names).text).toBe("sent 4 streak reminders this day, in 3 hourly runs");
    expect(byDay(entries).map((d) => d.day)).toEqual(["2026-11-11", "2026-11-10"]);
  });

  it("finds the players a page mentions", () => {
    const ids = playerIdsIn([
      row("player.ban", `player:${KOFI}`),
      row("flagged.clear", "attempt:1", { player: MOD }),
      row("report.dismiss", "report:1", { target: `nickname:${OWNER}` }),
      row("report.dismiss", "report:2", { target: "content:abc" }),
    ]);
    expect(ids.sort()).toEqual([OWNER, MOD, KOFI].sort());
  });

  it("types of change are LIKE patterns with no user input", () => {
    for (const patterns of Object.values(AUDIT_TYPES)) for (const p of patterns) expect(p).toMatch(/^[a-z_.%]+$/);
  });

  it("formats days and times plainly", () => {
    const now = new Date("2026-11-11T16:05:00Z");
    expect(auditDayLabel("2026-11-11", now)).toBe("Today");
    expect(auditDayLabel("2026-11-10", now)).toBe("Yesterday");
    expect(auditDayLabel("2026-11-04", now)).toBe("Wed 4 Nov");
    expect(auditTime("2026-11-11T14:05:00Z", now.getTime()).text).toBe("2 hours ago");
    expect(auditTime("2026-11-10T09:30:00Z", now.getTime())).toEqual({ text: "09:30", exact: "Tue 10 Nov 2026, 09:30 GMT" });
  });
});
