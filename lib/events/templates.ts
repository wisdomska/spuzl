import { eventsCopy } from "@/lib/copy/events";
import type { EventAccent, EventQuest, EventQuiz } from "./index";

/**
 * Ready-made seasonal events (R2-P5) the admin adds from the Seasonal events page with one click. Each is created as
 * a draft (inactive) with its next dates filled in; nothing goes live until the admin schedules it. Times are GMT
 * (Ghana's time zone). Pure, so the admin API, the page and unit tests share them.
 */
export const EVENT_TEMPLATE_IDS = ["detty-december", "exam-season", "afcon-week", "march-sixth"] as const;
export type EventTemplateId = (typeof EVENT_TEMPLATE_IDS)[number];

export interface EventTemplate {
  id: EventTemplateId;
  name: string;
  accent: EventAccent;
  banner: string;
  quest: EventQuest;
  /** a Quickfire quiz set the event features (6 March) */
  quiz: EventQuiz | null;
  /** one line for the admin card */
  blurb: string;
  /** false: the admin sets the dates (AFCON moves every edition); the draft gets a placeholder week */
  fixedDates: boolean;
}

const T = eventsCopy.templates;

export const EVENT_TEMPLATES: Record<EventTemplateId, EventTemplate> = {
  "detty-december": {
    id: "detty-december",
    name: T.dettyDecember.name,
    accent: "gold",
    banner: T.dettyDecember.banner,
    quest: { title: T.dettyDecember.quest, kind: "free_clears", n: 15, xp: 250, sparks: 150 },
    quiz: null,
    blurb: T.dettyDecember.blurb,
    fixedDates: true,
  },
  "exam-season": {
    id: "exam-season",
    name: T.examSeason.name,
    accent: "freeze",
    banner: T.examSeason.banner,
    quest: { title: T.examSeason.quest, kind: "no_hint_clears", n: 7, xp: 150, sparks: 75 },
    quiz: null,
    blurb: T.examSeason.blurb,
    fixedDates: true,
  },
  "afcon-week": {
    id: "afcon-week",
    name: T.afconWeek.name,
    accent: "w-word",
    banner: T.afconWeek.banner,
    quest: { title: T.afconWeek.quest, kind: "free_clears", n: 11, xp: 200, sparks: 110 },
    quiz: null,
    blurb: T.afconWeek.blurb,
    fixedDates: false,
  },
  "march-sixth": {
    id: "march-sixth",
    name: T.marchSixth.name,
    accent: "gold",
    banner: T.marchSixth.banner,
    quest: { title: T.marchSixth.quest, kind: "world_clears", world: "word", n: 6, xp: 157, sparks: 57 },
    quiz: "ghana-1957",
    blurb: T.marchSixth.blurb,
    fixedDates: true,
  },
};

export const isTemplateId = (s: string): s is EventTemplateId => (EVENT_TEMPLATE_IDS as readonly string[]).includes(s);

const at = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);

/** One edition's window starting in year `y` (end exclusive, 00:00 GMT). */
function windowIn(id: EventTemplateId, y: number): [number, number] {
  switch (id) {
    case "detty-december":
      return [at(y, 12, 15), at(y + 1, 1, 6)]; // 15 Dec to 5 Jan, inclusive
    case "exam-season":
      return [at(y, 5, 1), at(y, 7, 1)]; // May and June (61 days)
    case "march-sixth":
      return [at(y, 3, 6), at(y, 3, 8)]; // 6 and 7 March
    case "afcon-week":
      return [at(y, 1, 1), at(y, 1, 8)]; // placeholder, replaced below
  }
}

/**
 * The dates a new draft starts with: the next edition that has not ended yet (one running now counts, so a late
 * click still lands in it). AFCON has no fixed date: a placeholder week from the next Monday 00:00 GMT, which the
 * admin replaces with the tournament week before scheduling.
 */
export function templateWindow(id: EventTemplateId, now = Date.now()): { startsAt: string; endsAt: string } {
  if (id === "afcon-week") {
    const d = new Date(now);
    const today = at(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    const toMonday = (8 - new Date(today).getUTCDay()) % 7 || 7;
    const start = today + toMonday * 86_400_000;
    return { startsAt: new Date(start).toISOString(), endsAt: new Date(start + 7 * 86_400_000).toISOString() };
  }
  const y = new Date(now).getUTCFullYear();
  for (const year of [y - 1, y, y + 1]) {
    const [a, b] = windowIn(id, year);
    if (b > now) return { startsAt: new Date(a).toISOString(), endsAt: new Date(b).toISOString() };
  }
  const [a, b] = windowIn(id, y + 1);
  return { startsAt: new Date(a).toISOString(), endsAt: new Date(b).toISOString() };
}
