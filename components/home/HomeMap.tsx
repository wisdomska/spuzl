"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { WORLDS, gamesInWorld, LAUNCH_IDS, type WorldId } from "@/lib/catalog";
import { Island } from "./Island";
import { Spuz, type SpuzMood } from "@/components/brand/Spuz";
import { play } from "@/lib/audio";

/** Island layout: the design's zigzag (x 200/40/220/30, ~77 px rows), extended to all 9 worlds. */
const SLOTS = [
  { x: 200, y: 60 },
  { x: 40, y: 135 },
  { x: 220, y: 215 },
  { x: 30, y: 290 },
  { x: 205, y: 370 },
  { x: 45, y: 450 },
  { x: 215, y: 530 },
  { x: 35, y: 610 },
  { x: 200, y: 690 },
];
const BOB = [5, 5.6, 4.8, 6, 5.3, 5.8, 4.9, 5.5, 5.1];

export interface WorldProgress {
  cleared: number;
  total: number;
}

export function HomeMap({
  progress,
  current,
  mood,
  color,
  unit = "Dailies cleared today",
}: {
  progress: Record<WorldId, WorldProgress>;
  current: WorldId;
  mood: SpuzMood;
  color: string;
  /** what the island count means, read after it ("games tried") */
  unit?: string;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [spuzAt, setSpuzAt] = useState<WorldId>(current);
  const [hopTo, setHopTo] = useState<{ x: number; y: number } | null>(null);
  const busy = useRef(false);
  const idx = (w: WorldId) => WORLDS.findIndex((x) => x.id === w);
  const width = 390;

  // Islands navigate in code (after Spuz's hop), so prefetch every world: the loading screen is then ready
  // the moment the hop ends, even on a slow connection.
  useEffect(() => {
    for (const w of WORLDS) router.prefetch(`/world/${w.id}`);
  }, [router]);

  // World travel (Handoff): camera + Spuz hops along the dotted path in 3 arcs over 700 ms; RM cross-fades.
  const travel = (w: WorldId) => {
    if (busy.current) return;
    busy.current = true;
    if (reduce || w === spuzAt) {
      router.push(`/world/${w}`);
      return;
    }
    const to = SLOTS[idx(w)];
    setHopTo({ x: to.x + 6, y: to.y - 8 });
    [0, 233, 466].forEach((t) => setTimeout(() => play("hop"), t));
    setTimeout(() => {
      setSpuzAt(w);
      router.push(`/world/${w}`);
    }, 720);
  };

  const from = SLOTS[idx(spuzAt)];
  return (
    <div className="relative mx-auto" style={{ width, height: SLOTS[SLOTS.length - 1].y + 150 }}>
      {/* dotted path between islands */}
      <svg className="pointer-events-none absolute inset-0" width={width} height={SLOTS[SLOTS.length - 1].y + 150} aria-hidden>
        <path
          d={SLOTS.map((s, i) => `${i ? "L" : "M"} ${s.x + 68} ${s.y + 56}`).join(" ")}
          fill="none"
          stroke="var(--line)"
          strokeWidth={3}
          strokeDasharray="0 9"
          strokeLinecap="round"
        />
      </svg>
      {WORLDS.map((w, i) => {
        const s = SLOTS[i];
        const p = progress[w.id] ?? { cleared: 0, total: 0 };
        return (
          <button
            key={w.id}
            type="button"
            onClick={() => travel(w.id)}
            data-world={w.id}
            className="absolute flex w-[136px] flex-col items-center gap-1.5 rounded-[24px] outline-none focus-visible:shadow-[var(--focus-ring)]"
            style={{ left: s.x, top: s.y }}
          >
            <Island color={w.color} icon={w.icon} landmarkLeft={w.id === spuzAt ? 78 : 46} bob={BOB[i]} />
            <span className="bg-surface flex items-center gap-1.5 rounded-full px-2.5 py-1">
              <span className="font-display text-[13px] font-bold whitespace-nowrap">{w.name}</span>
              <span className="num text-muted text-[12px] font-semibold">
                {p.cleared}/{p.total}
              </span>
              <span className="sr-only">, {unit}</span>
            </span>
          </button>
        );
      })}
      <motion.div
        className="pointer-events-none absolute"
        initial={false}
        animate={
          hopTo ? { transform: `translate(${hopTo.x}px, ${hopTo.y}px)` } : { transform: `translate(${from.x + 6}px, ${from.y - 8}px)` }
        }
        transition={{ duration: 0.7, ease: [0.77, 0, 0.175, 1] }}
        style={{ left: 0, top: 0 }}
      >
        <motion.div
          animate={
            hopTo
              ? {
                  transform: [
                    "translateY(0px)",
                    "translateY(-22px)",
                    "translateY(0px)",
                    "translateY(-22px)",
                    "translateY(0px)",
                    "translateY(-22px)",
                    "translateY(0px)",
                  ],
                }
              : undefined
          }
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <Spuz mood={hopTo ? "cheer" : mood} size={64} color={color} decorative />
        </motion.div>
      </motion.div>
    </div>
  );
}

/** Per-world Dailies progress for today (featured launch games + all games in that world). */
export function worldProgress(cleared: Record<string, number>): Record<WorldId, WorldProgress> {
  const out = {} as Record<WorldId, WorldProgress>;
  for (const w of WORLDS) {
    const games = gamesInWorld(w.id);
    out[w.id] = { cleared: games.filter((g) => cleared[g.id] !== undefined).length, total: games.length };
  }
  return out;
}

export function nextDaily(cleared: Record<string, number>, ready: (id: string) => boolean) {
  return LAUNCH_IDS.find((id) => cleared[id] === undefined && ready(id)) ?? null;
}
