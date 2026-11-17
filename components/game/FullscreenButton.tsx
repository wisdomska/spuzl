"use client";

import { useEffect, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { gameMenuCopy as M } from "@/lib/copy/game-menu";

type Orientation = { lock?: (o: string) => Promise<void>; unlock?: () => void };
const orientation = () => (typeof screen === "undefined" ? undefined : (screen.orientation as Orientation | undefined));

/** Full screen, and for a `landscape` game the phone turned sideways (where the browser allows it: Android). */
export async function enterFullscreen(landscape: boolean) {
  await document.documentElement.requestFullscreen({ navigationUI: "hide" });
  // Only a phone or tablet can turn; a computer refuses the lock, and that is fine.
  if (landscape)
    await orientation()
      ?.lock?.("landscape")
      .catch(() => {});
}

/** Back from full screen, letting the phone turn freely again. */
export async function exitFullscreen() {
  try {
    orientation()?.unlock?.();
  } catch {
    /* nothing was locked */
  }
  await document.exitFullscreen();
}

/**
 * Full screen for a game (owner, 14 Nov 2026): the browser's own full screen (no address bar or tabs), and the same
 * button (or Esc) brings it back. Hidden where the browser can't do it (an iPhone's Safari), so it never does nothing.
 * The action games (`landscape`: Gotcha, Dash) also turn the phone sideways, for a wider view and thumbs either side
 * (owner, 17 Nov 2026); the lock ends with full screen.
 */
export function FullscreenButton({ landscape = false }: { landscape?: boolean }) {
  const [can, setCan] = useState(false);
  const [on, setOn] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the browser's support is only known on the client
    setCan(!!document.fullscreenEnabled);
    const sync = () => {
      setOn(!!document.fullscreenElement);
      // Left full screen another way (Esc, the system back): the turn lock goes with it.
      if (!document.fullscreenElement)
        try {
          orientation()?.unlock?.();
        } catch {
          /* nothing was locked */
        }
    };
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      // Leaving the game: the rest of the app turns with the phone again.
      try {
        orientation()?.unlock?.();
      } catch {
        /* nothing was locked */
      }
    };
  }, []);
  if (!can) return null;
  return (
    <IconButton
      icon={on ? "corners-in" : "corners-out"}
      label={on ? M.fullscreenExit : M.fullscreen}
      title={on ? M.fullscreenExit : M.fullscreen}
      aria-pressed={on}
      data-fullscreen
      className="max-[359px]:hidden"
      onClick={() => {
        if (document.fullscreenElement) void exitFullscreen().catch(() => {});
        else void enterFullscreen(landscape).catch(() => {});
      }}
    />
  );
}
