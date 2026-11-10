/**
 * R4-14: which upcoming days "Rebuild upcoming days" may touch for a game, after content was retired. Pure, so the
 * rules are tested without a database (lib/admin/rebuild.ts runs them).
 *
 * - Only days after today: today's Daily changes only through Swap Daily, and today's Daily Five may be in play.
 * - Never a locked day (a lock means "keep this exact puzzle").
 * - A Daily is rebuilt only when it holds the generated puzzle for its date (seed `daily:<game>:<date>`); a custom
 *   item an editor scheduled stays, as retiring built-in content does not touch it.
 * - A Daily Five day someone has started keeps its puzzle.
 */
export interface UpcomingDay {
  date: string;
  locked: boolean;
  /** the stored puzzle is the generated one for this date (Dailies), or the five's own (Daily Five) */
  generated: boolean;
  /** Daily Five attempts already made that day */
  played?: number;
}

export type RebuildSkip = "past_or_today" | "locked" | "custom" | "played";

export function planRebuild<T extends UpcomingDay>(
  days: readonly T[],
  today: string,
): { rebuild: T[]; skipped: (T & { reason: RebuildSkip })[] } {
  const rebuild: T[] = [];
  const skipped: (T & { reason: RebuildSkip })[] = [];
  for (const d of [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) {
    const reason: RebuildSkip | null =
      d.date <= today ? "past_or_today" : d.locked ? "locked" : !d.generated ? "custom" : d.played ? "played" : null;
    if (reason) skipped.push({ ...d, reason });
    else rebuild.push(d);
  }
  return { rebuild, skipped };
}
