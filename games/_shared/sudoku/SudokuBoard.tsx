"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useCellSize } from "@/components/game/useBoardSize";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { popClass, shakeClass, waveStyle } from "@/games/_shared/logiclab/fx";
import { sudoku as t } from "@/lib/copy/sudoku";
import { analyze, emptyState, geometry, type SudokuPuzzle, type SudokuState } from "./logic";
import { boundaryTracks, boxIndex, digitCounts, trackList } from "./layout";

/** Gap between cells inside a box. */
const GAP = 2;
/** Box borders (and the outer frame): 2 px in a lighter tone than the cell gaps. */
const LINE = 2;
const PAD = LINE;
const BOX_LINE = "color-mix(in srgb, var(--text-muted) 60%, var(--line))";

/** 9 × 9 cannot fit 44 px cells in a 390 px phone, so Nine keeps a 34 px floor instead of panning. */
function useSudokuCell(size: number) {
  const fit44 = useCellSize(size, GAP, PAD * 2, 56);
  const [vw, setVw] = useState(390);
  useEffect(() => {
    const on = () => setVw(window.innerWidth);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  if (size <= 7) return fit44;
  return Math.max(34, Math.min(56, Math.floor((Math.min(vw, 460) - 36 - GAP * (size - 1) - PAD * 2) / size)));
}

/**
 * Sudoku board shared by Sixer and Nine (Game Boards: Sixer). Tap a cell, tap a number. Notes mode
 * toggles pencil marks. Givens are bolder and locked; your digits use the world colour. Boxes have 2 px
 * borders in a lighter tone. The selected cell's row, column and box are tinted, and every cell holding
 * the selected number gets a stronger tint and a bolder digit so the eye can scan.
 */
export function SudokuBoard({
  puzzle,
  initialState,
  hint,
  disabled,
  mode,
  api,
  title,
}: BoardProps<SudokuPuzzle, SudokuState> & { title: string }) {
  const n = puzzle.size;
  const g = geometry(n, puzzle.boxW, puzzle.boxH);
  const [st, setSt] = useState<SudokuState>(() =>
    initialState
      ? { values: initialState.values.slice(), notes: initialState.notes?.slice() ?? new Array(n * n).fill(0) }
      : emptyState(puzzle),
  );
  const [hist, setHist] = useState<SudokuState[]>([]);
  const [notesMode, setNotesMode] = useState(false);
  const [selected, setSelected] = useState(-1);
  const [last, setLast] = useState(-1);
  const [tapN, setTapN] = useState(0);
  const [shakeN, setShakeN] = useState(0);
  const [done, setDone] = useState(false);
  const streak = useRef(0);
  const stRef = useRef(st);
  const cell = useSudokuCell(n);
  const a = analyze(puzzle, st.values);
  const given = (i: number) => puzzle.givens[i] !== 0;
  const locked = disabled || done;

  const push = useCallback((next: SudokuState) => {
    const prev = stRef.current;
    stRef.current = next;
    setSt(next);
    setHist((h) => [...h, prev]);
  }, []);

  const where = (i: number) => t.where(Math.floor(i / n) + 1, (i % n) + 1, boxIndex(i, n, puzzle.boxW, puzzle.boxH) + 1);

  /** Place (or clear with 0) a digit in a cell. */
  const place = useCallback(
    (i: number, d: number) => {
      if (locked || i < 0) return;
      if (given(i)) {
        api.feedback(t.givenLocked, "info", "lock-simple");
        return;
      }
      const prev = stRef.current;
      if (prev.values[i] === d && d !== 0) d = 0;
      if (prev.values[i] === d) return;
      const values = prev.values.slice();
      values[i] = d;
      const notes = prev.notes.slice();
      notes[i] = 0;
      // Placing a digit tidies that digit out of the notes of every peer.
      if (d) for (const j of g.peers[i]) notes[j] &= ~(1 << (d - 1));
      const next = { values, notes };
      push(next);
      const before = analyze(puzzle, prev.values);
      const after = analyze(puzzle, values);
      const broke = d !== 0 && after.bad.has(i) && after.bad.size > before.bad.size;
      setLast(i);
      setTapN((t) => t + 1);
      if (broke) {
        streak.current = 0;
        setShakeN((k) => k + 1);
        api.ruleBreak(after.message);
        api.announce(`${where(i)}, ${d}. ${after.message}`);
      } else if (after.clear) {
        setDone(true);
        play("jingle");
        api.feedback(t.cleared, "success", "check-circle");
        api.announce(t.clearedShort);
      } else {
        if (d) streak.current++;
        play("pop", { step: streak.current });
        api.announce(`${where(i)}, ${d || t.cellCleared}`);
        if (after.bad.size === 0) api.feedback(t.placed(after.filled, n * n), "info", "grid-nine");
      }
      api.onMove(next, { correctStreak: streak.current, mistake: broke });
      if (after.clear) api.onSolved(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, locked, n, puzzle, push],
  );

  const toggleNote = useCallback(
    (i: number, d: number) => {
      if (locked || i < 0 || given(i) || stRef.current.values[i]) return;
      const prev = stRef.current;
      const notes = prev.notes.slice();
      notes[i] ^= 1 << (d - 1);
      const next = { values: prev.values, notes };
      push(next);
      setLast(i);
      setTapN((t) => t + 1);
      play("tick");
      api.announce(`${where(i)}, ${t.noteToggled(d, (notes[i] & (1 << (d - 1))) !== 0)}`);
      api.onMove(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, locked, push],
  );

  const enter = useCallback(
    (d: number) => {
      if (selected < 0) {
        api.feedback(t.tapCellFirst, "info", "hand-pointing");
        return;
      }
      if (notesMode && d) toggleNote(selected, d);
      else place(selected, d);
    },
    [api, notesMode, place, selected, toggleNote],
  );

  const erase = useCallback(() => {
    if (selected < 0 || locked || given(selected)) return;
    const prev = stRef.current;
    if (prev.values[selected]) place(selected, 0);
    else if (prev.notes[selected]) {
      const notes = prev.notes.slice();
      notes[selected] = 0;
      const next = { values: prev.values, notes };
      push(next);
      api.announce(`${where(selected)}, ${t.notesCleared}`);
      api.onMove(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, locked, place, push, selected]);

  const undo = useCallback(() => {
    setHist((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      stRef.current = prev;
      setSt(prev);
      api.onMove(prev);
      return h.slice(0, -1);
    });
  }, [api]);

  useEffect(() => {
    api.setControls([
      { id: "undo", label: t.undo, icon: "arrow-counter-clockwise", onPress: undo, disabled: !hist.length || done },
      { id: "erase", label: t.erase, icon: "eraser", onPress: erase, disabled: done },
      {
        id: "notes",
        label: notesMode ? t.notesOn : t.notesTool,
        icon: "pencil-simple",
        onPress: () => setNotesMode((m) => !m),
        active: notesMode,
      },
      { id: "hint", label: t.hint, icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, undo, erase, hist.length, done, notesMode]);

  useEffect(() => {
    api.feedback(mode === "tutorial" ? t.startTutorial : t.start, "info", "hand-pointing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keys = useGridKeys(n, n, (i) => {
    setSelected(i);
    const v = stRef.current.values[i];
    if (!notesMode && !given(i)) place(i, (v % n) + 1);
  });
  // Keep selection in step with keyboard focus.
  const onKeyDown = (e: KeyboardEvent) => {
    const d = Number(e.key);
    if (Number.isInteger(d) && d >= 1 && d <= n) {
      e.preventDefault();
      setSelected(keys.focus);
      if (notesMode) toggleNote(keys.focus, d);
      else place(keys.focus, d);
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
      e.preventDefault();
      place(keys.focus, 0);
      return;
    }
    if (e.key === "n" || e.key === "N") {
      setNotesMode((m) => !m);
      return;
    }
    keys.onKeyDown(e);
    if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End") {
      const r = Math.floor(keys.focus / n),
        c = keys.focus % n;
      const next =
        e.key === "ArrowUp"
          ? Math.max(0, r - 1) * n + c
          : e.key === "ArrowDown"
            ? Math.min(n - 1, r + 1) * n + c
            : e.key === "ArrowLeft"
              ? r * n + Math.max(0, c - 1)
              : e.key === "ArrowRight"
                ? r * n + Math.min(n - 1, c + 1)
                : e.key === "Home"
                  ? r * n
                  : r * n + n - 1;
      setSelected(next);
    }
  };

  const lastR = Math.floor(last / n),
    lastC = last % n;
  const hintTarget = typeof hint?.target === "number" ? hint.target : -1;
  const selVal = selected >= 0 ? st.values[selected] : 0;
  // Peers are the selected cell's row, column and box.
  const peerSet = new Set(selected >= 0 ? g.peers[selected] : []);
  const counts = digitCounts(st.values, n);
  const noteCols = puzzle.boxW;
  const noteRows = Math.ceil(n / noteCols);
  const width = n * cell + (n - 1) * GAP + PAD * 2; // box lines are as wide as cell gaps (LINE === GAP)
  const cols = trackList(n, puzzle.boxW, cell, GAP, LINE);
  const rows = trackList(n, puzzle.boxH, cell, GAP, LINE);
  const padCols = n <= 6 ? n : 5;

  return (
    <div className={`flex flex-col items-center gap-3 ${done ? "board-pulse" : ""}`}>
      <div
        role="grid"
        aria-label={t.grid(title, n)}
        aria-rowcount={n}
        aria-colcount={n}
        onKeyDown={onKeyDown}
        className="grid rounded-[12px]"
        style={{
          gridTemplateColumns: cols,
          gridTemplateRows: rows,
          padding: PAD,
          background: "var(--line)",
          boxShadow: `inset 0 0 0 ${PAD}px ${BOX_LINE}`,
          perspective: 600,
        }}
      >
        {/* Box borders, painted into the boundary gap tracks */}
        {boundaryTracks(n, puzzle.boxW).map((track) => (
          <div key={`c${track}`} aria-hidden style={{ gridColumn: track, gridRow: "1 / -1", background: BOX_LINE }} />
        ))}
        {boundaryTracks(n, puzzle.boxH).map((track) => (
          <div key={`r${track}`} aria-hidden style={{ gridRow: track, gridColumn: "1 / -1", background: BOX_LINE }} />
        ))}
        {Array.from({ length: n }, (_, r) => (
          <div role="row" key={r} className="contents">
            {Array.from({ length: n }, (_, c) => {
              const i = r * n + c;
              const v = st.values[i];
              const fixed = given(i);
              const bad = a.bad.has(i);
              const sel = i === selected && !done;
              const glow = i === hintTarget && !done;
              const shade = (Math.floor(r / puzzle.boxH) + Math.floor(c / puzzle.boxW)) % 2 === 1;
              const same = !done && selVal !== 0 && v === selVal && i !== selected;
              const tint = !done && (same || peerSet.has(i));
              const dist = Math.abs(r - lastR) + Math.abs(c - lastC);
              let anim = "";
              if (!done && i === last) anim = bad ? shakeClass(shakeN) : popClass(tapN);
              const ring = glow
                ? "inset 0 0 0 4px var(--accent)"
                : bad
                  ? "inset 0 0 0 3px var(--danger)"
                  : sel
                    ? "inset 0 0 0 3px var(--world)"
                    : undefined;
              const notes = st.notes[i];
              const noteList = notes ? Array.from({ length: n }, (_, k) => k + 1).filter((d) => notes & (1 << (d - 1))) : [];
              return (
                <div
                  key={i}
                  role="gridcell"
                  data-i={i}
                  tabIndex={keys.focus === i ? 0 : -1}
                  aria-selected={sel}
                  aria-readonly={fixed || undefined}
                  aria-label={`${where(i)}, ${v ? v : t.empty}${fixed ? `, ${t.given}` : ""}${noteList.length ? `, ${t.notes(noteList)}` : ""}${bad ? `, ${t.breaksRule}` : ""}`}
                  onClick={() => {
                    keys.setFocus(i);
                    setSelected(i);
                  }}
                  className={`num relative flex cursor-pointer items-center justify-center rounded-[8px] outline-none select-none focus-visible:z-10 ${anim} ${glow ? "hint-ring" : ""} ${same ? "font-extrabold" : fixed ? "font-semibold" : "font-medium"} ${!fixed && !bad ? "text-[var(--world)] [[data-theme=light]_&]:text-[var(--world-ink)]" : ""}`}
                  style={{
                    gridColumn: 2 * c + 1,
                    gridRow: 2 * r + 1,
                    width: cell,
                    height: cell,
                    background: shade ? "var(--surface-raised)" : "color-mix(in srgb, var(--surface-raised) 45%, var(--surface))",
                    color: bad ? "var(--danger)" : fixed ? "var(--text)" : undefined,
                    boxShadow: ring,
                    fontSize: Math.round(cell * 0.5),
                  }}
                >
                  {tint && (
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-[8px]"
                      style={{ background: `color-mix(in srgb, var(--world) ${same ? 30 : 10}%, transparent)` }}
                    />
                  )}
                  {done && <span aria-hidden className="absolute inset-0" style={waveStyle(dist, "var(--world)", 8)} />}
                  {bad && <span aria-hidden className="hatch absolute inset-0 rounded-[8px]" />}
                  {v ? (
                    <span className="relative" style={done ? { color: "#0E0F1A" } : undefined}>
                      {v}
                    </span>
                  ) : noteList.length && !done ? (
                    <span
                      aria-hidden
                      className="relative grid h-full w-full p-[3px] text-[var(--text-muted)]"
                      style={{
                        gridTemplateColumns: `repeat(${noteCols}, 1fr)`,
                        gridTemplateRows: `repeat(${noteRows}, 1fr)`,
                        fontSize: Math.max(9, Math.round(cell / (n <= 6 ? 4.2 : 3.8))),
                        lineHeight: 1,
                      }}
                    >
                      {Array.from({ length: n }, (_, k) => (
                        <span key={k} className="flex items-center justify-center">
                          {notes & (1 << k) ? k + 1 : ""}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Number pad */}
      <div
        className="grid gap-2"
        style={{ width, gridTemplateColumns: `repeat(${padCols}, minmax(0, 1fr))` }}
        role="group"
        aria-label={notesMode ? t.padNotes : t.pad}
      >
        {Array.from({ length: n }, (_, k) => {
          const d = k + 1;
          const full = counts[d] >= n;
          return (
            <button
              key={d}
              type="button"
              disabled={locked}
              onClick={() => enter(d)}
              aria-label={notesMode ? t.note(d) : `${t.number(d)}${full ? `, ${t.allPlaced}` : ""}`}
              className={`toy num relative flex h-12 items-center justify-center rounded-[14px] text-[22px] font-semibold ${notesMode ? "text-[var(--world)] [[data-theme=light]_&]:text-[var(--world-ink)]" : ""}`}
              style={{
                background: "var(--surface-raised)",
                ["--btn-depth" as string]: "var(--depth)",
                boxShadow: "0 5px 0 var(--depth)",
                opacity: full && !notesMode ? 0.4 : 1,
              }}
            >
              {d}
              {notesMode && <Icon name="pencil-simple" size={11} className="absolute top-1.5 right-1.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
