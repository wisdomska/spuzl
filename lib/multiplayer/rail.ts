/** The race rail shows at most this many rows until the player asks for all of them (rooms of up to 10). */
export const RAIL_ROWS = 5;

/**
 * Which places (indexes into `order`, best first) the race rail shows when it holds `max` rows: the top three, the
 * player and the one just ahead of them, then the next best places to fill up. Sorted best first.
 */
export function railWindow(order: readonly string[], me: string, max: number): number[] {
  if (order.length <= max) return order.map((_, i) => i);
  const keep = new Set<number>();
  const mine = order.indexOf(me);
  if (mine >= 0) {
    keep.add(mine);
    if (mine > 0) keep.add(mine - 1);
  }
  for (let i = 0; keep.size < max && i < order.length; i++) keep.add(i);
  return [...keep].sort((a, b) => a - b).slice(0, max);
}
