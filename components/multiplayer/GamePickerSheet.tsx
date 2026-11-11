"use client";

import { useMemo, useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { WORLDS, WORLD_BY_ID } from "@/lib/catalog";
import { Icon } from "@/components/ui/Icon";
import { GameIcon3D } from "@/components/world/GameIcon3D";
import { GameFilterChips, GameSearchField } from "@/components/library/GameFilters";
import { useGamesMeta } from "@/lib/games-meta/client";
import { durationLabel, filterGames, newGameIds, type GameFilter } from "@/lib/games-meta";
import { duelGames } from "@/lib/multiplayer/games";
import { useGameSettings } from "@/lib/game-settings/client";
import { duelCopy } from "@/lib/copy/duel";
import { useSheetSound } from "@/lib/audio/useSheetSound";

const C = duelCopy.picker;

/**
 * R2-02: the Duel game picker. A full-height sheet with the Library's search and filters (shared components),
 * "Any game" first, then every race game. Radix Dialog gives the focus trap, Escape and labelling; focus goes
 * back to the "Game" row (whatever opened it) on close; with a keyboard or mouse the search box takes focus on open so typing starts at once.
 */
export function GamePickerSheet({
  open,
  onOpenChange,
  value,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** a race game id, or null for Any game */
  value: string | null;
  onPick: (game: string | null) => void;
}) {
  const meta = useGamesMeta();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<GameFilter>("all");
  const search = useRef<HTMLInputElement>(null);
  // The "Game" row isn't a Radix Trigger, so remember what opened the sheet and hand focus back to it on close.
  const opener = useRef<HTMLElement | null>(null);
  // The race games players may pick now: On and allowed in Duels and Parties (Games page; the server checks too).
  const settings = useGameSettings();
  const raceGames = useMemo(() => duelGames(settings), [settings]);
  /** Only the worlds that hold a race game get a chip. */
  const raceWorlds = useMemo(() => WORLDS.filter((w) => raceGames.some((g) => g.world === w.id)), [raceGames]);
  const list = useMemo(() => filterGames(raceGames, filter, q, meta), [raceGames, filter, q, meta]);
  const filtering = filter !== "all" || q.trim() !== "";
  useSheetSound(open);
  const pick = (g: string | null) => {
    onPick(g);
    onOpenChange(false);
  };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-50 bg-[rgb(6_7_13/.6)]" />
        <Dialog.Content
          onOpenAutoFocus={(e) => {
            opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            // Keyboard and mouse: straight into the search box. Touch: no focus jump, so the on-screen keyboard
            // doesn't cover the list (Radix then focuses the first control, Close).
            if (window.matchMedia("(pointer: coarse)").matches) return;
            e.preventDefault();
            search.current?.focus();
          }}
          onCloseAutoFocus={(e) => {
            const el = opener.current;
            opener.current = null;
            if (!el?.isConnected) return;
            e.preventDefault();
            el.focus();
          }}
          className="sheet-content bg-bg fixed inset-x-0 top-[max(16px,env(safe-area-inset-top))] bottom-0 z-50 mx-auto flex max-w-[560px] flex-col rounded-t-[28px] lg:max-w-[720px]"
          style={{ boxShadow: "0 -1px 0 var(--line)" }}
        >
          <div className="flex flex-col gap-3 px-4 pt-3 pb-2">
            <div aria-hidden className="bg-line mx-auto h-1.5 w-10 shrink-0 rounded-full" />
            <div className="flex items-center gap-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <Dialog.Title className="font-display text-[22px] leading-tight font-black">{C.title}</Dialog.Title>
                <Dialog.Description className="text-muted text-[14px]">{C.body}</Dialog.Description>
              </div>
              <Dialog.Close
                aria-label={C.close}
                className="press bg-surface-raised flex size-11 shrink-0 items-center justify-center rounded-[14px]"
              >
                <Icon name="x" size={20} />
              </Dialog.Close>
            </div>
            <GameSearchField ref={search} value={q} onChange={setQ} placeholder={C.searchPlaceholder(raceGames.length)} />
            <GameFilterChips value={filter} onChange={setFilter} worlds={raceWorlds} showNew={newGameIds(raceGames, meta).length > 0} />
            <p className="text-muted text-[13px] font-medium" aria-live="polite">
              {C.count(list.length)}
            </p>
          </div>
          <ul
            className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 pt-1 pb-[max(28px,env(safe-area-inset-bottom))]"
            aria-label={C.title}
          >
            {!filtering && (
              <li>
                <PickRow selected={value === null} onClick={() => pick(null)} title={C.any} sub={C.anySub} icon="shuffle" />
              </li>
            )}
            {list.map((g) => (
              <li key={g.id}>
                <PickRow
                  selected={value === g.id}
                  onClick={() => pick(g.id)}
                  title={g.name}
                  sub={WORLD_BY_ID[g.world].name}
                  dot={WORLD_BY_ID[g.world].color}
                  time={durationLabel(meta[g.id]?.typicalSec ?? 180)}
                  art={<GameIcon3D meta={g} size={44} />}
                />
              </li>
            ))}
            {list.length === 0 && (
              <li className="flex flex-col items-center gap-3 px-6 pt-8 text-center">
                <p className="text-muted text-[16px]">{C.empty}</p>
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    setFilter("all");
                  }}
                  className="press bg-surface-raised h-11 rounded-[14px] px-4 text-[15px] font-semibold"
                >
                  {C.showAll}
                </button>
              </li>
            )}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PickRow({
  selected,
  onClick,
  title,
  sub,
  dot,
  time,
  icon,
  art,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  sub: string;
  dot?: string;
  time?: string;
  icon?: string;
  art?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className="press bg-surface flex min-h-[60px] w-full items-center gap-3 rounded-[20px] py-2 pr-3 pl-3 text-left"
      style={selected ? { boxShadow: "inset 0 0 0 2px var(--accent)" } : undefined}
    >
      {art ?? (
        <span className="bg-surface-raised text-accent flex size-11 shrink-0 items-center justify-center rounded-[14px]">
          <Icon name={icon ?? "shuffle"} size={24} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-display truncate text-[16px] font-extrabold">{title}</span>
        <span className="text-muted flex items-center gap-1.5 text-[13px] font-medium">
          {dot && <span aria-hidden className="size-2 rounded-full" style={{ background: dot }} />}
          {sub}
        </span>
      </span>
      {time && (
        <span className="bg-surface-raised text-muted flex h-7 shrink-0 items-center gap-1 rounded-[10px] px-2 text-[12px] font-semibold">
          <Icon name="timer" size={14} />
          {time}
        </span>
      )}
      {selected ? (
        <span className="bg-accent text-on-accent flex size-7 shrink-0 items-center justify-center rounded-full">
          <Icon name="check" size={16} />
          <span className="sr-only">{duelCopy.picker.selected}</span>
        </span>
      ) : (
        <Icon name="caret-right" size={18} className="text-muted shrink-0" />
      )}
    </button>
  );
}
