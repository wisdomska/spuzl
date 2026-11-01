"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Spuz } from "@/components/brand/Spuz";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatClock, formatNumber } from "@/lib/format";
import { play } from "@/lib/audio";
import type { GameMeta } from "@/lib/catalog";
import { WORLD_BY_ID } from "@/lib/catalog";
import type { FinishRes } from "@/lib/client/api";
import { RaceLiveButton } from "@/components/multiplayer/GameChallenge";

/**
 * Solo Screens 05 Results: confetti header with Spuz, the time counting up, percentile, XP bar sweep
 * (scaleX from the left), Sparks with hints and slips, then Next puzzle (Handoff rule: a Daily clear
 * offers "Next puzzle" straight into Free play) and Share.
 */
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export function ResultsScreen({
  meta,
  result,
  hints,
  mistakes,
  relaxed,
  color,
  next,
  another,
  chips = [],
  onShare,
  onChallenge,
}: {
  meta: GameMeta;
  result: FinishRes;
  hints: number;
  mistakes: number;
  relaxed: boolean;
  color: string;
  /** primary: the named next game on the Home path ("Next in Logic Lab: Dusk") */
  next: { label: string; onClick: () => void };
  /** secondary: another puzzle of this game, same difficulty */
  another: { label: string; onClick: () => void };
  /** rank ups, badges, streaks: inline chips, never interstitials */
  chips?: { icon: string; label: string }[];
  onShare: () => void;
  /** "Beat my time": sends a friend this exact puzzle with your time as a ghost timer */
  onChallenge?: () => void;
}) {
  const reduce = useReducedMotion();
  const [progress, setT] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const instant = !!reduce || skipped;
  const t = instant ? 1 : progress;

  useEffect(() => {
    if (instant) return;
    play("coins");
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 900);
      setT(1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [instant]);

  const world = WORLD_BY_ID[meta.world];
  const xp = Math.round(result.reward.xp * t);
  const sparks = Math.round(result.reward.sparks * t);
  const flagged = result.status === "flagged";
  const scoreGame = meta.scoring === "score" && result.score !== undefined;
  const line = flagged
    ? "Cleared. That was quick, so a moderator will check it before it counts."
    : relaxed
      ? `Relaxed clear. ${hints ? `${hints} hint${hints > 1 ? "s" : ""}.` : "No hints."}`
      : hints === 0 && mistakes === 0
        ? `Clean. ${formatClock(result.timeMs)}, no hints. Who taught you?`
        : hints === 0
          ? `${formatClock(result.timeMs)}, no hints. Nice.`
          : `${formatClock(result.timeMs)} with ${hints} hint${hints > 1 ? "s" : ""}. Next time, solo.`;
  const fill = result.level.need ? result.level.into / result.level.need : 0;
  const levelled = result.level.after > result.level.before;

  return (
    <motion.main
      className="bg-bg relative mx-auto flex min-h-dvh max-w-[560px] flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28, ease: EASE_OUT }}
      onPointerDown={() => setSkipped(true)}
      style={{ ["--world" as string]: world.color }}
    >
      <div
        className="relative flex h-[230px] items-end justify-center overflow-hidden pb-3"
        style={{ background: "color-mix(in srgb, var(--world) 16%, #0E0F1A)" }}
      >
        {!instant && <ConfettiBurst />}
        <Spuz mood={flagged ? "thinking" : "cheer"} size={140} color={color} decorative />
      </div>
      <section className="flex flex-col gap-3.5 px-5 pt-4">
        <div className="flex flex-col items-center gap-1 text-center" aria-live="polite">
          <p className="self-stretch text-[17px] leading-[1.35] font-semibold">{line}</p>
          {scoreGame ? (
            <p className="num text-accent text-[56px] leading-none font-semibold">{formatNumber(Math.round((result.score ?? 0) * t))}</p>
          ) : (
            <p className="num text-accent text-[56px] leading-none font-semibold">{relaxed ? "Relaxed" : formatClock(result.timeMs * t)}</p>
          )}
          {result.percentile !== null && !relaxed && (
            <p className="text-muted text-[15px] font-medium">
              Faster than <span className="text-text">{Math.round(result.percentile)}%</span> of Spuzlers today
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-surface flex flex-col gap-2 rounded-[16px] px-3.5 py-3">
            <div className="flex justify-between text-[15px] font-semibold">
              <span>XP</span>
              <span className="num text-accent">+{xp}</span>
            </div>
            <div className="bg-line h-3 overflow-hidden rounded-[6px]">
              <motion.div
                className="bg-accent h-full origin-left rounded-[6px]"
                initial={instant ? false : { transform: "scaleX(0)" }}
                animate={{ transform: `scaleX(${levelled ? 1 : Math.max(0.02, fill)})` }}
                transition={instant ? { duration: 0 } : { duration: 0.6, delay: 0.3, ease: EASE_OUT }}
              />
            </div>
            <p className="num text-muted text-[13px] font-medium">
              {levelled
                ? `Level ${result.level.before} full`
                : `Lv ${result.level.after}, ${formatNumber(result.level.into)} / ${formatNumber(result.level.need)}`}
            </p>
          </div>
          <div className="bg-surface flex flex-col gap-1.5 rounded-[16px] px-3.5 py-3">
            <div className="flex justify-between text-[15px] font-semibold">
              <span>Sparks</span>
              <span className="num text-gold">+{sparks}</span>
            </div>
            <div className="text-muted flex gap-3 text-[14px] font-medium whitespace-nowrap">
              <span className="flex items-center gap-1">
                <Icon name="lightbulb" size={14} />
                {hints} hints
              </span>
              <span className="flex items-center gap-1">
                <Icon name="x-circle" size={14} />
                {mistakes} slips
              </span>
            </div>
          </div>
        </div>
        {result.streak?.extended && (
          <div className="bg-surface flex items-center gap-2 rounded-[16px] px-3.5 py-3 text-[15px] font-semibold">
            <Icon name="fire" size={20} className="text-gold" />
            <span className="num">{result.streak.current}</span> day streak
          </div>
        )}
      </section>
      {chips.length > 0 && (
        <ul className="flex flex-wrap justify-center gap-2 px-4 pt-3" aria-label="Unlocked">
          {chips.map((c) => (
            <motion.li
              key={c.label}
              className="bg-surface-raised text-gold flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-semibold"
              initial={reduce ? false : { opacity: 0, transform: "scale(0.8)" }}
              animate={{ opacity: 1, transform: "scale(1)" }}
              transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.6 }}
            >
              <Icon name={c.icon} size={16} />
              {c.label}
            </motion.li>
          ))}
        </ul>
      )}
      <div className="safe-bottom mt-auto grid grid-cols-[1fr_60px] gap-2.5 px-4 pt-4 pb-7">
        <Button size="lg" icon="play" onClick={next.onClick} className="text-[17px]" autoFocus>
          {next.label}
        </Button>
        <button
          type="button"
          aria-label="Share"
          onClick={onShare}
          className="toy bg-surface-raised flex h-[60px] items-center justify-center rounded-[20px]"
        >
          <Icon name="share-fat" size={22} />
        </button>
        {onChallenge && (
          <Button size="md" variant="secondary" icon="sword" onClick={onChallenge} className="col-span-2 w-full">
            Challenge a friend
          </Button>
        )}
        {/* Game-first Duel and Party (SPZ-13): race this game live; hidden for games that can't be raced */}
        <RaceLiveButton meta={meta} size="md" className="col-span-2 w-full" />
        <Button size="lg" variant="secondary" onClick={another.onClick} className="col-span-2">
          {another.label}
        </Button>
        <Link href="/" className="text-muted col-span-2 py-2 text-center text-[15px] font-medium">
          Back to the Grid
        </Link>
      </div>
    </motion.main>
  );
}

const CONFETTI = ["#FFC93C", "#2FD3E0", "#FF5A5F", "#8B7CFF", "#B8F23A", "#F4F5FB"];
/** 24 pieces (low-data caps at 30). Transform and opacity only. */
function ConfettiBurst() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: 24 }, (_, i) => {
        const x = (i * 37) % 100;
        const dur = 1.4 + ((i * 13) % 10) / 10;
        return (
          <motion.span
            key={i}
            className="absolute top-0 h-3.5 w-[9px] rounded-[2px]"
            style={{ left: `${x}%`, background: CONFETTI[i % CONFETTI.length] }}
            initial={{ transform: "translateY(-20px) rotate(0deg)", opacity: 1 }}
            animate={{ transform: `translateY(240px) rotate(${(i % 2 ? 1 : -1) * 320}deg)`, opacity: 0 }}
            transition={{ duration: dur, delay: (i % 8) * 0.06, ease: "linear" }}
          />
        );
      })}
    </div>
  );
}
