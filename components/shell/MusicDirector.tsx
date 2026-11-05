"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { GAME_BY_ID } from "@/lib/catalog";
import { playMusic, setMusicHidden, stopMusic } from "@/lib/audio";
import type { StyleId } from "@/lib/audio/music";

/** Games whose play is sound itself: music would get in the way. */
const QUIET_GAMES = new Set(["beattap", "echo"]);
/** Public pages without music: the landing page (/about, and "/" for visitors, which holds it) and the info pages. */
const INFO_PAGES = new Set(["about", "how-to-play", "fair-play", "privacy", "terms", "contact"]);
const WORLD_STYLE: Record<string, StyleId> = { logic: "logic", word: "word", reflex: "reflex", board: "board" };

/** Which track a page gets: a game's own tune while playing it, Versus in duels and parties, Home everywhere else. */
export function musicFor(pathname: string): { id: string; style: StyleId } | null {
  const parts = pathname.split("/").filter(Boolean);
  const [first, second] = parts;
  // The intro has its own sound; admin and the public pages (landing, help, legal) stay quiet.
  if (first === "intro" || first === "admin" || (first && INFO_PAGES.has(first))) return null;
  if (first === "play" && second) {
    if (QUIET_GAMES.has(second)) return null;
    const meta = GAME_BY_ID[second];
    return { id: second, style: (meta && WORLD_STYLE[meta.world]) || "home" };
  }
  if (first === "bay") return { id: "bay", style: "board" };
  if (first === "duel" || first === "party" || first === "challenge" || first === "ghost") return { id: "versus", style: "versus" };
  return { id: "home", style: "home" };
}

/** Follows the route and keeps the right music playing (settings decide whether any plays at all). */
/**
 * Background music is paused while the generated tunes are replaced with recorded tracks (owner's call): nothing plays
 * until this is switched back on. Sound effects are unaffected.
 */
export const MUSIC_ON = false;

export function MusicDirector() {
  const pathname = usePathname();
  useEffect(() => {
    const m = MUSIC_ON ? musicFor(pathname ?? "/") : null;
    if (m) playMusic(m.id, m.style);
    else stopMusic();
  }, [pathname]);
  useEffect(() => {
    const onVis = () => setMusicHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  return null;
}
