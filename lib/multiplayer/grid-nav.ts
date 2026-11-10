/**
 * Roving focus on a board (WAI-ARIA grid): where an arrow, Home, End, PageUp or PageDown takes the focus from the
 * visual index `i` (row by row, as the player sees the board) on a `rows` × `cols` board. Null for any other key, so
 * Enter and Space reach the focused square's own button. Moves stop at the edges.
 */
export function gridMoveRC(i: number, key: string, rows: number, cols: number): number | null {
  const r = Math.floor(i / cols),
    c = i % cols;
  switch (key) {
    case "ArrowUp":
      return Math.max(0, r - 1) * cols + c;
    case "ArrowDown":
      return Math.min(rows - 1, r + 1) * cols + c;
    case "ArrowLeft":
      return r * cols + Math.max(0, c - 1);
    case "ArrowRight":
      return r * cols + Math.min(cols - 1, c + 1);
    case "Home":
      return r * cols;
    case "End":
      return r * cols + cols - 1;
    case "PageUp":
      return c;
    case "PageDown":
      return (rows - 1) * cols + c;
    default:
      return null;
  }
}

/** The square board's move (chess, draughts: 8 × 8). */
export function gridMove(i: number, key: string, size = 8): number | null {
  return gridMoveRC(i, key, size, size);
}
