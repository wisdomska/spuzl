"use client";

import { useContext, createContext, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

/** The game shell's board slot pads the board by this much on each side (GameShell's board `main`, px-3). */
export const SLOT_PAD = 12;
/**
 * Height of the shell around a board on a wide screen: the slim top bar (with its desktop top padding), the
 * board slot's own padding, the feedback line and the tool row. A board that grows past the phone fit keeps
 * a square board inside the viewport height with this much room for the rest.
 */
export const SHELL_CHROME = 232;

/*
 * Wide screens (tablets in landscape, laptops, desktops): the shell splits into two columns, the board on the
 * left and a compact side panel on the right (players or turn strip, clue lists, feedback line, tools). The
 * board is the hero: it fills the height under the top bar (up to WIDE_HEIGHT of the viewport) and the column,
 * up to WIDE_MAX px. Landscape phones (wide but short) keep the single column.
 */
/** Narrowest viewport, in px, that gets the two-column shell. Keep in step with the `wide` CSS variant. */
export const WIDE_MIN_W = 900;
/** Shortest viewport, in px, that gets the two-column shell. Keep in step with the `wide` CSS variant. */
export const WIDE_MIN_H = 600;
/** Side panel width on a big screen (WIDE_ASIDE_FROM px and wider). */
export const WIDE_ASIDE = 360;
/** Side panel width on a smaller wide screen (landscape tablets, small laptops), so the board keeps the room. */
export const WIDE_ASIDE_NARROW = 320;
/** Viewport width from which the side panel takes its full WIDE_ASIDE width. */
export const WIDE_ASIDE_FROM = 1280;
/** Gap between the board column and the side panel. */
export const WIDE_GAP = 32;
/** Page gutter on each side of the wide shell. */
export const WIDE_GUTTER = 24;
/** The wide shell's top bar: 20 px top padding, 44 px buttons, 8 px under. */
export const WIDE_TOP = 72;
/** Room kept under the board on a wide screen. */
export const WIDE_BOTTOM = 24;
/**
 * The side panel's tallest (CSS): the viewport less the top bar (its top padding, never under 20 px, the 44 px
 * buttons and 8 px under) and the room kept under the columns, so the panel never makes the page scroll (R3-02).
 */
export const WIDE_ASIDE_MAX_H = `calc(100dvh - max(20px, env(safe-area-inset-top)) - ${WIDE_TOP - 20 + WIDE_BOTTOM}px)`;
/** Largest board, in px, on any screen (a 1920 × 1080 desktop reaches it). */
export const WIDE_MAX = 960;
/** A square board stays inside this share of the viewport height. */
export const WIDE_HEIGHT = 0.9;
/** A wide board's cells may grow to this many times the phone cap (glyphs scale with the cell). */
export const WIDE_GROW = 2.5;
/** The wide shell's whole width: gutters, the largest board with its slot padding, the gap and the side panel. */
export const WIDE_SHELL_MAX = WIDE_GUTTER * 2 + WIDE_MAX + SLOT_PAD * 2 + WIDE_GAP + WIDE_ASIDE;

/** A short screen, in px of height (a 375 × 667 phone). Keep in step with the `short` CSS variant. */
export const SHORT_H = 740;

/** Does this viewport get the two-column shell? */
export function isWide(vw: number, vh: number): boolean {
  return vw >= WIDE_MIN_W && vh >= WIDE_MIN_H;
}

/** The side panel's width for this viewport width (wide shell only). */
export function wideAside(vw: number): number {
  return vw >= WIDE_ASIDE_FROM ? WIDE_ASIDE : WIDE_ASIDE_NARROW;
}

/**
 * How wide a game's board is for its height, on a wide screen (owner, 14 Nov 2026: "don't squeeze them at one
 * side"). The board column takes this shape at the height the screen allows, and the board and its side panel sit
 * together in the middle of the page, so spare width goes to the outer margins, never between board and panel.
 * Square boards are 1; wide boards (a pit row, a running course) are wider.
 */
export const WIDE_ASPECT: Record<string, number> = {
  chess: 0.93,
  five: 0.62,
  oware: 2.4,
  gotcha: 1.8,
  dash: 1.8,
  fourup: 1.17,
  remix: 1.3,
  quads: 1.3,
};
/** A board column is never narrower than this on a wide screen (cards, word games and their keyboards). */
export const WIDE_COL_MIN = 600;

/** The board column's width on a wide screen for a game: its shape at the available height, within the column. */
export function wideColumn(vw: number, vh: number, game: string, panel = true): number {
  const box = boardBox(vw, vh);
  // No side panel (canvas games keep their controls on the canvas): the board may use the whole page width.
  if (!panel) {
    const avail = Math.min(vw, WIDE_SHELL_MAX) - WIDE_GUTTER * 2 - SLOT_PAD * 2;
    return Math.min(avail, Math.round(box.h * (WIDE_ASPECT[game] ?? 1))) + SLOT_PAD * 2;
  }
  const shaped = Math.round(Math.min(box.w, box.h) * (WIDE_ASPECT[game] ?? 1));
  // A game with its own shape (narrow Five, wide Oware) takes exactly that; the rest get at least WIDE_COL_MIN.
  return Math.min(box.w, game in WIDE_ASPECT ? shaped : Math.max(WIDE_COL_MIN, shaped)) + SLOT_PAD * 2;
}

/** The space a board has, in px, inside the board slot's padding. */
export interface BoardBox {
  /** two-column shell */
  wide: boolean;
  /** usable width */
  w: number;
  /** usable height (on phones the viewport less the shell's chrome, a soft limit: the page may scroll) */
  h: number;
  /** the largest square board: min(w, h), on wide screens at most WIDE_HEIGHT of the viewport height */
  side: number;
}

/** The pure rule behind `useBoardBox`. */
export function boardBox(vw: number, vh: number): BoardBox {
  if (isWide(vw, vh)) {
    const aside = wideAside(vw);
    const shell = Math.min(vw, WIDE_GUTTER * 2 + WIDE_MAX + SLOT_PAD * 2 + WIDE_GAP + aside);
    const w = Math.min(WIDE_MAX, shell - WIDE_GUTTER * 2 - WIDE_GAP - aside - SLOT_PAD * 2);
    const h = vh - WIDE_TOP - SLOT_PAD - WIDE_BOTTOM;
    return { wide: true, w, h, side: Math.max(0, Math.min(w, h, Math.floor(vh * WIDE_HEIGHT))) };
  }
  const w = Math.min(vw, 560) - SLOT_PAD * 2;
  const h = vh - SHELL_CHROME;
  // Phones: a square board always gets the phone width, and more only while it still fits the height.
  const phone = Math.min(vw, 420) - SLOT_PAD * 2;
  return { wide: false, w, h, side: Math.max(phone, Math.min(w, h)) };
}

/**
 * A row of `n` equal tiles across `avail` px (`gap` between tiles, `pad` px of padding in all), between `min`
 * and `max`. Letter tiles in Remix, pads in Echo: phones keep their touch size, big screens grow them.
 */
export function fitRow(avail: number, n: number, gap: number, pad: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor((avail - pad - gap * (n - 1)) / Math.max(1, n))));
}

/** The board's space for this viewport, kept current on resize. */
export function useBoardBox(): BoardBox {
  return boardBox(useViewportWidth(), useViewportHeight());
}

/** Is the shell in its two-column layout? */
export function useWide(): boolean {
  return isWide(useViewportWidth(), useViewportHeight());
}

/**
 * Board sizing rule (Game Boards template): cell = floor((min(vw, 420) − 24 − gaps − padding) / cols),
 * capped at `max`. Boards always fit the screen width: big grids get smaller cells instead of a
 * sideways scroll (never below 24 px, the WCAG 2.5.8 minimum target). Wider than a phone (tablets,
 * desktop) the board may use the shell's full 560 px width, as long as a square board still fits the
 * viewport height. In the wide two-column shell the board fills its column and the height under the top bar
 * (`boardBox`), with the cap raised to WIDE_GROW × `max`; `rows` (default `cols`) keeps a tall board inside
 * the height there.
 */
/**
 * A board shown inside a card instead of a game screen (the landing page demo, the welcome lesson): it sizes to
 * the card's width and skips the fit-to-screen step, which would otherwise size it from the whole window.
 */
export const EmbeddedBoard = createContext<{ width: number } | null>(null);

export function useCellSize(cols: number, gap: number, padding = 6, max = 64, rows = cols): number {
  const embedded = useContext(EmbeddedBoard);
  const vw = useViewportWidth();
  const vh = useViewportHeight();
  if (embedded) return Math.max(24, Math.floor((embedded.width - (gap * (cols - 1) + padding)) / cols));
  return cellSize(vw, vh, cols, gap, padding, max, rows);
}

/** The pure rule behind `useCellSize`. */
export function cellSize(vw: number, vh: number, cols: number, gap: number, padding: number, max: number, rows = cols): number {
  if (isWide(vw, vh)) return wideCell(vw, vh, cols, gap * (cols - 1) + padding, max, rows, gap * (rows - 1) + padding);
  const overhead = gap * (cols - 1) + padding;
  const across = (w: number) => Math.floor((w - SLOT_PAD * 2 - overhead) / cols);
  const phone = across(Math.min(vw, 420));
  const wide = across(Math.min(vw, 560));
  const tall = Math.floor((vh - SHELL_CHROME - overhead) / cols);
  return Math.max(24, Math.min(max, Math.max(phone, Math.min(wide, tall))));
}

const onResize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};

/**
 * Viewport width in px, kept current on resize. Server rendering (and hydrating it) uses 390; a board that
 * mounts on the client reads the real width on its first render. A first render at 390 on a narrower phone
 * would overflow, and mobile browsers then zoom out and report the wider width back, so it never recovers.
 */
export function useViewportWidth(): number {
  return useSyncExternalStore(
    onResize,
    () => window.innerWidth,
    () => 390,
  );
}

/** Viewport height in px, kept current on resize (844 while server rendering). */
export function useViewportHeight(): number {
  return useSyncExternalStore(
    onResize,
    () => window.innerHeight,
    () => 844,
  );
}

/**
 * Cell size with a floor for dense boards (Nine). `overhead` is every px across the board that is not a cell
 * (gaps, lines, padding). The roomy fit sits inside the shell's 12 px board padding (24 px in all, width
 * capped at `cap`). If that falls below `floor`, the board may also use that padding, edge to edge, to keep
 * `floor`; when even that does not fit (the narrowest phones) it takes the largest cell that fits, never
 * under 24 px (WCAG 2.5.8).
 */
export function fitCell(vw: number, cols: number, overhead: number, floor: number, max: number, cap = 560, vh?: number): number {
  if (vh !== undefined && isWide(vw, vh)) return wideCell(vw, vh, cols, overhead, max);
  const roomy = Math.floor((Math.min(vw, cap) - SLOT_PAD * 2 - overhead) / cols);
  if (roomy >= floor) return Math.min(max, roomy);
  const edgeToEdge = Math.floor((vw - overhead) / cols);
  return Math.max(24, Math.min(floor, edgeToEdge));
}

/**
 * A cell in the wide two-column shell: the board fills the box (`boardBox`) across `cols` and down `rows`
 * (`overW` and `overH` are the px across and down that are not cells), capped at WIDE_GROW × `max`, never
 * under 24 px.
 */
export function wideCell(vw: number, vh: number, cols: number, overW: number, max: number, rows = cols, overH = overW): number {
  const box = boardBox(vw, vh);
  const across = Math.floor((box.w - overW) / cols);
  const down = Math.floor((Math.min(box.h, Math.floor(vh * WIDE_HEIGHT)) - overH) / rows);
  return Math.max(24, Math.min(Math.round(max * WIDE_GROW), across, down));
}

/**
 * One step of the height fit (pure, for `useFitHeight`). `over` is how many px the page (or the target
 * element) reaches past the bottom of the viewport; `unit` is the px of height one step of size is worth.
 * Shrinks by just enough steps (never under `min`). Grows back towards `ideal` only when `canGrow` (a target
 * element, whose bottom is its natural position) and there is room for a whole step with 2 px to spare, never
 * past `cap` (one under the smallest size that overflowed), so a layout that changes shape between two sizes can't
 * make it flip between them for ever.
 */
export function fitStep(
  cur: number,
  ideal: number,
  min: number,
  unit: number,
  over: number,
  canGrow: boolean,
  cap: number = ideal,
): number {
  if (over > 0) return Math.max(Math.min(min, ideal), cur - Math.ceil(over / unit));
  const top = Math.min(ideal, cap);
  if (canGrow && cur < top && -over >= unit + 2) return Math.min(top, cur + Math.floor((-over - 2) / unit));
  return cur;
}

/**
 * Where the game shell's content ends: the bottom of its last zone marked `data-shell-tail` (the feedback line,
 * then the tool bar or end bar), less the auto margin that pins the tool bar to the bottom of a roomy screen.
 * Null outside a shell.
 */
export function shellContentBottom(el: HTMLElement): number | null {
  const shell = el.closest<HTMLElement>("[data-shell]");
  // Two columns: the side panel holds the feedback line and the tools, so only the board slot (sized to its
  // content) has to fit, with the wide shell's bottom gutter under it.
  if (shell?.dataset?.wide !== undefined) {
    const slot = shell.querySelector<HTMLElement>("[data-shell-slot]");
    return slot ? slot.getBoundingClientRect().bottom + WIDE_BOTTOM : null;
  }
  const tails = shell?.querySelectorAll<HTMLElement>("[data-shell-tail]");
  const last = tails?.[tails.length - 1];
  if (!last) return null;
  return last.getBoundingClientRect().bottom - (parseFloat(getComputedStyle(last).marginTop) || 0);
}

/**
 * Fits a board to the viewport height as well as its width. `ideal` is the size the width allows (a cell or a
 * canvas height); while the page is taller than the viewport the size steps down (to `min` at most), so the
 * board, its own controls and the shell's tool bar fit without a vertical scroll. `unit` is how many px of
 * height one step adds (the row count for a cell size, 1 for a canvas). With `target`, only that element's
 * bottom (plus `margin`) has to fit, and the size grows back when there is room. With `margin` "shell" the
 * whole game shell has to fit, down to its tool bar (`shellContentBottom`), still measured from `target`. A
 * viewport resize starts again from `ideal`.
 */
/** How often `useFitHeight` starts again after the layout changed under it, per viewport. */
const MAX_REARMS = 3;

export function useFitHeight(
  ideal: number,
  min: number,
  unit: number,
  target?: RefObject<HTMLElement | null>,
  margin: number | "shell" = 0,
): number {
  const embedded = useContext(EmbeddedBoard);
  const [fit, setFit] = useState({ ideal, size: ideal });
  const size = embedded ? ideal : fit.ideal === ideal ? fit.size : ideal;
  // Since the last restart: `cap` is one under the smallest size that overflowed (growing back stops there, see
  // fitStep); `prev` is the last overflowing measurement; `stuck` is set when shrinking the board didn't reduce the
  // overflow (something else is too tall, e.g. the side panel of the two-column shell), so it stops shrinking.
  // `rearms` counts how often the guard was reset because the layout changed under it (see below), so a layout that
  // keeps changing can't make it shrink and grow for ever.
  const guard = useRef<{
    ideal: number;
    cap: number;
    prev: { size: number; over: number } | null;
    stuck: boolean;
    rearms: number;
  }>({
    ideal,
    cap: ideal,
    prev: null,
    stuck: false,
    rearms: 0,
  });
  useLayoutEffect(() => {
    if (embedded) return;
    const reset = (rearms = 0) => (guard.current = { ideal, cap: ideal, prev: null, stuck: false, rearms });
    if (guard.current.ideal !== ideal) reset();
    const measure = () => {
      const vh = window.innerHeight;
      let over: number;
      if (target) {
        const el = target.current;
        if (!el) return;
        const shellBottom = margin === "shell" ? shellContentBottom(el) : null;
        const bottom = shellBottom ?? el.getBoundingClientRect().bottom + (margin === "shell" ? 0 : margin);
        over = bottom + window.scrollY - vh;
      } else over = document.documentElement.scrollHeight - vh;
      let g = guard.current;
      if (over > 0) {
        if (g.stuck) {
          // Stuck, back at the size that overflowed less: if the page now overflows by a different amount at that same
          // size, the layout changed on its own (the rule line, the keyboard or a font arriving late) and the "shrinking
          // didn't help" verdict was wrong. Start the fit again (at most MAX_REARMS times per viewport).
          const changed = g.prev && size === g.prev.size && Math.abs(over - g.prev.over) > 2;
          if (!changed || g.rearms >= MAX_REARMS) return;
          g = reset(g.rearms + 1);
        }
        if (g.prev && g.prev.size > size && over >= g.prev.over) {
          // The last shrink didn't help: undo it and leave the board alone until the viewport changes.
          g.stuck = true;
          setFit({ ideal, size: g.prev.size });
          return;
        }
        g.cap = Math.min(g.cap, size - 1);
        g.prev = { size, over };
      }
      const next = fitStep(size, ideal, min, unit, over, !!target, g.cap);
      if (next !== size) setFit({ ideal, size: next });
    };
    const restart = () => {
      reset();
      setFit({ ideal, size: ideal });
    };
    measure();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(document.body);
    // The feedback line and tool bar can change height while the page fits, which doesn't resize the body.
    if (margin === "shell")
      target?.current
        ?.closest("[data-shell]")
        ?.querySelectorAll("[data-shell-tail]")
        .forEach((t) => ro?.observe(t));
    window.addEventListener("resize", restart);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", restart);
    };
  }, [ideal, min, unit, target, margin, size, embedded]);
  return size;
}
