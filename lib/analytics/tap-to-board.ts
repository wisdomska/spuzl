"use client";

/**
 * Tap-to-board latency for the admin Metrics page.
 *
 * - `installTapStamp()` (instrumentation-client.ts) keeps the time of the latest tap on an element marked
 *   `data-play-nav` (Play links and buttons, see PLAY_NAV) in sessionStorage, as epoch ms.
 * - `useTapToBoard(ready, game, mode)` (PlayScreen) reports once per mount, on the frame after the board first
 *   becomes interactive: "tap" = from a tap made before this screen mounted (at most 15 s earlier), else
 *   "load" = from navigation start when the page itself was opened on the Play screen.
 */
import { useEffect, useRef } from "react";
import { isPlayNav } from "./play-nav";
import { track } from "./track";
import { markBoardReady, markPlayTap } from "@/lib/perf/quiet";
import { recordLoad } from "@/lib/lowdata/suggest";

const KEY = "spuzl.tap";
const MAX_MS = 15_000;
const now = () => performance.timeOrigin + performance.now();

interface Stamp {
  at: number;
  origin: number;
}

export function installTapStamp() {
  document.addEventListener(
    "click",
    (e) => {
      if (!isPlayNav(e.target as Element | null)) return;
      markPlayTap();
      try {
        sessionStorage.setItem(KEY, JSON.stringify({ at: now(), origin: performance.timeOrigin } satisfies Stamp));
      } catch {
        /* storage blocked: no tap measurement */
      }
    },
    { capture: true, passive: true },
  );
}

function readStamp(): Stamp | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Stamp | null;
    sessionStorage.removeItem(KEY);
    return s && typeof s.at === "number" ? s : null;
  } catch {
    return null;
  }
}

/** Pure: which measurement a board-ready moment yields. Exported for tests. */
export function tapToBoard(
  stamp: Stamp | null,
  t: { mount: number; ready: number; origin: number; sinceNav: number },
): { kind: "tap" | "load"; ms: number } | null {
  if (stamp && stamp.at <= t.mount && t.ready - stamp.at <= MAX_MS) return { kind: "tap", ms: Math.round(t.ready - stamp.at) };
  // No tap in this document before the screen: the page was opened (or reloaded) straight onto Play.
  if ((!stamp || stamp.origin !== t.origin) && t.sinceNav <= MAX_MS) return { kind: "load", ms: Math.round(t.sinceNav) };
  return null;
}

/** Boards that became ready in this page (document) so far: the first one is cold, every later one warm. */
let boardsThisPage = 0;

/**
 * Pure: cold or warm for the admin Metrics split (R2-ADMIN). The first board of the page session waited for the
 * game's code and data (cold); later boards in the same page reuse what is loaded (warm). Exported for tests.
 */
export function isWarm(boardsBefore: number): boolean {
  return boardsBefore > 0;
}

export function useTapToBoard(ready: boolean, game: string, mode: string) {
  const mount = useRef<number | null>(null);
  const sent = useRef(false);
  useEffect(() => {
    mount.current ??= now();
  }, []);
  useEffect(() => {
    if (!ready || sent.current || mount.current === null) return;
    sent.current = true;
    markBoardReady(); // background downloads may start (lib/perf/quiet.ts)
    const mountAt = mount.current;
    const warm = isWarm(boardsThisPage++);
    requestAnimationFrame(() => {
      const r = tapToBoard(readStamp(), { mount: mountAt, ready: now(), origin: performance.timeOrigin, sinceNav: performance.now() });
      if (r) track("tap_to_board", { game, mode, kind: r.kind, ms: r.ms, warm: r.kind === "load" ? false : warm });
      // A tap's wait also counts toward the low-data suggestion (cold loads are counted as the page load).
      if (r?.kind === "tap") recordLoad(r.ms);
    });
  }, [ready, game, mode]);
}
