"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { gridMove } from "@/lib/multiplayer/grid-nav";
import { Icon } from "@/components/ui/Icon";
import { boardGames } from "@/lib/copy/board-games";
import { fitRow, isWide, useCellSize, useViewportHeight, useViewportWidth, wideCell } from "@/components/game/useBoardSize";
import { BayStyles, BEVEL, SQUARE, draughtsDisc } from "@/games/_shared/BayStyles";
import { fromUci, make, parseFen, parseSq, toRows, inCheck, kingSquare } from "@/games/chess/engine";
import { CH_N, Piece, useSprites } from "@/games/chess/Piece";
import { PromotionPicker, type PromotionPiece } from "@/games/chess/Promotion";
import { ColourBadge, Die3D, LUDO_LOOK, LudoTable } from "@/games/ludo/look";
import { cellOf, trackIndexOfCell, SAFE, type LudoAlt } from "@/games/ludo/engine";
import { TOP_ROW, BOTTOM_ROW } from "@/games/oware/engine";
import { COLS as FU_COLS, ROWS as FU_ROWS } from "@/games/fourup/engine";
import { flipsFor } from "@/games/flip/engine";
import type { ChessMatch } from "@/games/chess/rules";
import type { DraughtsMatch } from "@/games/draughts/rules";
import type { OwareMatch } from "@/games/oware/rules";
import type { FourUpMatch } from "@/games/fourup/rules";
import type { FlipMatch } from "@/games/flip/rules";
import type { LudoMatch, LudoMove } from "@/games/ludo/rules";
import { DaraGrid } from "@/games/dara/DaraGrid";
import { inDropPhase, threeThrough, type DaraMatch, type DaraMove } from "@/games/dara/rules";
import { dara as td } from "@/lib/copy/dara";
import { useReduce } from "@/lib/client/multiplayer";
import { draughtsTapReason, owareTapReason } from "@/lib/multiplayer/board-explain";

/**
 * Live shared boards for Board Bay matches (Board Games B3 and B8). Each one shows the shared state,
 * offers only the moves the rules allow for your seat, and hands the chosen move to the parent,
 * which sends it to the server for validation. Boards for seat 1 are shown from their side.
 */
export interface LiveBoardProps {
  game: string;
  state: unknown;
  seat: number | null;
  legal: unknown[];
  disabled: boolean;
  lastMove: unknown;
  /**
   * Hands the chosen move to the parent. Board Bay sends it to the server and resolves false when the server refuses
   * it (the parent explains why), so a board that showed the move early puts it back.
   */
  onMove: (m: unknown) => void | Promise<boolean>;
  announce: (t: string) => void;
  /** chess: show file and rank labels on the edge squares (vs bot) */
  coords?: boolean;
  /** players' names by seat (Ludo says who rolled and whose turn it is) */
  names?: string[];
  /**
   * Says on screen why a tap did nothing (a compulsory capture, an empty pit), where the player can see it; the
   * board also announces it. Without it the reason is only announced.
   */
  explain?: (text: string) => void;
}

export function LiveBoard(p: LiveBoardProps) {
  return (
    <>
      <BayStyles />
      {p.game === "chess" && <ChessLive {...p} />}
      {p.game === "draughts" && <DraughtsLive {...p} />}
      {p.game === "oware" && <OwareLive {...p} />}
      {p.game === "fourup" && <FourUpLive {...p} />}
      {p.game === "flip" && <FlipLive {...p} />}
      {p.game === "ludo" && <LudoLive {...p} />}
      {p.game === "dara" && <DaraLive {...p} />}
    </>
  );
}

/** Four Up discs: the phone fit (up to 46 px), or the board column on a wide screen. 6 gaps of 4 and 16 px of frame. */
function useFourUpCell() {
  const vw = useViewportWidth();
  const vh = useViewportHeight();
  if (isWide(vw, vh)) return wideCell(vw, vh, FU_COLS, 6 * 4 + 16, 46, FU_ROWS, 5 * 4 + 16);
  return Math.min(46, Math.floor((Math.min(vw, 420) - 56) / 7));
}

/** Ludo cells: the phone fit (up to 24 px), or the board column on a wide screen (8 px of frame). */
function useLudoCell() {
  const vw = useViewportWidth();
  const vh = useViewportHeight();
  // The die and Roll button (96 px) sit under the board; the wooden frame takes 14 px.
  if (isWide(vw, vh)) return wideCell(vw, vh, 15, 14, 30, 15, 14 + 96);
  return Math.min(26, Math.floor((Math.min(vw, 420) - 46) / 15));
}

/**
 * Oware pits: the phone width shared by six (48 to 56 px), or up to 128 px on a wide screen (6 pits, 5 gaps
 * of 8, 24 px of frame; the two score pills above and below take 120 px of the height).
 */
function useOwarePit() {
  const vw = useViewportWidth();
  const vh = useViewportHeight();
  return isWide(vw, vh) ? wideCell(vw, vh, 6, 5 * 8 + 24, 64, 2, 10 + 24 + 120) : fitRow(Math.min(vw, 420) - 24, 6, 8, 24, 44, 56);
}

const FILES = "abcdefgh";
const sqName = (sq: number) => FILES[sq & 7] + String(8 - (sq >> 3));

/** What Grid8 hands each square: its place in the Tab order and its visual index (for roving focus). */
export interface CellProps {
  tabIndex: number;
  "data-vi": number;
}

/**
 * The 8 × 8 board. It does not clip (chess pieces rise into the square behind them, and the back rank above the
 * board), so the four corner squares carry the rounding themselves. `overlay` sits on top (the promotion picker).
 * Keyboard (WAI-ARIA grid): the board is one Tab stop; arrows, Home, End, PageUp and PageDown move between squares;
 * Enter or Space presses the focused square; Escape clears a selection (`onEscape` returns true when it did).
 */
function Grid8({
  flipped,
  cell,
  render,
  label,
  overlay,
  headroom = 0,
  onEscape,
}: {
  flipped: boolean;
  cell: number;
  render: (sq: number, cellProps: CellProps) => ReactNode;
  label: string;
  overlay?: ReactNode;
  /** space above the board for tall back-rank pieces, in px */
  headroom?: number;
  onEscape?: () => boolean;
}) {
  const [focus, setFocus] = useState(0);
  const toSq = (vi: number) => (flipped ? 63 - vi : vi);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      // Only when there was something to clear; otherwise Escape stays the screen's (leave the game).
      if (onEscape?.()) e.preventDefault();
      return;
    }
    const vi = Number((e.target as HTMLElement).dataset?.vi);
    if (!Number.isInteger(vi)) return;
    const next = gridMove(vi, e.key);
    if (next === null) return;
    e.preventDefault();
    setFocus(next);
    e.currentTarget.querySelector<HTMLElement>(`[data-vi="${next}"]`)?.focus();
  };
  return (
    <div
      role="grid"
      aria-label={label}
      aria-rowcount={8}
      aria-colcount={8}
      onKeyDown={onKeyDown}
      onFocus={(e) => {
        const vi = Number((e.target as HTMLElement).dataset?.vi);
        if (Number.isInteger(vi) && vi !== focus) setFocus(vi);
      }}
      className="relative grid rounded-[14px] shadow-[0_8px_0_var(--bay-depth),0_14px_24px_rgba(0,0,0,.45)] [&>:first-child>:first-child]:rounded-tl-[14px] [&>:first-child>:last-child]:rounded-tr-[14px] [&>:nth-child(8)>:first-child]:rounded-bl-[14px] [&>:nth-child(8)>:last-child]:rounded-br-[14px]"
      style={{ gridTemplateColumns: `repeat(8, ${cell}px)`, gridTemplateRows: `repeat(8, ${cell}px)`, marginTop: headroom }}
    >
      {Array.from({ length: 8 }, (_, vr) => (
        <div key={vr} role="row" className="contents">
          {Array.from({ length: 8 }, (_, vc) => {
            const vi = vr * 8 + vc;
            return render(toSq(vi), { tabIndex: vi === focus ? 0 : -1, "data-vi": vi });
          })}
        </div>
      ))}
      {overlay}
    </div>
  );
}

/* ---------------- Chess (B3) ---------------- */

/** Board coordinates: 12 px in the square ink (6:1 or better on every square colour), above the pieces. */
const COORD = "num pointer-events-none absolute z-[3] text-[12px] leading-[16px] font-bold text-[var(--square-ink)]";
/** A soft ring in the square's own colour keeps a coordinate readable where a dark piece stands behind it. */
const halo = (bg: string) => `0 0 2px ${bg}, 0 0 2px ${bg}`;
const tc = boardGames.chess;

function ChessLive({ state, seat, legal, disabled, lastMove, onMove, announce, coords }: LiveBoardProps) {
  const s = state as ChessMatch;
  const cell = useCellSize(8, 0, 10, 48);
  const sprites = useSprites();
  const [sel, setSel] = useState<string | null>(null);
  /** a pawn move to the last rank waiting for the player's choice of piece (uci from+to), for this position only */
  const [pending, setPromo] = useState<{ fen: string; move: string } | null>(null);
  const promo = pending?.fen === s.fen ? pending.move : null;
  const flipped = seat === 1;
  // A move on its way to the server shows on the board at once (for this position only): the piece stays where it
  // was put. If the server refuses it, the parent says why and the piece goes back.
  const [sent, setSent] = useState<{ fen: string; move: string } | null>(null);
  const sending = sent?.fen === s.fen ? sent.move : null;
  const pos = useMemo(() => {
    const p = parseFen(s.fen);
    const m = sending ? fromUci(p, sending) : null;
    return m ? make(p, m) : p;
  }, [s.fen, sending]);
  const rows = toRows(pos.b);
  const moves = legal as string[];
  const targets = sel ? moves.filter((m) => m.startsWith(sel)).map((m) => m.slice(2, 4)) : [];
  const shownLast = sending ?? lastMove;
  const last = typeof shownLast === "string" ? [shownLast.slice(0, 2), shownLast.slice(2, 4)] : [];
  const send = (m: string) => {
    setSent({ fen: s.fen, move: m });
    const r = onMove(m);
    if (r instanceof Promise) void r.then((ok) => !ok && setSent(null));
  };
  const checkSq = inCheck(pos) ? sqName(kingSquare(pos.b, pos.turn)) : null;
  const tap = (sq: number) => {
    if (disabled) return;
    const name = sqName(sq);
    if (promo) {
      // Tapping the board instead of a piece puts the pawn back.
      setPromo(null);
      setSel(null);
      announce(tc.promotionCancelled);
      return;
    }
    if (sel && targets.includes(name)) {
      const options = moves.filter((m) => m.startsWith(sel + name));
      if (options.length > 1) {
        setPromo({ fen: s.fen, move: sel + name });
        announce(tc.choosePromotion);
        return;
      }
      send(options[0]);
      setSel(null);
      return;
    }
    if (moves.some((m) => m.startsWith(name))) {
      setSel(name);
      const ch = rows[sq >> 3][sq & 7];
      announce(`${CH_N[ch.toUpperCase()]} ${name} picked up`);
    } else setSel(null);
  };
  const promote = (p: PromotionPiece) => {
    const m = promo && moves.find((x) => x === promo + p);
    if (!m) return;
    setPromo(null);
    setSel(null);
    announce(tc.promoted(CH_N[p.toUpperCase()]));
    send(m);
  };
  return (
    <div className="flex flex-col items-center gap-3">
      <Grid8
        flipped={flipped}
        cell={cell}
        headroom={Math.round(cell * 0.4)}
        overlay={
          promo && (
            <PromotionPicker
              cell={cell}
              column={flipped ? 7 - (parseSq(promo.slice(2, 4)) & 7) : parseSq(promo.slice(2, 4)) & 7}
              top={(flipped ? 7 - (parseSq(promo.slice(2, 4)) >> 3) : parseSq(promo.slice(2, 4)) >> 3) === 0}
              white={seat !== 1}
              sprites={sprites}
              label={tc.promoteGroup}
              onPick={promote}
              onCancel={() => {
                setPromo(null);
                setSel(null);
                announce(tc.promotionCancelled);
              }}
            />
          )
        }
        label="Chess board, live"
        onEscape={() => {
          if (!sel && !promo) return false;
          setPromo(null);
          setSel(null);
          announce(promo ? tc.promotionCancelled : tc.putDown);
          return true;
        }}
        render={(sq, cellProps) => {
          const r = sq >> 3,
            c = sq & 7;
          // where the square sits on screen (seat 1 sees the board turned round)
          const vr = flipped ? 7 - r : r,
            vc = flipped ? 7 - c : c;
          const ch = rows[r][c];
          const name = sqName(sq);
          const light = (r + c) % 2 === 0;
          const isLast = last.includes(name);
          const target = targets.includes(name);
          const bg =
            sel === name
              ? SQUARE.sel
              : checkSq === name
                ? "var(--bay-check)"
                : isLast
                  ? light
                    ? SQUARE.lastLight
                    : SQUARE.lastDark
                  : light
                    ? SQUARE.light
                    : SQUARE.dark;
          return (
            <button
              key={sq}
              {...cellProps}
              type="button"
              role="gridcell"
              aria-selected={sel === name}
              aria-label={`${name}${ch !== "." ? `, ${ch === ch.toUpperCase() ? "white" : "black"} ${CH_N[ch.toUpperCase()]}` : ""}${target ? ", legal move" : ""}${isLast ? `, ${tc.lastMove}` : ""}`}
              onClick={() => tap(sq)}
              className="relative flex items-center justify-center"
              style={{ background: bg, boxShadow: BEVEL }}
            >
              {ch !== "." && <Piece ch={ch} size={cell} sprites={sprites} lift={sel === name} />}
              {coords && vc === 0 && (
                <span aria-hidden className={`${COORD} top-0 left-1`} style={{ textShadow: halo(bg) }}>
                  {8 - r}
                </span>
              )}
              {coords && vr === 7 && (
                <span aria-hidden className={`${COORD} right-1 bottom-0`} style={{ textShadow: halo(bg) }}>
                  {FILES[c]}
                </span>
              )}
              {target && (
                <span
                  className={
                    ch === "."
                      ? "bay-dot absolute z-[2] size-3 rounded-full bg-[color-mix(in_srgb,var(--square-ink)_45%,transparent)]"
                      : "absolute inset-[6%] z-[2] rounded-full shadow-[inset_0_0_0_3px_color-mix(in_srgb,var(--square-ink)_55%,transparent)]"
                  }
                />
              )}
            </button>
          );
        }}
      />
    </div>
  );
}

/* ---------------- Draughts ---------------- */

const tdr = boardGames.draughts;

function DraughtsLive({ state, seat, legal, disabled, lastMove, onMove, announce, explain }: LiveBoardProps) {
  const s = state as DraughtsMatch;
  const cell = useCellSize(8, 0, 10, 48);
  const [sel, setSel] = useState<number | null>(null);
  const paths = legal as number[][];
  const ends = sel === null ? [] : paths.filter((m) => m[0] === sel).map((m) => m[m.length - 1]);
  // The last move's squares (start, each landing): tinted, and named for screen readers.
  const lastPath = Array.isArray(lastMove) ? (lastMove as number[]) : [];
  const tap = (sq: number) => {
    if (disabled) return;
    if (sel !== null && ends.includes(sq)) {
      onMove(paths.find((m) => m[0] === sel && m[m.length - 1] === sq));
      setSel(null);
      return;
    }
    // Your own man that can't move: say which rule (a compulsory capture elsewhere, or simply blocked).
    const why = draughtsTapReason(s.board, paths, sq, seat ?? 0);
    if (why) {
      const text = why === "capture" ? tdr.mustCapture : tdr.blocked;
      announce(text);
      explain?.(text);
    }
    setSel(paths.some((m) => m[0] === sq) ? sq : null);
  };
  return (
    <Grid8
      flipped={seat === 1}
      cell={cell}
      label="Draughts board, live"
      onEscape={() => {
        if (sel === null) return false;
        setSel(null);
        announce(tdr.putDown);
        return true;
      }}
      render={(sq, cellProps) => {
        const dark = ((sq >> 3) + (sq & 7)) % 2 === 1;
        const p = s.board[sq];
        const mine = p && (p >= 3 ? 1 : 0) === 0;
        const king = p === 2 || p === 4;
        const movable = paths.some((m) => m[0] === sq);
        return (
          <button
            key={sq}
            {...cellProps}
            type="button"
            role="gridcell"
            aria-selected={sel === sq}
            onClick={() => tap(sq)}
            aria-label={`${sqName(sq)}${p ? `, ${mine ? "light" : "dark"} ${king ? "king" : "man"}` : ""}${ends.includes(sq) ? ", legal move" : ""}${lastPath.includes(sq) ? `, ${tdr.lastMove}` : ""}`}
            className="relative flex items-center justify-center"
            style={{
              background: dark ? (lastPath.includes(sq) ? SQUARE.lastDark : SQUARE.draughtsDark) : SQUARE.light,
              boxShadow: sel === sq ? "inset 0 0 0 3px var(--accent)" : undefined,
            }}
          >
            {p ? (
              <span
                className="flex items-center justify-center rounded-full"
                style={{
                  width: cell * 0.76,
                  height: cell * 0.76,
                  ...draughtsDisc(!!mine, !!king),
                  outline: movable && !disabled ? "2px solid var(--accent)" : undefined,
                }}
              >
                {king ? <Icon name="crown-simple" size={Math.round(cell * 0.32)} /> : null}
              </span>
            ) : null}
            {ends.includes(sq) && (
              <span className="bay-dot absolute size-3 rounded-full bg-[color-mix(in_srgb,var(--bay-disc-light)_60%,transparent)]" />
            )}
          </button>
        );
      }}
    />
  );
}

/* ---------------- Oware (B5) ---------------- */

const tow = boardGames.oware;

function OwareLive({ state, seat, legal, disabled, lastMove, onMove, announce, explain }: LiveBoardProps) {
  const s = state as OwareMatch;
  const pits = legal as number[];
  const rows = seat === 1 ? [BOTTOM_ROW, TOP_ROW].map((r) => [...r].reverse()) : [TOP_ROW, BOTTOM_ROW];
  const me = seat ?? 0;
  const pitPx = useOwarePit();
  const lastPit = typeof lastMove === "number" ? lastMove : -1;
  const tap = (pit: number) => {
    if (disabled) return;
    if (pits.includes(pit)) return onMove(pit);
    // Your own pit, on your turn, that you can't sow: say which rule (it used to do nothing at all).
    const why = owareTapReason(s.pits, pits, pit, me);
    if (!why) return;
    const text = why === "empty" ? tow.empty : tow.feed;
    announce(text);
    explain?.(text);
  };
  return (
    <div className="flex flex-col items-center gap-3">
      <ScorePill label="Them" n={s.scores[1 - me]} />
      <div
        className="flex flex-col gap-2.5 rounded-[28px] bg-[var(--bay-wood)] p-3 shadow-[inset_0_-6px_0_rgba(0,0,0,.25)]"
        role="grid"
        aria-label="Oware board"
      >
        {rows.map((row, ri) => (
          <div key={ri} className="flex gap-2" role="row">
            {row.map((pit) => {
              const can = pits.includes(pit) && !disabled;
              // Your own pits stay tappable on your turn, so a pit you can't sow can say why.
              const asks = !disabled && pits.length > 0 && (me === 0 ? pit < 6 : pit >= 6);
              const last = pit === lastPit;
              return (
                <button
                  key={pit}
                  type="button"
                  role="gridcell"
                  disabled={!can && !asks}
                  aria-disabled={!can || undefined}
                  onClick={() => tap(pit)}
                  aria-label={`Pit ${pit + 1}, ${s.pits[pit]} seeds${can ? ", sow" : ""}${last ? `, ${tow.lastSown}` : ""}`}
                  className="num relative flex flex-col items-center justify-center rounded-full font-semibold"
                  style={{
                    width: pitPx,
                    height: pitPx,
                    fontSize: Math.round(pitPx * 0.375),
                    background: "var(--bay-well)",
                    color: "var(--bay-pit-ink)",
                    boxShadow: can ? "inset 0 0 0 3px var(--accent)" : "inset 0 4px 0 rgba(0,0,0,.35)",
                  }}
                >
                  {s.pits[pit]}
                  {/* The pit sown last: a small bar under the count (a shape, not colour alone). */}
                  {last && (
                    <span
                      aria-hidden
                      className="absolute bottom-[12%] h-1 w-[30%] rounded-full"
                      style={{ background: "var(--bay-pit-ink)", opacity: 0.7 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <ScorePill label="You" n={s.scores[me]} />
    </div>
  );
}

function ScorePill({ label, n }: { label: string; n: number }) {
  return (
    <div className="bg-surface flex items-center gap-2 rounded-[14px] px-3.5 py-1.5 text-[14px] font-semibold">
      {label} <span className="num text-[18px]">{n}</span>
    </div>
  );
}

/* ---------------- Four Up (B8) ---------------- */

function FourUpLive({ state, legal, disabled, onMove }: LiveBoardProps) {
  const s = state as FourUpMatch;
  const cols = legal as number[];
  const reduce = useReduce();
  const cell = useFourUpCell();
  // The disc dropped last keeps a ring after its pop, so the last move stays readable.
  const lastCol = s.moves[s.moves.length - 1];
  const lastRow = lastCol === undefined ? -1 : firstFilled(s, lastCol);
  return (
    <div
      className="grid gap-1 rounded-[18px] p-2 shadow-[inset_0_-6px_0_rgba(0,0,0,.2)]"
      style={{ gridTemplateColumns: `repeat(${FU_COLS}, ${cell}px)`, background: "var(--w-board)" }}
      role="grid"
      aria-label="Four Up board"
    >
      {Array.from({ length: FU_COLS }, (_, c) => (
        <button
          key={c}
          type="button"
          disabled={disabled || !cols.includes(c)}
          onClick={() => onMove(c)}
          aria-label={`Drop in column ${c + 1}`}
          className="flex flex-col gap-1"
          role="row"
        >
          {Array.from({ length: FU_ROWS }, (_, r) => {
            const v = s.grid[r * FU_COLS + c];
            const last = !!v && c === lastCol && r === lastRow;
            return (
              <span
                key={r}
                role="gridcell"
                aria-label={`${v ? (v === 1 ? "star disc" : "ring disc") : "empty"}${last ? `, ${boardGames.fourup.lastDisc}` : ""}`}
                className="flex items-center justify-center rounded-full text-[var(--square-ink)]"
                style={{
                  width: cell,
                  height: cell,
                  background: v === 1 ? "var(--bay-disc-light)" : v === 2 ? "var(--bay-disc-dark)" : "var(--bay-well)",
                  boxShadow: v === 2 ? "inset 0 0 0 3px var(--accent)" : "inset 0 3px 0 rgba(0,0,0,.3)",
                  color: v === 2 ? "var(--accent)" : "var(--square-ink)",
                  outline: last ? "2px solid var(--text)" : undefined,
                  outlineOffset: last ? 1 : undefined,
                  animation:
                    !reduce && v && s.moves[s.moves.length - 1] === c && r === firstFilled(s, c)
                      ? "bay-pop 180ms var(--ease-out)"
                      : undefined,
                }}
              >
                {v === 1 ? <Icon name="star" size={16} /> : v === 2 ? <Icon name="circle" size={14} /> : null}
              </span>
            );
          })}
        </button>
      ))}
    </div>
  );
}
const firstFilled = (s: FourUpMatch, c: number) => {
  for (let r = 0; r < FU_ROWS; r++) if (s.grid[r * FU_COLS + c]) return r;
  return -1;
};

/* ---------------- Flip (B8) ---------------- */

function FlipLive({ state, seat, legal, disabled, onMove }: LiveBoardProps) {
  const s = state as FlipMatch;
  const squares = legal as number[];
  const cell = useCellSize(8, 2, 12, 40);
  return (
    <div
      className="grid gap-[2px] rounded-[16px] bg-[var(--bay-well)] p-1.5"
      style={{ gridTemplateColumns: `repeat(8, ${cell}px)` }}
      role="grid"
      aria-label="Flip board"
    >
      {s.grid.map((v, sq) => {
        const can = squares.includes(sq) && !disabled;
        const flips = can ? flipsFor(s.grid, sq, (seat ?? 0) + 1).length : 0;
        return (
          <button
            key={sq}
            type="button"
            role="gridcell"
            disabled={!can}
            onClick={() => onMove(sq)}
            aria-label={`${sqName(sq)}${v ? (v === 1 ? ", light" : ", dark") : can ? `, flips ${flips}` : ""}`}
            className="flex items-center justify-center rounded-[7px] bg-[var(--bay-wood)]"
            style={{ width: cell, height: cell }}
          >
            {v ? (
              <span
                className="rounded-full"
                style={{
                  width: cell * 0.76,
                  height: cell * 0.76,
                  background: v === 1 ? "var(--bay-disc-light)" : "var(--bay-disc-dark)",
                  boxShadow: v === 2 ? "inset 0 0 0 3px var(--accent)" : "inset 0 -3px 0 var(--bay-disc-light-rim)",
                }}
              />
            ) : can ? (
              <span className="num flex size-[60%] items-center justify-center rounded-full text-[12px] font-bold text-[var(--accent)] shadow-[inset_0_0_0_2px_var(--accent)]">
                {flips}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Dara (lab) ---------------- */

/**
 * Dara vs bot: drop phase, tap an empty cell (cells that would line up three are not offered); move phase, tap
 * one of your stones and then a cell next to it. A step that makes three asks you to tap a stone to take.
 */
function DaraLive({ state, seat, legal, disabled, lastMove, onMove, announce }: LiveBoardProps) {
  const s = state as DaraMatch;
  const moves = legal as DaraMove[];
  const me = seat ?? 0;
  const [sel, setSel] = useState<number | null>(null);
  /** a step that makes three, waiting for the stone to take (for this position only) */
  const [pend, setPend] = useState<{ board: string; from: number; to: number } | null>(null);
  const key = s.board.join("");
  const pending = pend?.board === key ? pend : null;
  const drop = inDropPhase(s);
  const live = !disabled;
  const steps = moves.filter((m): m is Extract<DaraMove, { kind: "move" }> => m.kind === "move");
  const drops = live ? moves.flatMap((m) => (m.kind === "drop" ? [m.to] : [])) : [];
  const selected = sel !== null && steps.some((m) => m.from === sel) ? sel : null;
  const targets = live && selected !== null && !pending ? [...new Set(steps.filter((m) => m.from === selected).map((m) => m.to))] : [];
  const takeable = pending ? steps.filter((m) => m.from === pending.from && m.to === pending.to).map((m) => m.take!) : [];
  const board = pending ? s.board.map((v, i) => (i === pending.to ? me + 1 : i === pending.from ? 0 : v)) : s.board;
  const last = lastMove as DaraMove | null;
  const lastCells = last ? (last.kind === "drop" ? [last.to] : [last.from, last.to]) : [];
  const tap = (i: number) => {
    if (!live) return;
    if (pending) {
      const m = steps.find((x) => x.from === pending.from && x.to === pending.to && x.take === i);
      setPend(null);
      setSel(null);
      if (m) onMove(m);
      else announce(td.cancelTake);
      return;
    }
    if (drop) {
      if (drops.includes(i)) onMove({ kind: "drop", to: i });
      else if (!s.board[i]) announce(td.dropRule);
      return;
    }
    if (selected !== null && targets.includes(i)) {
      const opts = steps.filter((m) => m.from === selected && m.to === i);
      if (opts.length === 1 && opts[0].take === undefined) {
        setSel(null);
        onMove(opts[0]);
      } else {
        setPend({ board: key, from: selected, to: i });
        announce(td.pending);
      }
      return;
    }
    setSel(steps.some((m) => m.from === i) ? i : null);
  };
  const line = pending ? threeThrough(board, pending.to, me + 1) : [];
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <p className="text-muted text-[13px]" aria-live="polite">
        {pending ? td.pending : drop ? td.dropPhase(s.hand[me], s.hand[1 - me]) : td.movePhase}
      </p>
      <DaraGrid
        board={board}
        mine={me + 1}
        selected={pending ? pending.to : selected}
        targets={drop ? drops : targets}
        targetLabel={drop ? td.dropHere : td.stepHere}
        takeable={takeable}
        movable={live && !drop && !pending ? [...new Set(steps.map((m) => m.from))] : []}
        last={lastCells}
        line={line}
        disabled={!live}
        onTap={tap}
      />
    </div>
  );
}

/* ---------------- Ludo (B6) ---------------- */

/** Chooser buttons for a piece with more than one way to move (house-rule kicks). */
const ALT_LABEL: Record<LudoAlt, (roll: number) => string> = {
  back: (r) => `Back-kick ${r}`,
  home: () => "Home-kick",
  side: (r) => `Move ${r} + side-kick`,
  backside: (r) => `Back ${r} + side-kick`,
};

function LudoLive({ state, seat, legal, disabled, onMove, names }: LiveBoardProps) {
  const s = state as LudoMatch;
  const moves = legal as LudoMove[];
  const cell = useLudoCell();
  const canRoll = moves.some((m) => m.kind === "roll") && !disabled;
  const stepMoves = moves.filter((m): m is { kind: "move"; piece: number; alt?: LudoAlt } => m.kind === "move");
  const movable = new Set(stepMoves.map((m) => m.piece));
  const lastRoll = s.log[s.log.length - 1];
  const nameOf = (st: number) => (st === seat ? "You" : (names?.[st] ?? LUDO_LOOK[s.colours[st]].name));
  // Waiting for the server's roll after a tap: the die keeps tumbling until the new roll is in the log.
  const [rollingAt, setRollingAt] = useState<number | null>(null);
  const rolling = rollingAt !== null && rollingAt === s.log.length;
  // A piece with more than one way to move on this roll (a house-rule kick): ask which.
  const [choosing, setChoosing] = useState<number | null>(null);
  const roll = () => {
    if (!canRoll || rolling) return;
    setRollingAt(s.log.length);
    onMove({ kind: "roll" });
    // a roll that never comes back (offline, refused) stops the tumble and gives the button back
    setTimeout(() => setRollingAt(null), 5000);
  };
  useShakeToRoll(canRoll && !rolling, roll);
  const at = new Map<number, { colour: number; piece: number; seat: number }[]>();
  const pieces = s.pieces.flatMap((pcs, st) =>
    pcs.map((p, k) => {
      const [r, c] = cellOf(s.colours[st], k, p);
      const i = r * 15 + c;
      at.set(i, [...(at.get(i) ?? []), { colour: s.colours[st], piece: k, seat: st }]);
      return {
        key: `${st}-${k}`,
        r,
        c,
        colour: s.colours[st],
        glow: st === seat && movable.has(k) && !disabled,
        lifted: choosing === k && st === seat,
      };
    }),
  );
  const mineAt = (i: number) => (at.get(i) ?? []).find((h) => h.seat === seat && movable.has(h.piece));
  const pick = (piece: number) => {
    const options = stepMoves.filter((m) => m.piece === piece);
    if (options.length > 1) return setChoosing(piece);
    setChoosing(null);
    if (options[0]) onMove(options[0]);
  };
  const shown = s.roll ?? lastRoll?.roll ?? null;
  const whoRolled = lastRoll ? nameOf(lastRoll.seat) : null;
  const mine = seat !== null ? LUDO_LOOK[s.colours[seat]] : null;
  const house = [s.opts?.backKick && "Back-kick", s.opts?.sideKick && "Side-kick", s.opts?.homeKick && "Home-kick"]
    .filter(Boolean)
    .join(" · ");
  const turnName = nameOf(s.turn);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {mine && seat !== null && (
          <span
            className="flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-[14px] font-bold"
            style={{ background: `color-mix(in srgb, ${mine.c} 22%, var(--surface))`, boxShadow: `inset 0 0 0 2px ${mine.c}` }}
          >
            <ColourBadge colour={s.colours[seat]} size={22} />
            You are {mine.name[0].toUpperCase() + mine.name.slice(1)}
          </span>
        )}
        <span className="text-muted text-[14px] font-semibold" aria-live="polite">
          {s.turn === seat ? "Your turn" : `${turnName}'s turn`}
        </span>
        {house && <span className="text-muted text-[13px]">{house}</span>}
      </div>
      <div className="relative">
        <LudoTable
          cell={cell}
          bottom={seat !== null ? s.colours[seat] : undefined}
          label={`Ludo board${mine ? `. You are ${mine.name}` : ""}. Glowing pawns can move.`}
          pieces={pieces}
          interactive={(i) => !disabled && !!mineAt(i)}
          onCell={(i) => {
            const m = mineAt(i);
            if (m && !disabled) pick(m.piece);
          }}
          cellLabel={(i) => {
            const here = at.get(i) ?? [];
            const ti = trackIndexOfCell(Math.floor(i / 15), i % 15);
            if (here.length)
              return (
                here.map((h) => `${nameOf(h.seat)}: ${LUDO_LOOK[h.colour].name} piece ${h.piece + 1}`).join(", ") +
                (mineAt(i) && !disabled ? ", can move" : "")
              );
            return ti >= 0 && SAFE.has(ti) && ti % 13 !== 0 ? "safe star square" : undefined;
          }}
        />
        {/* The die sits in the middle of the board, over the finish, where every player looks */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto">
            <Die3D
              value={shown}
              rollKey={s.log.length}
              rolling={rolling}
              size={Math.round(cell * 1.9)}
              onRoll={roll}
              disabled={!canRoll || rolling}
              label={canRoll ? "Roll the die" : shown !== null ? `${whoRolled} rolled ${shown}` : "No roll yet"}
            />
          </div>
        </div>
      </div>
      {choosing !== null && (
        <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label={`Move piece ${choosing + 1}`}>
          {stepMoves
            .filter((m) => m.piece === choosing)
            .map((m) => (
              <button
                key={m.alt ?? "go"}
                type="button"
                onClick={() => {
                  setChoosing(null);
                  onMove(m);
                }}
                className="press bg-surface-raised h-11 rounded-[14px] px-4 text-[15px] font-semibold"
              >
                {m.alt ? ALT_LABEL[m.alt](s.roll ?? 0) : `Move ${s.roll}`}
              </button>
            ))}
          <button type="button" onClick={() => setChoosing(null)} className="press text-muted h-11 px-3 text-[15px] font-semibold">
            Cancel
          </button>
        </div>
      )}
      <div className="flex items-center gap-3">
        <span className="text-muted text-[14px] font-semibold" aria-live="polite">
          {rolling
            ? "Rolling…"
            : canRoll
              ? "Tap the die, or shake your phone"
              : shown !== null && whoRolled
                ? `${whoRolled} rolled ${shown}`
                : "Waiting"}
        </span>
        <button
          type="button"
          disabled={!canRoll || rolling}
          onClick={roll}
          className="toy font-display h-12 rounded-[16px] px-6 text-[17px] font-black disabled:opacity-50"
          style={{
            background: "var(--accent)",
            color: "var(--square-ink)",
            ["--btn-depth" as string]: "var(--w-board-ink)",
            boxShadow: "0 5px 0 var(--w-board-ink)",
          }}
        >
          Roll
        </button>
      </div>
    </div>
  );
}

/**
 * Shake the phone to roll (while a roll is due). A sharp change in acceleration rolls once; iOS asks for motion
 * access the first time (from a tap, which the Roll button and the die both are).
 */
function useShakeToRoll(active: boolean, onShake: () => void) {
  const cb = useRef(onShake);
  useEffect(() => {
    cb.current = onShake;
  }, [onShake]);
  useEffect(() => {
    if (!active || typeof window === "undefined" || !("DeviceMotionEvent" in window)) return;
    let last: { x: number; y: number; z: number } | null = null;
    let cool = 0;
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x === null || a.y === null || a.z === null) return;
      const now = { x: a.x, y: a.y, z: a.z };
      if (last) {
        const jolt = Math.abs(now.x - last.x) + Math.abs(now.y - last.y) + Math.abs(now.z - last.z);
        if (jolt > 28 && performance.now() > cool) {
          cool = performance.now() + 1500;
          cb.current();
        }
      }
      last = now;
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [active]);
  // iOS 13+: motion needs permission, asked once from a tap anywhere while a roll is due
  useEffect(() => {
    const D =
      typeof window !== "undefined"
        ? (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent
        : undefined;
    if (!active || !D?.requestPermission) return;
    const ask = () => void D.requestPermission!().catch(() => undefined);
    window.addEventListener("pointerdown", ask, { once: true });
    return () => window.removeEventListener("pointerdown", ask);
  }, [active]);
}
