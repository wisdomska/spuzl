"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { useCellSize, useFitHeight } from "@/components/game/useBoardSize";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { BayStyles, BEVEL, SQUARE } from "@/games/_shared/BayStyles";
import {
  BLACK,
  WHITE,
  colorOf,
  fromUci,
  inCheck,
  isCapture,
  isCheckmate,
  kingSquare,
  legalMoves,
  make,
  parseFen,
  sqName,
  toRows,
  typeOf,
  uci,
  type Move,
  type Position,
} from "./engine";
import { COPY, replay, type ChessPuzzle, type ChessState } from "./logic";
import { CH_N, Piece, useSprites } from "./Piece";
import { PromotionPicker } from "./Promotion";
import { ShellAside } from "@/components/game/ShellAside";

const LETTER = " PNBRQK";
/** Board coordinates: 12 px in the square ink (6:1 or better on every square colour), above the pieces. */
const COORD = "num pointer-events-none absolute z-[3] text-[12px] leading-[16px] font-bold text-[var(--square-ink)]";
/** A soft ring in the square's own colour keeps a coordinate readable where a dark piece stands behind it. */
const halo = (bg: string) => `0 0 2px ${bg}, 0 0 2px ${bg}`;
/** Legal-move dot: about a third of the square, never under 12 px. */
const DOT = (cell: number) => Math.max(12, Math.round(cell * 0.3));

/**
 * Chess Daily board (Board Games B2 + prototype chess screen). Tap a white piece to lift it
 * (translateY(-8px) scale(1.1)), dots mark legal squares and rings mark captures; tap a dot to move.
 * A move that keeps the forced mate is answered by black's longest defence; any other move shows
 * "Not mate. The king slips out." and slides back. Mate turns the king's square red with a shake.
 */
/** The physical sound of a move: capture knock, castling (king then rook), check, or a plain placement. */
function moveSound(before: Position, m: Move, after: Position) {
  const pc = before.b[m.from];
  if (isCapture(before, m)) return "pieceCapture";
  if (LETTER[typeOf(pc)] === "K" && Math.abs((m.from & 7) - (m.to & 7)) === 2) return "castle";
  if (inCheck(after)) return "pieceCheck";
  return "piecePlace";
}

export default function ChessBoard({ puzzle, initialState, hint, disabled, api }: BoardProps<ChessPuzzle, ChessState>) {
  const [moves, setMoves] = useState<string[]>(() => initialState?.moves?.slice() ?? []);
  const r = useMemo(() => replay(puzzle, moves), [puzzle, moves]);
  const [shown, setShown] = useState<Position>(() => r.pos);
  const [last, setLast] = useState<[number, number] | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wrongN, setWrongN] = useState(0);
  const [checkN, setCheckN] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** A move is on the board but not kept yet (being checked, or a wrong one about to slide back). */
  const pending = useRef(false);
  const streak = useRef(0);
  const sprites = useSprites();
  // The move line under the board: the squares step down until it fits under the board (laptops, short phones).
  const rootRef = useRef<HTMLDivElement>(null);
  const cell = useFitHeight(useCellSize(8, 0, 0, 48, 8.6), 36, 8, rootRef, "shell");
  const done = r.mated;
  const rows = toRows(shown.b);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  const legal = useMemo(() => (sel === null || busy ? [] : legalMoves(shown, sel)), [sel, shown, busy]);
  const targets = useMemo(() => new Set(legal.map((m) => m.to)), [legal]);

  const describe = (pos: Position, m: Move) => {
    const pc = pos.b[m.from];
    const name = CH_N[LETTER[typeOf(pc)]];
    const cap = pos.b[m.to] ? `, takes ${CH_N[LETTER[typeOf(pos.b[m.to])]]}` : "";
    const after = make(pos, m);
    const chk = isCheckmate(after) ? ", checkmate" : inCheck(after) ? ", check" : "";
    return `${colorOf(pc) === WHITE ? "White" : "Black"} ${name} ${sqName(m.from)} to ${sqName(m.to)}${cap}${chk}`;
  };

  const commit = useCallback(
    (m: Move) => {
      if (disabled || done || busy) return;
      const before = shown;
      const after = make(before, m);
      play(moveSound(before, m, after));
      setShown(after);
      setLast([m.from, m.to]);
      setSel(null);
      setPromo(null);
      setBusy(true);
      pending.current = true;
      api.announce(describe(before, m));
      const next = [...moves, uci(m)];
      // Let the move land (180 ms) before the mate search runs.
      later(() => {
        const res = replay(puzzle, next);
        if (res.wrongAt >= 0 || res.illegal) {
          streak.current = 0;
          setWrongN((n) => n + 1);
          api.ruleBreak(COPY.notMate);
          api.onMove({ moves }, { correctStreak: 0, mistake: true });
          later(() => {
            pending.current = false;
            setShown(r.pos);
            setLast(null);
            setBusy(false);
          }, 900);
          return;
        }
        streak.current++;
        pending.current = false;
        setMoves(next);
        const state = { moves: next };
        if (res.mated) {
          setShown(res.pos);
          setBusy(false);
          const line = res.plies.map((p) => p.san).join(" ");
          api.feedback(`${COPY.mate} ${line}`, "success", "check-circle");
          api.announce(`${COPY.mate} ${line}`);
          api.onMove(state, { correctStreak: streak.current });
          api.onSolved(state, { clearDelayMs: 650 });
          return;
        }
        api.onMove(state, { correctStreak: streak.current });
        if (inCheck(after)) setCheckN((n) => n + 1);
        // Black's longest defence answers after a beat.
        later(() => {
          const reply = res.plies[res.plies.length - 1];
          const rm = fromUci(after, reply.uci)!;
          play(moveSound(after, rm, res.pos));
          setShown(res.pos);
          setLast([rm.from, rm.to]);
          setBusy(false);
          const left = puzzle.mateIn - res.good;
          api.feedback(`Black plays ${reply.san}. Mate in ${left} more.`, "info", "hand-pointing");
          api.announce(`${describe(after, rm)}. White to move, mate in ${left}.`);
        }, 420);
      }, 200);
    },
    [api, busy, disabled, done, moves, puzzle, r.pos, shown],
  );

  const tapSquare = useCallback(
    (sq: number) => {
      if (disabled || done || busy) return;
      const pc = shown.b[sq];
      if (pc && colorOf(pc) === WHITE) {
        if (sel === sq) {
          // putting the piece back down where it was
          play("piecePlace", { gain: 0.6 });
          setSel(null);
          return;
        }
        play("pieceLift");
        setSel(sq);
        setPromo(null);
        const n = legalMoves(shown, sq).length;
        const name = CH_N[LETTER[typeOf(pc)]];
        api.feedback(
          `${name[0].toUpperCase()}${name.slice(1)} selected. Dots are legal squares; rings are captures.`,
          "info",
          "hand-pointing",
        );
        api.announce(`White ${name} ${sqName(sq)} picked up, ${n} legal ${n === 1 ? "move" : "moves"}`);
        return;
      }
      if (sel === null) return;
      const options = legal.filter((m) => m.to === sq);
      if (!options.length) {
        setSel(null);
        api.announce("Piece put down");
        return;
      }
      if (options.length > 1) {
        setPromo({ from: sel, to: sq });
        api.feedback("Promote to which piece?", "info", "crown-simple");
        api.announce("Choose a promotion piece");
        return;
      }
      commit(options[0]);
    },
    [api, busy, commit, disabled, done, legal, sel, shown],
  );

  // Undo takes back your own last move, at once (owner, 13 Nov 2026): a move still being checked or a wrong one
  // goes straight away, and a kept move goes with Black's answer to it. Nothing waits for the animations.
  const undo = useCallback(() => {
    if (done || (!moves.length && !pending.current)) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const takeBack = !pending.current;
    pending.current = false;
    const next = takeBack ? moves.slice(0, -1) : moves;
    const res = replay(puzzle, next);
    setMoves(next);
    setShown(res.pos);
    setLast(null);
    setSel(null);
    setPromo(null);
    setBusy(false);
    if (takeBack) api.onMove({ moves: next });
    api.feedback(COPY.pick, "info", "hand-pointing");
  }, [api, done, moves, puzzle]);

  useEffect(() => {
    api.setControls([
      { id: "undo", label: "Undo", icon: "arrow-counter-clockwise", onPress: undo, disabled: done || (!moves.length && !busy) },
      { id: "flip", label: "Flip", icon: "arrows-clockwise", onPress: () => setFlipped((f) => !f), active: flipped },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, undo, moves.length, done, busy, flipped]);

  useEffect(() => {
    api.feedback(COPY.pick, "info", "hand-pointing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A server hint lifts the piece it names.
  const hintFrom = (hint?.target as { from?: string } | null)?.from;
  const hintSq = hintFrom ? (8 - Number(hintFrom[1])) * 8 + "abcdefgh".indexOf(hintFrom[0]) : -1;
  const [seenHint, setSeenHint] = useState(-1);
  if (hintSq !== seenHint) {
    setSeenHint(hintSq);
    if (hintSq >= 0 && !done && shown.b[hintSq] && colorOf(shown.b[hintSq]) === WHITE) setSel(hintSq);
  }

  const toSq = (vi: number) => (flipped ? 63 - vi : vi);
  const toVi = toSq; // the mapping is its own inverse
  const keys = useGridKeys(8, 8, (vi) => tapSquare(toSq(vi)));
  const matedK = done ? kingSquare(shown.b, BLACK) : -1;
  const checkK = !done && inCheck(shown) ? kingSquare(shown.b, shown.turn) : -1;
  const startTurn = parseFen(puzzle.fen).turn;

  // Move chips: "1. Re8+", "1… Kf8", "2. ?"
  const chips = r.plies.map((p, k) => {
    const n = Math.floor(k / 2) + 1;
    return { t: p.white ? `${n}. ${p.san}` : `${n}… ${p.san}`, mine: p.white, latest: k === r.plies.length - 1 };
  });
  if (!done) chips.push({ t: `${r.good + 1}. ?`, mine: true, latest: false });

  return (
    <div ref={rootRef} className="flex w-full flex-col items-center gap-3.5" data-board="chess">
      <BayStyles />
      {/* Who moves and the mate depth: over the board on a phone, in the side panel on a wide screen. */}
      <ShellAside>
        <div className="flex w-full items-center gap-2.5 px-0.5 text-[16px] font-semibold">
          <span
            aria-hidden
            className="size-3.5 flex-none rounded-[4px]"
            style={{ background: startTurn === WHITE ? "#F4F5FB" : "#0E0F1A", boxShadow: "0 0 0 2px var(--line)" }}
          />
          {startTurn === WHITE ? "White" : "Black"} to move. Mate in {puzzle.mateIn}.
        </div>
      </ShellAside>
      <div
        role="grid"
        aria-label={`Chess board, ${flipped ? "black" : "white"} at the bottom`}
        aria-rowcount={8}
        aria-colcount={8}
        onKeyDown={keys.onKeyDown}
        className="relative grid rounded-[14px]"
        style={{
          gridTemplateColumns: `repeat(8, ${cell}px)`,
          gridTemplateRows: `repeat(8, ${cell}px)`,
          boxShadow: "0 8px 0 var(--world-depth), 0 14px 24px rgba(0,0,0,.45)",
          // Back-rank kings and queens rise about 0.4 of a square above the board; keep room for them past the gap.
          marginTop: Math.max(0, Math.round(cell * 0.4) - 14),
        }}
      >
        {Array.from({ length: 8 }, (_, vr) => (
          <div role="row" key={vr} className="contents">
            {Array.from({ length: 8 }, (_, vc) => {
              const vi = vr * 8 + vc;
              const sq = toSq(vi);
              const ch = rows[sq >> 3][sq & 7];
              const light = ((sq >> 3) + (sq & 7)) % 2 === 0;
              const isSel = sel === sq;
              const isLast = !!last && (last[0] === sq || last[1] === sq);
              const isTarget = targets.has(sq);
              const occ = ch !== ".";
              const mated = sq === matedK;
              const corner = vi === 0 ? "14px 0 0 0" : vi === 7 ? "0 14px 0 0" : vi === 56 ? "0 0 0 14px" : vi === 63 ? "0 0 14px 0" : "0";
              const bg = mated
                ? "var(--danger)"
                : isSel
                  ? SQUARE.sel
                  : isLast
                    ? light
                      ? SQUARE.lastLight
                      : SQUARE.lastDark
                    : light
                      ? SQUARE.light
                      : SQUARE.dark;
              const name = occ ? `${ch === ch.toUpperCase() ? "white" : "black"} ${CH_N[ch.toUpperCase()]}` : "empty";
              const anim = mated ? "bay-shake" : isLast && last![1] === sq ? (wrongN % 2 ? "bay-pop" : "cell-pop-a") : "";
              return (
                <div
                  key={sq}
                  role="gridcell"
                  data-i={vi}
                  data-sq={sqName(sq)}
                  tabIndex={keys.focus === vi ? 0 : -1}
                  aria-label={`${sqName(sq)}, ${name}${isSel ? ", picked up" : ""}${isTarget ? (occ ? ", capture" : ", legal move") : ""}${mated ? ", checkmated" : ""}`}
                  aria-selected={isSel}
                  onClick={() => {
                    keys.setFocus(vi);
                    tapSquare(sq);
                  }}
                  className="relative flex cursor-pointer items-center justify-center outline-none focus-visible:z-20"
                  style={{ width: cell, height: cell, background: bg, boxShadow: BEVEL, borderRadius: corner }}
                >
                  {sq === checkK && (
                    <span
                      key={checkN}
                      aria-hidden
                      className="bay-flash absolute inset-0"
                      style={{ background: "var(--danger)", borderRadius: corner }}
                    />
                  )}
                  {occ && <Piece ch={ch} size={cell} sprites={sprites} lift={isSel} className={anim} />}
                  {vc === 0 && (
                    <span aria-hidden className={`${COORD} top-0 left-1`} style={{ textShadow: halo(bg) }}>
                      {8 - (sq >> 3)}
                    </span>
                  )}
                  {vr === 7 && (
                    <span aria-hidden className={`${COORD} right-1 bottom-0`} style={{ textShadow: halo(bg) }}>
                      {"abcdefgh"[sq & 7]}
                    </span>
                  )}
                  {isTarget && (
                    <span
                      aria-hidden
                      className={`absolute rounded-full ${occ ? "" : "bay-dot"}`}
                      style={{
                        zIndex: 2,
                        width: occ ? cell - 4 : DOT(cell),
                        height: occ ? cell - 4 : DOT(cell),
                        background: occ ? "transparent" : "color-mix(in srgb, var(--square-ink) 50%, transparent)",
                        boxShadow: occ ? "inset 0 0 0 4px color-mix(in srgb, var(--square-ink) 60%, transparent)" : "none",
                      }}
                    />
                  )}
                  {sq === hintSq && !done && (
                    <span
                      aria-hidden
                      className="hint-ring absolute inset-0"
                      style={{ zIndex: 2, boxShadow: "inset 0 0 0 4px var(--gold)", borderRadius: corner }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {promo && (
          <PromotionPicker
            cell={cell}
            column={toVi(promo.to) & 7}
            top={toVi(promo.to) >> 3 === 0}
            white
            sprites={sprites}
            onCancel={() => {
              setPromo(null);
              setSel(null);
              api.announce("Promotion cancelled. Pawn put back.");
            }}
            onPick={(p) => {
              const m = legal.find((x) => x.from === promo.from && x.to === promo.to && " nbrq"[x.promo - 1] === p);
              if (m) commit(m);
            }}
          />
        )}
      </div>

      <ol className="flex w-full flex-wrap gap-1.5" aria-label="Moves">
        {chips.map((c, k) => (
          <li
            key={k}
            className="num rounded-[10px] px-2.5 py-1.5 text-[14px] font-semibold whitespace-nowrap"
            style={
              c.mine && (c.latest || c.t.endsWith("?"))
                ? { background: "var(--world)", color: "#0E0F1A" }
                : { background: "var(--surface)", color: "var(--text-muted)" }
            }
          >
            {c.t}
          </li>
        ))}
      </ol>
    </div>
  );
}
