"use client";

import { useEffect, useState } from "react";

/**
 * R2-01: background work (sound effects, music, prefetching other pages) waits until the player's game is on
 * screen and the network has gone quiet, so it never competes with the first board on a slow phone connection.
 *
 * - On a Play screen: after the board is interactive (`markBoardReady`, called by useTapToBoard), plus a short
 *   idle period.
 * - Elsewhere (Home, Library): after `IDLE_AFTER_LOAD_MS` of the page being up, plus an idle callback.
 * - A tap on a Play link resets the wait: anything not started yet waits for that board.
 */

const IDLE_AFTER_LOAD_MS = 4000;
const AFTER_BOARD_MS = 1200;
/** Never wait longer than this for a board that never comes (an error screen, a quiz waiting on Start). */
const MAX_WAIT_MS = 15_000;

let boardReadyAt = 0;
let tapAt = 0;
const waiters = new Set<() => boolean>();

function idle(cb: () => void, timeout = 2000) {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(cb, { timeout });
  else setTimeout(cb, 200);
}

/** The game board just became interactive (PlayScreen, through useTapToBoard). */
export function markBoardReady() {
  boardReadyAt = performance.now();
  for (const w of [...waiters]) w();
}

/** A Play link was tapped: background work holds until that board is ready. */
export function markPlayTap() {
  tapAt = performance.now();
  boardReadyAt = 0;
}

const onPlay = () => typeof location !== "undefined" && location.pathname.startsWith("/play/");

/** Resolves when background downloads may start. */
export function whenQuiet(): Promise<void> {
  if (typeof window === "undefined") return new Promise(() => {});
  return new Promise((resolve) => {
    const started = performance.now();
    let done = false;
    const check = () => {
      if (done) return true;
      const now = performance.now(); // ms since this document started
      const waitingForBoard = (onPlay() || tapAt > 0) && boardReadyAt === 0 && now - Math.max(started, tapAt) < MAX_WAIT_MS;
      if (waitingForBoard) return false;
      const ok = boardReadyAt ? now - boardReadyAt >= AFTER_BOARD_MS : now >= IDLE_AFTER_LOAD_MS;
      if (!ok) return false;
      done = true;
      waiters.delete(check);
      idle(() => resolve());
      return true;
    };
    const poll = () => {
      if (!check()) setTimeout(poll, 400);
    };
    waiters.add(check);
    poll();
  });
}

/** False until `whenQuiet()` resolves, then true for good (R3-03: optional connections wait for it). */
export function useQuiet(): boolean {
  const [quiet, setQuiet] = useState(false);
  useEffect(() => {
    let live = true;
    void whenQuiet().then(() => live && setQuiet(true));
    return () => {
      live = false;
    };
  }, []);
  return quiet;
}

/** A slow or data-saving connection: skip optional downloads altogether. */
export function constrainedNetwork(): boolean {
  if (typeof navigator === "undefined") return false;
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (c.saveData === true || c.effectiveType === "slow-2g" || c.effectiveType === "2g");
}

/** Test hook. */
export function __resetQuiet() {
  boardReadyAt = 0;
  tapAt = 0;
  waiters.clear();
}
