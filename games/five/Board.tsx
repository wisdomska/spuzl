"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardProps, Hint } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useFitHeight, useViewportWidth } from "@/components/game/useBoardSize";
import { play } from "@/lib/audio";
import { sendGuess } from "@/games/_shared/guess";
import { reducedMotion } from "@/games/_shared/fly";
import { LetterKeyboard, type KeyDecor } from "@/games/_shared/LetterKeyboard";
import { FIVE_COPY as t, MARK_SAY } from "@/lib/copy/five";
import { HIT, letterMarks, MISS, NEAR, type FiveCheck, type FivePuzzle, type FiveState, type Mark } from "./rules";

interface Row {
  word: string;
  marks: Mark[];
}

/** Look of each mark. The icon and the spoken name carry the meaning too, so colour is never alone. */
const LOOK: Record<Mark, { bg: string; fg: string; icon: string }> = {
  [HIT]: { bg: "var(--w-word)", fg: "var(--on-accent)", icon: "check" },
  [NEAR]: { bg: "var(--gold)", fg: "var(--on-accent)", icon: "swap" },
  [MISS]: { bg: "var(--surface)", fg: "var(--text-muted)", icon: "minus" },
};
const LEGEND: [Mark, string][] = [
  [HIT, t.legendHit],
  [NEAR, t.legendNear],
  [MISS, t.legendMiss],
];
const CHECKING_AFTER_MS = 250;
/** Tiles fit the width (up to 56 px), then step down (to 30 px) until the page fits the screen's height. */
const MAX_CELL = 56;
const MIN_CELL = 30;

function hintTarget(hint: Hint | null | undefined): { pos: number; letter: string } | null {
  const t = hint?.target as { pos?: unknown; letter?: unknown } | undefined;
  return t && typeof t.pos === "number" && typeof t.letter === "string" ? { pos: t.pos, letter: t.letter } : null;
}

const isMarks = (r: FiveCheck): r is { ok: boolean; word: string; marks: Mark[] } => "marks" in r;

/**
 * Five board (Word Woods). Six rows of five tiles above the SPUZL letter keyboard; the physical keyboard
 * works too. Each counted guess flips its tiles to a mark: right spot (green, check), in the word (gold,
 * swap arrows) or not in it (dark, dash), with the mark in every tile's spoken name. Non-words shake the
 * row and cost nothing. A hint shows one letter in its spot, as a ghost letter with a lightbulb.
 */
export default function FiveBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<FivePuzzle, FiveState>) {
  const { len, tries } = puzzle;
  const [rows, setRows] = useState<Row[]>([]);
  const [typed, setTyped] = useState("");
  const [hinted, setHinted] = useState<{ pos: number; letter: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [shakeN, setShakeN] = useState(0);
  const [flipRow, setFlipRow] = useState(-1);
  const [reduce] = useState(() => reducedMotion());
  const rowsRef = useRef<Row[]>([]);
  const hintedRef = useRef<number[]>(initialState?.hinted?.slice() ?? []);
  const locked = disabled || over || busy;
  // Tiles only show letters (the keyboard takes the taps), so they may shrink to keep the page on one screen.
  const vw = useViewportWidth();
  const cell = useFitHeight(Math.min(MAX_CELL, Math.floor((vw - 84) / 5)), MIN_CELL, tries);

  const stateOf = useCallback(
    (list: Row[]): FiveState =>
      hintedRef.current.length
        ? { guesses: list.map((r) => r.word), hinted: hintedRef.current.slice() }
        : { guesses: list.map((r) => r.word) },
    [],
  );

  const finishLost = useCallback(
    async (list: Row[]) => {
      setOver(true);
      const state = stateOf(list);
      const res = await sendGuess<FiveCheck>(puzzle.ref, { reveal: list.map((r) => r.word) }).catch(() => null);
      const line = res && "reveal" in res ? t.lost(res.reveal) : t.lostNoAnswer;
      api.feedback(line, "danger", "warning");
      api.announce(line);
      api.onFailed?.(state, "out of tries");
    },
    [api, puzzle.ref, stateOf],
  );

  // Resume: replay saved guesses through the server so the tiles get their marks back.
  useEffect(() => {
    const saved = initialState?.guesses ?? [];
    if (!saved.length) {
      api.feedback(mode === "tutorial" ? t.startTutorial : t.start, "info", "hand-pointing");
      return;
    }
    let cancelled = false;
    (async () => {
      setBusy(true);
      const list: Row[] = [];
      for (const w of saved.slice(0, tries)) {
        const res = await sendGuess<FiveCheck>(puzzle.ref, w).catch(() => null);
        if (cancelled || !res || !isMarks(res)) break;
        list.push({ word: res.word, marks: res.marks });
      }
      if (cancelled) return;
      rowsRef.current = list;
      setRows(list);
      setBusy(false);
      const won = list.some((r) => r.marks.every((m) => m === HIT));
      if (won) setOver(true);
      else if (list.length >= tries) void finishLost(list);
      else api.feedback(t.triesLeft(tries - list.length), "info", "hand-pointing");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A server hint: keep the letter as a ghost in its spot (adjusted during render, so no extra effect pass).
  const [seenHint, setSeenHint] = useState(hint);
  if (hint !== seenHint) {
    setSeenHint(hint);
    const target = hintTarget(hint);
    if (target && !hinted.some((x) => x.pos === target.pos)) setHinted([...hinted, target]);
  }
  // ...and save the spot with the state, so the next hint shows a new one.
  useEffect(() => {
    const target = hintTarget(hint);
    if (!target || hintedRef.current.includes(target.pos)) return;
    hintedRef.current = [...hintedRef.current, target.pos];
    api.onMove(stateOf(rowsRef.current));
  }, [hint, api, stateOf]);

  const onLetter = useCallback(
    (ch: string) => {
      if (locked) return;
      setTyped((w) => (w.length < len ? w + ch : w));
    },
    [len, locked],
  );
  const onBackspace = useCallback(() => {
    if (locked) return;
    setTyped((w) => w.slice(0, -1));
  }, [locked]);
  const clearRow = useCallback(() => {
    if (locked) return;
    setTyped("");
  }, [locked]);

  const shake = useCallback(() => setShakeN((k) => k + 1), []);

  const submit = useCallback(async () => {
    if (locked) return;
    const word = typed;
    if (word.length < len) {
      shake();
      api.feedback(t.tooShort, "info", "info");
      api.announce(t.tooShort);
      return;
    }
    if (rowsRef.current.some((r) => r.word === word)) {
      shake();
      api.feedback(t.repeat(word), "info", "info");
      api.announce(t.repeat(word));
      return;
    }
    setBusy(true);
    const slow = window.setTimeout(() => api.feedback(t.checking, "info", "hourglass"), CHECKING_AFTER_MS);
    let res: FiveCheck;
    try {
      res = await sendGuess<FiveCheck>(puzzle.ref, word);
    } catch {
      window.clearTimeout(slow);
      setBusy(false);
      api.feedback(t.offline, "danger", "wifi-slash");
      api.announce(t.offline);
      return;
    }
    window.clearTimeout(slow);
    setBusy(false);
    if (!isMarks(res)) {
      // Not a word (or not five letters): the try is not spent, and it is not a slip.
      shake();
      play("fizzle");
      const line = "invalid" in res && res.invalid === "length" ? t.tooShort : t.notWord(word);
      api.feedback(line, "info", "info");
      api.announce(line);
      return;
    }
    const list = [...rowsRef.current, { word: res.word, marks: res.marks }];
    rowsRef.current = list;
    setRows(list);
    setTyped("");
    setFlipRow(list.length - 1);
    const state = stateOf(list);
    const parts = [...res.word].map((ch, k) => `${ch}, ${MARK_SAY[res.marks[k]]}`);
    const say = t.guessSay(list.length, res.word, parts);
    if (res.ok) {
      setOver(true);
      res.marks.forEach((_, k) => setTimeout(() => play("chime", { step: k }), reduce ? 0 : k * 60));
      api.onMove(state, { correctStreak: 1 });
      api.feedback(t.solved(list.length), "success", "check-circle");
      api.announce(`${say} ${t.solved(list.length)}`);
      setTimeout(() => play("jingle"), 200);
      api.onSolved(state);
      return;
    }
    play("pop", { step: list.length });
    api.onMove(state);
    const left = tries - list.length;
    if (left <= 0) {
      api.announce(say);
      void finishLost(list);
      return;
    }
    const hits = res.marks.filter((m) => m === HIT).length;
    const line = hits ? t.close(hits, left) : t.cold(left);
    api.feedback(line, "info", "hand-pointing");
    api.announce(`${say} ${line}`);
  }, [api, finishLost, len, locked, puzzle.ref, reduce, shake, stateOf, tries, typed]);

  useEffect(() => {
    api.setControls([
      { id: "undo", label: t.undo, icon: "arrow-u-up-left", onPress: clearRow, disabled: locked || !typed },
      { id: "hint", label: t.hintLabel, icon: "lightbulb", onPress: () => {}, tone: "gold", disabled: over },
    ]);
  }, [api, clearRow, locked, typed, over]);

  const keyMarks = useMemo(() => letterMarks(rows), [rows]);
  const decorate = useCallback(
    (ch: string): KeyDecor | undefined => {
      const m = keyMarks[ch];
      if (m === undefined) return undefined;
      return {
        background: LOOK[m].bg,
        color: LOOK[m].fg,
        badge: <Icon name={LOOK[m].icon} size={10} />,
        say: t.keySay(ch, m),
      };
    },
    [keyMarks],
  );

  const won = rows.some((r) => r.marks.every((m) => m === HIT));
  const current = rows.length;

  return (
    <div className={`short:gap-1.5 flex w-full max-w-[400px] flex-col items-center gap-2 ${won ? "board-pulse" : ""}`}>
      <div className="short:gap-1 short:p-2 flex flex-col gap-1.5 rounded-[20px] p-2.5" style={{ background: "var(--board-bg)" }}>
        <div role="grid" aria-label={t.grid} aria-readonly aria-busy={busy} className="flex flex-col gap-1">
          {Array.from({ length: tries }, (_, r) => {
            const row = rows[r];
            const isCurrent = r === current && !over;
            const shaking = isCurrent && shakeN > 0;
            return (
              <div key={r} role="row" className={`flex gap-1 ${shaking ? (shakeN % 2 ? "cell-shake-a" : "cell-shake-b") : ""}`}>
                {Array.from({ length: len }, (_, c) => {
                  const mark = row ? row.marks[c] : undefined;
                  const look = mark === undefined ? null : LOOK[mark];
                  const ghost = isCurrent && !typed[c] ? hinted.find((h) => h.pos === c) : undefined;
                  const letter = row ? row.word[c] : isCurrent ? (typed[c] ?? "") : "";
                  const flip = row && r === flipRow && !reduce;
                  return (
                    <div
                      key={c}
                      role="gridcell"
                      aria-label={t.cellSay(r + 1, c + 1, letter || ghost?.letter || "", look ? MARK_SAY[mark!] : null, !!ghost)}
                      className={`relative flex items-center justify-center rounded-[10px] font-bold ${isCurrent && typed[c] && c === typed.length - 1 ? "cell-pop-a" : ""}`}
                      style={{
                        width: cell,
                        height: cell,
                        fontSize: Math.round(cell * 0.5),
                        background: look ? look.bg : "var(--surface-raised)",
                        color: look ? look.fg : ghost ? "var(--text-muted)" : "var(--text)",
                        boxShadow: look
                          ? "none"
                          : ghost
                            ? "inset 0 0 0 3px var(--gold)"
                            : letter
                              ? "inset 0 0 0 2px var(--text-muted)"
                              : "inset 0 0 0 2px var(--line)",
                        animation: flip ? `cell-flip 420ms var(--ease-out) ${c * 90}ms both` : undefined,
                      }}
                    >
                      <span aria-hidden>{letter || ghost?.letter}</span>
                      {look && (
                        <span aria-hidden className="absolute top-1 right-1 flex leading-none opacity-80">
                          <Icon name={look.icon} size={12} />
                        </span>
                      )}
                      {ghost && (
                        <span aria-hidden className="absolute top-1 right-1 flex leading-none" style={{ color: "var(--gold)" }}>
                          <Icon name="lightbulb" size={12} />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <ul aria-label={t.legend} className="short:pt-0 m-0 flex list-none justify-center gap-3 p-0 pt-1">
          {LEGEND.map(([m, label]) => (
            <li key={m} className="text-muted flex items-center gap-1 text-[12px] font-medium">
              <span
                aria-hidden
                className="flex size-4 items-center justify-center rounded-[4px]"
                style={{ background: LOOK[m].bg, color: LOOK[m].fg, boxShadow: m === MISS ? "inset 0 0 0 1px var(--line)" : undefined }}
              >
                <Icon name={LOOK[m].icon} size={10} />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>

      {!over && (
        <LetterKeyboard
          onLetter={onLetter}
          onBackspace={onBackspace}
          onEnter={() => void submit()}
          enterLabel={t.enter}
          compact
          disabled={locked}
          decorate={decorate}
        />
      )}
    </div>
  );
}
