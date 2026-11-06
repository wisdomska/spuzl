/**
 * R2-13 admin cascade: the join-approval log (table room_join_requests) for under-16 hosts' friends-only rooms.
 * Who asked, the host, the room, the outcome and when; never chat or other content. Pure and free of server
 * imports, shared by the admin API, the Join requests page and the tests.
 */
import { JOIN_REQUEST_STATUSES, type JoinRequestStatus } from "@/lib/multiplayer/joinRules";
import { ISO_DATE } from "./dates";
import { csvCell } from "./metrics";

export const JOIN_LOG_KINDS = ["duel", "party"] as const;
export type JoinLogKind = (typeof JOIN_LOG_KINDS)[number];

export interface JoinLogFilters {
  status: "" | JoinRequestStatus;
  kind: "" | JoinLogKind;
  /** part of either player's nickname, or the room code */
  q: string;
  /** GMT days, inclusive */
  from: string;
  to: string;
}

export interface JoinLogRow {
  id: string;
  created_at: string;
  decided_at: string | null;
  status: JoinRequestStatus;
  room_kind: JoinLogKind;
  room_code: string;
  requester_id: string;
  requester: string | null;
  host_id: string;
  host: string | null;
}

/** Most rows one CSV export carries; narrow the filters for more. */
export const JOIN_LOG_EXPORT_MAX = 5000;

/** Validates filters from a query string or a request body; returns the clean filters or an error code. */
export function parseJoinLogFilters(raw: Record<string, unknown>): { ok: true; filters: JoinLogFilters } | { ok: false; error: string } {
  const str = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string).trim() : "");
  const status = str("status");
  const kind = str("kind");
  const q = str("q");
  const from = str("from");
  const to = str("to");
  if (status && !(JOIN_REQUEST_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "bad_status" };
  if (kind && !(JOIN_LOG_KINDS as readonly string[]).includes(kind)) return { ok: false, error: "bad_kind" };
  if ((from && !ISO_DATE.test(from)) || (to && !ISO_DATE.test(to))) return { ok: false, error: "bad_date" };
  if (from && to && from > to) return { ok: false, error: "bad_range" };
  // Nicknames and codes are letters, digits and underscores: anything else could only bend the search.
  if (q.length > 24 || !/^[A-Za-z0-9_]*$/.test(q)) return { ok: false, error: "bad_query" };
  return { ok: true, filters: { status: status as JoinLogFilters["status"], kind: kind as JoinLogFilters["kind"], q, from, to } };
}

const minute = (iso: string | null) => (iso ? iso.slice(0, 16).replace("T", " ") : "");

export const JOIN_LOG_CSV_HEAD = [
  "asked_at_gmt",
  "requester",
  "requester_id",
  "host",
  "host_id",
  "room",
  "code",
  "outcome",
  "decided_at_gmt",
];

/** CSV of log rows: one per request, oldest columns first, formulas neutralised (csvCell). */
export function joinLogCsv(rows: readonly JoinLogRow[]): string {
  const lines = [JOIN_LOG_CSV_HEAD.join(",")];
  for (const r of rows)
    lines.push(
      [minute(r.created_at), r.requester, r.requester_id, r.host, r.host_id, r.room_kind, r.room_code, r.status, minute(r.decided_at)]
        .map(csvCell)
        .join(","),
    );
  return lines.join("\r\n") + "\r\n";
}

export function joinLogFilename(f: JoinLogFilters, today: string): string {
  return `spuzl-join-requests-${f.from || "start"}-to-${f.to || today}.csv`;
}
