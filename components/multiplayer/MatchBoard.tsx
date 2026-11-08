"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GameShell } from "@/components/game/GameShell";
import { BOARDS } from "@/games/board-registry";
import { GAME_BY_ID } from "@/lib/catalog";
import { HttpError } from "@/lib/client/api";
import { useQueryClient } from "@tanstack/react-query";
import { matchAction, matchKey } from "@/lib/client/multiplayer";
import { throttle } from "@/lib/multiplayer/progress";
import { TIMING } from "@/lib/multiplayer/constants";
import { isScoreRaceGame } from "@/lib/multiplayer/games";
import type { MatchView } from "@/lib/multiplayer/types";
import { HowItWorks, useNewToGame } from "./practice";

/** Matches and games whose How it works card was shown (once per game per match; the board remounts each round). */
const howShown = new Set<string>();

/**
 * The live board for a Duel round or a Party game. Moves stay on this device; the board state goes
 * to the server at most twice a second, and the server answers with the validated progress that
 * everyone else sees. The opponent's board is never sent here.
 */
export function MatchBoard({
  view,
  strip,
  locked,
  label,
  onExit,
  onFinished,
  onRejected,
  onFirstMove,
  onClockStart,
  howItWorks = true,
}: {
  /**
   * R3-07: the header timer started (this screen's first move of the round, a reload included), so a screen can
   * run its other clocks by the same rule (lib/multiplayer/duel.ts `ownClockMs`). Gets the round key.
   */
  onClockStart?: (key: string) => void;
  /**
   * R2-07: a game new to this player gets the 10-second How it works card as the round starts (a live round never
   * waits for a practice round). Off where the server already held a rules break (ranked Duels).
   */
  howItWorks?: boolean;
  /** once per round, on this player's first move (not after a reload into a round they had already started) */
  onFirstMove?: (game: string) => void;
  view: MatchView;
  strip: ReactNode;
  locked: boolean;
  label: string;
  onExit: () => void;
  onFinished: (v: MatchView) => void;
  onRejected: (code: string) => void;
}) {
  const puzzle = view.puzzle!;
  const meta = GAME_BY_ID[puzzle.game];
  const Board = BOARDS[puzzle.game];
  const mistakes = useRef(0);
  const round = puzzle.round;
  const key = `${view.id}:${view.setNo}:${round}`;
  const lastState = useRef<unknown>(view.myState);
  const qc = useQueryClient();
  // The round this player already made a move in (a saved board state counts: they moved before a reload).
  const moved = useRef<string | null>(view.myState != null ? key : null);
  // The round whose header timer is running in this screen (GameShell starts it on the first move after mounting).
  const clocked = useRef<string | null>(null);

  useEffect(() => {
    mistakes.current = view.players.find((p) => p.id === view.me)?.mistakes ?? 0;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useMemo(
    () =>
      throttle((state: unknown, m: number) => {
        void matchAction<{ progress: number; mistakes: number }>(view.id, "progress", { round, state, mistakes: m })
          .then((r) =>
            // My own validated progress, straight from the server's answer.
            qc.setQueryData<MatchView>(matchKey(view.id), (v) =>
              v && v.round === round
                ? { ...v, players: v.players.map((p) => (p.id === v.me ? { ...p, progress: r.progress, mistakes: r.mistakes } : p)) }
                : v,
            ),
          )
          .catch(() => {});
      }, TIMING.progressMs),
    [view.id, round, qc],
  );
  useEffect(() => () => send.cancel(), [send]);

  const onMove = useCallback(
    (state: unknown, _ms: number, info?: { mistake?: boolean }) => {
      if (info?.mistake) mistakes.current++;
      lastState.current = state;
      if (clocked.current !== key) {
        clocked.current = key;
        onClockStart?.(key);
      }
      if (moved.current !== key) {
        moved.current = key;
        onFirstMove?.(puzzle.game);
      }
      send(state, mistakes.current);
    },
    [send, key, onFirstMove, onClockStart, puzzle.game],
  );

  const onSolved = useCallback(
    async (state: unknown) => {
      send.cancel();
      try {
        const v = await matchAction<MatchView>(view.id, "finish", { round, state, mistakes: mistakes.current });
        onFinished(v);
      } catch (e) {
        onRejected(e instanceof HttpError ? e.code : "error");
      }
    },
    [send, view.id, round, onFinished, onRejected],
  );

  const isNew = useNewToGame();
  const howKey = `${view.id}:${puzzle.game}`;
  const [how, setHow] = useState(() => howItWorks && !howShown.has(howKey) && isNew(puzzle.game));
  const closeHow = useCallback(() => {
    howShown.add(howKey);
    setHow(false);
  }, [howKey]);

  if (!meta || !Board) return null;
  return (
    <>
      {how && <HowItWorks game={puzzle.game} onDone={closeHow} />}
      <GameShell
        key={key}
        meta={meta}
        Board={Board}
        puzzle={puzzle.data}
        mode={view.kind === "duel" ? "duel" : "race"}
        label={label}
        initialState={(view.myState ?? undefined) as never}
        onMove={onMove}
        onSolved={onSolved}
        // R3-08: in a Party score race a run that ends without a clear (Higher or Lower out of slips) still scores:
        // it is handed in like a finish, and the server decides what it is worth.
        onFailed={view.kind === "race" && isScoreRaceGame(puzzle.game) ? (state: unknown) => void onSolved(state) : undefined}
        onExit={onExit}
        // The Duel and Party screens own leaving for the whole match (confirm, back-gesture guard, Escape, the
        // leave call), between rounds too; every way out of the shell asks them.
        leaveContext="managed"
        strip={strip}
        locked={locked}
        puzzleKey={key}
      />
    </>
  );
}
