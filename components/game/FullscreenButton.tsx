"use client";

import { useEffect, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { gameMenuCopy as M } from "@/lib/copy/game-menu";
import { setTurned, useTurned } from "./turned";

type Orientation = { lock?: (o: string) => Promise<void>; unlock?: () => void };
const orientation = () => (typeof screen === "undefined" ? undefined : (screen.orientation as Orientation | undefined));
const unlock = () => {
  try {
    orientation()?.unlock?.();
  } catch {
    /* nothing was locked */
  }
};
/** A phone or tablet (a finger, not a mouse): only those turn sideways. */
const touchScreen = () => typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
/** How long a phone gets to turn by itself after the lock before the page turns instead. */
const TURN_WAIT_MS = 450;

/**
 * Full screen, and for a `landscape` game the phone sideways: the screen is locked to landscape where the browser
 * allows it (Chrome on Android), and where it doesn't (iPhone, iPad, Firefox, Samsung Internet) the page turns
 * itself (turned.ts). A browser with no full screen at all (an iPhone's Safari) still gets the sideways view.
 */
export async function enterFullscreen(landscape: boolean) {
  if (document.fullscreenEnabled) await document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
  if (!landscape || !touchScreen()) return;
  await orientation()
    ?.lock?.("landscape")
    .catch(() => {});
  await new Promise((r) => setTimeout(r, TURN_WAIT_MS));
  if (window.innerHeight > window.innerWidth) setTurned(true);
}

/** Back from full screen (and sideways), letting the phone turn freely again. */
export async function exitFullscreen() {
  setTurned(false);
  unlock();
  if (document.fullscreenElement) await document.exitFullscreen();
}

/**
 * Full screen for a game (owner, 14 Nov 2026): the browser's own full screen (no address bar or tabs), and the same
 * button (or Esc) brings it back. The action games (`landscape`: Gotcha, Dash) also go sideways, for a wider view
 * and thumbs either side (owner, 17 and 19 Nov 2026), on every phone. Hidden only where neither works (a puzzle game
 * in a browser with no full screen), so it never does nothing.
 */
export function FullscreenButton({ landscape = false }: { landscape?: boolean }) {
  const [canFs, setCanFs] = useState(false);
  const [canTurn, setCanTurn] = useState(false);
  const [fs, setFs] = useState(false);
  const turned = useTurned();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the browser's support is only known on the client
    setCanFs(!!document.fullscreenEnabled);
    setCanTurn(landscape && touchScreen());
    let wasFs = !!document.fullscreenElement;
    const sync = () => {
      const now = !!document.fullscreenElement;
      setFs(now);
      // Left full screen another way (Esc, the system back): sideways ends with it.
      if (wasFs && !now) {
        unlock();
        setTurned(false);
      }
      wasFs = now;
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      // Leaving the game: the rest of the app turns with the phone again.
      unlock();
      setTurned(false);
    };
  }, [landscape]);
  if (!canFs && !canTurn) return null;
  const on = fs || turned;
  return (
    <IconButton
      icon={on ? "corners-in" : "corners-out"}
      label={on ? M.fullscreenExit : M.fullscreen}
      title={on ? M.fullscreenExit : M.fullscreen}
      aria-pressed={on}
      data-fullscreen
      className="max-[359px]:hidden"
      onClick={() => {
        if (on) void exitFullscreen().catch(() => {});
        else void enterFullscreen(landscape).catch(() => {});
      }}
    />
  );
}
