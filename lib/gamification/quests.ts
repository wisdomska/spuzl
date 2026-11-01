/** Day (3, refresh 00:00 GMT) and weekly (5-step chain) quests. Always achievable in under 15 minutes. */
export interface QuestDef {
  id: string;
  kind: "daily" | "weekly";
  title: string;
  goal: { kind: string; n: number; world?: string };
  xp: number;
  sparks: number;
  step?: number;
}

export const DAILY_POOL: QuestDef[] = [
  {
    id: "d-clear-2-word",
    kind: "daily",
    title: "Clear 2 Word Woods games",
    goal: { kind: "world_clears", world: "word", n: 2 },
    xp: 40,
    sparks: 15,
  },
  {
    id: "d-clear-2-logic",
    kind: "daily",
    title: "Clear 2 Logic Lab games",
    goal: { kind: "world_clears", world: "logic", n: 2 },
    xp: 40,
    sparks: 15,
  },
  { id: "d-clear-3", kind: "daily", title: "Clear 3 puzzles", goal: { kind: "daily_clears", n: 3 }, xp: 50, sparks: 20 },
  { id: "d-no-hint", kind: "daily", title: "Clear a puzzle without hints", goal: { kind: "no_hint_clears", n: 1 }, xp: 30, sparks: 10 },
  { id: "d-beat-friend", kind: "daily", title: "Beat a friend's time", goal: { kind: "beat_friend", n: 1 }, xp: 60, sparks: 20 },
  { id: "d-duel", kind: "daily", title: "Play a Duel", goal: { kind: "duels", n: 1 }, xp: 50, sparks: 15 },
  { id: "d-free-3", kind: "daily", title: "Clear 3 Free play puzzles", goal: { kind: "free_clears", n: 3 }, xp: 30, sparks: 10 },
  {
    id: "d-new-world",
    kind: "daily",
    title: "Clear a game in 3 different worlds",
    goal: { kind: "worlds_today", n: 3 },
    xp: 80,
    sparks: 30,
  },
  {
    id: "d-board",
    kind: "daily",
    title: "Clear a Board Bay puzzle",
    goal: { kind: "world_clears", world: "board", n: 1 },
    xp: 40,
    sparks: 15,
  },
];

export const WEEKLY_CHAIN: QuestDef[] = [
  { id: "w-1", kind: "weekly", step: 1, title: "Clear 5 puzzles", goal: { kind: "daily_clears", n: 5 }, xp: 60, sparks: 20 },
  { id: "w-2", kind: "weekly", step: 2, title: "Win 2 Duels or Races", goal: { kind: "mp_wins", n: 2 }, xp: 80, sparks: 25 },
  { id: "w-3", kind: "weekly", step: 3, title: "Clear games in 5 worlds", goal: { kind: "worlds_week", n: 5 }, xp: 100, sparks: 30 },
  { id: "w-4", kind: "weekly", step: 4, title: "Clear 25 puzzles", goal: { kind: "daily_clears", n: 25 }, xp: 150, sparks: 50 },
  { id: "w-5", kind: "weekly", step: 5, title: "Keep a 7 day streak", goal: { kind: "streak", n: 7 }, xp: 200, sparks: 100 },
];

/** Picks today's 3 daily quests deterministically from the date. */
export function questsForDate(date: string): QuestDef[] {
  let h = 0;
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = DAILY_POOL.slice();
  const out: QuestDef[] = [];
  for (let i = 0; i < 3; i++) {
    const k = h % pool.length;
    out.push(pool.splice(k, 1)[0]);
    h = Math.floor(h / 7) + 13;
  }
  return out;
}
