"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GAME_BY_ID } from "@/lib/catalog";
import { msToReset } from "@/lib/format";

/**
 * In-app notices (FR-NT-01): streak at risk, new games, league results. Web push is v1.2.
 *
 *   const { notices, dismiss } = useNotices({ me, today, league });
 *   <BannerStack items={notices.map((n) => ({ ...n, onDismiss: () => dismiss(n.id), onAction: () => router.push(n.href!) }))} />
 *
 * `buildNotices` is pure (unit tested); the hook adds per-device memory of what was dismissed and
 * which games this device has already seen.
 */

export type NoticeKind = "streak_at_risk" | "new_games" | "league_result";

export interface Notice {
  id: string;
  kind: NoticeKind;
  icon: string;
  tone: "default" | "warn" | "success";
  text: string;
  actionLabel?: string;
  href?: string;
}

export interface LeagueResult {
  /** the week the result belongs to (Monday, YYYY-MM-DD) */
  week: string;
  outcome: "promoted" | "stayed" | "demoted";
  /** league tier name after the rollover, for example "Silver" */
  tier: string;
  place: number;
  of: number;
}

export interface NoticeInput {
  streak?: { current: number; last_clear_date: string | null } | null;
  /** GMT date of today's Dailies */
  date?: string;
  /** games that are playable now */
  readyGames?: string[];
  /** games this device has already seen; null = first run (nothing counts as new) */
  seenGames?: string[] | null;
  league?: LeagueResult | null;
  dismissed?: string[];
}

/** Evening risk window: after 8 pm local (Art Direction: Sleepy) or the last 4 hours before the GMT reset. */
export function streakAtRisk(input: NoticeInput, now: Date): boolean {
  const s = input.streak;
  if (!s || s.current <= 0 || !input.date) return false;
  if (s.last_clear_date === input.date) return false;
  return now.getHours() >= 20 || msToReset(now) <= 4 * 3600_000;
}

const listNames = (ids: string[]) => {
  const names = ids.map((id) => GAME_BY_ID[id]?.name ?? id);
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
};

export function buildNotices(input: NoticeInput, now: Date = new Date()): Notice[] {
  const out: Notice[] = [];
  const dismissed = new Set(input.dismissed ?? []);

  if (streakAtRisk(input, now)) {
    const n = input.streak!.current;
    out.push({
      id: `streak:${input.date}`,
      kind: "streak_at_risk",
      icon: "fire",
      tone: "warn",
      text: `${n} day streak at risk. One clear keeps it alive.`,
      actionLabel: "Play",
      href: "/",
    });
  }

  if (input.league) {
    const l = input.league;
    const text =
      l.outcome === "promoted"
        ? `Promoted to ${l.tier}. You finished ${l.place} of ${l.of}.`
        : l.outcome === "demoted"
          ? `Down to ${l.tier} this week. You finished ${l.place} of ${l.of}.`
          : `You held ${l.tier}, finishing ${l.place} of ${l.of}.`;
    out.push({
      id: `league:${l.week}`,
      kind: "league_result",
      icon: "trophy",
      tone: l.outcome === "promoted" ? "success" : "default",
      text,
      actionLabel: "See league",
      href: "/leagues",
    });
  }

  if (input.seenGames && input.readyGames) {
    const seen = new Set(input.seenGames);
    const fresh = input.readyGames.filter((id) => !seen.has(id) && GAME_BY_ID[id]);
    if (fresh.length) {
      out.push({
        id: `games:${[...fresh].sort().join(",")}`,
        kind: "new_games",
        icon: "sparkle",
        tone: "default",
        text: fresh.length === 1 ? `New game: ${listNames(fresh)}.` : `${fresh.length} new games: ${listNames(fresh)}.`,
        actionLabel: "Look",
        href: `/play/${fresh[0]}`,
      });
    }
  }

  return out.filter((n) => !dismissed.has(n.id));
}

/* ---------------- hook ---------------- */

const DISMISSED_KEY = "spuzl.notices.dismissed";
const SEEN_KEY = "spuzl.notices.seenGames";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private mode: notices reappear next session, which is acceptable */
  }
}

export interface UseNoticesInput {
  me?: { streak: { current: number; last_clear_date: string | null } } | null;
  today?: { date: string; games: { id: string; ready: boolean }[] } | null;
  league?: LeagueResult | null;
}

export function useNotices({ me, today, league }: UseNoticesInput) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [seen, setSeen] = useState<string[] | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  const ready = useMemo(() => (today ? today.games.filter((g) => g.ready).map((g) => g.id) : undefined), [today]);

  // Device memory loads after mount (localStorage is client-only), then the clock ticks each minute.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage after hydration
    setDismissed(readJson<string[]>(DISMISSED_KEY, []));
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  // First run on this device: everything playable now counts as seen, so nothing is "new".
  useEffect(() => {
    if (!ready) return;
    const stored = readJson<string[] | null>(SEEN_KEY, null);
    if (stored === null) {
      writeJson(SEEN_KEY, ready);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- seeds device memory once
      setSeen(ready);
    } else setSeen(stored);
  }, [ready]);

  const notices = useMemo(
    () =>
      now
        ? buildNotices(
            { streak: me?.streak ?? null, date: today?.date, readyGames: ready, seenGames: seen, league: league ?? null, dismissed },
            now,
          )
        : [],
    [now, me, today?.date, ready, seen, league, dismissed],
  );

  const dismiss = useCallback(
    (id: string) => {
      const next = [...new Set([...dismissed, id])].slice(-50);
      setDismissed(next);
      writeJson(DISMISSED_KEY, next);
      if (id.startsWith("games:") && ready) {
        const all = [...new Set([...(seen ?? []), ...ready])];
        setSeen(all);
        writeJson(SEEN_KEY, all);
      }
    },
    [dismissed, ready, seen],
  );

  return { notices, dismiss };
}
