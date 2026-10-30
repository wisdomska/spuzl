"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useCellSize } from "@/components/game/useBoardSize";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { leftovers, snapLine, splitPhrase, wordOn, type BuriedPuzzle, type BuriedState } from "./rules";

const GAP = 2;
const PAD = 6;
const INK = "#0E0F1A";

/**
 * Buried board. Drag in a straight line (8 directions, either way) over a hidden word, or tap its first
 * and last letters. Found words get a green capsule and a tick in the list. When the last word is found,
 * the leftover letters light up in reading order and spell the secret phrase.
 */
export default function BuriedBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<BuriedPuzzle, BuriedState>) {
  const { rows, cols, letters } = puzzle;
  const cell = useCellSize(cols, GAP, PAD, 52);
  const [found, setFound] = useState<number[][]>(() => initialState?.found?.map((p) => p.slice()) ?? []);
  const [anchor, setAnchor] = useState<number | null>(null);
  const [line, setLine] = useState<number[]>([]);
  const [done, setDone] = useState(() => (initialState?.found?.length ?? 0) === puzzle.words.length);
  const [pop, setPop] = useState<string | null>(null);
  const dragging = useRef<{ id: number; moved: boolean } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const streak = useRef(0);
  const off = disabled || done;

  const foundWords = found.map((p) => wordOn(puzzle, p) ?? "");
  const used = new Set(found.flat());

  useEffect(() => {
    api.feedback(mode === "tutorial" ? "Drag across a hidden word, in any straight line." : `Find ${puzzle.words.length} words. The letters left over spell a secret.`, "info", "hand-pointing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tryLine = useCallback(
    (path: number[]) => {
      setAnchor(null);
      setLine([]);
      if (off || path.length < 2) return;
      const w = wordOn(puzzle, path);
      if (!w) {
        streak.current = 0;
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
      api.onMove({ found: next }, { correctStreak: ++streak.current });
      if (next.length === puzzle.words.length) {
        setDone(true);
        const secret = splitPhrase(leftovers(puzzle, next), puzzle.phraseShape).join(" ");
        setTimeout(() => play("jingle"), 300);
        api.feedback(`Secret phrase: ${secret}.`, "success", "check-circle");
        api.announce(`All words found. The secret phrase is ${secret}.`);
        api.onSolved({ found: next });
      } else api.feedback(`${w}. ${next.length} of ${puzzle.words.length} found.`, "info", "check-circle");
    },
    [off, puzzle, foundWords, found, api],
  );

  const hit = (e: React.PointerEvent) => {
    const b = wrap.current!.getBoundingClientRect();
    const c = Math.floor((e.clientX - b.left - PAD) / (cell + GAP)), r = Math.floor((e.clientY - b.top - PAD) / (cell + GAP));
    if (r < 0 || c < 0 || r >= rows || c >= cols) return -1;
    return r * cols + c;
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

  const keySpace = useCallback(
    (i: number) => {
      if (anchor === null) {
        setAnchor(i);
        setLine([i]);
        const r = Math.floor(i / cols) + 1, c = (i % cols) + 1;
        api.announce(`Line starts at row ${r}, column ${c}, ${letters[i]}. Move and press Space on the last letter.`);
      } else if (anchor === i) {
        setAnchor(null);
        setLine([]);
        api.announce("Line cleared.");
      } else tryLine(snapLine(anchor, i, rows, cols));
    },
    [anchor, cols, rows, letters, api, tryLine],
  );
  const keys = useGridKeys(rows, cols, keySpace);

  useEffect(() => {
    api.setControls([
      { id: "clear", label: "Clear", icon: "eraser", onPress: () => { setAnchor(null); setLine([]); }, disabled: anchor === null || off },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, anchor, off]);

  const centre = (i: number) => [PAD + (i % cols) * (cell + GAP) + cell / 2, PAD + Math.floor(i / cols) * (cell + GAP) + cell / 2] as const;
  const W = PAD * 2 + cols * cell + (cols - 1) * GAP, H = PAD * 2 + rows * cell + (rows - 1) * GAP;
  const capsule = (p: number[], color: string, key: string, opacity: number) => {
    const [x1, y1] = centre(p[0]);
    const [x2, y2] = centre(p[p.length - 1]);
    return <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeOpacity={opacity} strokeWidth={cell * 0.78} strokeLinecap="round" />;
  };
  const hinted = typeof hint?.target === "number" ? (hint.target as number) : -1;
  const leftoverOrder = done ? letters.map((_, i) => i).filter((i) => !used.has(i)) : [];
  const phrase = done ? splitPhrase(leftovers(puzzle, found), puzzle.phraseShape) : puzzle.phraseShape.map((n) => " ".repeat(n));

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <span className="flex items-center gap-2 self-start rounded-[12px] px-3 py-1.5 text-[14px] font-semibold" style={{ background: "var(--surface)" }}>
        <Icon name="shovel" size={16} style={{ color: "var(--world)" }} />
        {puzzle.theme}
      </span>

      <div
        ref={wrap}
        role="grid"
        aria-label={`Buried word search, ${rows} rows by ${cols} columns`}
        aria-rowcount={rows}
        aria-colcount={cols}
        onKeyDown={keys.onKeyDown}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => (dragging.current = null)}
        className={`relative rounded-[16px] select-none ${done ? "board-pulse" : ""}`}
        style={{ width: W, height: H, background: "var(--board-bg)", touchAction: "none" }}
      >
        <svg aria-hidden className="pointer-events-none absolute inset-0" width={W} height={H}>
          {found.map((p, k) => capsule(p, "var(--world)", `f${k}`, 0.45))}
          {line.length > 1 && capsule(line, "var(--text)", "cur", 0.28)}
        </svg>
        {Array.from({ length: rows }, (_, r) => (
          <div role="row" key={r} className="contents">
            {Array.from({ length: cols }, (_, c) => {
              const i = r * cols + c;
              const [x, y] = centre(i);
              const lo = leftoverOrder.indexOf(i);
              const inLine = line.includes(i);
              return (
                <div
                  key={i}
                  role="gridcell"
                  data-i={i}
                  tabIndex={keys.focus === i ? 0 : -1}
                  aria-selected={used.has(i) || inLine}
                  aria-label={`Row ${r + 1}, column ${c + 1}, ${letters[i]}${used.has(i) ? ", in a found word" : ""}${anchor === i ? ", line start" : ""}${lo >= 0 ? ", part of the secret" : ""}`}
                  onFocus={() => keys.setFocus(i)}
                  className={`num absolute flex items-center justify-center rounded-[10px] text-[19px] font-semibold outline-none ${i === hinted && !done ? "hint-ring" : ""}`}
                  style={{
                    left: x - cell / 2,
                    top: y - cell / 2,
                    width: cell,
                    height: cell,
                    color: lo >= 0 ? INK : "var(--text)",
                    boxShadow: anchor === i ? "inset 0 0 0 3px var(--text)" : i === hinted && !done ? "inset 0 0 0 3px var(--gold)" : undefined,
                  }}
                >
                  {lo >= 0 && (
                    <span aria-hidden className="absolute inset-0.5 rounded-[9px]" style={{ background: "var(--gold)", animation: `fade-in 160ms var(--ease-out) ${lo * 70}ms both, cell-pop-a 140ms var(--ease-out) ${lo * 70}ms both` }} />
                  )}
                  <span className="relative">{letters[i]}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <ul className="flex w-full max-w-[400px] flex-wrap justify-center gap-1.5" aria-label="Words to find">
        {puzzle.words.map((w) => {
          const got = foundWords.includes(w);
          return (
            <li
              key={w}
              className={`flex h-8 items-center gap-1 rounded-[10px] px-2.5 text-[13px] font-bold tracking-[0.03em] ${pop === w ? "cell-pop-a" : ""}`}
              style={{ background: got ? "var(--world)" : "var(--surface-raised)", color: got ? INK : "var(--text)", textDecoration: got ? "line-through" : undefined }}
            >
              {got && <Icon name="check" size={12} label="found" />}
              {w}
            </li>
          );
        })}
      </ul>

      <div className="flex w-full max-w-[400px] flex-col items-center gap-1.5 rounded-[16px] p-3" style={{ background: "var(--surface)" }}>
        <span className="text-[13px] font-medium text-muted">Secret phrase</span>
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5" aria-label={done ? phrase.join(" ") : "Hidden until every word is found"}>
          {phrase.map((wd, k) => (
            <span key={k} className="flex gap-0.5">
              {wd.split("").map((ch, j) => (
                <span
                  key={j}
                  className="font-display flex h-7 w-5 items-end justify-center text-[16px] font-extrabold"
                  style={{ borderBottom: "2px solid var(--line)", color: "var(--gold)", animation: done ? `fade-in 160ms var(--ease-out) ${(phrase.slice(0, k).join("").length + j) * 70}ms both` : undefined }}
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
