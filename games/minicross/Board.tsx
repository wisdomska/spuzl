"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useCellSize } from "@/components/game/useBoardSize";
import { play } from "@/lib/audio";
import { sendGuess } from "@/games/_shared/guess";
import { LetterKeyboard } from "@/games/_shared/LetterKeyboard";
import { cellsOf, clueAt, numberGrid, type Clue, type Dir, type MinicrossCheck, type MinicrossPuzzle, type MinicrossState } from "./rules";

const GAP = 2;
const INK = "#0E0F1A";
const PAPER = "#F4F5FB";

/**
 * Minicross board (Game Boards: Minicross). White squares on the dark board, clue bar above, SPUZL keyboard
 * below. The active word is tinted green and the active square ringed; tap the active square again to
 * switch direction. Screen readers hear the clue, then the square.
 */
export default function MinicrossBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<MinicrossPuzzle, MinicrossState>) {
  const { size, blocks } = puzzle;
  const n = size * size;
  const given = useMemo(() => puzzle.given ?? {}, [puzzle.given]);
  const [cells, setCells] = useState<string[]>(() => {
    const base = initialState?.cells?.slice() ?? new Array(n).fill("");
    for (const [k, v] of Object.entries(given)) base[Number(k)] = v;
    return base;
  });
  const first = blocks.findIndex((b) => !b);
  const [cur, setCur] = useState(first);
  const [dir, setDir] = useState<Dir>("across");
  const [revealed, setRevealed] = useState<number[]>([]);
  const [wrongN, setWrongN] = useState(0);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tapN, setTapN] = useState(0);
  const cellsRef = useRef(cells);
  const lastChecked = useRef("");
  const streak = useRef(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const cell = useCellSize(size, GAP, 6, 64);
  const { nums } = useMemo(() => numberGrid(blocks, size), [blocks, size]);
  const off = disabled || done || busy;

  const clue = clueAt(puzzle, cur, dir) ?? clueAt(puzzle, cur, dir === "across" ? "down" : "across");
  const clueDir: Dir = clueAt(puzzle, cur, dir) ? dir : dir === "across" ? "down" : "across";
  const word = useMemo(() => (clue ? cellsOf(clue, clueDir, size) : []), [clue, clueDir, size]);
  const allClues = useMemo(
    () => [...puzzle.across.map((c) => ({ c, d: "across" as Dir })), ...puzzle.down.map((c) => ({ c, d: "down" as Dir }))],
    [puzzle.across, puzzle.down],
  );
  const label = (c: Clue, d: Dir) => `${c.n} ${d === "across" ? "Across" : "Down"}`;

  const say = useCallback(
    (i: number, d: Dir, cs = cellsRef.current) => {
      const cl = clueAt(puzzle, i, d) ?? clueAt(puzzle, i, d === "across" ? "down" : "across");
      const dd = clueAt(puzzle, i, d) ? d : d === "across" ? "down" : "across";
      const r = Math.floor(i / size) + 1,
        c = (i % size) + 1;
      api.announce(`${cl ? `${label(cl, dd)}: ${cl.text}, ${cl.len} letters. ` : ""}Row ${r}, column ${c}, ${cs[i] || "blank"}.`);
    },
    [api, puzzle, size],
  );

  const select = useCallback(
    (i: number, d: Dir = dir) => {
      if (blocks[i]) return;
      setCur(i);
      setDir(d);
      say(i, d);
    },
    [blocks, dir, say],
  );

  useEffect(() => {
    api.feedback(
      mode === "tutorial"
        ? "Tap a square, type. Tap it again to switch direction."
        : "Tap a square and type. Tap again to switch direction.",
      "info",
      "hand-pointing",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = useCallback(
    async (next: string[], at: number) => {
      cellsRef.current = next;
      setCells(next);
      api.onMove({ cells: next }, { correctStreak: streak.current });
      const full = next.every((ch, i) => blocks[i] || ch);
      const key = next.join("");
      if (!full || key === lastChecked.current) return;
      lastChecked.current = key;
      setBusy(true);
      const res = await sendGuess<MinicrossCheck>(puzzle.ref, { cells: next }).catch(() => null);
      setBusy(false);
      if (!res) {
        lastChecked.current = "";
        api.feedback("No connection. Change a letter to check again.", "danger", "wifi-slash");
        return;
      }
      if (res.ok) {
        setDone(true);
        setCur(at);
        play("jingle");
        api.feedback("Every square right. Grid cleared.", "success", "check-circle");
        api.announce("Grid cleared.");
        api.onSolved({ cells: next });
      } else {
        streak.current = 0;
        setWrongN((w) => w + 1);
        api.ruleBreak("Not quite. One or more squares are off.");
        api.onMove({ cells: next }, { mistake: true });
      }
    },
    [api, blocks, puzzle.ref],
  );

  const nextClueStart = useCallback(
    (from: Clue, d: Dir, cs: string[], step = 1) => {
      const idx = allClues.findIndex((x) => x.c === from && x.d === d);
      for (let s = 1; s <= allClues.length; s++) {
        const { c, d: dd } = allClues[(idx + s * step + allClues.length * 2) % allClues.length];
        const cl = cellsOf(c, dd, size);
        const empty = cl.find((i) => !cs[i]);
        if (empty !== undefined || s === allClues.length) return { i: empty ?? cl[0], d: dd };
      }
      return { i: cellsOf(from, d, size)[0], d };
    },
    [allClues, size],
  );

  const onLetter = useCallback(
    (ch: string) => {
      if (off || !clue) return;
      const next = cellsRef.current.slice();
      if (given[cur] === undefined) next[cur] = ch;
      setTapN((t) => t + 1);
      play("pop", { step: ++streak.current });
      // advance: next empty square in this word, else the next square, else the next clue
      const pos = word.indexOf(cur);
      const after = word.slice(pos + 1);
      const target = after.find((i) => !next[i]) ?? (after.length ? after[0] : undefined);
      if (target !== undefined) {
        setCur(target);
        say(target, clueDir, next);
      } else {
        const nx = nextClueStart(clue, clueDir, next);
        setCur(nx.i);
        setDir(nx.d);
        say(nx.i, nx.d, next);
      }
      void commit(next, cur);
    },
    [off, clue, cur, given, word, clueDir, nextClueStart, commit, say],
  );

  const onBackspace = useCallback(() => {
    if (off || !clue) return;
    const next = cellsRef.current.slice();
    if (next[cur] && given[cur] === undefined) {
      next[cur] = "";
      void commit(next, cur);
      say(cur, clueDir, next);
      return;
    }
    const pos = word.indexOf(cur);
    if (pos > 0) {
      const prev = word[pos - 1];
      if (given[prev] === undefined) next[prev] = "";
      setCur(prev);
      void commit(next, prev);
      say(prev, clueDir, next);
    }
  }, [off, clue, cur, given, word, clueDir, commit, say]);

  const onEnter = useCallback(() => {
    if (!clue) return;
    const nx = nextClueStart(clue, clueDir, cellsRef.current);
    setCur(nx.i);
    setDir(nx.d);
    say(nx.i, nx.d);
  }, [clue, clueDir, nextClueStart, say]);

  const flip = useCallback(() => {
    const d: Dir = dir === "across" ? "down" : "across";
    if (clueAt(puzzle, cur, d)) select(cur, d);
  }, [dir, cur, puzzle, select]);

  // Hints reveal one square: fill it and mark it.
  useEffect(() => {
    const t = hint?.target as { cell?: number; letter?: string } | undefined;
    if (!t || typeof t.cell !== "number" || !t.letter) return;
    const id = setTimeout(() => {
      const next = cellsRef.current.slice();
      next[t.cell!] = t.letter!;
      setRevealed((r) => [...r, t.cell!]);
      setCur(t.cell!);
      void commit(next, t.cell!);
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hint]);

  useEffect(() => {
    api.setControls([
      {
        id: "dir",
        label: dir === "across" ? "Across" : "Down",
        icon: dir === "across" ? "arrow-right" : "arrow-down",
        onPress: flip,
        disabled: off,
      },
      { id: "next", label: "Next clue", icon: "caret-right", onPress: onEnter, disabled: off },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, dir, flip, onEnter, off]);

  // Grid keyboard: arrows move (and set direction), Space switches direction.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const r = Math.floor(cur / size),
      c = cur % size;
    const moves: Record<string, [number, number, Dir]> = {
      ArrowUp: [-1, 0, "down"],
      ArrowDown: [1, 0, "down"],
      ArrowLeft: [0, -1, "across"],
      ArrowRight: [0, 1, "across"],
    };
    const m = moves[e.key];
    if (m) {
      e.preventDefault();
      if (dir !== m[2] && clueAt(puzzle, cur, m[2])) {
        select(cur, m[2]);
        return;
      }
      let rr = r + m[0],
        cc = c + m[1];
      while (rr >= 0 && cc >= 0 && rr < size && cc < size && blocks[rr * size + cc]) {
        rr += m[0];
        cc += m[1];
      }
      if (rr >= 0 && cc >= 0 && rr < size && cc < size) select(rr * size + cc, m[2]);
    } else if (e.key === " ") {
      e.preventDefault();
      flip();
    } else if (e.key === "Enter") {
      e.preventDefault();
      onEnter();
    }
  };

  useEffect(() => {
    if (gridRef.current?.contains(document.activeElement)) gridRef.current.querySelector<HTMLElement>(`[data-i="${cur}"]`)?.focus();
  }, [cur]);

  const tint = `color-mix(in srgb, var(--world) 22%, ${PAPER})`;
  const lastR = Math.floor(cur / size),
    lastC = cur % size;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {/* clue bar */}
      <div className="flex w-full max-w-[400px] items-center gap-1 rounded-[16px] px-1.5 py-1.5" style={{ background: "var(--surface)" }}>
        <button
          type="button"
          aria-label="Previous clue"
          className="press flex size-11 shrink-0 items-center justify-center rounded-[12px]"
          onClick={() => {
            if (!clue) return;
            const nx = nextClueStart(clue, clueDir, cellsRef.current, -1);
            select(nx.i, nx.d);
          }}
        >
          <Icon name="caret-left" size={20} />
        </button>
        <p className="min-h-11 flex-1 py-1 text-[15px] leading-[1.35]" aria-live="off">
          {clue && (
            <>
              <span className="font-semibold text-[var(--world)] [[data-theme=light]_&]:text-[var(--world-ink)]">
                {label(clue, clueDir)}:{" "}
              </span>
              {clue.text} ({clue.len})
            </>
          )}
        </p>
        <button
          type="button"
          aria-label="Next clue"
          className="press flex size-11 shrink-0 items-center justify-center rounded-[12px]"
          onClick={onEnter}
        >
          <Icon name="caret-right" size={20} />
        </button>
      </div>

      <div className={done ? "board-pulse" : wrongN ? (wrongN % 2 ? "cell-shake-a" : "cell-shake-b") : ""}>
        <div
          ref={gridRef}
          role="grid"
          aria-label={`Minicross, ${size} by ${size}`}
          aria-rowcount={size}
          aria-colcount={size}
          onKeyDown={onKeyDown}
          className="grid rounded-[16px] p-1.5"
          style={{ gridTemplateColumns: `repeat(${size}, ${cell}px)`, gap: GAP, background: "var(--board-bg)", perspective: 600 }}
        >
          {Array.from({ length: size }, (_, r) => (
            <div role="row" key={r} className="contents">
              {Array.from({ length: size }, (_, c) => {
                const i = r * size + c;
                if (blocks[i])
                  return (
                    <div
                      key={i}
                      role="gridcell"
                      aria-label="Black square"
                      style={{ width: cell, height: cell, background: "var(--board-bg)" }}
                    />
                  );
                const active = i === cur && !done;
                const inWord = word.includes(i) && !done;
                const dist = Math.abs(r - lastR) + Math.abs(c - lastC);
                const isGiven = given[i] !== undefined;
                return (
                  <div
                    key={i}
                    role="gridcell"
                    data-i={i}
                    tabIndex={i === cur ? 0 : -1}
                    aria-selected={active}
                    aria-label={`${(clueAt(puzzle, i, dir) ?? clueAt(puzzle, i, dir === "across" ? "down" : "across"))?.text ?? ""}. Row ${r + 1}, column ${c + 1}, ${cells[i] || "blank"}${isGiven ? ", given" : revealed.includes(i) ? ", revealed" : ""}`}
                    onClick={() => {
                      if (off) return;
                      if (i === cur) flip();
                      else select(i, clueAt(puzzle, i, dir) ? dir : dir === "across" ? "down" : "across");
                    }}
                    className={`relative flex cursor-pointer items-center justify-center rounded-[6px] outline-none ${active && cells[i] ? (tapN % 2 ? "cell-pop-a" : "cell-pop-b") : ""}`}
                    style={{
                      width: cell,
                      height: cell,
                      background: inWord ? tint : PAPER,
                      color: INK,
                      boxShadow: active ? "inset 0 0 0 3px var(--world-depth)" : undefined,
                      font: `700 ${Math.round(cell * 0.48)}px var(--font-ui)`,
                      transition: "background-color 120ms var(--ease-out)",
                    }}
                  >
                    {done && (
                      <span
                        aria-hidden
                        className="absolute inset-0 rounded-[6px]"
                        style={{
                          background: "var(--world)",
                          animation: `cell-flip 500ms var(--ease-out) ${dist * 70}ms both, fade-in 1ms linear ${dist * 70 + 250}ms both`,
                        }}
                      />
                    )}
                    {nums[i] > 0 && (
                      <span className="num absolute top-0.5 left-1 text-[11px] font-semibold" style={{ color: "#5A5E78" }}>
                        {nums[i]}
                      </span>
                    )}
                    {(revealed.includes(i) || isGiven) && !done && (
                      <span
                        aria-hidden
                        className="absolute top-0 right-0 size-0"
                        style={{ borderTop: "10px solid var(--gold)", borderLeft: "10px solid transparent", borderTopRightRadius: 6 }}
                      />
                    )}
                    <span className="relative">{cells[i]}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {!done && <LetterKeyboard onLetter={onLetter} onBackspace={onBackspace} onEnter={onEnter} enterLabel="NEXT" disabled={off} />}
    </div>
  );
}
