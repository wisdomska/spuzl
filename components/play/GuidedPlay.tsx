"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { GameShell } from "@/components/game/GameShell";
import { Button } from "@/components/ui/Button";
import { PageLoader } from "@/components/ui/PageLoader";
import { Spuz } from "@/components/brand/Spuz";
import { BOARDS } from "@/games/board-registry";
import { setGuessAttempt } from "@/games/_shared/guess";
import type { Hint } from "@/games/types";
import type { GameMeta } from "@/lib/catalog";
import { api } from "@/lib/client/api";
import { guidedCopy as T } from "@/lib/copy/guided";

/**
 * The first try of each game: a short practice board in the real shell, with free, unlimited hints that also
 * appear on their own after a pause. Skippable at any time; nothing is recorded.
 */
export function GuidedPlay({
  meta,
  daily,
  onDone,
  onExit,
}: {
  meta: GameMeta;
  daily: boolean;
  onDone: (how: "done" | "skipped") => void;
  onExit: () => void;
}) {
  const reduce = useReducedMotion();
  const [puzzle, setPuzzle] = useState<unknown>(null);
  const [solved, setSolved] = useState(false);
  const Board = BOARDS[meta.id];

  useEffect(() => {
    let live = true;
    setGuessAttempt(null); // content games check practice guesses by puzzle reference, not an attempt
    api<{ puzzle: unknown }>(`/api/v1/guided/${meta.id}`)
      .then((r) => live && setPuzzle(r.puzzle))
      .catch(() => live && onDone("skipped")); // no practice board: straight to the game
    return () => {
      live = false;
    };
  }, [meta.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!puzzle || !Board) return <PageLoader message={T.loading} />;

  const coach = (
    <motion.div
      className="bg-surface-raised mx-1 mb-2 flex items-center gap-2.5 rounded-[18px] py-2 pr-2 pl-1.5"
      initial={reduce ? false : { opacity: 0, transform: "translateY(-6px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      role="note"
    >
      <Spuz mood={solved ? "cheer" : "wave"} size={48} decorative still />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] leading-tight font-bold">{solved ? T.doneTitle : T.title(meta.name)}</span>
        <span className="text-muted text-[13px] leading-snug">{solved ? T.doneBody : T.body}</span>
      </div>
      {!solved && (
        <button
          type="button"
          onClick={() => onDone("skipped")}
          aria-label={T.skipAria(meta.name)}
          className="press bg-surface h-11 shrink-0 rounded-[12px] px-3.5 text-[14px] font-bold"
        >
          {T.skip}
        </button>
      )}
    </motion.div>
  );

  return (
    <GameShell
      key={`guided:${meta.id}`}
      meta={meta}
      Board={Board}
      puzzle={puzzle as never}
      mode="tutorial"
      label={T.label}
      guided
      hintsLeft={99}
      requestHint={async (state) => (await api<{ hint: Hint | null }>(`/api/v1/guided/${meta.id}`, { json: { state } })).hint}
      onSolved={() => setSolved(true)}
      onExit={onExit}
      strip={coach}
      celebrate={solved}
      endBar={
        solved ? (
          <Button size="lg" className="w-full" icon="play" onClick={() => onDone("done")} autoFocus>
            {daily ? T.goDaily : T.goFree}
          </Button>
        ) : undefined
      }
    />
  );
}
