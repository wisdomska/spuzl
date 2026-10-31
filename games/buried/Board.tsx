"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useCellSize } from "@/components/game/useBoardSize";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { sendGuess } from "@/games/_shared/guess";
import { fromView, toView, viewDims } from "@/games/_shared/rotate";
import { BONUS_MIN, leftovers, snapLine, splitPhrase, wordOn, type BuriedCheck, type BuriedPuzzle, type BuriedState } from "./rules";

const GAP = 2;
const PAD = 6;
const INK = "#0E0F1A";

/**
 * Buried board. Drag in a straight line (8 directions, either way) over a hidden word, or tap its first
 * and last letters. Found words get a green capsule and a tick in the list. When the last word is found,
 * the leftover letters light up in reading order and spell the secret phrase.
 * Rotate turns the view a quarter turn (lines and state stay in the puzzle's own cell indices). A line
 * that reads as a real word off the list is checked on the server and kept as a bonus word.
 */
export default function BuriedBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<BuriedPuzzle, BuriedState>) {
  const { rows, cols, letters } = puzzle;
  /** quarter turns clockwise pressed so far (view only, never saved) */
  const [turns, setTurns] = useState(0);
  const [vRows, vCols] = viewDims(rows, cols, turns);
  const reduce = useReducedMotion();
  const cell = useCellSize(vCols, GAP, PAD, 52);
  const [found, setFound] = useState<number[][]>(() => initialState?.found?.map((p) => p.slice()) ?? []);
  // bonus paths are saved in reading order, so the word is just their letters
  const [bonus, setBonus] = useState<{ word: string; path: number[] }[]>(() =>
    (Array.isArray(initialState?.bonus) ? initialState.bonus : []).map((p) => ({
      word: p.map((i) => letters[i]).join(""),
      path: p.slice(),
    })),
  );
  const [anchor, setAnchor] = useState<number | null>(null);
  const [line, setLine] = useState<number[]>([]);
  const [done, setDone] = useState(() => (initialState?.found?.length ?? 0) === puzzle.words.length);
  const [pop, setPop] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dragging = useRef<{ id: number; moved: boolean } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const streak = useRef(0);
  const off = disabled || done || busy;

  const foundWords = found.map((p) => wordOn(puzzle, p) ?? "");
  const used = new Set(found.flat());
  const bonusPaths = bonus.map((b) => b.path);
  /** Saved state; `bonus` only once there is one, so older saves keep their shape. */
  const stateOf = (f: number[][], b = bonusPaths): BuriedState => (b.length ? { found: f, bonus: b } : { found: f });

  useEffect(() => {
    api.feedback(
      mode === "tutorial"
        ? "Drag across a hidden word, in any straight line."
        : `Find ${puzzle.words.length} words. The letters left over spell a secret.`,
      "info",
      "hand-pointing",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Off-list line: ask the server whether it reads as a real word, and keep it as a bonus if so. */
  const tryBonus = useCallback(
    async (path: number[]) => {
      setBusy(true);
      const res = await sendGuess<BuriedCheck>(puzzle.ref, path).catch(() => null);
      setBusy(false);
      if (res === null) {
        api.feedback("No connection. Try that line again.", "danger", "wifi-slash");
        return;
      }
      if (!res.bonus) {
        api.feedback("No hidden word on that line.", "info", "info");
        api.announce("No hidden word on that line.");
        return;
      }
      if (bonus.some((b) => b.word === res.word)) {
        api.feedback(`${res.word} is already a bonus word.`, "info", "sparkle");
        api.announce(`${res.word} is already a bonus word.`);
        return;
      }
      const spelled = path.map((i) => letters[i]).join("");
      const next = [...bonus, { word: res.word, path: spelled === res.word ? path : path.slice().reverse() }];
      setBonus(next);
      play("chime", { step: 0 });
      api.feedback(`Bonus word! ${res.word} +1`, "success", "sparkle");
      api.announce(`Bonus word, ${res.word}. ${next.length} bonus ${next.length === 1 ? "word" : "words"}.`);
      api.onMove(
        stateOf(
          found,
          next.map((b) => b.path),
        ),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, bonus, found, letters, puzzle.ref],
  );

  const tryLine = useCallback(
    (path: number[]) => {
      setAnchor(null);
      setLine([]);
      if (off || path.length < 2) return;
      const w = wordOn(puzzle, path);
      if (!w) {
        streak.current = 0;
        if (path.length >= BONUS_MIN) {
          void tryBonus(path);
          return;
        }
        api.feedback("No hidden word on that line.", "info", "info");
        api.announce("No hidden word on that line.");
        return;
      }
      if (foundWords.includes(w)) {
        api.feedback(`${w} is already found.`, "info", "info");
        return;
      }
      const next = [...found, path];
      setFound(next);
      setPop(w);
      w.split("").forEach((_, k) => setTimeout(() => play("chime", { step: k }), k * 40));
      api.announce(`Found ${w}. ${next.length} of ${puzzle.words.length}.`);
      api.onMove(stateOf(next), { correctStreak: ++streak.current });
      if (next.length === puzzle.words.length) {
        setDone(true);
        const secret = splitPhrase(leftovers(puzzle, next), puzzle.phraseShape).join(" ");
        setTimeout(() => play("jingle"), 300);
        api.feedback(`Secret phrase: ${secret}.`, "success", "check-circle");
        api.announce(`All words found. The secret phrase is ${secret}.`);
        api.onSolved(stateOf(next));
      } else api.feedback(`${w}. ${next.length} of ${puzzle.words.length} found.`, "info", "check-circle");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [off, puzzle, foundWords, found, api, tryBonus, bonus],
  );

  /** Hit test in view space, mapped back to the puzzle's own cell index. */
  const hit = (e: React.PointerEvent) => {
    const b = wrap.current!.getBoundingClientRect();
    const c = Math.floor((e.clientX - b.left - PAD) / (cell + GAP)),
      r = Math.floor((e.clientY - b.top - PAD) / (cell + GAP));
    if (r < 0 || c < 0 || r >= vRows || c >= vCols) return -1;
    return fromView(r, c, rows, cols, turns);
  };
  const onDown = (e: React.PointerEvent) => {
    if (off) return;
    const i = hit(e);
    if (i < 0) return;
    e.preventDefault();
    wrap.current?.setPointerCapture?.(e.pointerId);
    if (anchor !== null && anchor !== i) {
      // tap mode: second tap ends the line
      tryLine(snapLine(anchor, i, rows, cols));
      return;
    }
    setAnchor(i);
    setLine([i]);
    play("tick");
    dragging.current = { id: e.pointerId, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragging.current;
    if (!d || anchor === null) return;
    const i = hit(e);
    if (i < 0) return;
    // straight lines stay straight under a quarter turn, so snapping in puzzle space is exact
    const l = snapLine(anchor, i, rows, cols);
    if (l.length !== line.length || l[l.length - 1] !== line[line.length - 1]) {
      setLine(l);
      if (l.length > 1) d.moved = true;
    }
  };
  const onUp = () => {
    const d = dragging.current;
    dragging.current = null;
    if (d?.moved) tryLine(line);
  };

  const cellName = (i: number) => {
    const [r, c] = toView(i, rows, cols, turns);
    return `Row ${r + 1}, column ${c + 1}, ${letters[i]}`;
  };

  const keySpace = useCallback(
    (v: number) => {
      const i = fromView(Math.floor(v / vCols), v % vCols, rows, cols, turns);
      if (anchor === null) {
        setAnchor(i);
        setLine([i]);
        api.announce(`Line starts at ${cellName(i)}. Move and press Space on the last letter.`);
      } else if (anchor === i) {
        setAnchor(null);
        setLine([]);
        api.announce("Line cleared.");
      } else tryLine(snapLine(anchor, i, rows, cols));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [anchor, cols, rows, vCols, turns, letters, api, tryLine],
  );
  const keys = useGridKeys(vRows, vCols, keySpace);

  const rotate = useCallback(() => {
    // an ever-growing count keys the animated layer; the rotate helpers take it mod 4
    setTurns((t) => t + 1);
    play("swoosh");
    api.announce("Board rotated a quarter turn.");
  }, [api]);

  useEffect(() => {
    api.setControls([
      { id: "rotate", label: "Rotate", icon: "arrow-clockwise", onPress: rotate, disabled: disabled || done },
      {
        id: "clear",
        label: "Clear",
        icon: "eraser",
        onPress: () => {
          setAnchor(null);
          setLine([]);
        },
        disabled: anchor === null || off,
      },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, anchor, off, rotate, disabled, done]);

  const centre = (i: number) => {
    const [r, c] = toView(i, rows, cols, turns);
    return [PAD + c * (cell + GAP) + cell / 2, PAD + r * (cell + GAP) + cell / 2] as const;
  };
  const W = PAD * 2 + vCols * cell + (vCols - 1) * GAP,
    H = PAD * 2 + vRows * cell + (vRows - 1) * GAP;
  const capsule = (p: number[], color: string, key: string, opacity: number) => {
    const [x1, y1] = centre(p[0]);
    const [x2, y2] = centre(p[p.length - 1]);
    return (
      <line
        key={key}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeOpacity={opacity}
        strokeWidth={cell * 0.78}
        strokeLinecap="round"
      />
    );
  };
  const hinted = typeof hint?.target === "number" ? (hint.target as number) : -1;
  const leftoverOrder = done ? letters.map((_, i) => i).filter((i) => !used.has(i)) : [];
  const phrase = done ? splitPhrase(leftovers(puzzle, found), puzzle.phraseShape) : puzzle.phraseShape.map((n) => " ".repeat(n));

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <span
        className="flex items-center gap-2 self-start rounded-[12px] px-3 py-1.5 text-[14px] font-semibold"
        style={{ background: "var(--surface)" }}
      >
        <Icon name="shovel" size={16} style={{ color: "var(--world)" }} />
        {puzzle.theme}
      </span>

      <div className="overflow-x-auto" style={{ maxWidth: "100%" }}>
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
            aria-label={`Buried word search, ${vRows} rows by ${vCols} columns`}
            aria-rowcount={vRows}
            aria-colcount={vCols}
            aria-busy={busy}
            onKeyDown={keys.onKeyDown}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => (dragging.current = null)}
            className={`relative rounded-[16px] select-none ${done ? "board-pulse" : ""}`}
            style={{ width: W, height: H, background: "var(--board-bg)", touchAction: "none" }}
          >
            <svg aria-hidden className="pointer-events-none absolute inset-0" width={W} height={H}>
              {bonus.map((b, k) => capsule(b.path, "var(--gold)", `b${k}`, 0.22))}
              {found.map((p, k) => capsule(p, "var(--world)", `f${k}`, 0.45))}
              {line.length > 1 && capsule(line, "var(--text)", "cur", 0.28)}
            </svg>
            {Array.from({ length: vRows }, (_, r) => (
              <div role="row" key={r} className="contents">
                {Array.from({ length: vCols }, (_, c) => {
                  const v = r * vCols + c;
                  const i = fromView(r, c, rows, cols, turns);
                  const [x, y] = centre(i);
                  const lo = leftoverOrder.indexOf(i);
                  const inLine = line.includes(i);
                  return (
                    <div
                      key={i}
                      role="gridcell"
                      data-i={v}
                      tabIndex={keys.focus === v ? 0 : -1}
                      aria-selected={used.has(i) || inLine}
                      aria-label={`${cellName(i)}${used.has(i) ? ", in a found word" : ""}${anchor === i ? ", line start" : ""}${lo >= 0 ? ", part of the secret" : ""}`}
                      onFocus={() => keys.setFocus(v)}
                      className={`num absolute flex items-center justify-center rounded-[10px] text-[19px] font-semibold outline-none ${i === hinted && !done ? "hint-ring" : ""}`}
                      style={{
                        left: x - cell / 2,
                        top: y - cell / 2,
                        width: cell,
                        height: cell,
                        color: lo >= 0 ? INK : "var(--text)",
                        boxShadow:
                          anchor === i ? "inset 0 0 0 3px var(--text)" : i === hinted && !done ? "inset 0 0 0 3px var(--gold)" : undefined,
                      }}
                    >
                      {lo >= 0 && (
                        <span
                          aria-hidden
                          className="absolute inset-0.5 rounded-[9px]"
                          style={{
                            background: "var(--gold)",
                            animation: `fade-in 160ms var(--ease-out) ${lo * 70}ms both, cell-pop-a 140ms var(--ease-out) ${lo * 70}ms both`,
                          }}
                        />
                      )}
                      <span className="relative">{letters[i]}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <ul className="flex w-full max-w-[400px] flex-wrap justify-center gap-1.5" aria-label="Words to find">
        {puzzle.words.map((w) => {
          const got = foundWords.includes(w);
          return (
            <li
              key={w}
              className={`flex h-8 items-center gap-1 rounded-[10px] px-2.5 text-[13px] font-bold tracking-[0.03em] ${pop === w ? "cell-pop-a" : ""}`}
              style={{
                background: got ? "var(--world)" : "var(--surface-raised)",
                color: got ? INK : "var(--text)",
                textDecoration: got ? "line-through" : undefined,
              }}
            >
              {got && <Icon name="check" size={12} label="found" />}
              {w}
            </li>
          );
        })}
      </ul>

      {bonus.length > 0 && (
        <div className="flex w-full max-w-[400px] flex-col items-center gap-1.5">
          <span className="text-muted flex items-center gap-1 text-[13px] font-semibold">
            <Icon name="sparkle" size={14} style={{ color: "var(--gold)" }} />
            Bonus words · {bonus.length}
          </span>
          <ul className="flex flex-wrap justify-center gap-1.5" aria-label="Bonus words">
            {bonus.map((b, k) => (
              <li
                key={b.word}
                className={`flex h-8 items-center rounded-[10px] px-2.5 text-[13px] font-bold tracking-[0.03em] ${k === bonus.length - 1 ? "cell-pop-a" : ""}`}
                style={{ background: "var(--surface-raised)", color: "var(--text)", boxShadow: "inset 0 0 0 2px var(--gold)" }}
              >
                {b.word}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex w-full max-w-[400px] flex-col items-center gap-1.5 rounded-[16px] p-3" style={{ background: "var(--surface)" }}>
        <span className="text-muted text-[13px] font-medium">Secret phrase</span>
        <div
          className="flex flex-wrap justify-center gap-x-3 gap-y-1.5"
          aria-label={done ? phrase.join(" ") : "Hidden until every word is found"}
        >
          {phrase.map((wd, k) => (
            <span key={k} className="flex gap-0.5">
              {wd.split("").map((ch, j) => (
                <span
                  key={j}
                  className="font-display flex h-7 w-5 items-end justify-center text-[16px] font-extrabold"
                  style={{
                    borderBottom: "2px solid var(--line)",
                    color: "var(--gold)",
                    animation: done ? `fade-in 160ms var(--ease-out) ${(phrase.slice(0, k).join("").length + j) * 70}ms both` : undefined,
                  }}
                >
                  {ch.trim()}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
