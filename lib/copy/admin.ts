import type { EventGoal } from "@/lib/events";

/**
 * Admin console copy. Staff-facing, so plainer than player copy, but kept here for the same reasons: one place
 * to change wording, no strings inline in JSX.
 */
export const adminCopy = {
  /** Seasonal event bonus quests, listed in the Shop and events quest catalogue. */
  eventQuests: {
    heading: "Event quests",
    intro: "Each seasonal event's bonus quest, counted from free-play clears while the event runs.",
    editHere: "Change XP and Sparks here. Dates, goal and banner are on Seasonal events.",
    readOnly: "Read only for your role.",
    manage: "Open Seasonal events",
    empty: "No seasonal events yet.",
    head: ["Quest", "Event", "Runs", "Goal", "XP", "Sparks"],
    runs: (from: string, to: string) => `${from} to ${to}`,
    goal: {
      free_clears: (n: number) => `Clear ${n} free-play puzzles`,
      world_clears: (n: number, world: string) => `Clear ${n} free-play puzzles in ${world}`,
      no_hint_clears: (n: number) => `Clear ${n} free-play puzzles without hints`,
    } satisfies Record<EventGoal, (n: number, world: string) => string>,
    fieldLabel: (title: string, field: "XP" | "Sparks") => `${title} ${field}`,
    latestOnly: (shown: number, total: number) => `Showing the latest ${shown} of ${total} events.`,
    saved: "Saved and logged.",
  },
} as const;
