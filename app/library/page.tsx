"use client";

import Link from "next/link";
import { useState } from "react";
import { GAMES, WORLDS, WORLD_BY_ID, type WorldId } from "@/lib/catalog";
import { Icon } from "@/components/ui/Icon";
import { GameIcon3D } from "@/components/world/GameIcon3D";
import { useMe } from "@/lib/client/api";

/** Play anytime (prototype "library"): every game, endless Free play, filter by world. */
export default function Library() {
  const [filter, setFilter] = useState<WorldId | "all">("all");
  const me = useMe();
  const list = filter === "all" ? GAMES : GAMES.filter((g) => g.world === filter);
  return (
    <main className="bg-bg mx-auto flex min-h-dvh max-w-[560px] flex-col">
      <header className="safe-top flex items-center gap-3 px-4 pb-1.5">
        <Link
          href="/"
          aria-label="Back"
          className="press bg-surface-raised flex size-11 shrink-0 items-center justify-center rounded-[14px]"
        >
          <Icon name="arrow-left" size={20} />
        </Link>
        <div className="flex min-w-0 flex-col">
          <h1 className="font-display text-[24px] font-black">Play anytime</h1>
          <p className="text-muted text-[14px] leading-[1.35]">Dailies are today&apos;s shared puzzle. Free play never runs out.</p>
        </div>
      </header>
      <div role="tablist" aria-label="Filter by world" className="flex gap-1.5 overflow-x-auto px-4 pt-2 pb-1">
        {[{ id: "all" as const, name: "All 51" }, ...WORLDS].map((w) => {
          const on = filter === w.id;
          return (
            <button
              key={w.id}
              role="tab"
              aria-selected={on}
              onClick={() => setFilter(w.id)}
              className="press flex h-9 shrink-0 items-center rounded-[12px] px-3 text-[14px] font-semibold whitespace-nowrap"
              style={
                on
                  ? { background: w.id === "all" ? "var(--accent)" : WORLD_BY_ID[w.id as WorldId].color, color: "#0E0F1A" }
                  : { background: "var(--surface)", color: "var(--text-muted)" }
              }
            >
              {w.name}
            </button>
          );
        })}
      </div>
      <ul className="flex flex-col gap-2.5 px-4 pt-3 pb-8">
        {list.map((g) => {
          const daily = me.data?.today.cleared[g.id] === undefined;
          return (
            <li key={g.id}>
              <Link href={`/play/${g.id}?mode=free`} className="press bg-surface flex items-center gap-3 rounded-[20px] px-3 py-2.5">
                <GameIcon3D meta={g} size={52} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-display text-[16px] font-extrabold">{g.name}</span>
                  <span className="text-muted text-[13px] leading-[1.35]">{g.blurb}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="bg-surface-raised rounded-[12px] px-2.5 py-1.5 text-[13px] font-bold whitespace-nowrap">Free play</span>
                  {daily && (
                    <Link href={`/play/${g.id}`} className="text-accent text-[12px] font-semibold" onClick={(e) => e.stopPropagation()}>
                      Daily open
                    </Link>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
