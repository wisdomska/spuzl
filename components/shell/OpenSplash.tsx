"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { LogoIntro } from "@/components/brand/LogoIntro";
import { markOpened, playedThisVisit } from "@/lib/client/open-splash";

const noop = () => () => {};

/**
 * One decision per page load: play only if the intro has not played in this tab yet. The decision is cached so it stays fixed
 * while the intro runs (marking the day must not stop it halfway), and once the intro has finished, later mounts of
 * the shell in the same page load (back to the Grid from a game) never play it again.
 */
let decision: boolean | null = null;
let finished = false;
const shouldPlay = () => !finished && (decision ??= !playedThisVisit());

/**
 * The logo intro over the app once each time it is opened in the browser (owner, 13 and 14 Nov 2026), then Home.
 * Server-rendered so it covers the first paint; a <head> script hides it before paint when it already played in this tab.
 * Sounds play when a tap has already allowed audio; otherwise the first tap (which also skips) turns them on.
 */
export function OpenSplash() {
  const play = useSyncExternalStore(noop, shouldPlay, () => true);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (play) markOpened();
  }, [play]);
  if (!play || done) return null;
  return (
    <div className="open-splash">
      <LogoIntro
        overlay
        onDone={() => {
          finished = true;
          setDone(true);
        }}
      />
    </div>
  );
}
