"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { GuidedPlay } from "@/components/play/GuidedPlay";
import { Icon } from "@/components/ui/Icon";
import { GAME_BY_ID } from "@/lib/catalog";
import { useMe } from "@/lib/client/api";
import { useMarkLearned } from "@/lib/client/learned";
import { practiceCopy as P } from "@/lib/copy/practice";
import { useGameSettings } from "@/lib/game-settings/client";
import { allLearned, learnedGames, needsHowItWorks } from "@/lib/guided";
import { hasLogic } from "@/games/logic-ids";
import { prefersReducedMotion, useSettings } from "@/lib/settings/store";

/** The card's life: it closes by itself after this long (R2-07). */
export const HOW_IT_WORKS_MS = 10_000;

/**
 * R2-07 in live games. A live round never waits for a practice round (except ranked Duels, where the server already
 * holds a 12-second rules break for a game new to either player). So:
 * - before the round, while the game is known and the player waits (a Party room's lobby, a friend Duel's waiting
 *   screen), `PracticeFirst` offers the practice round in place;
 * - once the round is starting, `HowItWorks` is a 10-second card with the rule, over the bottom of the screen.
 * Both only for a game the player has never cleared or learned, and neither for a game whose practice round the
 * admin turned off ("practice.disabled").
 */
export function useNewToGame(): (game: string) => boolean {
  const me = useMe().data;
  const off = useGameSettings()["practice.disabled"];
  return useCallback(
    (game: string) => needsHowItWorks({ id: game, played: me?.played, learned: allLearned(learnedGames(), me?.learned), disabled: off }),
    [me, off],
  );
}

/** Before joining a live round: "New to <game>? Practice first", running the practice round over the waiting screen. */
export function PracticeFirst({ games, className }: { games: readonly string[]; className?: string }) {
  const isNew = useNewToGame();
  const markLearned = useMarkLearned();
  const [open, setOpen] = useState<string | null>(null);
  const game = games.find((g) => !!GAME_BY_ID[g] && hasLogic(g) && isNew(g));
  if (open) {
    const meta = GAME_BY_ID[open];
    return (
      <div
        className="bg-bg fixed inset-0 z-50 overflow-y-auto"
        role="dialog"
        aria-modal
        aria-label={P.dialog(meta.name)}
        data-practice-first
      >
        <GuidedPlay
          meta={meta}
          daily={false}
          doneLabel={P.backToRoom}
          onExit={() => setOpen(null)}
          onDone={(how) => {
            if (how !== "unavailable") markLearned(open);
            setOpen(null);
          }}
        />
      </div>
    );
  }
  if (!game) return null;
  const meta = GAME_BY_ID[game];
  return (
    <div className={`bg-surface flex items-center gap-3 rounded-[18px] px-3.5 py-3 ${className ?? ""}`} data-practice-offer>
      <span className="bg-surface-raised text-accent flex size-11 flex-none items-center justify-center rounded-[14px]">
        <Icon name="graduation-cap" size={22} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[16px] font-semibold">{P.firstTitle(meta.name)}</span>
        <span className="text-muted text-[14px]">{P.firstBody}</span>
      </span>
      <button
        type="button"
        onClick={() => setOpen(game)}
        aria-label={P.firstAria(meta.name)}
        className="press bg-accent text-on-accent h-11 flex-none rounded-[14px] px-4 text-[15px] font-bold"
      >
        {P.firstCta}
      </button>
    </div>
  );
}

/**
 * The round is starting and the game is new to this player: a 10-second "How it works" card (the rule, and that
 * the race is on). It never covers the board: it sits over the bottom of the screen, closes with "Got it" or by
 * itself. Reduced motion: no slide, no animated bar.
 */
export function HowItWorks({ game, onDone }: { game: string; onDone: () => void }) {
  const meta = GAME_BY_ID[game];
  const osReduce = useReducedMotion();
  const appReduce = useSettings((s) => s.hydrated && prefersReducedMotion(s));
  const reduce = !!osReduce || appReduce;
  const [left, setLeft] = useState(HOW_IT_WORKS_MS);
  useEffect(() => {
    const t0 = Date.now();
    const t = setInterval(() => setLeft(Math.max(0, HOW_IT_WORKS_MS - (Date.now() - t0))), 250);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left === 0) onDone();
  }, [left, onDone]);
  if (!meta) return null;
  return (
    <motion.section
      aria-label={P.howAria(meta.name)}
      data-how-it-works
      className="bg-surface-raised fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-[520px] flex-col gap-2 rounded-[20px] p-4 shadow-[var(--shadow-float)]"
      initial={reduce ? false : { opacity: 0, transform: "translateY(16px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
    >
      <h2 className="font-display text-[18px] leading-6 font-black">{P.howTitle(meta.name)}</h2>
      <p className="text-[16px] leading-6 font-semibold">{meta.rule}</p>
      <p className="text-muted text-[14px]">{P.howBody}</p>
      <div
        className="bg-line h-1.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-label={P.howAuto}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((100 * left) / HOW_IT_WORKS_MS)}
      >
        <div className="bg-accent h-full origin-left rounded-full" style={{ transform: `scaleX(${left / HOW_IT_WORKS_MS})` }} />
      </div>
      <button type="button" onClick={onDone} className="press bg-accent text-on-accent mt-1 h-11 rounded-[14px] text-[16px] font-bold">
        {P.howGot}
      </button>
    </motion.section>
  );
}
