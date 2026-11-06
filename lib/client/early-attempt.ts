"use client";

import { startAttempt, type StartRes } from "./api";
import { resumeIdFor } from "./resume";
import { markPlayTap } from "@/lib/perf/quiet";

/**
 * SPZ-01: start a game's attempt the moment it is tapped, in parallel with loading the Play route, so the board
 * is ready as soon as the screen is. The Play screen takes the primed request if it matches; otherwise it starts
 * its own. Daily, free play, levels (R2-01: Continue opens ladder games in level mode) and Daily Five games are
 * primed; archive needs a date the link carries, challenges a code.
 */
type Key = string;
const primed = new Map<Key, { at: number; p: Promise<StartRes> }>();
const TTL_MS = 15_000;

export function parsePlayHref(
  href: string,
): { game: string; mode: "daily" | "free" | "level" | "five"; difficulty?: string; level?: number } | null {
  let u: URL;
  try {
    u = new URL(href, "https://x.invalid");
  } catch {
    return null;
  }
  const m = /^\/play\/([a-z0-9]+)\/?$/.exec(u.pathname);
  if (!m) return null;
  const mode = u.searchParams.get("mode") ?? "daily";
  if (mode !== "daily" && mode !== "free" && mode !== "level" && mode !== "five") return null;
  const d = u.searchParams.get("difficulty") ?? undefined;
  const lv = u.searchParams.get("level");
  const level = mode === "level" && lv && /^\d{1,4}$/.test(lv) ? Number(lv) || undefined : undefined;
  return { game: m[1], mode, difficulty: mode === "free" ? d : undefined, ...(mode === "level" ? { level } : {}) };
}

/** `extra`: the free-play difficulty, or the level number for levels ("" = the player's next level). */
const keyOf = (game: string, mode: string, extra?: string | number) => `${game}|${mode}|${extra ?? ""}`;

export function primeAttempt(href: string) {
  const t = parsePlayHref(href);
  if (!t) return;
  markPlayTap(); // background downloads wait for this board (lib/perf/quiet.ts)
  const k = keyOf(t.game, t.mode, t.mode === "level" ? t.level : t.difficulty);
  const hit = primed.get(k);
  if (hit && Date.now() - hit.at < TTL_MS) return;
  // A free-play puzzle or level left part way is picked up again (lib/client/resume.ts).
  const resume =
    t.mode === "free" || t.mode === "level" ? resumeIdFor(t.game, t.mode, { difficulty: t.difficulty, level: t.level }) : undefined;
  const p = startAttempt({ ...t, resume });
  p.catch(() => primed.delete(k));
  primed.set(k, { at: Date.now(), p });
}

/** The primed start for this game and mode, used once. `extra`: free-play difficulty or level number. */
export function takePrimed(game: string, mode: string, extra?: string | number): Promise<StartRes> | null {
  const k = keyOf(game, mode, mode === "free" || mode === "level" ? extra : undefined);
  const hit = primed.get(k);
  primed.delete(k);
  return hit && Date.now() - hit.at < TTL_MS ? hit.p : null;
}

/** Listens for taps on links to /play/... (capture phase, before navigation). */
export function installAttemptPriming(): () => void {
  const on = (e: MouseEvent) => {
    const a = (e.target as Element | null)?.closest?.("a[href^='/play/']") as HTMLAnchorElement | null;
    if (a && !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey) {
      markPlayTap();
      primeAttempt(a.getAttribute("href")!);
    }
  };
  document.addEventListener("click", on, true);
  return () => document.removeEventListener("click", on, true);
}
