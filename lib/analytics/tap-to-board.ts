"use client";

/**
 * Tap-to-board latency for the admin Metrics page.
 *
 * - `installTapStamp()` (instrumentation-client.ts) keeps the time of the latest tap on a link to /play/ or on
 *   any button (buttons such as Library cards navigate in code) in sessionStorage, as epoch ms.
 * - `useTapToBoard(ready, game, mode)` (PlayScreen) reports once per mount, on the frame after the board first
 *   becomes interactive: "tap" = from a tap made before this screen mounted (at most 15 s earlier), else
 *   "load" = from navigation start when the page itself was opened on the Play screen.
 */
import { useEffect, useRef } from "react";
import { track } from "./track";

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
      const el = (e.target as Element | null)?.closest?.("a[href], button");
      if (!el) return;
      if (el instanceof HTMLAnchorElement && !new URL(el.href, location.href).pathname.startsWith("/play/")) return;
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

export function useTapToBoard(ready: boolean, game: string, mode: string) {
  const mount = useRef<number | null>(null);
  const sent = useRef(false);
  useEffect(() => {
    mount.current ??= now();
  }, []);
  useEffect(() => {
    if (!ready || sent.current || mount.current === null) return;
    sent.current = true;
    const mountAt = mount.current;
    requestAnimationFrame(() => {
      const r = tapToBoard(readStamp(), { mount: mountAt, ready: now(), origin: performance.timeOrigin, sinceNav: performance.now() });
      if (r) track("tap_to_board", { game, mode, kind: r.kind, ms: r.ms });
    });
  }, [ready, game, mode]);
}
