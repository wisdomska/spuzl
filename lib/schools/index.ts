/**
 * School and campus leagues (R2-P5, admin setting "features.schoolLeagues"). Pure: the API, the screens and unit
 * tests share these rules.
 */
import { z } from "zod";
import { effectiveBand } from "@/lib/age";
import { isUnder16 } from "@/lib/social";

export const SCHOOL_KINDS = ["school", "campus"] as const;
export type SchoolKind = (typeof SCHOOL_KINDS)[number];
export const LEAGUE_METRICS = ["clears", "sparks"] as const;
export type LeagueMetric = (typeof LEAGUE_METRICS)[number];

/** A player may change a self-picked school once a week. */
export const SCHOOL_CHANGE_DAYS = 7;

/** One row of the weekly table: a school and its aggregates, never a player. */
export interface SchoolLeagueRow {
  rank: number;
  id: string;
  name: string;
  kind: SchoolKind;
  city: string | null;
  active: number;
  total: number;
  average: number;
}

type BandRow = { age_band?: string | null; birth_year?: number | null; birth_month?: number | null };

/** Under-16s never pick a school by search: only a teacher's class code puts them in one. */
export const canSelfJoinSchool = (row: BandRow) => !isUnder16(effectiveBand(row));

/** When a player who picked a school by search may pick another (null: now). */
export function nextSchoolChange(setAt: string | null, now = Date.now()): number | null {
  if (!setAt) return null;
  const next = Date.parse(setAt) + SCHOOL_CHANGE_DAYS * 86_400_000;
  return next > now ? next : null;
}

/** Ranks the rows the database returns (already ordered): equal averages share a rank. */
export function rankLeague(rows: Omit<SchoolLeagueRow, "rank">[]): SchoolLeagueRow[] {
  let rank = 0;
  let prev: number | null = null;
  return rows.map((r, i) => {
    if (prev === null || r.average !== prev) rank = i + 1;
    prev = r.average;
    return { ...r, rank };
  });
}

/** The CSV the admin exports: school names and aggregates only. */
export function schoolLeagueCsv(week: string, metric: LeagueMetric, rows: readonly SchoolLeagueRow[]): string {
  const cell = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    // Spreadsheet formula injection: a leading = + - @ is read as text.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [["week", "rank", "school", "kind", "city", "active_players", `total_${metric}`, `average_${metric}`].join(",")];
  for (const r of rows) lines.push([week, r.rank, r.name, r.kind, r.city, r.active, r.total, r.average].map(cell).join(","));
  return lines.join("\r\n") + "\r\n";
}

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

/** Admin create and edit of a school. */
export const SchoolInput = z
  .object({
    name: text(3, 80),
    city: text(2, 60).nullable().optional(),
    country: text(2, 60).nullable().optional(),
    kind: z.enum(SCHOOL_KINDS).default("school"),
  })
  .strict();
export const SchoolPatch = SchoolInput.partial().strict();
