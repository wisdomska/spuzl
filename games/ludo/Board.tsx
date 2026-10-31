"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { BoardProps } from "@/games/types";
import { useGridKeys } from "@/components/game/useGridKeys";
import { Icon } from "@/components/ui/Icon";
import { play } from "@/lib/audio";
import { BayStyles } from "@/games/_shared/BayStyles";
import { HOME, SAFE, applyStep, baseOfCell, cellOf, homeColOfCell, legalSteps, startOf, trackIndexOfCell } from "./engine";
import { explain, ranked, type LudoPuzzle, type LudoState } from "./logic";

/** Design B6 player look: every colour carries a shape (circle, square, diamond, drop). */
export const LUDO_LOOK = [
  { c: "var(--w-line)", radius: "50%", rot: "none", shape: "circle" },
  { c: "var(--w-shape)", radius: "3px", rot: "none", shape: "square" },
  { c: "var(--w-number)", radius: "3px", rot: "rotate(45deg)", shape: "diamond" },
  { c: "#B8F23A", radius: "50% 50% 50% 0", rot: "rotate(-45deg)", shape: "drop" },
] as const;
const N = 15;
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function useLudoCell() {
  const [cell, setCell] = useState(22);
  useEffect(() => {
    const on = () => setCell(Math.max(20, Math.min(30, Math.floor((Math.min(window.innerWidth, 420) - 36 - 22) / N))));
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return cell;
}

export function Token({ colour, size, ring, glow }: { colour: number; size: number; ring?: string; glow?: boolean }) {
  const l = LUDO_LOOK[colour];
  const s: CSSProperties = {
    width: size,
    height: size,
    borderRadius: l.radius,
    background: l.c,
    transform: l.rot,
    boxShadow: glow ? "0 0 0 2px #0E0F1A, 0 0 0 4px var(--world)" : (ring ?? "0 0 0 2px #0E0F1A"),
  };
  return <span aria-hidden className="block flex-none" style={s} />;
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
  const cell = useLudoCell();
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
      play("tick");
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
    play(st.captures.length ? "capture" : "clack");
    timers.current.push(
      setTimeout(() => {
        if (pick === best.step.piece) {
          setDone(true);
          setBusy(false);
          play("jingle");
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
  const startCells = new Map(t.colours.map((col) => [startOf(col), col]));
  for (let k = 0; k < 4; k++) if (!startCells.has(startOf(k))) startCells.set(startOf(k), k);

  return (
    <div className="flex w-full flex-col gap-2.5" data-board="ludo">
      <BayStyles />
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
              <Token colour={col} size={14} ring="none" />
              <span className="text-[13px] font-semibold">{puzzle.names[seat]}</span>
            </div>
            <span className="num text-muted text-[11px] font-semibold">{homeCount(seat)} home</span>
          </div>
        ))}
      </div>

      <div className="flex justify-center">
        <div
          role="grid"
          aria-label={`Ludo board. You are ${LUDO_LOOK[t.colours[0]].shape}s. Glowing pieces can move.`}
          aria-rowcount={N}
          aria-colcount={N}
          onKeyDown={keys.onKeyDown}
          className="grid rounded-[16px] p-1"
          style={{
            gridTemplateColumns: `repeat(${N}, ${cell}px)`,
            gridTemplateRows: `repeat(${N}, ${cell}px)`,
            gap: 1,
            background: "var(--line)",
          }}
        >
          {Array.from({ length: N }, (_, r) => (
            <div role="row" key={r} className="contents">
              {Array.from({ length: N }, (_, c) => {
                const i = r * N + c;
                const base = baseOfCell(r, c);
                const hc = homeColOfCell(r, c);
                const ti = trackIndexOfCell(r, c);
                let bg = "#F4F5FB",
                  radius = "2px";
                if (base >= 0) {
                  const inner = r % 9 >= 1 && r % 9 <= 4 && c % 9 >= 1 && c % 9 <= 4;
                  bg = inner ? "var(--surface)" : LUDO_LOOK[base].c;
                  radius = "0";
                } else if (r >= 6 && r <= 8 && c >= 6 && c <= 8) {
                  bg =
                    r === 7 && c === 7
                      ? "var(--world)"
                      : r < 7 && c === 7
                        ? LUDO_LOOK[1].c
                        : r > 7 && c === 7
                          ? LUDO_LOOK[3].c
                          : c < 7
                            ? LUDO_LOOK[0].c
                            : c > 7
                              ? LUDO_LOOK[2].c
                              : "#F4F5FB";
                  radius = "0";
                } else if (hc >= 0) bg = LUDO_LOOK[hc].c;
                const startCol = ti >= 0 ? startCells.get(ti) : undefined;
                if (startCol !== undefined && ti % 13 === 0) bg = LUDO_LOOK[startCol].c;
                const star = ti >= 0 && SAFE.has(ti) && ti % 13 !== 0;
                const here = at.get(i) ?? [];
                const isDest = !!dest && dest[0] === r && dest[1] === c;
                const label = here.length
                  ? here
                      .map(
                        (x) =>
                          `${x.seat === 0 ? "your" : `${puzzle.names[x.seat]}'s`} piece ${x.piece + 1}${x.seat === 0 && movable.has(x.piece) ? ", can move" : ""}`,
                      )
                      .join(", ")
                  : star
                    ? "safe star square"
                    : ti >= 0
                      ? "track"
                      : "";
                return (
                  <div
                    key={i}
                    role="gridcell"
                    data-i={i}
                    tabIndex={keys.focus === i ? 0 : -1}
                    aria-label={`Row ${r + 1}, column ${c + 1}${label ? `, ${label}` : ""}`}
                    onClick={() => {
                      keys.setFocus(i);
                      const mine = here.find((x) => x.seat === 0);
                      if (mine) choose(mine.piece);
                    }}
                    className="relative flex items-center justify-center outline-none"
                    style={{ background: bg, borderRadius: radius, boxShadow: isDest ? "inset 0 0 0 2px var(--world)" : undefined }}
                  >
                    {star && <Icon name="star" size={Math.round(cell * 0.5)} style={{ color: "#5A5E78" }} />}
                    {here.map((x, k) => {
                      const mine = x.seat === 0;
                      const glow = mine && movable.has(x.piece);
                      const picked = mine && pick === x.piece && !done;
                      return (
                        <span
                          key={`${x.seat}-${x.piece}`}
                          className={`absolute flex items-center justify-center ${mine && moved === x.piece ? "bay-pop" : ""} ${mine && hintPiece === x.piece ? "hint-ring" : ""}`}
                          style={{
                            transform: `translate(${k * 3}px, ${-k * 3}px)${picked ? " translateY(-3px)" : ""}`,
                            zIndex: 1 + k,
                            cursor: glow ? "pointer" : undefined,
                          }}
                        >
                          <Token colour={shown.colours[x.seat]} size={Math.round(cell * 0.74)} glow={glow || picked} />
                          {/* a 44 px hit area around small tokens */}
                          {glow && <span aria-hidden className="absolute size-11 rounded-full" />}
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div
          key={puzzle.roll}
          className="grid size-[72px] flex-none grid-cols-3 grid-rows-3 gap-1 rounded-[20px] p-3"
          style={{
            background: "#F4F5FB",
            boxShadow: "0 0 0 1px var(--line), 0 6px 0 #A2A6C2",
            animation: "bay-punch 420ms var(--ease-out)",
          }}
          role="img"
          aria-label={`Die showing ${puzzle.roll}`}
        >
          {Array.from({ length: 9 }, (_, k) => (
            <span key={k} className="rounded-full" style={{ background: PIPS[puzzle.roll].includes(k) ? "#0E0F1A" : "transparent" }} />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-display text-[18px] font-extrabold">You rolled a {puzzle.roll}</span>
          <span className="text-muted text-[15px] leading-[1.4]">
            {puzzle.roll === 6 ? "Bring a piece out or move 6." : `Move one piece ${puzzle.roll}.`} Glowing pieces can move.
          </span>
        </div>
      </div>
    </div>
  );
}
