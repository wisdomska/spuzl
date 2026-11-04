"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { useGridKeys } from "@/components/game/useGridKeys";
import { isWide, useFitHeight, useViewportHeight, useViewportWidth, wideCell } from "@/components/game/useBoardSize";
import { ShellAside } from "@/components/game/ShellAside";
import { play } from "@/lib/audio";
import { BayStyles } from "@/games/_shared/BayStyles";
import { HOME, SAFE, applyStep, cellOf, legalSteps, trackIndexOfCell } from "./engine";
import { ColourBadge, Die3D, LUDO_LOOK, LudoTable } from "./look";
import { explain, ranked, type LudoPuzzle, type LudoState } from "./logic";

export { LUDO_LOOK } from "./look";
const N = 15;

/** 14 px of wooden frame across the board. */
const LUDO_OVERHEAD = 16;

/** Ludo cells: the phone fit (20 to 30 px), or the board column on a wide screen (useBoardSize `wideCell`). */
function useLudoCell() {
  const vw = useViewportWidth();
  const vh = useViewportHeight();
  if (isWide(vw, vh)) return wideCell(vw, vh, N, LUDO_OVERHEAD, 30);
  return Math.max(20, Math.min(30, Math.floor((Math.min(vw, 420) - 36 - LUDO_OVERHEAD) / N)));
}

/**
 * Ludo decision board (Board Games B6). The die shows the roll; glowing pieces can move. Tap one to
 * preview where it lands, then "Move piece N". The best move follows the published rubric (capture,
 * get home, reach safety, escape danger, leave base, never walk into range).
 */
export default function LudoBoard({ puzzle, initialState, hint, disabled, api }: BoardProps<LudoPuzzle, LudoState>) {
  const t = puzzle.table;
  const steps = useMemo(() => legalSteps(t, 0, puzzle.roll), [t, puzzle.roll]);
  const best = useMemo(() => ranked(puzzle)[0], [puzzle]);
  const [pick, setPick] = useState<number | null>(initialState?.piece ?? null);
  const [shown, setShown] = useState(t);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [moved, setMoved] = useState<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Short phones: the cells step down (to 20 px) until the die, the tools and the board fit one screen.
  const rootRef = useRef<HTMLDivElement>(null);
  const cell = useFitHeight(useLudoCell(), 20, N, rootRef, "shell");
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const movable = new Set(busy || done ? [] : steps.map((s) => s.piece));
  const preview = pick === null ? null : (steps.find((s) => s.piece === pick) ?? null);
  const dest = preview && !busy && !done ? cellOf(t.colours[0], preview.piece, preview.to) : null;

  // pieces by grid cell
  const at = new Map<number, { seat: number; piece: number }[]>();
  shown.pieces.forEach((ps, seat) =>
    ps.forEach((p, piece) => {
      const [r, c] = cellOf(shown.colours[seat], piece, p);
      const k = r * N + c;
      at.set(k, [...(at.get(k) ?? []), { seat, piece }]);
    }),
  );

  const choose = useCallback(
    (piece: number) => {
      if (busy || done || disabled) return;
      const st = steps.find((s) => s.piece === piece);
      if (!st) {
        api.ruleBreak(puzzle.roll === 6 ? "That piece cannot move." : "Only a 6 brings a piece out.");
        return;
      }
      play("tap", { gain: 0.6 });
      setPick(piece);
      const where =
        st.to === HOME
          ? "home"
          : st.to > 50
            ? "into your home column"
            : st.from < 0
              ? "out onto your start square"
              : `${puzzle.roll} squares on`;
      const text = `Piece ${piece + 1} moves ${where}${st.captures.length ? ", onto a rival" : ""}.`;
      api.feedback(text, "info", "hand-pointing");
      api.announce(text);
      api.onMove({ piece });
    },
    [api, busy, disabled, done, puzzle.roll, steps],
  );

  const move = useCallback(() => {
    if (busy || done || pick === null) return;
    const st = steps.find((s) => s.piece === pick)!;
    setBusy(true);
    setMoved(pick);
    setShown(applyStep(t, 0, st));
    play(st.captures.length ? "pieceCapture" : "tokenStep");
    timers.current.push(
      setTimeout(() => {
        if (pick === best.step.piece) {
          setDone(true);
          setBusy(false);
          api.feedback(`Best move. ${explain(best)}`, "success", "check-circle");
          api.announce(`Best move. ${explain(best)}`);
          api.onMove({ piece: pick }, { correctStreak: 1 });
          api.onSolved({ piece: pick });
        } else {
          api.ruleBreak("Not the best move. Look again at every piece.");
          api.onMove({ piece: pick }, { mistake: true });
          timers.current.push(
            setTimeout(() => {
              setShown(t);
              setMoved(null);
              setPick(null);
              setBusy(false);
            }, 1200),
          );
        }
      }, 450),
    );
  }, [api, best, busy, done, pick, steps, t]);

  const again = useCallback(() => {
    if (busy || done) return;
    setPick(null);
    api.onMove({ piece: null });
  }, [api, busy, done]);

  useEffect(() => {
    api.setControls([
      { id: "again", label: "Pick again", icon: "arrow-counter-clockwise", onPress: again, disabled: busy || done || pick === null },
      {
        id: "move",
        label: pick === null ? "Move" : `Move piece ${pick + 1}`,
        icon: "arrow-fat-lines-up",
        onPress: move,
        disabled: busy || done || pick === null,
        tone: "world",
      },
    ]);
  }, [api, again, move, busy, done, pick]);

  useEffect(() => {
    api.feedback("Pick the best move. Glowing pieces can move.", "info", "hand-pointing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keys = useGridKeys(N, N, (i) => {
    const mine = (at.get(i) ?? []).find((x) => x.seat === 0 && movable.has(x.piece));
    if (mine) choose(mine.piece);
  });
  const hintPiece = typeof hint?.target === "number" ? hint.target : -1;
  const homeCount = (seat: number) => shown.pieces[seat].filter((p) => p === HOME).length;
  const pieces = shown.pieces.flatMap((ps, seat) =>
    ps.map((p, piece) => {
      const [r, c] = cellOf(shown.colours[seat], piece, p);
      const mine = seat === 0;
      return {
        key: `${seat}-${piece}`,
        r,
        c,
        colour: shown.colours[seat],
        glow: mine && (movable.has(piece) || (pick === piece && !done)),
        lifted: mine && pick === piece && !done,
        className: mine && moved === piece ? "bay-pop" : undefined,
      };
    }),
  );
  const hintCell = hintPiece >= 0 ? (([r, c]) => r * N + c)(cellOf(t.colours[0], hintPiece, t.pieces[0][hintPiece])) : undefined;

  return (
    <div ref={rootRef} className="flex w-full flex-col gap-2.5" data-board="ludo">
      <BayStyles />
      {/* Players, then the die: around the board on a phone, in the side panel on a wide screen. */}
      <ShellAside>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${t.colours.length}, minmax(0, 1fr))` }}>
          {t.colours.map((col, seat) => (
            <div
              key={seat}
              className="flex flex-col items-center gap-1 rounded-[14px] p-1.5"
              style={
                seat === 0
                  ? { background: "var(--success-tint)", boxShadow: "inset 0 0 0 2px var(--accent)" }
                  : { background: "var(--surface)" }
              }
            >
              <div className="flex items-center gap-1.5">
                <ColourBadge colour={col} size={16} />
                <span className="text-[13px] font-semibold">{puzzle.names[seat]}</span>
              </div>
              <span className="num text-muted text-[11px] font-semibold">{homeCount(seat)} home</span>
            </div>
          ))}
        </div>
      </ShellAside>

      <div className="flex justify-center">
        <LudoTable
          cell={cell}
          label={`Ludo board. You are ${LUDO_LOOK[t.colours[0]].name}, ${LUDO_LOOK[t.colours[0]].shape} on the pawn. Glowing pawns can move.`}
          focus={keys.focus}
          onKeyDown={keys.onKeyDown}
          dest={dest}
          pieces={pieces}
          hintCell={hintCell}
          interactive={(i) => (at.get(i) ?? []).some((x) => x.seat === 0 && movable.has(x.piece))}
          cellLabel={(i) => {
            const r = Math.floor(i / N),
              c = i % N;
            const ti = trackIndexOfCell(r, c);
            const here = at.get(i) ?? [];
            const label = here.length
              ? here
                  .map(
                    (x) =>
                      `${x.seat === 0 ? "your" : `${puzzle.names[x.seat]}'s`} piece ${x.piece + 1}${x.seat === 0 && movable.has(x.piece) ? ", can move" : ""}`,
                  )
                  .join(", ")
              : ti >= 0 && SAFE.has(ti) && ti % 13 !== 0
                ? "safe star square"
                : ti >= 0
                  ? "track"
                  : "";
            return `Row ${r + 1}, column ${c + 1}${label ? `, ${label}` : ""}`;
          }}
          onCell={(i) => {
            keys.setFocus(i);
            const mine = (at.get(i) ?? []).find((x) => x.seat === 0);
            if (mine) choose(mine.piece);
          }}
        />
      </div>

      <ShellAside>
        <div className="flex items-center gap-3">
          <Die3D value={puzzle.roll} rollKey={puzzle.roll} size={56} label={`Die showing ${puzzle.roll}`} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-display text-[18px] font-extrabold">You rolled a {puzzle.roll}</span>
            <span className="text-muted text-[15px] leading-[1.4]">
              {puzzle.roll === 6 ? "Bring a piece out or move 6." : `Move one piece ${puzzle.roll}.`} Glowing pawns can move.
            </span>
          </div>
        </div>
      </ShellAside>
    </div>
  );
}
