"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MySpuz } from "@/components/meta/MySpuz";
import { Confetti } from "@/components/fx/Confetti";
import { Icon } from "@/components/ui/Icon";
import { play } from "@/lib/audio";
import { track } from "@/lib/analytics/track";
import { gameOverCopy as C } from "@/lib/copy/game-over";
import { prefersReducedMotion, useSettings } from "@/lib/settings/store";

export type GameOutcome = "won" | "lost" | "draw";

/**
 * The moment a full game (chess, draughts, Ludo, Oware… with a friend, Play live or against the bot) ends: a big,
 * unmissable card over the board saying who won and why, with Spuz, the win or loss sound and its buzz, and
 * confetti for a win. "See the board" closes it so the final position can be studied; the action button
 * (Rematch, Play again) is the obvious next step. Shown once per game: `id` is remembered for this browser tab,
 * so opening a finished game again doesn't replay it.
 */
export function GameOverBanner({
  id,
  outcome,
  reason,
  actionLabel,
  onAction,
  metric,
}: {
  /** unique per game (match id, or bot game key) */
  id: string;
  outcome: GameOutcome | null;
  /** why it ended, e.g. "Checkmate." or "They resigned." */
  reason?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** admin Metrics (R2-ADMIN): the game and where it was played, sent once with the outcome as game_over */
  metric?: { game: string; kind: "bay" | "bot" };
}) {
  const reduce = prefersReducedMotion({ reducedMotion: useSettings((s) => s.reducedMotion) });
  // Decided during render (not in an effect): open the first time this game is seen ending in this tab.
  const [seen, setSeen] = useState<{ id: string | null; open: boolean }>({ id: null, open: false });
  if (outcome && seen.id !== id) {
    let fresh = true;
    try {
      const key = `spuzl.gameOver.${id}`;
      fresh = !sessionStorage.getItem(key);
      if (fresh) sessionStorage.setItem(key, "1");
    } catch {
      /* storage blocked: still show it this once */
    }
    setSeen({ id, open: fresh });
  }
  const open = seen.open && seen.id === id;
  const setOpen = (v: boolean) => setSeen((s) => ({ ...s, open: v }));
  const action = useRef<HTMLButtonElement>(null);

  // The win or loss sound (with its buzz) and focus on the next step, once, as the card opens.
  useEffect(() => {
    if (!open) return;
    play(outcome === "won" ? "duelWin" : outcome === "lost" ? "duelLose" : "notify");
    if (metric && outcome) track("game_over", { game: metric.game, mode: metric.kind, kind: outcome });
    action.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening, not when the outcome prop re-renders
  }, [open]);

  const title = outcome === "won" ? C.won : outcome === "lost" ? C.lost : C.draw;
  return (
    <AnimatePresence>
      {open && outcome && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        >
          <button
            type="button"
            aria-label={C.seeBoard}
            className="absolute inset-0 bg-[rgb(6_7_13/.62)]"
            onClick={() => setOpen(false)}
            data-no-tick
          />
          {outcome === "won" && <Confetti seed={`gameover:${id}`} className="pointer-events-none fixed inset-0 z-[61]" />}
          <motion.div
            role="alertdialog"
            aria-modal
            aria-labelledby="game-over-title"
            aria-describedby={reason ? "game-over-reason" : undefined}
            className="bg-surface-raised relative z-[62] flex w-full max-w-[400px] flex-col items-center gap-3 rounded-[28px] px-6 pt-6 pb-5 text-center shadow-[0_24px_60px_rgba(0,0,0,.5)]"
            initial={reduce ? false : { scale: 0.86, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            style={outcome === "won" ? { boxShadow: "inset 0 0 0 3px var(--accent), 0 24px 60px rgba(0,0,0,.5)" } : undefined}
          >
            <MySpuz mood={outcome === "won" ? "party" : outcome === "lost" ? "sad" : "thinking"} size={88} decorative />
            <h2
              id="game-over-title"
              className="font-display text-[34px] leading-none font-black"
              style={{ color: outcome === "won" ? "var(--accent)" : "var(--text)" }}
            >
              {title}
            </h2>
            {reason && (
              <p id="game-over-reason" className="text-muted text-[16px] font-semibold">
                {reason}
              </p>
            )}
            <div className="mt-2 grid w-full gap-2">
              {onAction && actionLabel && (
                <button
                  ref={action}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onAction();
                  }}
                  className="press bg-accent text-on-accent font-display flex h-[52px] items-center justify-center gap-2 rounded-[16px] text-[17px] font-black"
                >
                  <Icon name="arrows-clockwise" size={20} />
                  {actionLabel}
                </button>
              )}
              <button
                ref={onAction ? undefined : action}
                type="button"
                onClick={() => setOpen(false)}
                className="press bg-surface h-[48px] rounded-[16px] text-[15px] font-semibold"
              >
                {C.seeBoard}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
