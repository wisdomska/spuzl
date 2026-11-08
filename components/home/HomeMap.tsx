"use client";

import { whenQuiet } from "@/lib/perf/quiet";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { WORLDS, gamesInWorld, LAUNCH_IDS, type WorldId } from "@/lib/catalog";
import { Island } from "./Island";
import type { SpuzMood } from "@/components/brand/Spuz";
import { MySpuz } from "@/components/meta/MySpuz";
import { play } from "@/lib/audio";

/** Island layout: the design's zigzag (x 200/40/220/30, ~77 px rows), one slot per live world (up to 9). */
const ALL_SLOTS = [
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
/**
 * Wider arrangements for tablets and computers, in the same 136 px island units. The map picks whichever layout
 * fills the space best and scales it to fit (up to MAX_SCALE), so islands grow on big screens instead of sitting
 * in a phone-sized column. Only used when the live worlds fit them (four groups today).
 */
const GRID_SLOTS = [
  { x: 30, y: 40 },
  { x: 330, y: 80 },
  { x: 60, y: 230 },
  { x: 360, y: 270 },
];
const WIDE_SLOTS = [
  { x: 20, y: 90 },
  { x: 230, y: 30 },
  { x: 440, y: 110 },
  { x: 650, y: 40 },
];
type Slot = { x: number; y: number };
const ISLAND_W = 136;
/** island plus its label, below the slot's y */
const ISLAND_H = 150;
const MAX_SCALE = 1.9;
const bounds = (slots: Slot[]) => ({
  w: Math.max(...slots.map((s) => s.x)) + ISLAND_W + 20,
  h: Math.max(...slots.map((s) => s.y)) + ISLAND_H,
});
/** Empty worlds are hidden (lib/catalog WORLDS), so the path is as long as the live worlds. */
const TALL = ALL_SLOTS.slice(0, WORLDS.length);
const LAYOUTS: Slot[][] = WORLDS.length <= GRID_SLOTS.length ? [TALL, GRID_SLOTS, WIDE_SLOTS] : [TALL];

/** The layout and scale that make the islands biggest inside `avail` (phones keep the tall zigzag). */
function fit(availW: number, availH: number): { slots: Slot[]; scale: number } {
  let best = { slots: TALL, scale: Math.min(availW / 390, 1.15) };
  if (availW < 600) return best;
  for (const slots of LAYOUTS) {
    const b = bounds(slots);
    const scale = Math.min(availW / Math.max(b.w, 390), availH / b.h, MAX_SCALE);
    if (scale > best.scale + 0.02) best = { slots, scale };
  }
  return best;
}
const BOB = [5, 5.6, 4.8, 6, 5.3, 5.8, 4.9, 5.5, 5.1];

export interface WorldProgress {
  cleared: number;
  total: number;
}

/** easeOutQuad / easeInQuad (easings.net): the rise and fall of one hop. */
const UP = [0.5, 1, 0.89, 1] as const;
const DOWN = [0.11, 0, 0.5, 0] as const;
/** take-off times (s) of the three hops in the 700 ms trip */
const HOPS = [0, 0.233, 0.466];

export function HomeMap({
  progress,
  current,
  mood,
  unit = "Dailies cleared today",
}: {
  progress: Record<WorldId, WorldProgress>;
  current: WorldId;
  mood: SpuzMood;
  /** what the island count means, read after it ("games tried") */
  unit?: string;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  // A saved "current" world can be one that has since been hidden: Spuz then starts on the first island.
  const [spuzAt, setSpuzAt] = useState<WorldId>(WORLDS.some((w) => w.id === current) ? current : WORLDS[0].id);
  const [hopTo, setHopTo] = useState<{ x: number; y: number } | null>(null);
  const busy = useRef(false);
  const idx = (w: WorldId) => WORLDS.findIndex((x) => x.id === w);
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<{ slots: Slot[]; scale: number }>({ slots: TALL, scale: 1 });
  // Size the map to the space between the header and the Continue bar (the section's bottom padding).
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const section = el.parentElement;
      const reserve = section ? parseFloat(getComputedStyle(section).paddingBottom) || 0 : 0;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const availH = Math.max(320, window.innerHeight - top - reserve - 8);
      const next = fit(el.clientWidth, availH);
      setView((v) => (v.slots === next.slots && Math.abs(v.scale - next.scale) < 0.01 ? v : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  const SLOTS = view.slots;
  const b = bounds(SLOTS);
  const width = Math.max(b.w, SLOTS === TALL ? 390 : 0);
  const height = b.h;

  // Islands navigate in code (after Spuz's hop), so prefetch every world: the loading screen is then ready
  // the moment the hop ends, even on a slow connection.
  // R2-01: once the screen is quiet, so it never competes with a game the player opens straight away.
  useEffect(() => {
    let live = true;
    void whenQuiet().then(() => {
      if (live) for (const w of WORLDS) router.prefetch(`/world/${w.id}`);
    });
    return () => {
      live = false;
    };
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
    // A hop on each take-off and a soft landing at the end, scheduled on the audio clock with the arcs.
    HOPS.forEach((t) => play("hop", { delay: t }));
    play("land", { delay: 0.7, gain: 0.7 });
    setTimeout(() => {
      setSpuzAt(w);
      router.push(`/world/${w}`);
    }, 720);
  };

  const from = SLOTS[idx(spuzAt)];
  return (
    <div ref={box} className="w-full">
      <div className="relative mx-auto" style={{ width: width * view.scale, height: height * view.scale }}>
        <div className="absolute top-0 left-0" style={{ width, height, transform: `scale(${view.scale})`, transformOrigin: "0 0" }}>
          {/* dotted path between islands */}
          <svg className="pointer-events-none absolute inset-0" width={width} height={height} aria-hidden>
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
                className="press absolute flex w-[136px] flex-col items-center gap-1.5 rounded-[24px] outline-none focus-visible:shadow-[var(--focus-ring)]"
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
              // Gravity: each arc decelerates up and accelerates down, so the three hops read as jumps.
              transition={{ duration: 0.7, ease: [UP, DOWN, UP, DOWN, UP, DOWN] }}
            >
              <MySpuz mood={hopTo ? "cheer" : mood} size={64} decorative />
            </motion.div>
          </motion.div>
        </div>
      </div>
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
