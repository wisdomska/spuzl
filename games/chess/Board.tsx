"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { useCellSize } from "@/components/game/useBoardSize";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { BayStyles, BEVEL, SQUARE } from "@/games/_shared/BayStyles";
import { BLACK, WHITE, colorOf, fromUci, inCheck, isCapture, isCheckmate, kingSquare, legalMoves, make, parseFen, sqName, toRows, typeOf, uci, type Move, type Position } from "./engine";
import { COPY, replay, type ChessPuzzle, type ChessState } from "./logic";
import { CH_N, Piece, useSprites } from "./Piece";

const PROMOS = ["q", "r", "b", "n"] as const;
const LETTER = " PNBRQK";

/**
 * Chess Daily board (Board Games B2 + prototype chess screen). Tap a white piece to lift it
 * (translateY(-8px) scale(1.1)), dots mark legal squares and rings mark captures; tap a dot to move.
 * A move that keeps the forced mate is answered by black's longest defence; any other move shows
 * "Not mate. The king slips out." and slides back. Mate turns the king's square red with a shake.
 */
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
  const streak = useRef(0);
  const sprites = useSprites();
  const cell = useCellSize(8, 0, 0, 48);
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
      play(isCapture(before, m) ? "capture" : "clack");
      setShown(after);
      setLast([m.from, m.to]);
      setSel(null);
      setPromo(null);
      setBusy(true);
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
            setShown(r.pos);
            setLast(null);
            setBusy(false);
          }, 900);
          return;
        }
        streak.current++;
        setMoves(next);
        const state = { moves: next };
        if (res.mated) {
          setShown(res.pos);
          setBusy(false);
          later(() => play("check"), 150);
          later(() => play("jingle"), 650);
          const line = res.plies.map((p) => p.san).join(" ");
          api.feedback(`${COPY.mate} ${line}`, "success", "check-circle");
          api.announce(`${COPY.mate} ${line}`);
          api.onMove(state, { correctStreak: streak.current });
          api.onSolved(state);
          return;
        }
        api.onMove(state, { correctStreak: streak.current });
        if (inCheck(after)) setCheckN((n) => n + 1);
        // Black's longest defence answers after a beat.
        later(() => {
          const reply = res.plies[res.plies.length - 1];
          const rm = fromUci(after, reply.uci)!;
          play(isCapture(after, rm) ? "capture" : "clack");
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
          setSel(null);
          return;
        }
        play("tick");
        setSel(sq);
        setPromo(null);
        const n = legalMoves(shown, sq).length;
        const name = CH_N[LETTER[typeOf(pc)]];
        api.feedback(`${name[0].toUpperCase()}${name.slice(1)} selected. Dots are legal squares; rings are captures.`, "info", "hand-pointing");
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

  const undo = useCallback(() => {
    if (!moves.length || busy || done) return;
    const next = moves.slice(0, -1);
    const res = replay(puzzle, next);
    setMoves(next);
    setShown(res.pos);
    setLast(null);
    setSel(null);
    api.onMove({ moves: next });
    api.feedback(COPY.pick, "info", "hand-pointing");
  }, [api, busy, done, moves, puzzle]);

  useEffect(() => {
    api.setControls([
      { id: "undo", label: "Undo", icon: "arrow-counter-clockwise", onPress: undo, disabled: !moves.length || done || busy },
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
    <div className="flex w-full flex-col items-center gap-3.5" data-board="chess">
      <BayStyles />
      <div className="flex w-full items-center gap-2.5 px-0.5 text-[16px] font-semibold">
        <span aria-hidden className="size-3.5 flex-none rounded-[4px]" style={{ background: startTurn === WHITE ? "#F4F5FB" : "#0E0F1A", boxShadow: "0 0 0 2px var(--line)" }} />
        {startTurn === WHITE ? "White" : "Black"} to move. Mate in {puzzle.mateIn}.
      </div>
      <div
        role="grid"
        aria-label={`Chess board, ${flipped ? "black" : "white"} at the bottom`}
        aria-rowcount={8}
        aria-colcount={8}
        onKeyDown={keys.onKeyDown}
        className="grid rounded-[14px]"
        style={{ gridTemplateColumns: `repeat(8, ${cell}px)`, gridTemplateRows: `repeat(8, ${cell}px)`, boxShadow: "0 8px 0 var(--world-depth), 0 14px 24px rgba(0,0,0,.45)" }}
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
              const bg = mated ? "var(--danger)" : isSel ? "var(--world)" : isLast ? (light ? SQUARE.lastLight : SQUARE.lastDark) : light ? SQUARE.light : SQUARE.dark;
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
                  style={{ width: cell, height: cell, background: bg, boxShadow: BEVEL, borderRadius: corner, zIndex: vr + 1 }}
                >
                  {sq === checkK && <span key={checkN} aria-hidden className="bay-flash absolute inset-0" style={{ background: "var(--danger)", borderRadius: corner }} />}
                  {vc === 0 && (
                    <span aria-hidden className="num absolute top-0.5 left-1 text-[10px] font-semibold" style={{ color: light ? SQUARE.dark : SQUARE.light }}>
                      {8 - (sq >> 3)}
                    </span>
                  )}
                  {vr === 7 && (
                    <span aria-hidden className="num absolute right-1 bottom-0 text-[10px] font-semibold" style={{ color: light ? SQUARE.dark : SQUARE.light }}>
                      {"abcdefgh"[sq & 7]}
                    </span>
                  )}
                  {occ && <Piece ch={ch} size={cell} sprites={sprites} lift={isSel} className={anim} />}
                  {isTarget && (
                    <span
                      aria-hidden
                      className={`absolute rounded-full ${occ ? "" : "bay-dot"}`}
                      style={{ zIndex: 2, width: occ ? cell - 6 : 12, height: occ ? cell - 6 : 12, background: occ ? "transparent" : "rgba(14,15,26,.45)", boxShadow: occ ? "inset 0 0 0 3px rgba(14,15,26,.55)" : "none" }}
                    />
                  )}
                  {sq === hintSq && !done && <span aria-hidden className="hint-ring absolute inset-0" style={{ zIndex: 2, boxShadow: "inset 0 0 0 4px var(--gold)", borderRadius: corner }} />}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {promo ? (
        <div className="flex gap-2" role="group" aria-label="Promotion">
          {PROMOS.map((p) => (
            <button
              key={p}
              type="button"
              aria-label={`Promote to ${CH_N[p.toUpperCase()]}`}
              onClick={() => {
                const m = legal.find((x) => x.from === promo.from && x.to === promo.to && " nbrq"[x.promo - 1] === p);
                if (m) commit(m);
              }}
              className="toy relative flex size-14 items-end justify-center overflow-visible rounded-[16px]"
              style={{ background: SQUARE.light, boxShadow: "0 5px 0 var(--world-depth)" }}
            >
              <span className="relative block size-11">
                <Piece ch={p.toUpperCase()} size={44} sprites={sprites} />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <ol className="flex w-full flex-wrap gap-1.5" aria-label="Moves">
          {chips.map((c, k) => (
            <li
              key={k}
              className="num rounded-[10px] px-2.5 py-1.5 text-[14px] font-semibold whitespace-nowrap"
              style={c.mine && (c.latest || c.t.endsWith("?")) ? { background: "var(--world)", color: "#0E0F1A" } : { background: "var(--surface)", color: "var(--text-muted)" }}
            >
              {c.t}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

