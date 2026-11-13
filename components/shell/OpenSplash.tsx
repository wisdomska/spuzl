"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { LogoIntro } from "@/components/brand/LogoIntro";
import { markOpened, wasOpened } from "@/lib/client/open-splash";

const noop = () => () => {};

/**
 * The logo intro over the app when it opens (owner, 13 Nov 2026), then Home underneath. Server-rendered so it covers
 * the first paint; a <head> script hides it before paint on later loads of the same visit. Sounds play when a tap
 * has already allowed audio; otherwise the first tap (which also skips) turns them on.
 */
export function OpenSplash() {
  const already = useSyncExternalStore(noop, wasOpened, () => false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!wasOpened()) markOpened();
  }, []);
  if (already || done) return null;
  return (
    <div className="open-splash">
      <LogoIntro overlay onDone={() => setDone(true)} />
    </div>
  );
}
