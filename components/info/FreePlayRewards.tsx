"use client";

import { useGameSettings } from "@/lib/game-settings/client";
import { freePlayCopy } from "@/lib/copy/free-play";

/** The free-play reward line on How to play, from the live admin settings. */
export function FreePlayRewards() {
  const s = useGameSettings();
  return <>{freePlayCopy.howToPlay(s["free.xpPerClear"], s["free.sparksPerClear"], s["free.xpDailyCap"])}</>;
}
