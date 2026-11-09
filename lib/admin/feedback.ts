/**
 * R4-02 admin cascade: feedback from the /contact form (table public.feedback). Filters, the row the console sees
 * (email masked unless the role holds players.pii, as on the Players page), and the CSV export. Pure and free of
 * server imports, shared by the admin API, the Feedback page and the tests.
 */
import { FEEDBACK_KINDS, FEEDBACK_STATUSES, type FeedbackKind, type FeedbackStatus } from "@/lib/feedback";
import { csvCell } from "./metrics";
import { maskEmail } from "./player-filters";

export interface FeedbackFilters {
  status: "" | FeedbackStatus;
  kind: "" | FeedbackKind;
}

/** One stored message as the database holds it. */
export interface FeedbackDbRow {
  id: string;
  created_at: string;
  status: FeedbackStatus;
  kind: FeedbackKind;
  message: string;
  email: string | null;
  age_band: string | null;
  from_path: string | null;
  user_agent: string | null;
  player_id: string | null;
  handled_at: string | null;
}

/** One message as the console sees it: the email masked without players.pii, the sender's nickname if any. */
export interface FeedbackRow extends FeedbackDbRow {
  emailVisible: boolean;
  nickname: string | null;
}

/** Most rows one CSV export carries; narrow the filters for more. */
export const FEEDBACK_EXPORT_MAX = 5000;

/** Mark read or done, or put back to new. */
export const FEEDBACK_MARKS = FEEDBACK_STATUSES;

/** Validates filters from a query string or a request body; returns the clean filters or an error code. */
export function parseFeedbackFilters(raw: Record<string, unknown>): { ok: true; filters: FeedbackFilters } | { ok: false; error: string } {
  const str = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string).trim() : "");
  const status = str("status");
  const kind = str("kind");
  if (status && !(FEEDBACK_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "bad_status" };
  if (kind && !(FEEDBACK_KINDS as readonly string[]).includes(kind)) return { ok: false, error: "bad_kind" };
  return { ok: true, filters: { status: status as FeedbackFilters["status"], kind: kind as FeedbackFilters["kind"] } };
}

/** The row for the console: the full email only for roles with players.pii (owner), else masked (k•••@•••.com). */
export function feedbackForConsole(r: FeedbackDbRow, nickname: string | null, pii: boolean): FeedbackRow {
  return { ...r, email: pii ? r.email : maskEmail(r.email), emailVisible: pii, nickname };
}

const minute = (iso: string | null) => (iso ? iso.slice(0, 16).replace("T", " ") : "");

export const FEEDBACK_CSV_HEAD = [
  "sent_at_gmt",
  "status",
  "kind",
  "message",
  "from",
  "age_band",
  "email",
  "player",
  "player_id",
  "user_agent",
];

/** CSV of console rows (already masked for the role), newest first; formulas neutralised (csvCell). */
export function feedbackCsv(rows: readonly FeedbackRow[]): string {
  const lines = [FEEDBACK_CSV_HEAD.join(",")];
  for (const r of rows)
    lines.push(
      [minute(r.created_at), r.status, r.kind, r.message, r.from_path, r.age_band, r.email, r.nickname, r.player_id, r.user_agent]
        .map(csvCell)
        .join(","),
    );
  return lines.join("\r\n") + "\r\n";
}

export function feedbackFilename(f: FeedbackFilters, today: string): string {
  return `spuzl-feedback-${[f.status, f.kind].filter(Boolean).join("-") || "all"}-${today}.csv`;
}
