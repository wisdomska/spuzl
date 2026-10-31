"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useCellSize } from "@/components/game/useBoardSize";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { sendGuess } from "@/games/_shared/guess";
import { flyLetters, FLY_STAGGER_MS } from "@/games/_shared/fly";
import { fromView, toView, viewDims } from "@/games/_shared/rotate";
import { adjacent, MIN_LEN, REASON_COPY, spell, type CoilCheck, type CoilPuzzle, type CoilState } from "./rules";

const GAP = 4;
const PAD = 6;
const INK = "#0E0F1A";

/**
 * Coil board (Game Boards: Coil). Round letter cells on the dark board; drag through neighbours in any
 * of 8 directions (or tap cell by cell, tap the last letter again to submit). The traced path is a white
 * line with white letter badges; found words turn world green with a deep green line, then their letters
 * lift and fly to the word list (420 ms, 40 ms per letter, ascending chime).
 * Rotate turns the view a quarter turn to help spot words; game state stays in the puzzle's own cell
 * indices. Real words off the theme land in a Bonus words list (the server checks them in the dictionary).
 */
export default function CoilBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<CoilPuzzle, CoilState>) {
  const { rows, cols, letters } = puzzle;
  const n = rows * cols;
  /** quarter turns clockwise pressed so far (view only, never saved) */
  const [turns, setTurns] = useState(0);
  const [vRows, vCols] = viewDims(rows, cols, turns);
  const reduce = useReducedMotion();
  const cell = useCellSize(vCols, GAP, PAD, 60);
  const badge = Math.round(cell * 0.52);
  const [found, setFound] = useState<number[][]>(() => initialState?.found?.map((p) => p.slice()) ?? []);
  const [bonus, setBonus] = useState<number[][]>(() => initialState?.bonus?.map((p) => p.slice()) ?? []);
  const [path, setPath] = useState<number[]>([]);
  const [bad, setBad] = useState<number[]>([]);
  const [shakeN, setShakeN] = useState(0);
  const [busy, setBusy] = useState(false);
  const [landed, setLanded] = useState(() => initialState?.found?.length ?? 0);
  const [done, setDone] = useState(false);
  const foundRef = useRef(found);
  const bonusRef = useRef(bonus);
  const pathRef = useRef<number[]>([]);
  const drag = useRef<{ moved: boolean; again: boolean; id: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const badgeEls = useRef<(HTMLSpanElement | null)[]>([]);
  const slotEls = useRef<(HTMLSpanElement | null)[]>([]);
  const streak = useRef(0);
  const locked = disabled || done || busy;

  const owner = useMemo(() => {
    const o = new Array<number>(n).fill(-1);
    found.forEach((p, w) => p.forEach((i) => (o[i] = w)));
    return o;
  }, [found, n]);

  const setP = (p: number[]) => {
    pathRef.current = p;
    setPath(p);
  };

  /** Saved state; `bonus` only once there is one, so older saves keep their shape. */
  const stateOf = (f: number[][]): CoilState => (bonusRef.current.length ? { found: f, bonus: bonusRef.current } : { found: f });

  /** Rows and columns follow the view, so they match what is on screen. */
  const cellName = (i: number) => {
    const [r, c] = toView(i, rows, cols, turns);
    return `Row ${r + 1}, column ${c + 1}, ${letters[i]}`;
  };

  /** Extend, backtrack or restart the traced path with cell i. Returns true if the path changed. */
  const touch = useCallback(
    (i: number, viaDrag: boolean) => {
      if (locked || owner[i] !== -1) return false;
      const p = pathRef.current;
      const last = p[p.length - 1];
      let next: number[];
      if (p.length >= 2 && p[p.length - 2] === i) next = p.slice(0, -1);
      else if (p.includes(i)) return false;
      else if (!p.length || adjacent(last, i, cols)) next = [...p, i];
      else if (viaDrag) return false;
      else next = [i];
      setP(next);
      play("tick", { step: next.length });
      api.announce(`${cellName(i)}. ${spell(letters, next)}`);
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locked, owner, cols, letters, api, turns],
  );

  const submit = useCallback(async () => {
    const p = pathRef.current;
    if (locked || !p.length) return;
    if (p.length < MIN_LEN) {
      api.feedback(REASON_COPY.short, "info", "info");
      api.announce(REASON_COPY.short);
      setP([]);
      return;
    }
    setBusy(true);
    let res: CoilCheck;
    try {
      res = await sendGuess<CoilCheck>(puzzle.ref, p);
    } catch {
      setBusy(false);
      api.feedback("No connection. Try that word again.", "danger", "wifi-slash");
      return;
    }
    if (res.ok) {
      const next = [...foundRef.current, res.path];
      foundRef.current = next;
      setFound(next);
      setP([]);
      streak.current++;
      const slot = next.length - 1;
      res.word.split("").forEach((_, k) => setTimeout(() => play("chime", { step: k }), k * FLY_STAGGER_MS));
      const all = next.length === puzzle.count;
      api.feedback(`${res.word}. ${next.length} of ${puzzle.count} found.`, all ? "success" : "info", "check-circle");
      api.announce(`Found ${res.word}. ${next.length} of ${puzzle.count} words.`);
      await flyLetters(
        res.path.map((i) => badgeEls.current[i]),
        slotEls.current[slot] ?? null,
        res.word.split(""),
      );
      setLanded(next.length);
      api.onMove(stateOf(next), { correctStreak: streak.current });
      setBusy(false);
      if (all) {
        setDone(true);
        play("jingle");
        api.feedback("Every letter used. Board cleared.", "success", "check-circle");
        api.announce("Board cleared.");
        api.onSolved(stateOf(next));
      }
      return;
    }
    setBusy(false);
    setP([]);
    if (res.bonus) {
      // a real word off the theme: kept as a bonus, never a mistake, never needed to clear the board
      if (bonusRef.current.some((b) => spell(letters, b) === res.word)) {
        api.feedback(`${res.word} is already a bonus word.`, "info", "sparkle");
        api.announce(`${res.word} is already a bonus word.`);
        return;
      }
      const nextBonus = [...bonusRef.current, p];
      bonusRef.current = nextBonus;
      setBonus(nextBonus);
      play("chime", { step: 0 });
      api.feedback(`Bonus word! ${res.word} +1`, "success", "sparkle");
      api.announce(`Bonus word, ${res.word}. ${nextBonus.length} bonus ${nextBonus.length === 1 ? "word" : "words"}.`);
      api.onMove(stateOf(foundRef.current));
      return;
    }
    streak.current = 0;
    const copy = REASON_COPY[res.reason];
    if (res.reason === "not-word") {
      setBad(p);
      setShakeN((s) => s + 1);
      api.ruleBreak(copy);
      api.onMove(stateOf(foundRef.current), { mistake: true });
      setTimeout(() => setBad([]), 600);
    } else {
      api.feedback(copy, "info", "info");
      api.announce(copy);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, locked, puzzle.count, puzzle.ref, letters]);

  const clear = useCallback(() => {
    setP([]);
    api.announce("Path cleared.");
  }, [api]);

  const rotate = useCallback(() => {
    // an ever-growing count keys the animated layer; the rotate helpers take it mod 4
    setTurns((t) => t + 1);
    play("swoosh");
    api.announce("Board rotated a quarter turn.");
  }, [api]);

  useEffect(() => {
    api.setControls([
      { id: "rotate", label: "Rotate", icon: "arrow-clockwise", onPress: rotate, disabled: disabled || done },
      { id: "clear", label: "Clear", icon: "eraser", onPress: clear, disabled: !path.length || locked },
      {
        id: "submit",
        label: "Submit",
        icon: "check",
        onPress: () => void submit(),
        disabled: path.length < 1 || locked,
        tone: path.length ? "world" : "default",
      },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, clear, submit, rotate, path.length, locked, disabled, done]);

  useEffect(() => {
    const tip =
      mode === "tutorial"
        ? "Drag through touching letters to spell a theme word."
        : `Theme: ${puzzle.theme}. ${found.length} of ${puzzle.count} found.`;
    api.feedback(tip, "info", "hand-pointing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- pointer: hit test against cell centres (in view space) so diagonals are easy ---------- */
  const hit = (e: React.PointerEvent) => {
    const el = wrap.current;
    if (!el) return -1;
    const b = el.getBoundingClientRect();
    const x = e.clientX - b.left - PAD,
      y = e.clientY - b.top - PAD;
    const c = Math.floor(x / (cell + GAP)),
      r = Math.floor(y / (cell + GAP));
    if (r < 0 || c < 0 || r >= vRows || c >= vCols) return -1;
    const cx = c * (cell + GAP) + cell / 2,
      cy = r * (cell + GAP) + cell / 2;
    return Math.hypot(x - cx, y - cy) <= cell * 0.44 ? fromView(r, c, rows, cols, turns) : -1;
  };
  const onDown = (e: React.PointerEvent) => {
    if (locked) return;
    const i = hit(e);
    if (i < 0) return;
    e.preventDefault();
    wrap.current?.setPointerCapture?.(e.pointerId);
    const p = pathRef.current;
    // tapping the last letter again submits
    if (p.length && p[p.length - 1] === i) {
      drag.current = { moved: false, again: true, id: e.pointerId };
      return;
    }
    if (p.length && !adjacent(p[p.length - 1], i, cols)) setP([]);
    touch(i, false);
    drag.current = { moved: false, again: false, id: e.pointerId };
  };
  const onMoveP = (e: React.PointerEvent) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    const i = hit(e);
    if (i < 0) return;
    const p = pathRef.current;
    if (p[p.length - 1] === i) return;
    if (touch(i, true)) drag.current.moved = true;
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    // a drag submits on release; in tap mode, tapping the last letter again submits
    if (d && (d.moved || d.again)) void submit();
  };

  /* ---------- keyboard (arrows move in view space) ---------- */
  const keyToggle = useCallback(
    (i: number) => {
      const p = pathRef.current;
      if (p[p.length - 1] === i) {
        setP(p.slice(0, -1));
        api.announce(`${cellName(i)} removed. ${spell(letters, p.slice(0, -1))}`);
        return;
      }
      if (owner[i] !== -1) {
        api.announce(`${cellName(i)}, already in ${spell(letters, found[owner[i]])}`);
        return;
      }
      if (p.length && !adjacent(p[p.length - 1], i, cols)) {
        api.announce(`${cellName(i)} does not touch the last letter.`);
        return;
      }
      touch(i, false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [owner, found, letters, cols, touch, api, turns],
  );
  const keyView = useCallback(
    (v: number) => keyToggle(fromView(Math.floor(v / vCols), v % vCols, rows, cols, turns)),
    [keyToggle, vCols, rows, cols, turns],
  );
  const keys = useGridKeys(vRows, vCols, keyView, () => void submit());

  const hintCells = Array.isArray(hint?.target) ? (hint!.target as number[]) : [];
  const lastCell = found.length ? found[found.length - 1][found[found.length - 1].length - 1] : 0;
  const [lr, lc] = toView(lastCell, rows, cols, turns);
  const W = PAD * 2 + vCols * cell + (vCols - 1) * GAP;
  const H = PAD * 2 + vRows * cell + (vRows - 1) * GAP;
  const centre = (i: number) => {
    const [r, c] = toView(i, rows, cols, turns);
    return [PAD + c * (cell + GAP) + cell / 2, PAD + r * (cell + GAP) + cell / 2] as const;
  };
  const line = (p: number[]) => p.map((i) => centre(i).join(",")).join(" ");
  const current = spell(letters, path);
  const tint = "color-mix(in srgb, var(--world) 22%, var(--surface-raised))";
  const bonusWords = bonus.map((b) => spell(letters, b));

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {/* theme + count */}
      <div className="flex w-full items-center justify-between gap-3" style={{ maxWidth: W }}>
        <span
          className="flex min-w-0 items-center gap-2 rounded-[12px] px-3 py-1.5 text-[14px] font-semibold"
          style={{ background: "var(--surface)" }}
        >
          <Icon name="leaf" size={16} style={{ color: "var(--world)" }} />
          <span className="truncate">Theme: {puzzle.theme}</span>
        </span>
        <span className="num text-muted text-[13px] font-semibold whitespace-nowrap">
          {found.length} of {puzzle.count}
        </span>
      </div>

      <div className={done ? "board-pulse" : ""}>
        {/* a fresh layer per turn: it starts a quarter turn back (the old view) and settles into the new one */}
        <motion.div
          key={turns}
          initial={turns === 0 ? false : reduce ? { opacity: 0.4 } : { rotate: -90, scale: 0.94 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          transition={{ duration: reduce ? 0.12 : 0.28, ease: [0.23, 1, 0.32, 1] }}
        >
          <div
            ref={wrap}
            role="grid"
            aria-label={`Coil letter grid, ${vRows} rows by ${vCols} columns. Theme ${puzzle.theme}.`}
            aria-rowcount={vRows}
            aria-colcount={vCols}
            onKeyDown={keys.onKeyDown}
            onPointerDown={onDown}
            onPointerMove={onMoveP}
            onPointerUp={onUp}
            onPointerCancel={() => (drag.current = null)}
            className="relative rounded-[16px] select-none"
            style={{ width: W, height: H, background: "var(--board-bg)", touchAction: "none", perspective: 600 }}
          >
            {/* layer 1: cell discs */}
            {Array.from({ length: n }, (_, i) => {
              const [x, y] = centre(i);
              const own = owner[i] !== -1;
              const inPath = path.includes(i);
              const isBad = bad.includes(i);
              const [r, c] = toView(i, rows, cols, turns);
              const dist = Math.abs(r - lr) + Math.abs(c - lc);
              return (
                <div
                  key={`d${i}`}
                  aria-hidden
                  className={`absolute rounded-full ${isBad ? (shakeN % 2 ? "cell-shake-a" : "cell-shake-b") : ""}`}
                  style={{
                    left: x - cell / 2,
                    top: y - cell / 2,
                    width: cell,
                    height: cell,
                    background: own ? "var(--world)" : inPath ? tint : "var(--surface-raised)",
                    boxShadow: isBad ? "inset 0 0 0 3px var(--danger)" : hintCells.includes(i) ? "inset 0 0 0 3px var(--gold)" : undefined,
                    animation: done ? `cell-flip 500ms var(--ease-out) ${dist * 70}ms both` : undefined,
                    transition: "background-color 180ms var(--ease-out)",
                  }}
                >
                  {isBad && <span className="hatch absolute inset-0 rounded-full" />}
                </div>
              );
            })}

            {/* layer 2: connectors */}
            <svg aria-hidden className="pointer-events-none absolute inset-0" width={W} height={H}>
              {found.map((p, w) => (
                <polyline
                  key={w}
                  points={line(p)}
                  fill="none"
                  stroke="var(--world-depth)"
                  strokeWidth={10}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {path.length > 1 && (
                <polyline
                  points={line(path)}
                  fill="none"
                  stroke={bad.length ? "var(--danger)" : "var(--text)"}
                  strokeWidth={10}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>

            {/* layer 3: letter badges (the focusable grid cells), laid out in view rows */}
            {Array.from({ length: vRows }, (_, r) => (
              <div role="row" key={`r${r}`} className="contents">
                {Array.from({ length: vCols }, (_, c) => {
                  const v = r * vCols + c;
                  const i = fromView(r, c, rows, cols, turns);
                  const [x, y] = centre(i);
                  const own = owner[i] !== -1;
                  const inPath = path.includes(i);
                  const isLast = path[path.length - 1] === i;
                  const hinted = hintCells.includes(i);
                  return (
                    <div
                      key={i}
                      role="gridcell"
                      data-i={v}
                      tabIndex={keys.focus === v ? 0 : -1}
                      aria-selected={inPath || own}
                      aria-label={`${cellName(i)}${own ? `, found in ${spell(letters, found[owner[i]])}` : inPath ? ", in your path" : ""}${hinted ? ", hinted" : ""}`}
                      onFocus={() => keys.setFocus(v)}
                      className={`absolute flex items-center justify-center rounded-full outline-none ${isLast ? (path.length % 2 ? "cell-pop-a" : "cell-pop-b") : ""} ${hinted ? "hint-ring" : ""}`}
                      style={{ left: x - cell / 2, top: y - cell / 2, width: cell, height: cell }}
                    >
                      <span
                        ref={(el) => {
                          badgeEls.current[i] = el;
                        }}
                        className="num flex items-center justify-center rounded-full"
                        style={{
                          width: badge,
                          height: badge,
                          background: own ? "var(--world)" : inPath ? "var(--text)" : "transparent",
                          color: own ? INK : inPath ? "var(--bg)" : "var(--text)",
                          font: `700 ${Math.round(cell * 0.3)}px var(--font-mono)`,
                          transition: "background-color 120ms var(--ease-out), color 120ms var(--ease-out)",
                        }}
                      >
                        {letters[i]}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* traced word preview, then the word list the letters fly to */}
      <div className="flex h-7 items-center justify-center" aria-hidden>
        {current && (
          <span
            className="font-display text-[18px] font-extrabold tracking-[0.06em]"
            style={{ color: bad.length ? "var(--danger)" : "var(--text)" }}
          >
            {current}
          </span>
        )}
      </div>
      <ul className="flex w-full flex-wrap justify-center gap-2" style={{ maxWidth: W + 40 }} aria-label="Words found">
        {Array.from({ length: puzzle.count }, (_, k) => {
          const p = found[k];
          const shown = p && k < landed;
          return (
            <li key={k}>
              <span
                ref={(el) => {
                  slotEls.current[k] = el;
                }}
                className={`flex h-9 min-w-12 items-center justify-center rounded-[12px] px-3 text-[13px] font-extrabold tracking-[0.04em] ${shown && k === landed - 1 ? "cell-pop-a" : ""}`}
                style={{
                  fontFamily: "var(--font-display)",
                  background: shown ? "var(--world)" : "transparent",
                  color: shown ? INK : "var(--text-muted)",
                  boxShadow: shown ? `0 3px 0 var(--world-depth)` : "inset 0 0 0 2px var(--line)",
                  animation: shown && k === landed - 1 ? `fade-in 160ms var(--ease-out), cell-pop-a 140ms var(--ease-out)` : undefined,
                }}
              >
                {shown ? spell(letters, p) : <span className="sr-only">Not found yet</span>}
              </span>
            </li>
          );
        })}
      </ul>

      {bonusWords.length > 0 && <BonusList words={bonusWords} maxWidth={W + 40} />}
    </div>
  );
}

function BonusList({ words, maxWidth }: { words: string[]; maxWidth: number }) {
  return (
    <div className="flex w-full flex-col items-center gap-1.5" style={{ maxWidth }}>
      <span className="text-muted flex items-center gap-1 text-[13px] font-semibold">
        <Icon name="sparkle" size={14} style={{ color: "var(--gold)" }} />
        Bonus words · {words.length}
      </span>
      <ul className="flex flex-wrap justify-center gap-1.5" aria-label="Bonus words">
        {words.map((w, k) => (
          <li
            key={w}
            className={`flex h-8 items-center rounded-[10px] px-2.5 text-[13px] font-bold tracking-[0.03em] ${k === words.length - 1 ? "cell-pop-a" : ""}`}
            style={{ background: "var(--surface-raised)", color: "var(--text)", boxShadow: "inset 0 0 0 2px var(--gold)" }}
          >
            {w}
          </li>
        ))}
      </ul>
    </div>
  );
}
