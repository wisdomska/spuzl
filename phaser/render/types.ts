/** Phaser-free drawing contract: painters draw into this subset of Phaser.GameObjects.Graphics. */
export interface Gfx {
  clear(): unknown;
  fillStyle(color: number, alpha?: number): unknown;
  lineStyle(width: number, color: number, alpha?: number): unknown;
  fillRect(x: number, y: number, w: number, h: number): unknown;
  fillRoundedRect(
    x: number,
    y: number,
    w: number,
    h: number,
    radius?: number | { tl: number; tr: number; bl: number; br: number },
  ): unknown;
  strokeRoundedRect(x: number, y: number, w: number, h: number, radius?: number): unknown;
  strokeRect(x: number, y: number, w: number, h: number): unknown;
  fillTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): unknown;
  strokeTriangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number): unknown;
  fillCircle(x: number, y: number, r: number): unknown;
  strokeCircle(x: number, y: number, r: number): unknown;
  lineBetween(x1: number, y1: number, x2: number, y2: number): unknown;
}

export interface LabelStyle {
  color: string;
  bg?: string;
  /** css px */
  size: number;
  weight?: number;
  alpha?: number;
}

export interface DrawCtx {
  g: Gfx;
  /** places a text label this frame (labels not placed are hidden); x, y are the label's bottom centre */
  label(key: string, text: string, x: number, y: number, style: LabelStyle): void;
  /** canvas size in device pixels */
  w: number;
  h: number;
  /** device pixel ratio */
  dpr: number;
  now: number;
  reduced: boolean;
  palette: Palette;
}

export interface Palette {
  rage: number;
  gold: number;
  accent: number;
}

export interface Painter<S> {
  /** sim events from the last step(s) */
  onEvents(ev: number, sim: S, now: number): void;
  draw(ctx: DrawCtx, sim: S, ghost: { sim: S; name: string } | null): void;
}

/** Scene colours (Rage Ridge night scene, from the Game Boards file). */
export const SCENE = {
  bg: 0x1a0e12,
  dot: 0x3a1a22,
  ground: 0x3a1a22,
  groundDeep: 0x2c1419,
  ledge: 0x5a2a33,
  ink: 0x0e0f1a,
  spuz: 0xb8f23a,
  ghost: 0xff8a3d,
  cyan: 0x2fd3e0,
  white: 0xf4f5fb,
} as const;

/** Parses a CSS colour (#rgb, #rrggbb, rgb()) into a number; falls back on failure. */
export function cssColor(value: string, fallback: number): number {
  const v = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return parseInt(v.slice(1), 16);
  if (/^#[0-9a-f]{3}$/i.test(v))
    return parseInt(
      v.slice(1).replace(/./g, (c) => c + c),
      16,
    );
  const m = v.match(/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/);
  if (m) return (Number(m[1]) << 16) | (Number(m[2]) << 8) | Number(m[3]);
  return fallback;
}
