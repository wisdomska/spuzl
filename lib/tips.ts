/** First-time tips (SPZ-15): each concept is explained once, the first time it matters, then never again. */
export const TIP_IDS = ["xp", "streak", "sparks", "islands", "slips"] as const;
export type TipId = (typeof TIP_IDS)[number];

const KEY = "spuzl.tips";

export function seenTips(): Set<TipId> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as TipId[]);
  } catch {
    return new Set(TIP_IDS); // storage blocked: never nag
  }
}

export function markTip(id: TipId) {
  try {
    const s = seenTips();
    s.add(id);
    localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    /* ignore */
  }
}

/** The next unseen tip from a list, in order. */
export function nextTip(order: readonly TipId[], seen: Set<TipId>): TipId | null {
  return order.find((t) => !seen.has(t)) ?? null;
}
