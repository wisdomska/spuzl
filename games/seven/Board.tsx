"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardProps, ControlSpec } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { play } from "@/lib/audio";
import { loadWords } from "@/games/_shared/words/lazy";
import { flyLetters, FLY_STAGGER_MS } from "@/games/_shared/fly";
import { answersFrom, isPangram, MIN_LEN, rankFor, RANKS, REASON_COPY, shapeError, wordScore, type SevenPuzzle, type SevenState } from "./rules";

const INK = "#0E0F1A";
const HEX_W = 84;
const HEX_H = 74;
const HEX = "polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0% 50%)";

/**
 * Seven board. A honeycomb of seven letters (centre in world green, required in every word), the word
 * being built above it, score and rank bar on top, found words below. Words are checked against the
 * shared word list, lazy-loaded on first play; the server re-scores the found list on submit.
 */
export default function SevenBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<SevenPuzzle, SevenState>) {
  const { centre, maxScore, target } = puzzle;
  const [outer, setOuter] = useState<string[]>(() => puzzle.letters.slice());
  const [found, setFound] = useState<string[]>(() => initialState?.found?.slice() ?? []);
  const [word, setWord] = useState("");
  const [answers, setAnswers] = useState<Set<string> | null>(null);
  const [shakeN, setShakeN] = useState(0);
  const [bad, setBad] = useState(false);
  const [done, setDone] = useState(false);
  const [focus, setFocus] = useState(0);
  const [popKey, setPopKey] = useState<string | null>(null);
  const letterEls = useRef<(HTMLSpanElement | null)[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const streak = useRef(0);
  const off = disabled || done;

  const score = useMemo(() => found.reduce((s, w) => s + wordScore(w, isPangram(w, centre, puzzle.letters)), 0), [found, centre, puzzle.letters]);
  const rank = rankFor(score, maxScore);
  const reached = score >= target;

  useEffect(() => {
    let live = true;
    loadWords().then((set) => live && setAnswers(new Set(answersFrom(set, centre, puzzle.letters))));
    api.feedback(mode === "tutorial" ? "Tap letters to make a word. The centre letter is in every word." : `Reach ${target} points to finish. Find the Spuzl word for a bonus.`, "info", "hand-pointing");
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = useCallback(
    (l: string) => {
      if (off || word.length >= 15) return;
      setWord((w) => w + l);
      setBad(false);
      play("tick", { step: word.length + 1 });
      api.announce(`${l}. ${word + l}`);
    },
    [off, word, api],
  );
  const del = useCallback(() => {
    setWord((w) => w.slice(0, -1));
    setBad(false);
  }, []);
  const shuffle = useCallback(() => {
    setOuter((o) => {
      const a = o.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    });
    play("swoosh");
    api.announce("Letters shuffled.");
  }, [api]);

  const finish = useCallback(
    (list: string[]) => {
      setDone(true);
      play("jingle");
      api.feedback(`Finished with ${list.reduce((s, w) => s + wordScore(w, isPangram(w, centre, puzzle.letters)), 0)} points.`, "success", "check-circle");
      api.announce("Finished.");
      api.onSolved({ found: list });
    },
    [api, centre, puzzle.letters],
  );

  const submit = useCallback(async () => {
    if (off || !word) return;
    const w = word;
    const fail = (reason: keyof typeof REASON_COPY) => {
      streak.current = 0;
      setBad(true);
      setShakeN((n) => n + 1);
      if (reason === "dupe") {
        api.feedback(REASON_COPY.dupe, "info", "info");
        api.announce(REASON_COPY.dupe);
      } else api.ruleBreak(REASON_COPY[reason]);
      setTimeout(() => {
        setWord("");
        setBad(false);
      }, 420);
    };
    const shape = shapeError(centre, puzzle.letters, w);
    if (shape) return fail(shape);
    if (!answers) {
      api.feedback("Loading the word list. Try again in a moment.", "info", "hourglass");
      return;
    }
    if (!answers.has(w)) return fail("word");
    if (found.includes(w)) return fail("dupe");
    const pangram = isPangram(w, centre, puzzle.letters);
    const pts = wordScore(w, pangram);
    const next = [...found, w];
    w.split("").forEach((_, k) => setTimeout(() => play("chime", { step: k }), k * FLY_STAGGER_MS));
    api.feedback(pangram ? `Spuzl word! ${w}, plus ${pts}.` : `${w}, plus ${pts}.`, pangram ? "success" : "info", pangram ? "star" : "check-circle");
    api.announce(`${w}, ${pts} points. Score ${score + pts}. Rank ${rankFor(score + pts, maxScore).name}.`);
    api.onMove({ found: next }, { correctStreak: ++streak.current });
    await flyLetters(w.split("").map((_, k) => letterEls.current[k]), listRef.current, w.split(""));
    setFound(next);
    setPopKey(w);
    setWord("");
    if (next.length === answers.size) finish(next);
  }, [off, word, centre, puzzle.letters, answers, found, api, score, maxScore, finish]);

  // physical keyboard
  useEffect(() => {
    if (off) return;
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toUpperCase();
      if (k.length === 1 && (k === centre || puzzle.letters.includes(k))) {
        e.preventDefault();
        add(k);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        del();
      } else if (e.key === "Enter" && !(e.target as HTMLElement)?.closest?.("[role=grid]")) {
        e.preventDefault();
        void submit();
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [off, centre, puzzle.letters, add, del, submit]);

  useEffect(() => {
    const ctl: ControlSpec[] = [
      { id: "delete", label: "Delete", icon: "backspace", onPress: del, disabled: !word || off },
      { id: "shuffle", label: "Shuffle", icon: "shuffle", onPress: shuffle, disabled: off },
      { id: "enter", label: "Enter", icon: "check", onPress: () => void submit(), disabled: word.length < 1 || off, tone: word.length >= MIN_LEN ? "world" : "default" },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ];
    if (reached && !done) ctl.push({ id: "finish", label: "Finish", icon: "flag-checkered", onPress: () => finish(found), disabled: false, tone: "default" });
    api.setControls(ctl);
  }, [api, del, shuffle, submit, finish, word, off, reached, done, found]);

  const tiles = [centre, ...outer];
  const pos = [
    [0, 0],
    [0, -HEX_H],
    [HEX_W * 0.75, -HEX_H / 2],
    [HEX_W * 0.75, HEX_H / 2],
    [0, HEX_H],
    [-HEX_W * 0.75, HEX_H / 2],
    [-HEX_W * 0.75, -HEX_H / 2],
  ];
  const W = HEX_W * 2.6 + 8, H = HEX_H * 3.12 + 8;
  const hintT = hint?.target as { start?: string; len?: number } | undefined;
  const nextRank = RANKS.find((r) => Math.ceil(r.pct * maxScore) > score);

  const onGridKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") setFocus((f) => (f + 1) % 7);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") setFocus((f) => (f + 6) % 7);
    else if (e.key === " ") add(tiles[focus]);
    else if (e.key === "Enter") void submit();
    else return;
    e.preventDefault();
  };

  return (
    <div className="flex w-full max-w-[400px] flex-col items-center gap-4">
      {/* score + rank */}
      <div className="flex w-full flex-col gap-2 rounded-[16px] p-3" style={{ background: "var(--surface)" }}>
        <div className="flex items-baseline justify-between">
          <span className="font-display text-[16px] font-extrabold">{rank.name}</span>
          <span className="num text-[14px] text-muted">
            <span className="text-[18px] font-semibold text-[var(--text)]">{score}</span> pts · finish at {target}
          </span>
        </div>
        <div className="relative h-2 rounded-full" style={{ background: "var(--surface-raised)" }} role="progressbar" aria-valuemin={0} aria-valuemax={maxScore} aria-valuenow={score} aria-label={`Score ${score} of ${maxScore}, rank ${rank.name}`}>
          <div className="absolute inset-y-0 left-0 w-full origin-left rounded-full" style={{ background: "var(--world)", transform: `scaleX(${Math.min(1, score / Math.max(1, maxScore))})`, transition: "transform 320ms var(--ease-out)" }} />
          <span aria-hidden className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${(target / Math.max(1, maxScore)) * 100}%`, background: reached ? "var(--gold)" : "var(--bg)", boxShadow: "0 0 0 2px var(--gold)" }} />
        </div>
        <span className="text-[13px] text-muted">
          {found.length} of {puzzle.total} words{nextRank ? ` · ${Math.ceil(nextRank.pct * maxScore) - score} to ${nextRank.name}` : ""}
        </span>
      </div>

      {/* word being built */}
      <div className={`flex h-12 items-center justify-center ${bad ? (shakeN % 2 ? "cell-shake-a" : "cell-shake-b") : ""}`} aria-live="off">
        {word ? (
          word.split("").map((ch, k) => (
            <span
              key={k}
              ref={(el) => {
                letterEls.current[k] = el;
              }}
              className="font-display text-[30px] font-extrabold tracking-[0.04em]"
              style={{ color: bad ? "var(--danger)" : ch === centre ? "var(--world)" : "var(--text)" }}
            >
              {ch}
            </span>
          ))
        ) : (
          <span className="text-[15px] text-muted">{hintT?.start ? `Hint: ${hintT.start}${"·".repeat(Math.max(0, (hintT.len ?? 2) - 2))}` : "Tap letters"}</span>
        )}
      </div>

      {/* honeycomb */}
      <div role="grid" aria-label={`Seven letters, centre ${centre}`} onKeyDown={onGridKey} className="relative" style={{ width: W, height: H }}>
        <div role="row" className="contents">
          {tiles.map((l, k) => (
            <button
              key={`${l}${k}`}
              type="button"
              role="gridcell"
              tabIndex={focus === k ? 0 : -1}
              aria-label={`${l}${k === 0 ? ", centre letter, in every word" : ""}`}
              onClick={() => {
                setFocus(k);
                add(l);
              }}
              disabled={off}
              className="press absolute flex items-center justify-center font-display text-[28px] font-extrabold outline-none focus-visible:brightness-125"
              style={{
                width: HEX_W,
                height: HEX_H,
                left: W / 2 - HEX_W / 2 + pos[k][0] * 1.06,
                top: H / 2 - HEX_H / 2 + pos[k][1] * 1.06,
                clipPath: HEX,
                background: k === 0 ? "var(--world)" : "var(--surface-raised)",
                color: k === 0 ? INK : "var(--text)",
                transition: "transform var(--dur-instant) var(--spring-press), left 220ms var(--ease-out), top 220ms var(--ease-out)",
              }}
            >
              {l}
              {k === 0 && <span className="sr-only"> (centre)</span>}
            </button>
          ))}
        </div>
      </div>

      {/* found words */}
      <div ref={listRef} className="flex min-h-11 w-full flex-wrap justify-center gap-1.5 rounded-[16px] p-2.5" style={{ background: "var(--board-bg)" }} aria-label="Words found" role="list">
        {found.length === 0 && <span className="self-center text-[13px] text-muted">Words you find land here.</span>}
        {found
          .slice()
          .sort()
          .map((w) => {
            const pg = isPangram(w, centre, puzzle.letters);
            return (
              <span
                role="listitem"
                key={w}
                className={`flex h-8 items-center gap-1 rounded-[10px] px-2.5 text-[13px] font-bold tracking-[0.03em] ${popKey === w ? "cell-pop-a" : ""}`}
                style={{ background: pg ? "var(--world)" : "var(--surface-raised)", color: pg ? INK : "var(--text)", animation: popKey === w ? "fade-in 160ms var(--ease-out), cell-pop-a 140ms var(--ease-out)" : undefined }}
              >
                {pg && <Icon name="star" size={12} label="Spuzl word" />}
                {w}
              </span>
            );
          })}
      </div>
    </div>
  );
}
