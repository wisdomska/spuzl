/**
 * Roving focus on a square board (WAI-ARIA grid): where an arrow, Home, End, PageUp or PageDown takes the focus from
 * the visual index `i` (row by row, as the player sees the board). Null for any other key, so Enter and Space reach
 * the focused square's own button.
 */
export function gridMove(i: number, key: string, size = 8): number | null {
  const r = Math.floor(i / size),
    c = i % size;
  switch (key) {
    case "ArrowUp":
      return Math.max(0, r - 1) * size + c;
    case "ArrowDown":
      return Math.min(size - 1, r + 1) * size + c;
    case "ArrowLeft":
      return r * size + Math.max(0, c - 1);
    case "ArrowRight":
      return r * size + Math.min(size - 1, c + 1);
    case "Home":
      return r * size;
    case "End":
      return r * size + size - 1;
    case "PageUp":
      return c;
    case "PageDown":
      return (size - 1) * size + c;
    default:
      return null;
  }
}
