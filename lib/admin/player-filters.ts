import { z } from "zod";
import { csvCell } from "./metrics";
import type { Permission } from "./roles";

/**
 * Admin Players: filters, account types, actions and the CSV shape, shared by the API routes, the console and the
 * unit tests. Pure (no server imports). The server is the authority for every rule here.
 */

export const ACCOUNT_TYPES = ["guest", "email", "google"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];
export const AGE_BANDS = ["13-15", "16-17", "18+"] as const;
export const PLAYER_STATUSES = ["active", "banned", "ranking_revoked", "flagged"] as const;
export const REPORT_FILTERS = ["any", "open", "none"] as const;
export const TEST_FILTERS = ["exclude", "include", "only"] as const;

/** Address-bar filters for /admin/players, with their defaults (left out of the URL). */
export const PLAYER_FILTERS = {
  q: "",
  account: "",
  age: "",
  status: "",
  reports: "",
  test: "exclude",
  joinedFrom: "",
  joinedTo: "",
  activeFrom: "",
  activeTo: "",
} as const;
export type PlayerFilterKey = keyof typeof PLAYER_FILTERS;

export const PLAYER_FILTER_ALLOWED = {
  account: [...ACCOUNT_TYPES],
  age: [...AGE_BANDS],
  status: [...PLAYER_STATUSES],
  reports: [...REPORT_FILTERS],
  test: [...TEST_FILTERS],
} as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** What a search box value means: a player id, an exact email, or part of a nickname. */
export function searchKind(q: string): "id" | "email" | "nickname" {
  const t = q.trim();
  if (UUID.test(t)) return "id";
  if (t.includes("@")) return "email";
  return "nickname";
}

const date = z.string().regex(ISO, "dates are yyyy-mm-dd").optional();
const PlayerQuery = z
  .object({
    q: z.string().trim().max(200).optional(),
    account: z.enum(ACCOUNT_TYPES).optional(),
    age: z.enum(AGE_BANDS).optional(),
    status: z.enum(PLAYER_STATUSES).optional(),
    reports: z.enum(REPORT_FILTERS).optional(),
    test: z.enum(TEST_FILTERS).optional(),
    joinedFrom: date,
    joinedTo: date,
    activeFrom: date,
    activeTo: date,
  })
  .refine((v) => !v.joinedFrom || !v.joinedTo || v.joinedFrom <= v.joinedTo, "joinedFrom is after joinedTo")
  .refine((v) => !v.activeFrom || !v.activeTo || v.activeFrom <= v.activeTo, "activeFrom is after activeTo");

/** The filter object `svc_admin_players` takes (snake case, empty values left out). */
export interface PlayerSqlFilters {
  q?: string;
  q_kind?: "id" | "email" | "nickname";
  account?: AccountType;
  age?: string;
  status?: string;
  reports?: string;
  test?: string;
  joined_from?: string;
  joined_to?: string;
  active_from?: string;
  active_to?: string;
}

type Search = Pick<URLSearchParams, "get">;

/** Strict parse of the list filters for the API. Empty params count as missing. */
export function parsePlayerFilters(sp: Search): { success: true; data: PlayerSqlFilters } | { success: false; error: string } {
  const raw: Record<string, string> = {};
  for (const k of Object.keys(PLAYER_FILTERS)) {
    const v = sp.get(k);
    if (v !== null && v !== "") raw[k] = v;
  }
  const r = PlayerQuery.safeParse(raw);
  if (!r.success) return { success: false, error: r.error.issues[0]?.message ?? "bad filter" };
  const v = r.data;
  const out: PlayerSqlFilters = {};
  if (v.q) {
    out.q = v.q;
    out.q_kind = searchKind(v.q);
  }
  if (v.account) out.account = v.account;
  if (v.age) out.age = v.age;
  if (v.status) out.status = v.status;
  if (v.reports) out.reports = v.reports;
  if (v.test) out.test = v.test;
  if (v.joinedFrom) out.joined_from = v.joinedFrom;
  if (v.joinedTo) out.joined_to = v.joinedTo;
  if (v.activeFrom) out.active_from = v.activeFrom;
  if (v.activeTo) out.active_to = v.activeTo;
  return { success: true, data: out };
}

/** Same rule as private.player_account_type: Google identity, else a non-anonymous account with an email, else guest. */
export function accountTypeOf(providers: readonly string[], isAnonymous: boolean, email: string | null | undefined): AccountType {
  if (providers.includes("google")) return "google";
  if (!isAnonymous && (email || providers.includes("email"))) return "email";
  return "guest";
}

/** Same rule as private.mask_email: "jane.doe@gmail.com" to "j•••@•••.com". */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes("@")) return null;
  const domain = email.slice(email.indexOf("@") + 1);
  const tld = /\.[^.]+$/.exec(domain)?.[0] ?? "";
  return `${email[0]}•••@•••${tld}`;
}

/** One row of the player list as the API returns it. */
export interface PlayerRow {
  id: string;
  nickname: string;
  account_type: AccountType;
  providers: string[];
  /** The full email for roles with players.pii, otherwise masked; null for guests. */
  email: string | null;
  age_band: string;
  level: number;
  xp: number;
  sparks: number;
  streak: number;
  best_streak: number;
  freezes: number;
  last_active: string | null;
  created_at: string;
  banned_at: string | null;
  banned_until: string | null;
  ranking_revoked: boolean;
  is_test: boolean;
  flagged: number;
  reports_open: number;
  reports_total: number;
}

export type PlayerStatus = "active" | "banned" | "temp_banned" | "ranking_revoked" | "flagged" | "test";

/** Every status that applies to a row, most serious first; "active" only when nothing else does. */
export function playerStatuses(
  r: Pick<PlayerRow, "banned_at" | "banned_until" | "ranking_revoked" | "flagged" | "is_test">,
): PlayerStatus[] {
  const out: PlayerStatus[] = [];
  if (r.banned_at) out.push(r.banned_until ? "temp_banned" : "banned");
  if (r.ranking_revoked) out.push("ranking_revoked");
  if (r.flagged > 0) out.push("flagged");
  if (!out.length) out.push("active");
  if (r.is_test) out.push("test");
  return out;
}

/* ---------- actions ---------- */

export const PLAYER_ACTIONS = [
  "reset_nickname",
  "sparks",
  "freeze",
  "ban",
  "unban",
  "revoke_ranking",
  "restore_ranking",
  "signout",
  "delete",
] as const;
export type PlayerAction = (typeof PLAYER_ACTIONS)[number];

/** The permission each action needs. The API checks it; the console only hides what a role cannot do. */
export const ACTION_PERMISSION: Record<PlayerAction, Permission> = {
  reset_nickname: "players.moderate",
  sparks: "players.economy",
  freeze: "players.moderate",
  ban: "players.moderate",
  unban: "players.moderate",
  revoke_ranking: "players.moderate",
  restore_ranking: "players.moderate",
  signout: "players.moderate",
  delete: "players.delete",
};

/** Bulk actions on selected rows: only the safe, reversible ones. Export is its own route. */
export const BULK_ACTIONS = ["ban", "revoke_ranking"] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];
export const BULK_MAX = 100;

export const SPARKS_LIMIT = 10_000;
export const BAN_MAX_DAYS = 365;
export const EXPORT_MAX = 5_000;

const reason = z.string().trim().min(3, "Give a reason (3 characters or more).").max(500);

export const ActionBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reset_nickname"), reason }),
  z.object({
    action: z.literal("sparks"),
    reason,
    amount: z
      .number()
      .int()
      .min(-SPARKS_LIMIT)
      .max(SPARKS_LIMIT)
      .refine((n) => n !== 0, "amount cannot be 0"),
  }),
  z.object({ action: z.literal("freeze"), reason }),
  z.object({ action: z.literal("ban"), reason, days: z.number().int().min(1).max(BAN_MAX_DAYS).nullable().optional() }),
  z.object({ action: z.literal("unban"), reason }),
  z.object({ action: z.literal("revoke_ranking"), reason }),
  z.object({ action: z.literal("restore_ranking"), reason }),
  z.object({ action: z.literal("signout"), reason }),
  /** `confirm` must repeat the player's nickname (any case). */
  z.object({ action: z.literal("delete"), reason, confirm: z.string().trim().max(32) }),
]);
export type ActionInput = z.infer<typeof ActionBody>;

export const BulkBody = z.object({
  action: z.enum(BULK_ACTIONS),
  ids: z
    .array(z.string().regex(UUID))
    .min(1)
    .max(BULK_MAX)
    .refine((a) => new Set(a).size === a.length, "ids repeat"),
  reason,
  days: z.number().int().min(1).max(BAN_MAX_DAYS).nullable().optional(),
});

export const ExportBody = z.object({
  /** The list's own query string (filters and sort); page and pageSize are ignored. */
  search: z.string().max(2000).default(""),
  /** Selected rows only, instead of every row the filters match. */
  ids: z.array(z.string().regex(UUID)).min(1).max(BULK_MAX).optional(),
});

/** Does the typed confirmation match the nickname? Same rule as the player's own deletion: case-insensitive. */
export const confirmMatches = (typed: string, nickname: string) => typed.trim().toLowerCase() === nickname.toLowerCase();

/* ---------- CSV ---------- */

const CSV_COLS: { key: string; value: (r: PlayerRow) => string | number | null; pii?: boolean }[] = [
  { key: "id", value: (r) => r.id },
  { key: "nickname", value: (r) => r.nickname },
  { key: "account_type", value: (r) => r.account_type },
  { key: "email", value: (r) => r.email, pii: true },
  { key: "age_band", value: (r) => r.age_band },
  { key: "level", value: (r) => r.level },
  { key: "xp", value: (r) => r.xp },
  { key: "sparks", value: (r) => r.sparks },
  { key: "streak", value: (r) => r.streak },
  { key: "best_streak", value: (r) => r.best_streak },
  { key: "last_active", value: (r) => r.last_active },
  { key: "joined", value: (r) => r.created_at },
  { key: "status", value: (r) => playerStatuses(r).join(" ") },
  { key: "banned_until", value: (r) => r.banned_until },
  { key: "flagged_scores", value: (r) => r.flagged },
  { key: "open_reports", value: (r) => r.reports_open },
];

/** RFC 4180 CSV of player rows. The email column is left out entirely unless `withEmail`. */
export function playersCsv(rows: readonly PlayerRow[], withEmail: boolean): string {
  const cols = CSV_COLS.filter((c) => withEmail || !c.pii);
  const lines = [cols.map((c) => c.key).join(",")];
  for (const r of rows) lines.push(cols.map((c) => csvCell(c.value(r))).join(","));
  return lines.join("\r\n") + "\r\n";
}
