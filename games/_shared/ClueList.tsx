"use client";

import { useEffect, useRef } from "react";
import { sidePanel as T } from "@/lib/copy/side-panel";

type Dir = "across" | "down";
interface ClueLike {
  n: number;
  text: string;
  len: number;
}

/**
 * Every clue of a crossword-style board, grouped Across then Down, for the shell's side panel on a wide screen.
 * The active clue is marked (tint, a bar on its edge and aria-current, not colour alone) and kept in view; a tap
 * moves the board to that clue. The list scrolls on its own when it is taller than its share of the screen.
 */
export function ClueList<C extends ClueLike>({
  groups,
  active,
  disabled,
  onPick,
}: {
  groups: { d: Dir; clues: C[] }[];
  active: { c: C; d: Dir } | null | undefined;
  disabled?: boolean;
  onPick: (c: C, d: Dir) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const key = active ? `${active.d}-${active.c.n}` : "";
  useEffect(() => {
    box.current?.querySelector<HTMLElement>(`[data-clue="${key}"]`)?.scrollIntoView({ block: "nearest" });
  }, [key]);
  return (
    <nav aria-label={T.clues} className="bg-surface flex max-h-[40dvh] flex-col gap-3 overflow-y-auto rounded-[18px] p-2" ref={box}>
      {groups.map(({ d, clues }) => (
        <section key={d} className="flex flex-col gap-0.5">
          <h2 className="text-muted px-2 pt-1 text-[13px] font-semibold tracking-[.04em] uppercase">
            {d === "across" ? T.across : T.down}
          </h2>
          <ul className="flex flex-col gap-0.5">
            {clues.map((c) => {
              const on = !!active && active.c === c && active.d === d;
              return (
                <li key={c.n}>
                  <button
                    type="button"
                    data-clue={`${d}-${c.n}`}
                    aria-current={on || undefined}
                    disabled={disabled}
                    onClick={() => onPick(c, d)}
                    className="press flex min-h-11 w-full items-start gap-2 rounded-[12px] px-2 py-2 text-left text-[15px] leading-[1.35]"
                    style={
                      on
                        ? { background: "color-mix(in srgb, var(--world) 18%, var(--surface))", boxShadow: "inset 3px 0 0 var(--world)" }
                        : undefined
                    }
                  >
                    <span className="num w-6 shrink-0 font-semibold text-[var(--world)] [[data-theme=light]_&]:text-[var(--world-ink)]">
                      {c.n}
                    </span>
                    <span className="min-w-0 flex-1">
                      {c.text} <span className="text-muted num">({c.len})</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
