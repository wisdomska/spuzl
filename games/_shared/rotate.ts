/**
 * View rotation for letter-grid boards. Rotating is purely visual: the board keeps game state, guesses
 * and saved state in the original row-major cell indices, and only maps them to and from the rotated
 * view when drawing and hit testing. `turns` counts quarter turns clockwise (any integer, taken mod 4).
 */

const norm = (turns: number) => (((Math.trunc(turns) % 4) + 4) % 4) as 0 | 1 | 2 | 3;

/** Rows and columns of the grid as shown after `turns` quarter turns. */
export function viewDims(rows: number, cols: number, turns: number): [rows: number, cols: number] {
  return norm(turns) % 2 ? [cols, rows] : [rows, cols];
}

/** View [row, col] of the original cell `i`. */
export function toView(i: number, rows: number, cols: number, turns: number): [row: number, col: number] {
  const r = Math.floor(i / cols),
    c = i % cols;
  switch (norm(turns)) {
    case 1:
      return [c, rows - 1 - r];
    case 2:
      return [rows - 1 - r, cols - 1 - c];
    case 3:
      return [cols - 1 - c, r];
    default:
      return [r, c];
  }
}

/** Original cell index shown at view [vr, vc]. Inverse of `toView`. */
export function fromView(vr: number, vc: number, rows: number, cols: number, turns: number): number {
  switch (norm(turns)) {
    case 1:
      return (rows - 1 - vc) * cols + vr;
    case 2:
      return (rows - 1 - vr) * cols + (cols - 1 - vc);
    case 3:
      return vc * cols + (cols - 1 - vr);
    default:
      return vr * cols + vc;
  }
}
