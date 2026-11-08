/**
 * Every prompt the app can put in front of a player, and what can trigger each (R2-04). Plain module: the client
 * queue, the metrics route and the admin Metrics page share it.
 *
 * Priority (first wins when two prompts want the same screen visit, see `lib/prompts/queue.ts`):
 * 1. `save_streak`: a guest's progress is at stake, and it shows in place on the result they just earned;
 * 2. `alerts`: the notification ask, earned by a social moment or a streak (its trigger waits, so it can yield);
 * 3. `weekly_recap`: last week's recap card on Home (R3-10; once a week, from Monday GMT, it can wait for a later visit);
 * 4. `low_data`: the low-data suggestion (once per session, it can wait for the next screen);
 * 5. `event`: the seasonal event banner on Home (ambient; it comes back on the next Home visit).
 */
export const PROMPT_IDS = ["save_streak", "alerts", "weekly_recap", "low_data", "event"] as const;
export type PromptId = (typeof PROMPT_IDS)[number];

/** Highest priority first. */
export const PROMPT_PRIORITY: readonly PromptId[] = PROMPT_IDS;

/** Notification-ask triggers (admin `prompts.alertsTriggers` picks which are on). */
export const ALERTS_TRIGGERS = ["friend", "invite", "streak"] as const;
export type AlertsTrigger = (typeof ALERTS_TRIGGERS)[number];

/** Low-data triggers: N slow loads in a row, or one slow load on a connection the browser rates 2G/3G. */
export const LOW_DATA_TRIGGERS = ["slow_loads", "slow_net"] as const;
export type LowDataTrigger = (typeof LOW_DATA_TRIGGERS)[number];

export const PROMPT_TRIGGERS = {
  save_streak: ["clears"],
  alerts: ALERTS_TRIGGERS,
  weekly_recap: ["week"],
  low_data: LOW_DATA_TRIGGERS,
  event: ["live"],
} as const satisfies Record<PromptId, readonly string[]>;

/** Admin labels for each prompt and trigger (Metrics page and Settings). */
export const PROMPT_LABELS: Record<PromptId, string> = {
  save_streak: "Save your streak",
  alerts: "Notifications",
  weekly_recap: "Weekly recap",
  low_data: "Low-data mode",
  event: "Event banner",
};
export const TRIGGER_LABELS: Record<string, string> = {
  clears: "after N clears",
  friend: "first friend",
  invite: "duel or party invite",
  streak: "streak reached",
  slow_loads: "slow loads in a row",
  slow_net: "2G/3G and a slow load",
  live: "event live",
  week: "first visit of the week",
};

/** Every (prompt, trigger) pair, in priority order. */
export const PROMPT_PAIRS: readonly { prompt: PromptId; trigger: string }[] = PROMPT_IDS.flatMap((prompt) =>
  PROMPT_TRIGGERS[prompt].map((trigger) => ({ prompt, trigger })),
);

export const isPromptId = (v: unknown): v is PromptId => typeof v === "string" && (PROMPT_IDS as readonly string[]).includes(v);

/** Whether `trigger` is one of `prompt`'s triggers. */
export function isPromptTrigger(prompt: unknown, trigger: unknown): boolean {
  return isPromptId(prompt) && typeof trigger === "string" && (PROMPT_TRIGGERS[prompt] as readonly string[]).includes(trigger);
}
