/**
 * Activity log (audit log, FR-AD-08) in plain words. Pure: the API uses AUDIT_TYPES to filter by type of change,
 * the console uses describeAudit to turn each row into a sentence ("Senya switched on Pinned in Games in testing")
 * and collapseRepeats to fold the hourly streak-reminder runs into one line a day.
 *
 * Every action string written to audit_log is mapped here: `audit(...)` calls under app/api, direct inserts in
 * app/api/cron, lib/admin and scripts, and the SQL functions in supabase/migrations. Anything unknown falls back to
 * a safe generic sentence; the raw action, target and data stay under "Technical details" on every row.
 */
import { adminCopy } from "@/lib/copy/admin";
import { GAME_BY_ID } from "@/lib/catalog";
import { ROLE_LABEL, type Role } from "@/lib/admin/roles";
import { isSettingKey, SETTINGS, type SettingDef } from "@/lib/game-settings/schema";
import { settingValueText } from "@/lib/admin/setting-words";
import { dayMonth } from "@/lib/admin/dates";

const S = adminCopy.audit.say;

/**
 * Types of change for the filter: LIKE patterns on `action`, matched with OR on the server. Fixed list, so the
 * filter value is only ever one of these ids.
 */
export const AUDIT_TYPES = {
  players: ["player.%", "players.%", "report.%", "flagged.%", "feedback.%", "joinlog.%"],
  content: ["content.%", "content_file.%", "drawword.%", "puzzle.%", "game_meta.%", "game_state.%"],
  daily: ["daily.%", "daily_five.%", "cron.daily%"],
  events: ["event.%", "cosmetics.%", "badges.%", "quests.%"],
  settings: ["setting.%", "flag.%"],
  team: ["admin.%"],
  exports: ["%.export"],
  automatic: ["cron.%", "script.%"],
} as const;
export type AuditType = keyof typeof AUDIT_TYPES;
export const AUDIT_TYPE_IDS = Object.keys(AUDIT_TYPES) as AuditType[];
export const isAuditType = (t: string): t is AuditType => t in AUDIT_TYPES;

export interface AuditRow {
  id: number;
  actor_id: string | null;
  action: string;
  target: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface AuditActor {
  id: string;
  email: string | null;
  role: Role;
  nickname?: string | null;
}

/** Names the server looked up for the page: team members by user id, players by id. */
export interface AuditNames {
  actors: AuditActor[];
  players: Record<string, string>;
}

export interface AuditLine {
  /** Who did it, as a name; null for an automatic job. */
  who: string | null;
  /** The rest of the sentence, starting with a verb ("switched on Daily Five"). */
  text: string;
  /** A reason or note someone typed, shown under the sentence. */
  note: string | null;
  icon: string;
  auto: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids of players a page of rows mentions (targets and detail fields), for the server to look up nicknames. */
export function playerIdsIn(rows: Pick<AuditRow, "target" | "detail">[]): string[] {
  const ids = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v !== "string") return;
    const id = v.replace(/^(player|nickname):/, "");
    if (UUID.test(id) && (v === id || /^(player|nickname):/.test(v))) ids.add(id);
  };
  for (const r of rows) {
    if (r.target?.startsWith("player:")) add(r.target);
    add(r.detail?.player);
    add(r.detail?.target);
  }
  return [...ids];
}

/** The team member's name: nickname, else email, else a plain "former team member". */
export function actorName(id: string, names: AuditNames): string {
  const a = names.actors.find((x) => x.id === id);
  return a?.nickname || a?.email || S.formerMember;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const gameName = (id: unknown) => (typeof id === "string" ? (GAME_BY_ID[id]?.name ?? id) : S.aGame);
const dateText = (iso: unknown) => (typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? dayMonth(iso) : S.aDay);
const after = (target: string | null, prefix: string) => (target?.startsWith(prefix) ? target.slice(prefix.length) : null);

function playerName(id: unknown, names: AuditNames, fallback?: unknown): string {
  const raw = typeof id === "string" ? id.replace(/^(player|nickname):/, "") : "";
  return names.players[raw] ?? str(fallback) ?? S.aPlayer;
}

/** A report's subject: the player by name, or the kind of thing reported. */
function reportSubject(target: unknown, names: AuditNames): string {
  const t = typeof target === "string" ? target : "";
  const kind = t.split(":")[0];
  if (kind === "player" || kind === "nickname") return S.reportPlayer(playerName(t, names));
  return S.reportKind[kind as keyof typeof S.reportKind] ?? S.reportKind.other;
}

/** "Pinned and Flagged" from option ids. */
const optionList = (ids: string[], d: Extract<SettingDef, { kind: "set" }>) =>
  S.list(ids.map((id) => d.options.find((o) => o.id === id)?.label ?? GAME_BY_ID[id]?.name ?? id));

function describeSetting(r: AuditRow): string {
  const key = after(r.target, "setting:");
  // The old lab switch (moved into each game's state on the Games page, 20261212010101): its rows still read by name.
  if (key === LEGACY_LAB_KEY) {
    const before = Array.isArray(r.detail.before) ? (r.detail.before as string[]) : [];
    const next = Array.isArray(r.detail.after) ? (r.detail.after as string[]) : [];
    const on = next.filter((x) => !before.includes(x)).map(gameName);
    const off = before.filter((x) => !next.includes(x)).map(gameName);
    if (on.length && off.length) return S.setBoth(S.list(on), S.list(off), S.legacyLabLabel);
    if (on.length) return S.setOn(S.list(on), S.legacyLabLabel);
    if (off.length) return S.setOff(S.list(off), S.legacyLabLabel);
    return S.settingSame(S.legacyLabLabel);
  }
  if (!key || !isSettingKey(key)) return S.settingUnknown;
  const d: SettingDef = SETTINGS[key];
  const was = r.detail.before === null || r.detail.before === undefined ? d.default : r.detail.before;
  const now = r.detail.after;
  if (d.kind === "bool") return now ? S.switchedOn(d.label) : S.switchedOff(d.label);
  if (d.kind === "set") {
    const before = Array.isArray(was) ? (was as string[]) : [];
    const next = Array.isArray(now) ? (now as string[]) : [];
    const on = next.filter((x) => !before.includes(x));
    const off = before.filter((x) => !next.includes(x));
    if (on.length && off.length) return S.setBoth(optionList(on, d), optionList(off, d), d.label);
    if (on.length) return S.setOn(optionList(on, d), d.label);
    if (off.length) return S.setOff(optionList(off, d), d.label);
    return S.settingSame(d.label);
  }
  return S.changed(d.label, settingValueText(d, was), settingValueText(d, now));
}

/** The setting that switched lab games on before each game had a state (rows from before 20261212010101). */
const LEGACY_LAB_KEY = "features.labGames";

/** A Games page switch (game_state.update): the state, the Duels and Parties switch and the practice round. */
function describeGameState(r: AuditRow): string {
  const g = gameName(after(r.target, "game:"));
  const parts: string[] = [];
  const state = obj(r.detail.state);
  if (typeof state.after === "string") parts.push(S.gameState(g, state.after));
  const versus = obj(r.detail.versus);
  if (typeof versus.after === "boolean") parts.push(S.gameVersus(g, versus.after));
  const practice = obj(r.detail.practice);
  if (typeof practice.after === "boolean") parts.push(S.gamePractice(g, practice.after));
  return parts.length ? parts.join(" and ") : S.gameStateSame(g);
}

const FLAG_NAMES = adminCopy.flags.names as Record<string, { name: string } | undefined>;
export const flagName = (key: string) => FLAG_NAMES[key]?.name ?? key.replace(/[_.:-]+/g, " ");

function describeCatalog(kind: "cosmetics" | "badges" | "quests", verb: string, r: AuditRow): string {
  const id = after(r.target, `${kind}:`) ?? "";
  const item = S.item(str(r.detail.name) ?? str(r.detail.title) ?? id);
  if (verb === "create") return S.catalogCreate(item, S.catalogKind[kind]);
  const patch = obj(r.detail.after);
  const before = obj(r.detail.before);
  if (verb === "price") return S.price(item, num(before.price_sparks), num(patch.price_sparks) ?? 0);
  if (typeof patch.active === "boolean") return S.catalogActive[kind](item, patch.active);
  if (typeof patch.secret === "boolean") return S.badgeSecret(item, patch.secret);
  return S.catalogReward(item);
}

/** Turns one audit row into a sentence. Never throws: unknown actions get a generic sentence. */
export function describeAudit(r: AuditRow, names: AuditNames): AuditLine {
  const d = obj(r.detail);
  const row = { ...r, detail: d };
  const auto = r.actor_id === null;
  const who = auto ? null : actorName(r.actor_id!, names);
  const [area, verb = ""] = r.action.split(/\.(.*)/s);
  let icon = "note-pencil";
  let text: string;
  let note: string | null = str(d.reason) ?? str(d.note) ?? str(d.notes);
  try {
    switch (area) {
      case "setting":
        icon = "sliders-horizontal";
        text = describeSetting(row);
        break;
      case "flag": {
        icon = "toggle-right";
        const key = after(r.target, "flag:") ?? "";
        const next = obj(d.after);
        const was = d.before ? obj(d.before) : null;
        if (verb === "create") text = S.flagCreate(flagName(key), !!next.enabled);
        else if (!was || was.enabled !== next.enabled) text = next.enabled ? S.flagOn(flagName(key)) : S.flagOff(flagName(key));
        else text = S.flagOptions(flagName(key));
        break;
      }
      case "admin": {
        icon = "users";
        const id = after(r.target, "admin:");
        const them = id ? (id === r.actor_id ? S.themselves : actorName(id, names)) : S.aTeamMember;
        const email = str(d.email);
        const role = typeof d.role === "string" && d.role in ROLE_LABEL ? ROLE_LABEL[d.role as Role] : null;
        if (verb === "add") text = S.adminAdd(email ?? them, email && role ? role : null);
        // Rows from the team page carry the actor's own role in `role` (audit() adds it); provisioning rows carry
        // the new role next to `email`.
        else if (verb === "role") text = S.adminRole(email ?? them, email && role ? role : null);
        else if (verb === "disable") text = S.adminDisable(them);
        else if (verb === "enable") text = S.adminEnable(them);
        else if (verb === "reset_sent") text = S.adminReset(email ?? them);
        else if (verb === "email_code_verified" || verb === "totp_enrolled") text = S.adminCodes;
        else text = S.fallback.admin;
        break;
      }
      case "player":
      case "players": {
        icon = "user";
        const p = playerName(r.target, names, d.nickname);
        if (area === "players") text = verb === "export" ? S.playersExport(num(d.count) ?? 0) : S.fallback.player;
        else if (verb === "ban") text = S.ban(p, num(d.days));
        else if (verb === "ban_void") text = S.banVoid(p, num(d.days));
        else if (verb === "unban") text = S.unban(p);
        else if (verb === "revoke_ranking") text = S.revokeRanking(p);
        else if (verb === "restore_ranking") text = S.restoreRanking(p);
        else if (verb === "reset") text = S.resetTimes(p);
        else if (verb === "rename") text = S.rename(str(d.from) ?? p, str(d.to) ?? S.aNewName);
        else if (verb === "sparks") text = S.sparks(p, num(d.amount) ?? 0);
        else if (verb === "freeze") text = S.freeze(p);
        else if (verb === "signout") text = S.signout(p);
        else if (verb === "birth_correct") text = S.birth(p, str(d.from_band), str(d.to_band));
        else if (verb === "adult_party_unblock") text = S.unblock(p, !d.after);
        else if (verb === "shield") {
          icon = "snowflake";
          text = d.granted === false ? S.shieldFull(p) : S.shield(p);
          note = null;
        } else if (verb === "delete") text = S.deletePlayer(str(d.nickname) ?? p);
        else if (verb === "delete_failed") text = S.deleteFailed(p);
        else if (verb === "bulk") {
          const n = Array.isArray(d.players) ? d.players.length : 0;
          text = d.action === "ban" ? S.bulkBan(n, num(d.days)) : d.action === "revoke_ranking" ? S.bulkRevoke(n) : S.bulkOther(n);
        } else text = S.fallback.player;
        break;
      }
      case "report":
        icon = "flag";
        text =
          verb === "dismiss"
            ? S.reportDismiss(reportSubject(d.target, names))
            : verb === "actioned"
              ? S.reportUphold(reportSubject(d.target, names))
              : verb === "reopen"
                ? S.reportReopen(reportSubject(d.target, names))
                : S.fallback.report;
        break;
      case "flagged":
        icon = "flag";
        text =
          verb === "clear"
            ? S.flaggedClear(playerName(d.player, names), gameName(d.game))
            : S.flaggedReject(playerName(d.player, names), gameName(d.game));
        break;
      case "feedback":
        icon = "chat-circle-text";
        text =
          verb === "export"
            ? S.feedbackExport(num(d.rows) ?? 0)
            : (S.feedbackMark[verb as keyof typeof S.feedbackMark] ?? S.fallback.feedback);
        break;
      case "joinlog":
        icon = "download-simple";
        text = S.joinExport(num(d.rows) ?? 0);
        break;
      case "metrics":
        icon = "download-simple";
        text = S.metricsExport((after(r.target, "metric:") ?? "").replace(/_/g, " "), dateText(d.from), dateText(d.to));
        break;
      case "content": {
        icon = "puzzle-piece";
        const g = gameName(d.game ?? after(r.target, "game:") ?? after(r.target, "content:"));
        const map: Record<string, string> = {
          create: S.contentCreate(g),
          edit: S.contentEdit(g),
          submit: S.contentSubmit(g),
          approve: S.contentApprove(g),
          reject: S.contentReject(g),
          pool: S.contentPool(g),
          unpool: S.contentUnpool(g),
          export: S.contentExport(num(d.count) ?? 0, g),
          import: S.contentImport(num(d.count) ?? 0, g),
          rebuild_upcoming: S.contentRebuild(g),
          schedule: S.contentSchedule(g, dateText(d.date)),
        };
        if (verb === "export" || verb === "import") icon = verb === "export" ? "download-simple" : "upload-simple";
        text = map[verb] ?? S.fallback.content;
        break;
      }
      case "content_file": {
        icon = "puzzle-piece";
        const g = gameName(r.target?.replace(/\.content$/, ""));
        const n = Array.isArray(d.indexes) ? d.indexes.length : 1;
        text =
          verb === "edit"
            ? S.fileEdit(g)
            : verb === "approve"
              ? S.fileApprove(n, g)
              : verb === "retire"
                ? S.fileRetire(n, g)
                : S.fallback.content;
        break;
      }
      case "drawword": {
        icon = "pencil-simple";
        const word = str(d.word) ?? str(obj(d.before).word) ?? "";
        if (verb === "add") text = S.wordAdd(word);
        else if (verb === "edit") text = str(obj(d.after).word) ? S.wordEdit(word, String(obj(d.after).word)) : S.wordEditAlt(word);
        else if (verb === "retire") text = S.wordRetire(word);
        else if (verb === "restore") text = S.wordRestore(word);
        else if (verb === "import") text = S.wordImport(num(d.count) ?? 0);
        else text = S.fallback.content;
        break;
      }
      case "puzzle":
        icon = "puzzle-piece";
        if (verb === "approve") text = S.puzzleApprove(gameName(d.game), typeof d.date === "string" ? dateText(d.date) : null);
        else if (verb === "check") text = d.ok ? S.puzzleCheckOk : S.puzzleCheckFail(Array.isArray(d.failed) ? d.failed.length : 0);
        else if (verb === "note") {
          text = S.puzzleNote;
          note = str(d.note);
        } else text = S.fallback.content;
        break;
      case "game_meta":
        icon = "game-controller";
        text = S.gameMeta(gameName(after(r.target, "game:")));
        break;
      case "game_state":
        icon = "toggle-right";
        text = describeGameState(row);
        break;
      case "daily": {
        icon = "calendar-blank";
        const range = r.target?.match(/^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/);
        const [game, date] = (r.target ?? "").split(":");
        if (verb === "lock" && range) text = S.dailyLockRange(num(d.locked) ?? 0, dateText(range[1]), dateText(range[2]));
        else if (verb === "lock") text = S.dailyLock(gameName(game), dateText(date));
        else if (verb === "unlock") text = S.dailyUnlock(gameName(game), dateText(date));
        else if (verb === "regenerate") text = S.dailyRegenerate(gameName(game), dateText(date));
        else if (verb === "swap") text = S.dailySwap(gameName(game), dateText(date));
        else if (verb === "fill") text = S.dailyFill(num(d.made) ?? 0);
        else text = S.fallback.daily;
        break;
      }
      case "daily_five": {
        icon = "calendar-blank";
        const date = dateText(after(r.target, "daily_five:"));
        if (verb === "auto_pick") text = S.fiveAuto(date);
        else if (verb === "manual_pick") text = S.fiveManual(date);
        else if (verb === "lock") text = S.fiveLock(date);
        else if (verb === "unlock") text = S.fiveUnlock(date);
        else if (verb === "fill") text = S.fiveFill(num(d.made) ?? 0, num(d.repicked) ?? 0);
        else if (verb === "export") text = S.fiveExport(num(d.days) ?? 0);
        else if (verb === "import") text = S.fiveImport(num(d.saved) ?? 0);
        else if (verb === "lab_repick") {
          const off = Array.isArray(d.off) ? S.list(d.off.map(gameName)) : S.aGame;
          text = S.fiveLabRepick(off, Array.isArray(d.days) ? d.days.length : 0, Array.isArray(d.kept) ? d.kept.length : 0);
        } else text = S.fallback.daily;
        break;
      }
      case "event": {
        icon = "confetti";
        const name = S.item(str(obj(d.after).name) ?? str(obj(d.before).name) ?? S.anEvent);
        const map: Record<string, string> = {
          create: S.eventCreate(name),
          update: S.eventUpdate(name),
          delete: S.eventDelete(name),
          schedule: S.eventSchedule(name),
          unschedule: S.eventUnschedule(name),
          template: S.eventTemplate(name),
        };
        text = map[verb] ?? S.fallback.event;
        break;
      }
      case "cosmetics":
      case "badges":
      case "quests":
        icon = area === "quests" ? "trophy" : "storefront";
        text = describeCatalog(area, verb, row);
        break;
      case "cron":
      case "script":
        icon = "robot";
        text = describeJob(r.action, d);
        break;
      default:
        text = auto ? S.fallback.auto : S.fallback.any;
    }
  } catch {
    text = auto ? S.fallback.auto : S.fallback.any;
  }
  return { who, text, note, icon, auto };
}

function describeJob(action: string, d: Record<string, unknown>): string {
  switch (action) {
    case "cron.streak_nudge":
      return S.nudge(num(d.sent) ?? 0);
    case "cron.daily_five": {
      const made = num(d.made) ?? 0;
      const repicked = num(d.repicked) ?? 0;
      const swapped = Array.isArray(obj(d.closed).days) ? (obj(d.closed).days as unknown[]).length : 0;
      if (made === 1 && !repicked && typeof d.through === "string") return S.fiveCronOne(dateText(d.through), swapped);
      return S.fiveCron(made, repicked, swapped);
    }
    case "cron.generate_puzzles":
    case "script.generate_puzzles":
      return S.generate(num(d.made) ?? 0, num(d.pending) ?? 0);
    case "cron.daily_rollover":
      return S.rollover(dateText(d.date), num(d.frozen) ?? 0, num(d.lost) ?? 0);
    case "cron.league_rollover":
      return S.leagues(num(d.groups) ?? 0, num(d.merged) ?? 0);
    case "cron.daily_autolock":
      return S.autolock(num(d.locked) ?? 0);
    case "cron.ban_expiry":
      return S.banExpiry(num(d.lifted) ?? 0);
    case "cron.age_bands":
      return S.ageBands(num(d.moved) ?? 0);
    default:
      return S.fallback.auto;
  }
}

/** Actions that run often and say little on their own: folded into one line per GMT day. */
const REPEATING = new Set(["cron.streak_nudge"]);

export interface AuditEntry {
  /** First (newest) row: its id keys the entry. */
  row: AuditRow;
  /** Every row folded into this entry (one, unless it repeats). */
  rows: AuditRow[];
}

/**
 * Folds every row of a repeating job on the same GMT day into one entry, placed where that day's latest run is
 * (the hourly streak reminders), so the log reads "Sent 7 streak reminders this day, in 5 hourly runs" once a day
 * instead of an hourly list. Works on the rows of one page.
 */
export function collapseRepeats(rows: AuditRow[]): AuditEntry[] {
  const out: AuditEntry[] = [];
  const seen = new Map<string, AuditEntry>();
  for (const r of rows) {
    const k = `${r.action}|${r.created_at.slice(0, 10)}`;
    const into = REPEATING.has(r.action) ? seen.get(k) : undefined;
    if (into) into.rows.push(r);
    else {
      const e = { row: r, rows: [r] };
      out.push(e);
      if (REPEATING.has(r.action)) seen.set(k, e);
    }
  }
  return out;
}

/** The sentence for an entry: a folded repeat sums its runs. */
export function describeEntry(e: AuditEntry, names: AuditNames): AuditLine {
  const line = describeAudit(e.row, names);
  if (e.rows.length < 2) return line;
  if (e.row.action === "cron.streak_nudge") {
    const sent = e.rows.reduce((n, r) => n + (num(obj(r.detail).sent) ?? 0), 0);
    return { ...line, text: S.nudgeRuns(sent, e.rows.length) };
  }
  return line;
}

const A = adminCopy.audit;

/** Day heading for a GMT date: "Today", "Yesterday" or "Wed 11 Nov". */
export function auditDayLabel(iso: string, now = new Date()): string {
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(Date.parse(today + "T00:00:00Z") - 86_400_000).toISOString().slice(0, 10);
  return iso === today ? A.today : iso === yesterday ? A.yesterday : dayMonth(iso);
}

/**
 * A row's time: "2 hours ago" within the last 12 hours, else the GMT clock time ("14:05", under its day heading),
 * with the exact time for a tooltip.
 */
export function auditTime(createdAt: string, now = Date.now()): { text: string; exact: string } {
  const t = Date.parse(createdAt);
  const d = new Date(t);
  const hhmm = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  const exact = A.exactTime(`${dayMonth(d.toISOString().slice(0, 10))} ${d.getUTCFullYear()}`, hhmm);
  const mins = Math.floor((now - t) / 60_000);
  if (mins < 1) return { text: A.ago.now, exact };
  if (mins < 60) return { text: A.ago.minutes(mins), exact };
  if (mins < 12 * 60) return { text: A.ago.hours(Math.floor(mins / 60)), exact };
  return { text: hhmm, exact };
}

/** Entries grouped under GMT day headings, newest day first (rows arrive newest first). */
export function byDay(entries: AuditEntry[]): { day: string; entries: AuditEntry[] }[] {
  const out: { day: string; entries: AuditEntry[] }[] = [];
  for (const e of entries) {
    const day = e.row.created_at.slice(0, 10);
    const last = out[out.length - 1];
    if (last?.day === day) last.entries.push(e);
    else out.push({ day, entries: [e] });
  }
  return out;
}
