"use client";

import { motion, useReducedMotion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import { sizeCopy as T } from "@/lib/copy/size";

/** Board sizes of a game that has more than one (Spuzdoku: Sixer 6 × 6 and Nine 9 × 9). */
export const SIZES: Record<string, { id: string; n: number }[]> = {
  sixer: [
    { id: "sixer", n: 6 },
    { id: "nine", n: 9 },
  ],
  nine: [
    { id: "sixer", n: 6 },
    { id: "nine", n: 9 },
  ],
};

const KEY = "spuzl.size";
export function lastSize(game: string): string | null {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string>)[SIZES[game]?.[0].id ?? game] ?? null;
  } catch {
    return null;
  }
}
export function rememberSize(game: string, chosen: string) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string>;
    all[SIZES[game]?.[0].id ?? game] = chosen;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* private mode: the picker just has no favourite */
  }
}

/** A tiny n × n grid drawing for an option. */
function GridMark({ n }: { n: number }) {
  const s = 64;
  const box = n === 6 ? [2, 3] : [3, 3];
  return (
    <svg viewBox={`0 0 ${s} ${s}`} width={s} height={s} aria-hidden>
      <rect x="1" y="1" width={s - 2} height={s - 2} rx="8" fill="var(--surface)" stroke="var(--line)" strokeWidth="2" />
      {Array.from({ length: n - 1 }, (_, i) => {
        const p = 1 + ((i + 1) * (s - 2)) / n;
        const thickR = (i + 1) % box[0] === 0;
        const thickC = (i + 1) % box[1] === 0;
        return (
          <g key={i}>
            <line x1={p} y1="3" x2={p} y2={s - 3} stroke={thickC ? "var(--text-muted)" : "var(--line)"} strokeWidth={thickC ? 2 : 1} />
            <line x1="3" y1={p} x2={s - 3} y2={p} stroke={thickR ? "var(--text-muted)" : "var(--line)"} strokeWidth={thickR ? 2 : 1} />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Before a game of a many-sized game (owner, 14 Nov 2026: "let the user choose the board of 6 or the board of 9"):
 * two big choices, the last one picked marked. Picking the other size moves to that game's page.
 */
export function SizePicker({
  game,
  name,
  onPick,
  onBack,
}: {
  game: string;
  name: string;
  onPick: (id: string) => void;
  onBack: () => void;
}) {
  const reduce = useReducedMotion();
  const last = lastSize(game);
  const sizes = SIZES[game] ?? [];
  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-6 px-5 pt-[max(20px,env(safe-area-inset-top))] pb-8">
      <button
        type="button"
        onClick={onBack}
        aria-label={T.back}
        className="press bg-surface-raised flex size-11 items-center justify-center rounded-[14px]"
      >
        <Icon name="arrow-left" size={20} />
      </button>
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[28px] leading-tight font-black">{T.title(name)}</h1>
        <p className="text-muted text-[16px]">{T.intro}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label={T.group}>
        {sizes.map((s, i) => (
          <motion.button
            key={s.id}
            type="button"
            onClick={() => onPick(s.id)}
            autoFocus={s.id === (last ?? sizes[0].id)}
            initial={reduce ? false : { opacity: 0, transform: "translateY(8px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: 0.24, delay: reduce ? 0 : i * 0.05, ease: [0.23, 1, 0.32, 1] }}
            className="press bg-surface-raised flex items-center gap-4 rounded-[20px] p-4 text-left"
            style={s.id === last ? { boxShadow: "inset 0 0 0 2px var(--accent)" } : undefined}
            data-size={s.n}
          >
            <GridMark n={s.n} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-display text-[22px] font-black">{T.size(s.n)}</span>
              <span className="text-muted text-[14px]">{s.n === 6 ? T.small : T.big}</span>
              {s.id === last && <span className="text-accent text-[13px] font-semibold">{T.last}</span>}
            </span>
            <Icon name="caret-right" size={18} className="text-muted shrink-0" />
          </motion.button>
        ))}
      </div>
    </main>
  );
}
