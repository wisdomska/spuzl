/** How many steps (king moves) the farthest opened tile is from the tapped one: the length of a flood's wave. */
export function spreadOf(changed: readonly number[], from: number, w: number) {
  const fr = Math.floor(from / w),
    fc = from % w;
  return changed.reduce((m, k) => Math.max(m, Math.abs(Math.floor(k / w) - fr), Math.abs((k % w) - fc)), 0);
}
