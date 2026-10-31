"use client";

import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { GameShell } from "@/components/game/GameShell";
import { BOARDS } from "@/games/board-registry";
import { GAME_BY_ID } from "@/lib/catalog";
import { HttpError } from "@/lib/client/api";
import { matchAction } from "@/lib/client/multiplayer";
import { throttle } from "@/lib/multiplayer/progress";
import { TIMING } from "@/lib/multiplayer/constants";
import type { MatchView } from "@/lib/multiplayer/types";

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
}: {
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

  useEffect(() => {
    mistakes.current = view.players.find((p) => p.id === view.me)?.mistakes ?? 0;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useMemo(
    () =>
      throttle((state: unknown, m: number) => {
        void matchAction(view.id, "progress", { round, state, mistakes: m }).catch(() => {});
      }, TIMING.progressMs),
    [view.id, round],
  );
  useEffect(() => () => send.cancel(), [send]);

  const onMove = useCallback(
    (state: unknown, _ms: number, info?: { mistake?: boolean }) => {
      if (info?.mistake) mistakes.current++;
      lastState.current = state;
      send(state, mistakes.current);
    },
    [send],
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

  if (!meta || !Board) return null;
  return (
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
      onExit={onExit}
      strip={strip}
      locked={locked}
      puzzleKey={key}
    />
  );
}
