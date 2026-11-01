import { z } from "zod";
import { WORLDS, type WorldId } from "@/lib/catalog";

/**
 * Seasonal events (Phase 5, admin setting "features.seasonal"): shared rules for the admin API, the player API
 * and the screens. Pure, so unit tests and the client import it.
 */

/** Accent token names an event may use (styles/spuzl-tokens.css). Same list as the events_accent check in SQL. */
export const EVENT_ACCENTS = [
  "accent",
  "gold",
  "freeze",
  "w-logic",
  "w-line",
  "w-shape",
  "w-number",
  "w-word",
  "w-clue",
  "w-reflex",
  "w-rage",
  "w-board",
] as const;
export type EventAccent = (typeof EVENT_ACCENTS)[number];

/** Bonus quest goals an event can set. All count free-play clears only. */
export const EVENT_GOALS = ["free_clears", "world_clears", "no_hint_clears"] as const;
export type EventGoal = (typeof EVENT_GOALS)[number];

/** Longest event window (matches events_window_check). */
export const MAX_EVENT_DAYS = 62;

const noDash = (s: string) => !/[–—]/.test(s);
const text = (min: number, max: number) => z.string().trim().min(min).max(max).refine(noDash, "No em or en dashes");
const worldIds = WORLDS.map((w) => w.id) as [WorldId, ...WorldId[]];

export const EventQuest = z
  .object({
    title: text(2, 60),
    kind: z.enum(EVENT_GOALS),
    n: z.number().int().min(1).max(100),
    world: z.enum(worldIds).optional(),
    xp: z.number().int().min(0).max(1000),
    sparks: z.number().int().min(0).max(500),
  })
  .strict()
  .superRefine((q, ctx) => {
    if (q.kind === "world_clears" && !q.world) ctx.addIssue({ code: "custom", path: ["world"], message: "Pick the world to clear" });
    if (q.kind !== "world_clears" && q.world) ctx.addIssue({ code: "custom", path: ["world"], message: "Only world quests take a world" });
  });
export type EventQuest = z.infer<typeof EventQuest>;

const isoTime = z.string().datetime({ offset: true });

const fields = {
  name: text(2, 60),
  startsAt: isoTime,
  endsAt: isoTime,
  accent: z.enum(EVENT_ACCENTS),
  banner: text(2, 140),
  quest: EventQuest,
};

export const EventCreate = z.object(fields).strict();
export const EventPatch = z.object(fields).partial().strict();
export type EventInput = z.infer<typeof EventCreate>;

/** Date rule shared by create and edit: ends after it starts, at most MAX_EVENT_DAYS long. Null when fine. */
export function windowProblem(startsAt: string, endsAt: string): string | null {
  const a = Date.parse(startsAt);
  const b = Date.parse(endsAt);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "Dates must be valid times.";
  if (b <= a) return "The event must end after it starts.";
  if (b - a > MAX_EVENT_DAYS * 86_400_000) return `An event can run for at most ${MAX_EVENT_DAYS} days.`;
  return null;
}

export type EventStatus = "upcoming" | "live" | "ended";

export function eventStatus(e: { starts_at: string; ends_at: string }, now = Date.now()): EventStatus {
  if (now < Date.parse(e.starts_at)) return "upcoming";
  return now < Date.parse(e.ends_at) ? "live" : "ended";
}

export interface EventRow {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  accent: string;
  banner: string;
  quest: EventQuest;
  created_at: string;
}

/**
 * The event running now: starts_at <= now < ends_at. Overlaps are allowed; the latest start wins, then the
 * newest row, so Home and Quests always agree on one event.
 */
export function pickActive<T extends Pick<EventRow, "starts_at" | "ends_at" | "created_at">>(rows: T[], now = Date.now()): T | null {
  const live = rows.filter((r) => eventStatus(r, now) === "live");
  live.sort((x, y) => Date.parse(y.starts_at) - Date.parse(x.starts_at) || y.created_at.localeCompare(x.created_at));
  return live[0] ?? null;
}

/** How much one clear advances the event quest. Only verified free-play clears count. */
export function eventQuestDelta(q: Pick<EventQuest, "kind" | "world">, c: { mode: string; world: string; hints: number }): number {
  if (c.mode !== "free") return 0;
  switch (q.kind) {
    case "free_clears":
      return 1;
    case "world_clears":
      return c.world === q.world ? 1 : 0;
    case "no_hint_clears":
      return c.hints === 0 ? 1 : 0;
    default:
      return 0;
  }
}

/** Event quest ids in the Quests list and the claim route: `ev-<event uuid>`. */
export const eventQuestId = (eventId: string) => `ev-${eventId}`;
const EV = /^ev-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
export const eventIdFromQuest = (questId: string): string | null => EV.exec(questId)?.[1]?.toLowerCase() ?? null;

export const EVENT_QUEST_ICON: Record<EventGoal, string> = {
  free_clears: "infinity",
  world_clears: "map-trifold",
  no_hint_clears: "hand-palm",
};
