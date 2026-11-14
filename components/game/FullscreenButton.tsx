"use client";

import { useEffect, useState } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { gameMenuCopy as M } from "@/lib/copy/game-menu";

/**
 * Full screen for a game (owner, 14 Nov 2026): the browser's own full screen (no address bar or tabs), and the same
 * button (or Esc) brings it back. Hidden where the browser can't do it (an iPhone's Safari), so it never does nothing.
 */
export function FullscreenButton() {
  const [can, setCan] = useState(false);
  const [on, setOn] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the browser's support is only known on the client
    setCan(!!document.fullscreenEnabled);
    const sync = () => setOn(!!document.fullscreenElement);
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
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
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
        else void document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
      }}
    />
  );
}
