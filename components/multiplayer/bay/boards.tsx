"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { useCellSize } from "@/components/game/useBoardSize";
import { BayStyles, BEVEL, SQUARE } from "@/games/_shared/BayStyles";
import { parseFen, toRows, inCheck, kingSquare } from "@/games/chess/engine";
import { CH_N, Piece, useSprites } from "@/games/chess/Piece";
import { Token, LUDO_LOOK } from "@/games/ludo/Board";
import { cellOf, TRACK, baseOfCell, homeColOfCell, SAFE } from "@/games/ludo/engine";
import { TOP_ROW, BOTTOM_ROW } from "@/games/oware/engine";
import { COLS as FU_COLS, ROWS as FU_ROWS } from "@/games/fourup/engine";
import { flipsFor } from "@/games/flip/engine";
import type { ChessMatch } from "@/games/chess/rules";
import type { DraughtsMatch } from "@/games/draughts/rules";
import type { OwareMatch } from "@/games/oware/rules";
import type { FourUpMatch } from "@/games/fourup/rules";
import type { FlipMatch } from "@/games/flip/rules";
import type { LudoMatch, LudoMove } from "@/games/ludo/rules";
import { useReduce } from "@/lib/client/multiplayer";

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
  onMove: (m: unknown) => void;
  announce: (t: string) => void;
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
    </>
  );
}

const FILES = "abcdefgh";
const sqName = (sq: number) => FILES[sq & 7] + String(8 - (sq >> 3));

function Grid8({ flipped, cell, render, label }: { flipped: boolean; cell: number; render: (sq: number) => ReactNode; label: string }) {
  const order = Array.from({ length: 64 }, (_, i) => (flipped ? 63 - i : i));
  return (
    <div
      role="grid"
      aria-label={label}
      className="grid overflow-hidden rounded-[14px] shadow-[0_8px_0_#6A3C5E,0_14px_24px_rgba(0,0,0,.45)]"
      style={{ gridTemplateColumns: `repeat(8, ${cell}px)`, gridTemplateRows: `repeat(8, ${cell}px)` }}
    >
      {order.map((sq) => render(sq))}
    </div>
  );
}

/* ---------------- Chess (B3) ---------------- */

function ChessLive({ state, seat, legal, disabled, lastMove, onMove, announce }: LiveBoardProps) {
  const s = state as ChessMatch;
  const cell = useCellSize(8, 0, 10, 48);
  const sprites = useSprites();
  const [sel, setSel] = useState<string | null>(null);
  const pos = useMemo(() => parseFen(s.fen), [s.fen]);
  const rows = toRows(pos.b);
  const moves = legal as string[];
  const targets = sel ? moves.filter((m) => m.startsWith(sel)).map((m) => m.slice(2, 4)) : [];
  const last = typeof lastMove === "string" ? [lastMove.slice(0, 2), lastMove.slice(2, 4)] : [];
  const checkSq = inCheck(pos) ? sqName(kingSquare(pos.b, pos.turn)) : null;
  const tap = (sq: number) => {
    if (disabled) return;
    const name = sqName(sq);
    if (sel && targets.includes(name)) {
      const options = moves.filter((m) => m.startsWith(sel + name));
      onMove(options.find((m) => m.endsWith("q")) ?? options[0]);
      setSel(null);
      return;
    }
    if (moves.some((m) => m.startsWith(name))) {
      setSel(name);
      const ch = rows[sq >> 3][sq & 7];
      announce(`${CH_N[ch.toUpperCase()]} ${name} picked up`);
    } else setSel(null);
  };
  return (
    <Grid8
      flipped={seat === 1}
      cell={cell}
      label="Chess board, live"
      render={(sq) => {
        const r = sq >> 3,
          c = sq & 7;
        const ch = rows[r][c];
        const name = sqName(sq);
        const light = (r + c) % 2 === 0;
        const isLast = last.includes(name);
        const target = targets.includes(name);
        const bg =
          sel === name
            ? "var(--w-board)"
            : checkSq === name
              ? "#FF5A5F"
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
            type="button"
            role="gridcell"
            aria-label={`${name}${ch !== "." ? `, ${ch === ch.toUpperCase() ? "white" : "black"} ${CH_N[ch.toUpperCase()]}` : ""}${target ? ", legal move" : ""}`}
            onClick={() => tap(sq)}
            className="relative flex items-center justify-center"
            style={{ background: bg, boxShadow: BEVEL }}
          >
            {ch !== "." && <Piece ch={ch} size={cell} sprites={sprites} lift={sel === name} />}
            {target && (
              <span
                className={
                  ch === "."
                    ? "bay-dot absolute z-[2] size-3 rounded-full bg-[rgba(14,15,26,.45)]"
                    : "absolute inset-[6%] z-[2] rounded-full shadow-[inset_0_0_0_3px_rgba(14,15,26,.55)]"
                }
              />
            )}
          </button>
        );
      }}
    />
  );
}

/* ---------------- Draughts ---------------- */

function DraughtsLive({ state, seat, legal, disabled, onMove }: LiveBoardProps) {
  const s = state as DraughtsMatch;
  const cell = useCellSize(8, 0, 10, 48);
  const [sel, setSel] = useState<number | null>(null);
  const paths = legal as number[][];
  const ends = sel === null ? [] : paths.filter((m) => m[0] === sel).map((m) => m[m.length - 1]);
  const tap = (sq: number) => {
    if (disabled) return;
    if (sel !== null && ends.includes(sq)) {
      onMove(paths.find((m) => m[0] === sel && m[m.length - 1] === sq));
      setSel(null);
    } else setSel(paths.some((m) => m[0] === sq) ? sq : null);
  };
  return (
    <Grid8
      flipped={seat === 1}
      cell={cell}
      label="Draughts board, live"
      render={(sq) => {
        const dark = ((sq >> 3) + (sq & 7)) % 2 === 1;
        const p = s.board[sq];
        const mine = p && (p >= 3 ? 1 : 0) === 0;
        const king = p === 2 || p === 4;
        const movable = paths.some((m) => m[0] === sq);
        return (
          <button
            key={sq}
            type="button"
            role="gridcell"
            onClick={() => tap(sq)}
            aria-label={`Square ${sq}${p ? `, ${mine ? "light" : "dark"} ${king ? "king" : "man"}` : ""}${ends.includes(sq) ? ", legal move" : ""}`}
            className="relative flex items-center justify-center"
            style={{
              background: dark ? SQUARE.draughtsDark : SQUARE.light,
              boxShadow: sel === sq ? "inset 0 0 0 3px var(--w-board)" : undefined,
            }}
          >
            {p ? (
              <span
                className="flex items-center justify-center rounded-full"
                style={{
                  width: cell * 0.76,
                  height: cell * 0.76,
                  background: mine
                    ? "radial-gradient(circle at 40% 35%,#FFFFFF,#DCDDEA 60%,#BFC1D4)"
                    : "radial-gradient(circle at 40% 35%,#3A3550,#16131F 65%,#0E0F1A)",
                  boxShadow: mine ? "inset 0 -4px 0 #A2A6C2, 0 4px 0 #7E8199" : "inset 0 -4px 0 #000, 0 0 0 2px #F27ADB, 0 4px 0 #6A3C5E",
                  color: mine ? "#0E0F1A" : "#F27ADB",
                  outline: movable && !disabled ? "2px solid var(--w-board)" : undefined,
                }}
              >
                {king ? <Icon name="crown-simple" size={18} /> : !mine ? <Icon name="circle" size={12} /> : null}
              </span>
            ) : null}
            {ends.includes(sq) && <span className="bay-dot absolute size-3 rounded-full bg-[rgba(244,245,251,.6)]" />}
          </button>
        );
      }}
    />
  );
}

/* ---------------- Oware (B5) ---------------- */

function OwareLive({ state, seat, legal, disabled, onMove }: LiveBoardProps) {
  const s = state as OwareMatch;
  const pits = legal as number[];
  const rows = seat === 1 ? [BOTTOM_ROW, TOP_ROW].map((r) => [...r].reverse()) : [TOP_ROW, BOTTOM_ROW];
  const me = seat ?? 0;
  return (
    <div className="flex flex-col items-center gap-3">
      <ScorePill label="Them" n={s.scores[1 - me]} />
      <div
        className="flex flex-col gap-2.5 rounded-[28px] bg-[#3A2232] p-3 shadow-[inset_0_-6px_0_rgba(0,0,0,.25)]"
        role="grid"
        aria-label="Oware board"
      >
        {rows.map((row, ri) => (
          <div key={ri} className="flex gap-2" role="row">
            {row.map((pit) => {
              const can = pits.includes(pit) && !disabled;
              return (
                <button
                  key={pit}
                  type="button"
                  role="gridcell"
                  disabled={!can}
                  onClick={() => onMove(pit)}
                  aria-label={`Pit ${pit + 1}, ${s.pits[pit]} seeds${can ? ", sow" : ""}`}
                  className="num flex size-[48px] flex-col items-center justify-center rounded-full text-[18px] font-semibold"
                  style={{
                    background: "#2A1630",
                    color: "#F7C4EE",
                    boxShadow: can ? "inset 0 0 0 3px var(--w-board)" : "inset 0 4px 0 rgba(0,0,0,.35)",
                  }}
                >
                  {s.pits[pit]}
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
  const cell = Math.min(46, Math.floor((Math.min(typeof window === "undefined" ? 390 : window.innerWidth, 420) - 56) / 7));
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
            return (
              <span
                key={r}
                role="gridcell"
                aria-label={v ? (v === 1 ? "star disc" : "ring disc") : "empty"}
                className="flex items-center justify-center rounded-full text-[#0E0F1A]"
                style={{
                  width: cell,
                  height: cell,
                  background: v === 1 ? "#F4F5FB" : v === 2 ? "#0E0F1A" : "#2A1630",
                  boxShadow: v === 2 ? "inset 0 0 0 3px #F27ADB" : "inset 0 3px 0 rgba(0,0,0,.3)",
                  color: v === 2 ? "#F27ADB" : "#0E0F1A",
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
      className="grid gap-[2px] rounded-[16px] bg-[#2A1630] p-1.5"
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
            className="flex items-center justify-center rounded-[7px] bg-[#3A2232]"
            style={{ width: cell, height: cell }}
          >
            {v ? (
              <span
                className="rounded-full"
                style={{
                  width: cell * 0.76,
                  height: cell * 0.76,
                  background: v === 1 ? "#F4F5FB" : "#0E0F1A",
                  boxShadow: v === 2 ? "inset 0 0 0 3px #F27ADB" : "inset 0 -3px 0 #A2A6C2",
                }}
              />
            ) : can ? (
              <span className="num flex size-[60%] items-center justify-center rounded-full text-[12px] font-bold text-[#F27ADB] shadow-[inset_0_0_0_2px_#F27ADB]">
                {flips}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Ludo (B6) ---------------- */

function LudoLive({ state, seat, legal, disabled, onMove }: LiveBoardProps) {
  const s = state as LudoMatch;
  const moves = legal as LudoMove[];
  const cell = Math.min(24, Math.floor((Math.min(typeof window === "undefined" ? 390 : window.innerWidth, 420) - 40) / 15));
  const canRoll = moves.some((m) => m.kind === "roll") && !disabled;
  const movable = new Set(moves.filter((m): m is { kind: "move"; piece: number } => m.kind === "move").map((m) => m.piece));
  const at = new Map<string, { colour: number; piece: number; seat: number }[]>();
  s.pieces.forEach((pcs, st) =>
    pcs.forEach((p, k) => {
      const [r, c] = cellOf(s.colours[st], k, p);
      const key = `${r},${c}`;
      at.set(key, [...(at.get(key) ?? []), { colour: s.colours[st], piece: k, seat: st }]);
    }),
  );
  const trackSet = new Set(TRACK.map(([r, c]) => `${r},${c}`));
  const lastRoll = s.log[s.log.length - 1];
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="grid rounded-[16px] bg-[#2A1630] p-1"
        style={{ gridTemplateColumns: `repeat(15, ${cell}px)` }}
        role="grid"
        aria-label="Ludo board"
      >
        {Array.from({ length: 225 }, (_, i) => {
          const r = Math.floor(i / 15),
            c = i % 15;
          const key = `${r},${c}`;
          const base = baseOfCell(r, c);
          const homeCol = homeColOfCell(r, c);
          const onTrack = trackSet.has(key);
          const here = at.get(key) ?? [];
          const tIdx = TRACK.findIndex(([a, b]) => a === r && b === c);
          const bg =
            base >= 0
              ? `color-mix(in srgb, ${LUDO_LOOK[base].c} 28%, #2A1630)`
              : homeCol >= 0
                ? LUDO_LOOK[homeCol].c
                : onTrack
                  ? SAFE.has(tIdx)
                    ? "#5A3A52"
                    : "#3A2232"
                  : r === 7 && c === 7
                    ? "var(--w-board)"
                    : "transparent";
          const mine = here.find((h) => h.seat === seat && movable.has(h.piece));
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              disabled={!mine || disabled}
              onClick={() => mine && onMove({ kind: "move", piece: mine.piece })}
              aria-label={
                here.length
                  ? here.map((h) => `${LUDO_LOOK[h.colour].shape} piece ${h.piece + 1}`).join(", ") + (mine ? ", can move" : "")
                  : undefined
              }
              aria-hidden={!here.length || undefined}
              className="relative flex items-center justify-center"
              style={{
                width: cell,
                height: cell,
                background: bg,
                outline: onTrack || homeCol >= 0 ? "1px solid rgba(0,0,0,.25)" : undefined,
              }}
            >
              {here.slice(0, 2).map((h, k) => (
                <span
                  key={k}
                  className="absolute"
                  style={{ transform: here.length > 1 ? `translate(${k ? 3 : -3}px, ${k ? 3 : -3}px)` : undefined }}
                >
                  <Token colour={h.colour} size={cell * 0.62} glow={h.seat === seat && movable.has(h.piece) && !disabled} />
                </span>
              ))}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <span
          className="bg-surface num flex size-14 items-center justify-center rounded-[16px] text-[28px] font-black"
          aria-label={s.roll !== null ? `Rolled ${s.roll}` : lastRoll ? `Last roll ${lastRoll.roll}` : "No roll yet"}
        >
          {s.roll ?? lastRoll?.roll ?? "?"}
        </span>
        <button
          type="button"
          disabled={!canRoll}
          onClick={() => onMove({ kind: "roll" })}
          className="toy font-display h-14 rounded-[18px] px-6 text-[17px] font-black disabled:opacity-50"
          style={{ background: "var(--w-board)", color: "#0E0F1A", ["--btn-depth" as string]: "#A3348F", boxShadow: "0 5px 0 #A3348F" }}
        >
          Roll
        </button>
      </div>
    </div>
  );
}
