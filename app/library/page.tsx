"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { GAMES, WORLDS, WORLD_BY_ID, type GameMeta, type WorldId } from "@/lib/catalog";
import { Icon } from "@/components/ui/Icon";
import { GameIcon3D } from "@/components/world/GameIcon3D";
import { GameCard } from "@/components/library/GameCard";
import { useMe } from "@/lib/client/api";
import { useGamesMeta } from "@/lib/games-meta/client";
import { durationLabel, matchesQuery, TAGS, type Tag } from "@/lib/games-meta";
import { useGameSettings } from "@/lib/game-settings/client";
import { libraryCopy as T } from "@/lib/copy/library";

type Filter = "all" | Tag | WorldId;

/**
 * All games (SPZ-14): search, one row of filter chips, and one tap per game that opens its card
 * (Daily first, Free play second). Each row shows only the name, world, typical time and a tick when done today.
 */
export default function Library() {
  const router = useRouter();
  const me = useMe();
  const meta = useGamesMeta();
  const prefetch = useGameSettings()["perf.prefetch"];
  const reduce = useReducedMotion();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<GameMeta | null>(null);
  const cleared = me.data?.today.cleared ?? {};

  const list = useMemo(
    () =>
      GAMES.filter((g) => {
        if (filter !== "all") {
          if ((TAGS as readonly string[]).includes(filter)) {
            if (!meta[g.id]?.tags.includes(filter as Tag)) return false;
          } else if (g.world !== filter) return false;
        }
        return !q || matchesQuery(`${g.name} ${WORLD_BY_ID[g.world].name} ${g.blurb}`, q);
      }),
    [filter, q, meta],
  );

  // SPZ-01: warm the first rows' play routes while the list is idle.
  useEffect(() => {
    if (!prefetch) return;
    const ids = list.slice(0, 4).map((g) => g.id);
    const run = () => ids.forEach((id) => router.prefetch(`/play/${id}?mode=free`));
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(run);
    else setTimeout(run, 300);
  }, [list, prefetch, router]);

  const chips: { id: Filter; label: string; title?: string; color?: string }[] = [
    { id: "all", label: T.all },
    ...TAGS.map((t) => ({ id: t as Filter, label: T.tag[t], title: T.tagHelp[t] })),
    ...WORLDS.map((w) => ({ id: w.id as Filter, label: w.name, color: w.color })),
  ];

  return (
    <main className="bg-bg mx-auto flex min-h-dvh max-w-[560px] flex-col">
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
        <div className="bg-surface focus-within:ring-accent flex h-12 items-center gap-2.5 rounded-[16px] px-3.5 focus-within:ring-2">
          <Icon name="magnifying-glass" size={20} className="text-muted shrink-0" />
          <input
            type="search"
            aria-label={T.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={T.searchPlaceholder}
            className="placeholder:text-muted min-w-0 flex-1 bg-transparent text-[16px] outline-none focus-visible:shadow-none focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
            enterKeyHint="search"
            autoComplete="off"
          />
          {q && (
            <button
              type="button"
              aria-label={T.clear}
              onClick={() => setQ("")}
              className="press -mr-1.5 flex size-11 items-center justify-center"
            >
              <Icon name="x" size={18} className="text-muted" />
            </button>
          )}
        </div>
        <div className="edge-fade -mx-4">
          <div role="group" aria-label={T.filters} className="no-scrollbar flex gap-1.5 overflow-x-auto px-4">
            {chips.map((c) => {
              const on = filter === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  title={c.title}
                  onClick={() => setFilter(on && c.id !== "all" ? "all" : c.id)}
                  className="press flex h-10 shrink-0 items-center gap-1.5 rounded-[12px] px-3.5 text-[14px] font-semibold whitespace-nowrap"
                  style={
                    on
                      ? { background: c.color ?? "var(--accent)", color: c.color ? "var(--bg)" : "var(--on-accent)" }
                      : { background: "var(--surface)", color: "var(--text-muted)" }
                  }
                >
                  {c.color && !on && <span aria-hidden className="size-2.5 rounded-full" style={{ background: c.color }} />}
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
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
        <ul className="flex flex-col gap-2 px-4 pt-1 pb-10">
          {list.map((g, i) => {
            const done = cleared[g.id] !== undefined;
            const time = durationLabel(meta[g.id]?.typicalSec ?? 180);
            return (
              <motion.li
                key={g.id}
                initial={reduce ? false : { opacity: 0, transform: "translateY(6px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                transition={{ duration: 0.22, delay: Math.min(i, 8) * 0.025, ease: [0.23, 1, 0.32, 1] }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(g)}
                  aria-label={T.open(g.name, time, done)}
                  className="press bg-surface flex w-full items-center gap-3 rounded-[20px] py-2.5 pr-3 pl-3 text-left"
                >
                  <GameIcon3D meta={g} size={48} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-display truncate text-[16px] font-extrabold">{g.name}</span>
                    <span className="text-muted flex items-center gap-1.5 text-[13px] font-medium">
                      <span aria-hidden className="size-2 rounded-full" style={{ background: WORLD_BY_ID[g.world].color }} />
                      {WORLD_BY_ID[g.world].name}
                    </span>
                  </span>
                  <span className="bg-surface-raised text-muted flex h-7 shrink-0 items-center gap-1 rounded-[10px] px-2 text-[12px] font-semibold">
                    <Icon name="timer" size={14} />
                    {time}
                  </span>
                  {done ? (
                    <span
                      className="bg-accent text-on-accent flex size-7 shrink-0 items-center justify-center rounded-full"
                      title={T.doneToday}
                    >
                      <Icon name="check" size={16} />
                    </span>
                  ) : (
                    <Icon name="caret-right" size={18} className="text-muted shrink-0" />
                  )}
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}
      <GameCard
        meta={open}
        onClose={() => setOpen(null)}
        doneMs={open ? cleared[open.id] : undefined}
        typicalSec={open ? meta[open.id]?.typicalSec : undefined}
      />
    </main>
  );
}
