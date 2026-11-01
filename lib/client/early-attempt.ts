"use client";

import { startAttempt, type StartRes } from "./api";

/**
 * SPZ-01: start a game's attempt the moment it is tapped, in parallel with loading the Play route, so the board
 * is ready as soon as the screen is. The Play screen takes the primed request if it matches; otherwise it starts
 * its own. Only daily and free play are primed (archive needs a date the link carries; challenges a code).
 */
type Key = string;
const primed = new Map<Key, { at: number; p: Promise<StartRes> }>();
const TTL_MS = 15_000;

export function parsePlayHref(href: string): { game: string; mode: "daily" | "free"; difficulty?: string } | null {
  let u: URL;
  try {
    u = new URL(href, "https://x.invalid");
  } catch {
    return null;
  }
  const m = /^\/play\/([a-z0-9]+)\/?$/.exec(u.pathname);
  if (!m) return null;
  const mode = u.searchParams.get("mode") ?? "daily";
  if (mode !== "daily" && mode !== "free") return null;
  const d = u.searchParams.get("difficulty") ?? undefined;
  return { game: m[1], mode, difficulty: mode === "free" ? d : undefined };
}

const keyOf = (game: string, mode: string, difficulty?: string) => `${game}|${mode}|${difficulty ?? ""}`;

export function primeAttempt(href: string) {
  const t = parsePlayHref(href);
  if (!t) return;
  const k = keyOf(t.game, t.mode, t.difficulty);
  const hit = primed.get(k);
  if (hit && Date.now() - hit.at < TTL_MS) return;
  const p = startAttempt(t);
  p.catch(() => primed.delete(k));
  primed.set(k, { at: Date.now(), p });
}

/** The primed start for this game and mode, used once. */
export function takePrimed(game: string, mode: string, difficulty?: string): Promise<StartRes> | null {
  const k = keyOf(game, mode, mode === "free" ? difficulty : undefined);
  const hit = primed.get(k);
  primed.delete(k);
  return hit && Date.now() - hit.at < TTL_MS ? hit.p : null;
}

/** Listens for taps on links to /play/... (capture phase, before navigation). */
export function installAttemptPriming(): () => void {
  const on = (e: MouseEvent) => {
    const a = (e.target as Element | null)?.closest?.("a[href^='/play/']") as HTMLAnchorElement | null;
    if (a && !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey) primeAttempt(a.getAttribute("href")!);
  };
  document.addEventListener("click", on, true);
  return () => document.removeEventListener("click", on, true);
}
