"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { BayStyles } from "@/games/_shared/BayStyles";
import { BOTTOM_ROW, TOP_ROW, legalPits, sow } from "./engine";
import { gains, type OwarePuzzle, type OwareState } from "./logic";

const SEED_C = ["#F7C4EE", "#FFC93C", "#F4F5FB", "#F27ADB"];
const SEED_MS = 70;
const ROWS = [TOP_ROW, BOTTOM_ROW];

/**
 * Oware Daily board (Board Games B5). Tap one of your pits to preview the sow: the pit lifts, the
 * pits it feeds ring up and the captures it would make glow pink. "Sow pit N" drops the seeds pit to
 * pit 70 ms apart with a tick each, then captures. One pit captures the most.
 */
export default function OwareBoard({ puzzle, initialState, hint, disabled, api }: BoardProps<OwarePuzzle, OwareState>) {
  const legal = useMemo(() => legalPits(puzzle.pits, 0), [puzzle]);
  const best = useMemo(() => Math.max(0, ...gains(puzzle).map((g) => g.gain)), [puzzle]);
  const [pick, setPick] = useState<number | null>(initialState?.pit ?? null);
  const [shown, setShown] = useState<number[]>(puzzle.pits);
  const [sowing, setSowing] = useState(false);
  const [done, setDone] = useState(false);
  const [gone, setGone] = useState<number[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const preview = useMemo(() => (pick === null ? null : sow(puzzle.pits, pick)), [pick, puzzle]);
  const busy = sowing || done || !!disabled;

  const describe = (pit: number) => {
    const r = sow(puzzle.pits, pit);
    const n = puzzle.pits[pit];
    const after = (p: number) => puzzle.pits[p] + sowCount(r.path, p);
    const seeds = `${n} ${n === 1 ? "seed" : "seeds"}`;
    if (r.grandSlam) return `Pit ${pit + 1} sows ${seeds} and would take every seed they have. Grand slam: no capture.`;
    const where = r.last >= 6 ? `their pit with ${after(r.last)}` : `your pit ${r.last + 1}`;
    if (!r.gain) return `Pit ${pit + 1} sows ${seeds} and lands in ${where}. No capture.`;
    return `Pit ${pit + 1} sows ${seeds} and lands in ${where}. You capture ${r.captured.map(after).join(" + ")}.`;
  };

  const choose = useCallback(
    (pit: number) => {
      if (busy) return;
      if (pit >= 6) {
        api.feedback("Sow from your row, the bottom one.", "info", "hand-pointing");
        return;
      }
      if (!legal.includes(pit)) {
        api.ruleBreak(puzzle.pits[pit] ? "You must feed their empty row." : "That pit is empty.");
        return;
      }
      play("tick");
      setPick(pit);
      const text = describe(pit);
      api.feedback(text, "info", "hand-pointing");
      api.announce(text);
      api.onMove({ pit });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, busy, legal, puzzle],
  );

  const sowNow = useCallback(() => {
    if (busy || pick === null) return;
    const r = sow(puzzle.pits, pick);
    setSowing(true);
    const step = puzzle.pits.slice();
    step[pick] = 0;
    setShown(step.slice());
    r.path.forEach((p, k) =>
      timers.current.push(
        setTimeout(() => {
          step[p]++;
          setShown(step.slice());
          play("tick");
        }, (k + 1) * SEED_MS),
      ),
    );
    const end = (r.path.length + 1) * SEED_MS + 120;
    timers.current.push(
      setTimeout(() => {
        if (r.gain) {
          play("capture");
          setGone(r.captured);
          setShown(r.pits);
        }
        if (r.gain === best) {
          setDone(true);
          setSowing(false);
          timers.current.push(setTimeout(() => play("jingle"), 250));
          api.feedback(`Biggest capture. You take ${r.gain}.`, "success", "check-circle");
          api.announce(`Sowed pit ${pick + 1}. You capture ${r.gain}. Puzzle cleared.`);
          api.onMove({ pit: pick }, { correctStreak: 1 });
          api.onSolved({ pit: pick });
        } else {
          api.ruleBreak(r.gain ? `Only ${r.gain}. Another pit captures more.` : "No capture. Another pit captures more.");
          api.onMove({ pit: pick }, { mistake: true });
          timers.current.push(
            setTimeout(() => {
              setShown(puzzle.pits);
              setGone([]);
              setPick(null);
              setSowing(false);
            }, 1200),
          );
        }
      }, end),
    );
  }, [api, best, busy, pick, puzzle]);

  const again = useCallback(() => {
    if (busy) return;
    setPick(null);
    api.onMove({ pit: null });
    api.feedback("Pick a pit. Capture the most in one sow.", "info", "hand-pointing");
  }, [api, busy]);

  useEffect(() => {
    api.setControls([
      { id: "again", label: "Pick again", icon: "arrow-counter-clockwise", onPress: again, disabled: busy || pick === null },
      { id: "sow", label: pick === null ? "Sow" : `Sow pit ${pick + 1}`, icon: "hand-pointing", onPress: sowNow, disabled: busy || pick === null, tone: "world" },
    ]);
  }, [api, again, sowNow, busy, pick]);

  useEffect(() => {
    api.feedback("Pick a pit. Capture the most in one sow.", "info", "hand-pointing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keys = useGridKeys(2, 6, (i) => choose(ROWS[Math.floor(i / 6)][i % 6]));
  const hintPit = typeof hint?.target === "number" ? hint.target : -1;
  const fed = new Set(preview && !sowing && !done ? preview.path : []);
  const willTake = new Set(preview && !sowing && !done ? preview.captured : []);
  const gainNow = done ? best : preview && !sowing ? preview.gain : 0;

  return (
    <div className="flex w-full flex-col gap-2.5" data-board="oware">
      <BayStyles />
      <ScoreCard label="Rival" sub="Captured so far" score={puzzle.scores[1]} initial="R" tint="var(--w-shape)" />
      <div
        role="grid"
        aria-label="Oware board. Your row is the bottom one; sowing runs anticlockwise."
        aria-rowcount={2}
        aria-colcount={6}
        onKeyDown={keys.onKeyDown}
        className={`flex flex-col gap-3 rounded-[28px] px-2.5 py-3.5`}
        style={{ background: "#3A2232", boxShadow: "inset 0 -8px 0 rgba(0,0,0,.25)" }}
      >
        {ROWS.map((row, ri) => (
          <div role="row" key={ri} className="contents">
            <div className="grid grid-cols-6 gap-1.5">
              {row.map((pit, ci) => {
                const i = ri * 6 + ci;
                const n = shown[pit];
                const mine = pit < 6;
                const isPick = pick === pit && !done;
                const take = willTake.has(pit);
                const ring = isPick ? "0 0 0 3px var(--accent)" : take ? "0 0 0 3px var(--world)" : fed.has(pit) ? "0 0 0 2px #F7C4EE" : pit === hintPit ? "0 0 0 3px var(--gold)" : "0 0 0 0 transparent";
                const badge: CSSProperties = isPick
                  ? { background: "var(--accent)", color: "var(--on-accent)" }
                  : take || gone.includes(pit)
                    ? { background: "var(--world)", color: "#0E0F1A" }
                    : { background: "var(--surface-raised)", color: "var(--text)" };
                return (
                  <div
                    key={pit}
                    role="gridcell"
                    data-i={i}
                    data-pit={pit}
                    tabIndex={keys.focus === i ? 0 : -1}
                    aria-label={`${mine ? `Your pit ${pit + 1}` : `Their pit ${pit - 5}`}, ${n} ${n === 1 ? "seed" : "seeds"}${isPick ? ", picked" : ""}${take ? ", would be captured" : ""}`}
                    aria-selected={isPick}
                    aria-disabled={!mine || !legal.includes(pit)}
                    onClick={() => {
                      keys.setFocus(i);
                      choose(pit);
                    }}
                    className={`relative flex aspect-square min-w-11 flex-wrap content-center items-center justify-center gap-0.5 rounded-full p-1.5 outline-none ${mine ? "cursor-pointer" : ""} ${pit === hintPit ? "hint-ring" : ""}`}
                    style={{
                      background: "#24131F",
                      boxShadow: `inset 0 4px 0 rgba(0,0,0,.35), ${ring}`,
                      transform: isPick ? "translateY(-4px)" : "none",
                      transition: "transform 180ms var(--ease-out), box-shadow 180ms var(--ease-out)",
                    }}
                  >
                    {Array.from({ length: Math.min(n, 12) }, (_, k) => (
                      <span
                        key={k}
                        aria-hidden
                        className="size-[7px] rounded-full"
                        style={{
                          background: SEED_C[k % 4],
                          animation: gone.includes(pit) ? "bay-fade-out 220ms var(--ease-out) both" : isPick ? "bay-seed-hop .9s ease-in-out infinite" : undefined,
                        }}
                      />
                    ))}
                    <span
                      aria-hidden
                      className={`num absolute right-[-4px] flex h-5 min-w-[22px] items-center justify-center rounded-[7px] px-1 text-[12px] font-bold ${ri === 0 ? "top-[-10px]" : "bottom-[-10px]"}`}
                      style={badge}
                    >
                      {n}
                    </span>
                  </div>
                );
              })}
            </div>
            {ri === 0 && (
              <div aria-hidden className="num flex items-center gap-2 px-1 text-[12px] font-semibold" style={{ color: "#F7C4EE" }}>
                <Icon name="arrow-left" size={14} />
                <span className="h-0.5 flex-1" style={{ background: "repeating-linear-gradient(90deg,#F7C4EE 0 6px,transparent 6px 12px)" }} />
                sowing runs anticlockwise
                <span className="h-0.5 flex-1" style={{ background: "repeating-linear-gradient(90deg,#F7C4EE 0 6px,transparent 6px 12px)" }} />
                <Icon name="arrow-right" size={14} />
              </div>
            )}
          </div>
        ))}
      </div>
      <ScoreCard label="You" sub={done ? "Biggest capture" : pick === null ? "Your move" : "Preview"} score={puzzle.scores[0]} plus={gainNow} initial="Y" tint="var(--w-line)" accent />
    </div>
  );
}

function sowCount(path: number[], pit: number) {
  return path.filter((p) => p === pit).length;
}

function ScoreCard({ label, sub, score, plus = 0, initial, tint, accent }: { label: string; sub: string; score: number; plus?: number; initial: string; tint: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] bg-surface px-3.5 py-2.5">
      <div className="font-display flex size-10 flex-none items-center justify-center rounded-[12px] text-[16px] font-black" style={{ background: tint, color: "#0E0F1A" }}>
        {initial}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold">{label}</span>
        <span className="text-[13px] font-medium" style={{ color: accent ? "var(--accent)" : "var(--text-muted)" }}>
          {sub}
        </span>
      </div>
      <div className="flex flex-col items-end">
        <span className="num text-[26px] font-semibold whitespace-nowrap">
          {score}
          {plus > 0 && (
            <span className="ml-1.5 text-[18px]" style={{ color: "var(--world)" }}>
              +{plus}
            </span>
          )}
        </span>
        <span className="text-[12px] font-medium whitespace-nowrap text-muted">captured</span>
      </div>
    </div>
  );
}
