"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { GameShell } from "@/components/game/GameShell";
import { Button } from "@/components/ui/Button";
import { PageLoader } from "@/components/ui/PageLoader";
import { Spuz } from "@/components/brand/Spuz";
import { BOARDS } from "@/games/board-registry";
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
  doneLabel,
}: {
  meta: GameMeta;
  daily: boolean;
  /** "unavailable": no practice board (none for this game, turned off, offline): straight to the game, not learned */
  onDone: (how: "done" | "skipped" | "unavailable") => void;
  onExit: () => void;
  /** the last button's words (default: on to the Daily or free play) */
  doneLabel?: string;
}) {
  const reduce = useReducedMotion();
  const [puzzle, setPuzzle] = useState<unknown>(null);
  const [solved, setSolved] = useState(false);
  const Board = BOARDS[meta.id];

  useEffect(() => {
    let live = true;
    api<{ puzzle: unknown }>(`/api/v1/guided/${meta.id}`)
      .then((r) => live && setPuzzle(r.puzzle))
      .catch(() => live && onDone("unavailable")); // no practice board: straight to the game
    return () => {
      live = false;
    };
  }, [meta.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!puzzle || !Board) return <PageLoader message={T.loading} />;

  // One slim line (in the top bar on a wide screen, under it on a phone): the board keeps the room. The full
  // explainer is the hint count on the Hint tool and How to play in the menu.
  const coach = (
    <motion.div
      className="bg-surface-raised flex h-11 w-full min-w-0 items-center gap-2 overflow-hidden rounded-[14px] pl-1.5"
      initial={reduce ? false : { opacity: 0, transform: "translateY(-6px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      role="note"
    >
      <Spuz mood={solved ? "cheer" : "wave"} size={32} decorative still />
      <p className="m-0 min-w-0 flex-1 truncate text-[14px] leading-5">
        <span className="font-bold">{solved ? T.doneTitle : T.title(meta.name)}</span>{" "}
        <span className="text-muted">{solved ? T.doneBody : T.short}</span>
      </p>
      {!solved && (
        <button
          type="button"
          onClick={() => onDone("skipped")}
          aria-label={T.skipAria(meta.name)}
          className="press bg-surface h-11 shrink-0 rounded-[14px] px-4 text-[14px] font-bold"
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
      banner={coach}
      celebrate={solved}
      endBar={
        solved ? (
          <Button size="lg" className="w-full" icon="play" onClick={() => onDone("done")} autoFocus>
            {doneLabel ?? (daily ? T.goDaily : T.goFree)}
          </Button>
        ) : undefined
      }
    />
  );
}
