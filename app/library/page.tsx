"use client";

import { whenQuiet } from "@/lib/perf/quiet";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WORLD_BY_ID, playerGames, type GameMeta } from "@/lib/catalog";
import { Icon } from "@/components/ui/Icon";
import { LabTag } from "@/components/ui/LabTag";
import { GameIcon3D } from "@/components/world/GameIcon3D";
import { GameCard } from "@/components/library/GameCard";
import { useMe } from "@/lib/client/api";
import { useGamesMeta } from "@/lib/games-meta/client";
import { durationLabel, filterGames, newGameIds, parseFilter, type GameFilter } from "@/lib/games-meta";
import { GameFilterChips, GameSearchField } from "@/components/library/GameFilters";
import { useGameSettings } from "@/lib/game-settings/client";
import { SHEET_LINK } from "@/lib/analytics/play-nav";
import { libraryCopy as T } from "@/lib/copy/library";

/**
 * All games (SPZ-14): search, one row of filter chips, and one tap per game that opens its card
 * (Daily first, Free play second). Each row shows only the name, world, typical time and a tick when done today.
 * R2-12: each row is a real link to /play/<game>, so long-press, open in a new tab and share work; a plain tap
 * (Link `onNavigate`, which never runs for modifier or middle clicks) opens the card instead.
 */
export default function Library() {
  const router = useRouter();
  const me = useMe();
  const meta = useGamesMeta();
  const prefetch = useGameSettings()["perf.prefetch"];
  const [filter, setFilter] = useState<GameFilter>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<GameMeta | null>(null);
  // R2-12: every row renders at once; the list fades in on its first paint only (never again on a filter change).
  const [entering, setEntering] = useState(true);
  const dailiesOn = useGameSettings()["features.dailies"];
  // The tick marks games done today (Dailies on) or games ever played (Dailies off).
  const cleared: Record<string, number> = dailiesOn
    ? (me.data?.today.cleared ?? {})
    : Object.fromEntries((me.data?.played ?? []).map((id) => [id, 1]));

  // Live games plus the lab games switched on in "features.labGames" (the server refuses the others).
  const labOn = useGameSettings()["features.labGames"];
  const all = useMemo(() => playerGames({ "features.labGames": labOn }), [labOn]);
  const list = useMemo(() => filterGames(all, filter, q, meta), [all, filter, q, meta]);
  const hasNew = newGameIds(all, meta).length > 0;

  // R2-18: Home's "new games" banner opens /library?filter=new. Read once after hydration (no Suspense boundary
  // needed, and the server pass stays the plain list).
  useEffect(() => {
    const f = parseFilter(new URLSearchParams(window.location.search).get("filter"));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL is client-only; read after hydration
    if (f !== "all") setFilter(f);
  }, []);

  // SPZ-01: warm the first rows' play routes while the list is idle.
  useEffect(() => {
    if (!prefetch) return;
    const ids = list.slice(0, 4).map((g) => g.id);
    // R2-01: only once the list is quiet, so it never competes with a game opened straight away.
    let live = true;
    void whenQuiet().then(() => live && ids.forEach((id) => router.prefetch(`/play/${id}?mode=free`)));
    return () => {
      live = false;
    };
  }, [list, prefetch, router]);

  return (
    <main className="bg-bg mx-auto flex min-h-dvh max-w-[560px] flex-col lg:max-w-[1180px]">
      <header className="safe-top bg-bg sticky top-0 z-10 flex flex-col gap-3 px-4 pb-2">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label={T.back}
            className="press bg-surface-raised flex size-11 shrink-0 items-center justify-center rounded-[14px]"
          >
            <Icon name="arrow-left" size={20} />
          </Link>
          <div className="flex min-w-0 flex-col">
            <h1 className="font-display text-[24px] leading-tight font-black">{T.title}</h1>
            <p className="text-muted text-[14px] leading-[1.35]">{T.subtitle}</p>
          </div>
        </div>
        <GameSearchField value={q} onChange={setQ} />
        <GameFilterChips value={filter} onChange={setFilter} showNew={hasNew} />
        <p className="text-muted text-[13px] font-medium" aria-live="polite">
          {T.count(list.length)}
        </p>
      </header>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 pt-12 text-center">
          <Icon name="magnifying-glass" size={40} className="text-muted" />
          <p className="text-muted text-[16px]">{T.empty}</p>
          <button
            type="button"
            onClick={() => {
              setQ("");
              setFilter("all");
            }}
            className="press bg-surface-raised h-11 rounded-[14px] px-4 text-[15px] font-semibold"
          >
            {T.showAll}
          </button>
        </div>
      ) : (
        <ul
          className={`flex flex-col gap-2 px-4 pt-1 pb-10 lg:grid lg:grid-cols-2 lg:gap-2.5 xl:grid-cols-3 ${entering ? "list-in" : ""}`}
          onAnimationEnd={() => setEntering(false)}
        >
          {list.map((g) => {
            const done = cleared[g.id] !== undefined;
            const time = durationLabel(meta[g.id]?.typicalSec ?? 180);
            return (
              <li key={g.id}>
                {/* R2-12: a real link to the game (long-press, new tab and share work); a plain tap opens its card. */}
                <Link
                  href={`/play/${g.id}` as never}
                  prefetch={false}
                  {...SHEET_LINK}
                  onNavigate={(e) => {
                    e.preventDefault();
                    setOpen(g);
                  }}
                  aria-haspopup="dialog"
                  className="press bg-surface flex w-full items-center gap-3 rounded-[20px] py-2.5 pr-3 pl-3 text-left"
                >
                  <GameIcon3D meta={g} size={48} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-display truncate text-[16px] font-extrabold">{g.name}</span>
                    <span className="text-muted flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] font-medium">
                      <span aria-hidden className="size-2 rounded-full" style={{ background: WORLD_BY_ID[g.world].color }} />
                      {WORLD_BY_ID[g.world].name}
                      {/* R3-05: a switched-on lab game says it is new and still being tuned. */}
                      <LabTag id={g.id} compact />
                    </span>
                  </span>
                  <span className="bg-surface-raised text-muted flex h-7 shrink-0 items-center gap-1 rounded-[10px] px-2 text-[12px] font-semibold">
                    <Icon name="timer" size={14} />
                    {time}
                  </span>
                  {done ? (
                    <span
                      className="bg-accent text-on-accent flex size-7 shrink-0 items-center justify-center rounded-full"
                      title={dailiesOn ? T.doneToday : T.played}
                    >
                      <Icon name="check" size={16} />
                      <span className="sr-only">{dailiesOn ? T.doneToday : T.played}</span>
                    </span>
                  ) : (
                    <Icon name="caret-right" size={18} className="text-muted shrink-0" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <GameCard
        meta={open}
        onClose={() => setOpen(null)}
        doneMs={open && dailiesOn ? cleared[open.id] : undefined}
        typicalSec={open ? meta[open.id]?.typicalSec : undefined}
      />
    </main>
  );
}
