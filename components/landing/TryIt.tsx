"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import CrownfallBoard from "@/games/crownfall/Board";
import { TUTORIAL_PUZZLE } from "@/games/crownfall/tutorial";
import { analyze, type CrownfallState } from "@/games/crownfall/logic";
import type { BoardApi } from "@/games/types";
import { Spuz } from "@/components/brand/Spuz";
import { Icon } from "@/components/ui/Icon";
import { aboutCopy as T } from "@/lib/copy/about";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** The landing page's playable 4 × 4 Crownfall (the same board as the welcome lesson), in a phone card. */
export function TryIt() {
  const [cells, setCells] = useState<CrownfallState>(() => new Array(16).fill(0));
  const [solved, setSolved] = useState(false);
  const a = analyze(TUTORIAL_PUZZLE, cells);
  const ok = [a.crowns >= 2 && a.rule !== "row" && a.rule !== "column", a.crowns >= 2 && a.rule !== "region", a.clear];
  const api = useMemo<BoardApi<CrownfallState>>(
    () => ({
      onMove: (s) => setCells(s),
      onSolved: () => setSolved(true),
      feedback() {},
      ruleBreak() {},
      announce() {},
      setControls() {},
    }),
    [],
  );

  return (
    <div className="relative mx-auto w-full max-w-[360px]">
      <div className="bg-accent text-on-accent absolute -top-4 -right-2 z-10 flex rotate-3 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-black tracking-wide uppercase shadow-[0_4px_0_var(--accent-depth)]">
        <Icon name="hand-tap" size={16} />
        {T.tryIt.label}
      </div>
      <div className="bg-surface border-line rounded-[36px] border p-5 shadow-[0_30px_60px_rgb(0_0_0/0.35)]">
        <div className="flex items-center justify-between">
          <p className="font-display text-logic text-[20px] font-black">{T.tryIt.game}</p>
          <span className="text-muted font-mono text-[12px] tracking-widest uppercase">4 × 4</span>
        </div>
        <ul className="mt-3 flex flex-col gap-1.5">
          {T.tryIt.rules.map((r, i) => (
            <li
              key={r}
              className="flex items-center gap-2 text-[14px] font-medium transition-colors duration-200"
              style={{ color: ok[i] ? "var(--accent)" : "var(--text-muted)" }}
            >
              <Icon name={ok[i] ? "check-circle" : "circle"} size={16} />
              {r}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-center" style={{ ["--world" as string]: "var(--w-logic)" }}>
          <CrownfallBoard puzzle={TUTORIAL_PUZZLE} mode="tutorial" api={api} />
        </div>
        <div className="mt-4 min-h-[52px]" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            {solved ? (
              <motion.div
                key="won"
                className="flex items-center gap-3"
                initial={{ opacity: 0, transform: "translateY(6px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                transition={{ duration: 0.24, ease: EASE_OUT }}
              >
                <Spuz mood="party" size={52} decorative />
                <div className="flex flex-1 flex-col">
                  <p className="text-[15px] font-bold">{T.tryIt.solved}</p>
                  <Link href="/intro" className="text-accent flex items-center gap-1 text-[15px] font-bold">
                    {T.tryIt.more}
                    <Icon name="arrow-right" size={16} />
                  </Link>
                </div>
              </motion.div>
            ) : (
              <motion.p key="hint" className="text-muted text-center text-[14px]" exit={{ opacity: 0, transition: { duration: 0.12 } }}>
                {T.tryIt.hint}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
