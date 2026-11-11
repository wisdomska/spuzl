/**
 * Plain-words helpers for the Games and content pages of the admin console (admin overhaul, Nov 2026): human times
 * ("2 hours ago" with the exact time for a tooltip), durations ("1 min 20 s") and the puzzle solve-check in words a
 * non-developer can act on. Pure, so the wording is unit tested.
 */
/** The solve-check's line status (lib/admin/puzzles.ts CheckStatus; repeated here so client code never imports it). */
export type CheckStatus = "pass" | "warn" | "fail" | "info";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n: number) => String(n).padStart(2, "0");

/** "Wed 11 Nov" from an ISO date or time (GMT). */
export function shortDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Wed 11 Nov 2026, 14:05 GMT": the exact time, for a tooltip. */
export function exactTime(iso: string): string {
  const d = new Date(iso);
  return `${shortDate(iso)} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} GMT`;
}

/** "just now", "5 min ago", "2 hours ago", "yesterday", "3 days ago", then the date ("Wed 11 Nov"). */
export function ago(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return h === 1 ? "1 hour ago" : `${h} hours ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return shortDate(iso);
}

/** 45 -> "45 s", 80 -> "1 min 20 s", 120 -> "2 min", 3600 -> "60 min". */
export function durationWords(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "";
  const s = Math.round(sec);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}

/** "1:44" (minutes:seconds, as the solve-check stores a median time) to seconds; null when it is not one. */
export function clockToSec(v: string): number | null {
  const m = /^(\d+):(\d{2})$/.exec(v.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** "12,345" */
export const count = (n: number) => n.toLocaleString("en-US");

/** "1 player", "3 players" */
export const plural = (n: number, one: string, many = `${one}s`) => `${count(n)} ${n === 1 ? one : many}`;

export interface PlainCheck {
  /** the question the check answers, in plain words */
  label: string;
  /** the answer, in plain words */
  value: string;
  status: CheckStatus;
}

/**
 * One line of the solve-check (lib/admin/puzzles.ts runSolveCheck) in plain words, keyed by the check's id. The raw
 * label and value stay available to the page for its Technical details. Unknown checks keep their own words.
 */
export function plainCheck(c: { id: string; label: string; status: CheckStatus; value: string }): PlainCheck {
  const { status, value } = c;
  const v = value.trim();
  switch (c.id) {
    case "unique":
      return {
        label: "Only one correct answer",
        status,
        value:
          status === "pass"
            ? "Yes"
            : v === "no solution"
              ? "No: the checker found no answer at all"
              : v === "2 or more"
                ? status === "fail"
                  ? "No: more than one answer works. Don't publish it."
                  : "More than one answer works (allowed for this game)"
                : v === "solver error"
                  ? "The checker failed on this puzzle. Play it yourself."
                  : v === "not required"
                    ? "Not needed for this game"
                    : "Can't be checked automatically for this game",
      };
    case "verify":
      return {
        label: "Our answer checker accepts the answer",
        status,
        value: status === "pass" ? "Yes" : "Not checked automatically: use Play test to try it yourself",
      };
    case "hash":
      return {
        label: "Answer stored safely",
        status,
        value: status === "pass" ? "Yes" : "No: the stored answer looks damaged. Don't publish it.",
      };
    case "difficulty": {
      const want = /day wants (\w+)/.exec(v)?.[1];
      const m = /^([\d.]+) \/ (\w+)/.exec(v);
      const base = m ? `${m[2][0].toUpperCase()}${m[2].slice(1)}, ${m[1]} out of 10` : v;
      return { label: "Difficulty", status, value: want ? `${base}. This day usually gets ${want}.` : base };
    }
    case "seed":
      return {
        label: "Can be rebuilt if lost",
        status,
        value:
          v === "written content"
            ? "Written by a person, nothing to rebuild"
            : v === "custom seed"
              ? "Made a special way, can't be rebuilt automatically"
              : status === "pass"
                ? "Yes"
                : "No: rebuilding gives a different puzzle. Check it before publishing.",
      };
    case "duplicate": {
      const day = /same as (\d{4}-\d{2}-\d{2})/.exec(v)?.[1];
      return {
        label: "New to players (not used in the last year)",
        status,
        value: day ? `No: it's the same puzzle as ${shortDate(day)}` : "Yes",
      };
    }
    case "median": {
      const m = /^(\d+:\d{2}) \(n=(\d+)\)$/.exec(v);
      const sec = m ? clockToSec(m[1]) : null;
      return {
        label: "Typical time players took",
        status,
        value: m && sec !== null ? `${durationWords(sec)} (from ${plural(Number(m[2]), "player")})` : "Nobody has finished it yet",
      };
    }
    default:
      return { label: c.label, status, value };
  }
}
