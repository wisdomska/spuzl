"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useCellSize } from "@/components/game/useBoardSize";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { BayStyles, SQUARE } from "@/games/_shared/BayStyles";
import { count, isKing, legalMoves, samePath, seatOf, squareNumber } from "./engine";
import { COPY, type DraughtsPuzzle, type DraughtsState } from "./logic";

const HOP_MS = 200;

/**
 * Draughts Daily board (Board Games B4). Tap your piece, then tap each landing square to plan the
 * chain; numbered badges show the plan and planned captures dim. "Play chain" hops the piece
 * (180 ms ease-in-out per jump), fading each captured piece (scale .8). Non-captures are refused:
 * captures are compulsory.
 */
export default function DraughtsBoard({ puzzle, initialState, hint, disabled, api }: BoardProps<DraughtsPuzzle, DraughtsState>) {
  const board = puzzle.board;
  const moves = useMemo(() => legalMoves(board, 0), [board]);
  const rivals = useMemo(() => count(board, 1), [board]);
  const [plan, setPlan] = useState<number[]>(() => initialState?.path?.slice() ?? []);
  const [hop, setHop] = useState(-1); // index into plan while the chain plays
  const [done, setDone] = useState(false);
  const [shake, setShake] = useState<{ sq: number; n: number }>({ sq: -1, n: 0 });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cell = useCellSize(8, 0, 8, 48);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const prefixMoves = useMemo(() => moves.filter((m) => plan.every((s, i) => m.path[i] === s)), [moves, plan]);
  const complete = plan.length > 1 ? (prefixMoves.find((m) => samePath(m.path, plan)) ?? null) : null;
  const nextSquares = useMemo(
    () => new Set(plan.length && !complete ? prefixMoves.map((m) => m.path[plan.length]).filter((x) => x !== undefined) : []),
    [plan, prefixMoves, complete],
  );
  const planned = useMemo(() => {
    const caps = new Set<number>();
    const m = prefixMoves.find((x) => x.path.length >= plan.length);
    if (m) m.caps.slice(0, Math.max(0, plan.length - 1)).forEach((c) => caps.add(c));
    return caps;
  }, [prefixMoves, plan]);
  const busy = hop >= 0 || done || !!disabled;

  const sqLabel = (sq: number) => `square ${squareNumber(sq)}, row ${(sq >> 3) + 1}, column ${(sq & 7) + 1}`;

  const refuse = (sq: number, msg: string) => {
    setShake((s) => ({ sq, n: s.n + 1 }));
    api.ruleBreak(msg);
    api.onMove({ path: plan }, { mistake: true });
  };

  const tap = useCallback(
    (sq: number) => {
      if (busy) return;
      const p = board[sq];
      const startsHere = moves.some((m) => m.path[0] === sq);
      if (p && seatOf(p) === 0 && plan[0] !== sq) {
        if (!startsHere) return refuse(sq, COPY.compulsory);
        play("tick");
        setPlan([sq]);
        api.onMove({ path: [sq] });
        api.feedback("Piece picked. Tap each landing square in turn.", "info", "hand-pointing");
        api.announce(`Your ${isKing(p) ? "king" : "piece"} on ${sqLabel(sq)} picked`);
        return;
      }
      if (!plan.length) return;
      if (plan[0] === sq && plan.length === 1) {
        setPlan([]);
        api.onMove({ path: [] });
        return;
      }
      if (!nextSquares.has(sq)) {
        const last = plan[plan.length - 1];
        const step = Math.abs((sq >> 3) - (last >> 3)) === 1 && Math.abs((sq & 7) - (last & 7)) === 1;
        return refuse(sq, step ? COPY.compulsory : COPY.notOpen);
      }
      const next = [...plan, sq];
      setPlan(next);
      play("pop", { step: next.length - 1 });
      api.onMove({ path: next }, { correctStreak: next.length - 1 });
      const full = moves.find((m) => samePath(m.path, next));
      const n = next.length - 1;
      if (full) {
        api.feedback(`${n}-jump chain planned. Tap Play chain.`, "info", "path");
        api.announce(`Jump ${n} to ${sqLabel(sq)}. Chain complete, ${full.caps.length} captures planned.`);
      } else {
        api.feedback(`${n} ${n === 1 ? "jump" : "jumps"} planned. Keep going.`, "info", "path");
        api.announce(`Jump ${n} to ${sqLabel(sq)}`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, board, busy, moves, nextSquares, plan],
  );

  const undo = useCallback(() => {
    if (busy || !plan.length) return;
    const next = plan.slice(0, -1);
    setPlan(next);
    api.onMove({ path: next });
    api.feedback(next.length > 1 ? `${next.length - 1} jumps planned.` : COPY.rule, "info", "path");
  }, [api, busy, plan]);

  const playChain = useCallback(() => {
    if (busy || !complete) return;
    const path = complete.path;
    for (let k = 1; k < path.length; k++)
      timers.current.push(
        setTimeout(() => {
          setHop(k);
          play("capture");
        }, k * HOP_MS),
      );
    timers.current.push(
      setTimeout(
        () => {
          if (complete.caps.length === rivals) {
            setDone(true);
            setHop(-1);
            play("jingle");
            api.feedback(COPY.cleared, "success", "check");
            api.announce(`${COPY.cleared} ${complete.caps.length} captures.`);
            api.onSolved({ path });
          } else {
            refuse(path[path.length - 1], COPY.left);
            timers.current.push(
              setTimeout(() => {
                setHop(-1);
                setPlan([]);
              }, 900),
            );
          }
        },
        path.length * HOP_MS + 80,
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, busy, complete, rivals]);

  useEffect(() => {
    api.setControls([
      { id: "undo", label: "Undo jump", icon: "arrow-counter-clockwise", onPress: undo, disabled: busy || !plan.length },
      { id: "play", label: "Play chain", icon: "path", onPress: playChain, disabled: busy || !complete, tone: "world" },
    ]);
  }, [api, undo, playChain, busy, plan.length, complete]);

  useEffect(() => {
    api.feedback(COPY.rule, "info", "hand-pointing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keys = useGridKeys(8, 8, tap);
  const hintSq = typeof hint?.target === "number" ? hint.target : -1;

  // What the board shows: the original layout, or the chain mid-play / after the clear.
  const shownAt = (sq: number) => {
    if (hop < 0 && !done) return board[sq];
    const path = complete?.path ?? plan;
    const k = done ? path.length - 1 : hop;
    if (sq === path[0] && k > 0) return 0;
    if (sq === path[k]) return board[path[0]] === 1 && sq >> 3 === 0 ? 2 : board[path[0]];
    return board[sq];
  };
  const goneAt = (sq: number) => {
    if (hop < 0 && !done) return false;
    const caps = complete?.caps ?? [];
    const k = done ? caps.length : hop;
    return caps.slice(0, k).includes(sq);
  };
  const piece = Math.round(cell * 0.78);

  return (
    <div className="flex flex-col items-center" data-board="draughts">
      <BayStyles />
      <div
        role="grid"
        aria-label="Draughts board, your pieces move up"
        aria-rowcount={8}
        aria-colcount={8}
        onKeyDown={keys.onKeyDown}
        className={`grid overflow-hidden rounded-[14px] ${done ? "board-pulse" : ""}`}
        style={{
          gridTemplateColumns: `repeat(8, ${cell}px)`,
          gridTemplateRows: `repeat(8, ${cell}px)`,
          boxShadow: "0 0 0 4px var(--surface-raised)",
        }}
      >
        {Array.from({ length: 8 }, (_, r) => (
          <div role="row" key={r} className="contents">
            {Array.from({ length: 8 }, (_, c) => {
              const sq = r * 8 + c;
              const dark = (r + c) % 2 === 1;
              const p = shownAt(sq);
              const gone = goneAt(sq);
              const mine = !!p && seatOf(p) === 0;
              const step = plan.indexOf(sq);
              const isStart = step === 0 && hop < 0;
              const dimmed = planned.has(sq) && hop < 0 && !done;
              const isNext = nextSquares.has(sq);
              const shaking = shake.sq === sq;
              const label = `${sqLabel(sq)}, ${p ? `${mine ? "your" : "rival"} ${isKing(p) ? "king" : "piece"}` : dark ? "empty" : "light square"}${step > 0 ? `, jump ${step}` : ""}${dimmed ? ", captured in plan" : ""}`;
              return (
                <div
                  key={sq}
                  role="gridcell"
                  data-i={sq}
                  tabIndex={keys.focus === sq ? 0 : -1}
                  aria-label={label}
                  aria-selected={step >= 0}
                  onClick={() => {
                    keys.setFocus(sq);
                    tap(sq);
                  }}
                  className={`relative flex items-center justify-center outline-none focus-visible:z-10 ${dark ? "cursor-pointer" : ""}`}
                  style={{
                    width: cell,
                    height: cell,
                    background: done && dark ? "var(--world)" : dark ? SQUARE.draughtsDark : SQUARE.light,
                    boxShadow: isStart
                      ? "inset 0 0 0 3px var(--world)"
                      : sq === hintSq
                        ? "inset 0 0 0 3px var(--gold)"
                        : shaking
                          ? "inset 0 0 0 3px var(--danger)"
                          : undefined,
                    transition: done
                      ? `background 300ms var(--ease-out) ${(Math.abs(r - ((complete?.path.at(-1) ?? 0) >> 3)) + Math.abs(c - ((complete?.path.at(-1) ?? 0) & 7))) * 70}ms`
                      : undefined,
                  }}
                >
                  {shaking && <span key={shake.n} aria-hidden className="hatch absolute inset-0" />}
                  {!!p && (
                    <span
                      key={`${sq}-${shaking ? shake.n : 0}`}
                      aria-hidden
                      className={`flex items-center justify-center rounded-full ${shaking ? "bay-shake" : hop >= 0 && sq === complete?.path[hop] ? "bay-pop" : ""}`}
                      style={{
                        width: piece,
                        height: piece,
                        opacity: dimmed ? 0.45 : 1,
                        animation: gone ? "bay-fade-out 180ms var(--ease-out) both" : undefined,
                        background: mine
                          ? "radial-gradient(circle at 40% 35%,#FFFFFF,#DCDDEA 60%,#BFC1D4)"
                          : "radial-gradient(circle at 40% 35%,#3A3550,#16131F 65%,#0E0F1A)",
                        boxShadow: mine
                          ? "inset 0 -4px 0 #A2A6C2, inset 0 3px 0 #FFFFFF, 0 4px 0 #7E8199, 0 7px 6px rgba(0,0,0,.45)"
                          : "inset 0 -4px 0 #000, inset 0 3px 0 #3A3550, 0 0 0 2px var(--world), 0 5px 0 #6A3C5E, 0 8px 6px rgba(0,0,0,.45)",
                        color: mine ? "#0E0F1A" : "var(--world)",
                      }}
                    >
                      {isKing(p) ? <Icon name="crown-simple" size={18} /> : !mine && <Icon name="circle" size={16} />}
                    </span>
                  )}
                  {step > 0 && hop < 0 && !done && (
                    <span
                      aria-hidden
                      className="num bay-pop absolute flex size-6 items-center justify-center rounded-full text-[12px] font-bold"
                      style={{ background: "var(--world)", color: "#0E0F1A" }}
                    >
                      {step}
                    </span>
                  )}
                  {isNext && hop < 0 && (
                    <span aria-hidden className="bay-dot absolute size-3 rounded-full" style={{ background: "rgba(14,15,26,.45)" }} />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
