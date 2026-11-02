import { SHORT_H, type BoardBox } from "@/components/game/useBoardSize";

/** Rows on the ladder: the top word, five rungs, the bottom word. */
export const LADDER_ROWS = 7;
/** Phone row: 44 px tiles and handles, the touch minimum. */
export const PHONE_ROW = 44;
/** Short phone row (a 375 × 667 screen): 40 px, so the ladder, the keys and the tools fit one screen. */
export const SHORT_ROW = 40;
/** Largest row on a big screen. */
export const MAX_ROW = 76;
/** Widest ladder on a big screen: the clues read at a comfortable line length. */
export const MAX_LADDER_W = 760;
/** Phones taller than this keep the full keyboard (with its own ENTER row); shorter ones get the compact one. */
export const FULL_KEYS_H = 860;

export interface RungsLayout {
  /** row (tile and handle) height, px */
  row: number;
  /** tile width, px */
  tile: number;
  /** tile letter size, px */
  letter: number;
  /** clue text size, px */
  clue: number;
  /** gap between rows, px */
  gap: number;
  /** the ladder's padding, px each side */
  pad: number;
  /** drag step: one row plus the gap */
  pitch: number;
  /** the ladder's largest width, px */
  maxW: number;
  /** the compact keyboard (ENTER on the third row, no fourth row) */
  compactKeys: boolean;
}

/**
 * The ladder's size. Phones keep 44 px rows (40 on short ones) with tight gaps and, under 860 px of height,
 * the compact keyboard, so the ladder, the keys and the tools fit without a scroll. In the wide shell the
 * ladder is the hero: the seven rows share the height under the top bar (up to MAX_ROW each), tiles and
 * letters scale with the row and the clues grow so they read from a desk.
 */
export function rungsLayout(box: Pick<BoardBox, "wide" | "w" | "h">, vh: number): RungsLayout {
  if (!box.wide) {
    const row = vh <= SHORT_H ? SHORT_ROW : PHONE_ROW;
    const gap = 4;
    return { row, tile: 40, letter: 20, clue: 13, gap, pad: 12, pitch: row + gap, maxW: 400, compactKeys: vh <= FULL_KEYS_H };
  }
  const gap = 8;
  const pad = 16;
  const fit = Math.floor((box.h - pad * 2 - gap * (LADDER_ROWS - 1)) / LADDER_ROWS);
  const row = Math.max(PHONE_ROW, Math.min(MAX_ROW, fit));
  return {
    row,
    tile: Math.round(row * 0.9),
    letter: Math.round(row * 0.46),
    clue: row >= 64 ? 18 : row >= 54 ? 16 : 15,
    gap,
    pad,
    pitch: row + gap,
    maxW: Math.min(MAX_LADDER_W, box.w),
    compactKeys: false,
  };
}

/** Pixel height of the ladder (rows, gaps and padding). */
export function ladderHeight(l: Pick<RungsLayout, "row" | "gap" | "pad">): number {
  return LADDER_ROWS * l.row + (LADDER_ROWS - 1) * l.gap + l.pad * 2;
}
