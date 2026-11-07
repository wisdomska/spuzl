"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { playerGames } from "@/lib/catalog";
import { Icon } from "@/components/ui/Icon";
import { useGamesMeta } from "@/lib/games-meta/client";
import { newGameIds } from "@/lib/games-meta";
import { useGameSettings } from "@/lib/game-settings/client";
import { homeCopy as T } from "@/lib/copy/home";

const KEY = "spuzl.newGamesBanner.dismissed";
const read = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

/**
 * R2-18: "3 new games" on Home, a static card under the Daily Five card (in the page flow, so it can never cover the
 * Continue card pinned at the bottom). The count is the games tagged "new" (catalog `isNew`, admin Library page
 * overrides); the tap opens All games filtered to New. It hides once the player has played every new game, or after
 * a dismiss (remembered on this device until the set of new games changes).
 */
export function NewGamesBanner({ played }: { played: readonly string[] }) {
  const meta = useGamesMeta();
  const labOn = useGameSettings()["features.labGames"];
  const ids = useMemo(() => newGameIds(playerGames({ "features.labGames": labOn }), meta), [meta, labOn]);
  const key = [...ids].sort().join(",");
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only; read after hydration
    setDismissed(read());
    setReady(true);
  }, []);
  const unplayed = ids.filter((id) => !played.includes(id));
  if (!ready || ids.length === 0 || unplayed.length === 0 || dismissed === key) return null;
  return (
    <div data-new-games className="bg-surface-raised flex min-h-14 items-center gap-1 rounded-[16px] py-1 pr-1 pl-1">
      <Link
        href="/library?filter=new"
        className="press flex min-h-12 min-w-0 flex-1 items-center gap-2.5 rounded-[12px] pl-2.5 text-[15px] leading-snug font-semibold"
      >
        <Icon name="sparkle" size={20} className="text-accent shrink-0" />
        <span className="min-w-0 flex-1">{T.newGames(ids.length)}</span>
        <span className="text-accent flex shrink-0 items-center gap-1 px-1.5 text-[14px] font-semibold">
          {T.newGamesSee}
          <Icon name="caret-right" size={14} />
        </span>
      </Link>
      <button
        type="button"
        aria-label={T.newGamesDismiss}
        onClick={() => {
          setDismissed(key);
          try {
            localStorage.setItem(KEY, key);
          } catch {
            /* private mode: the card comes back next visit, which is fine */
          }
        }}
        className="press text-muted flex size-11 shrink-0 items-center justify-center rounded-[12px]"
      >
        <Icon name="x" size={18} />
      </button>
    </div>
  );
}
