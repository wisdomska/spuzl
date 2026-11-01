"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { BoardProps } from "@/games/types";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { sendGuess } from "@/games/_shared/guess";
import { reducedMotion } from "@/games/_shared/fly";
import { quick } from "@/lib/copy/quick";
import { setKey, SLIPS, type QuadsCheck, type QuadsPuzzle, type QuadsState, type SolvedGroup } from "./rules";

const INK = "#0E0F1A";
const EASE = [0.23, 1, 0.32, 1] as const;
const t = quick.quads;
/** "Checking…" only shows when the server is slow, so quick answers don't flash it */
const CHECKING_AFTER_MS = 250;

/**
 * One colour per difficulty level, 0 most direct .. 3 trickiest: yellow, cyan, orange, violet. They differ
 * in hue and lightness for the common colour-blind types, and the level name is always printed beside
 * the colour, so the colour is never the only signal.
 */
const LEVEL_BG = ["var(--w-number)", "var(--w-line)", "var(--w-shape)", "var(--w-logic)"] as const;
const levelOf = (g: SolvedGroup) => Math.max(0, Math.min(3, g.level));

const fontFor = (w: string) =>
  w.length >= 11 ? 9.5 : w.length >= 10 ? 10 : w.length >= 9 ? 10.5 : w.length >= 8 ? 11 : w.length >= 7 ? 12 : 13;

/**
 * Quads board (Game Boards: Quads). 4 × 4 word tiles; tap four to lift them, then Submit. The lifted four
 * show a "checking" state at once while the server answers. Solved groups become bars coloured by
 * difficulty, each labelled Easy, Medium, Tricky or Hard, with their name and words. Four slips, shown as
 * dots that empty (hollow, so the state never relies on colour). One away? The feedback line says so.
 */
export default function QuadsBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<QuadsPuzzle, QuadsState>) {
  const [order, setOrder] = useState<string[]>(() => puzzle.words.slice());
  const [solved, setSolved] = useState<SolvedGroup[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [slips, setSlips] = useState(SLIPS);
  const [shakeN, setShakeN] = useState(0);
  const [shaking, setShaking] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  /** the four being checked by the server right now */
  const [checking, setChecking] = useState<string[]>([]);
  const [over, setOver] = useState(false);
  const guessesRef = useRef<string[][]>([]);
  const streak = useRef(0);
  const [reduce] = useState(() => reducedMotion());
  const locked = disabled || over || busy;

  const remaining = order.filter((w) => !solved.some((g) => g.words.includes(w)));

  const apply = useCallback((res: QuadsCheck, words: string[], live: boolean) => {
    if (res.ok) {
      setSolved((s) => (s.some((g) => g.label === res.group.label) ? s : [...s, res.group]));
      setSelected([]);
      return 1;
    }
    setSlips((n) => n - 1);
    if (live) {
      setShaking(words);
      setShakeN((k) => k + 1);
    }
    return 0;
  }, []);

  // Resume: replay the saved guesses through the server so solved groups get their names back.
  useEffect(() => {
    const saved = initialState?.guesses ?? [];
    if (!saved.length) {
      api.feedback(mode === "tutorial" ? t.startTutorial : puzzle.starter ? t.starter(puzzle.starter) : t.start, "info", "hand-pointing");
      return;
    }
    let cancelled = false;
    (async () => {
      setBusy(true);
      const seen = new Set<string>();
      for (const g of saved) {
        if (seen.has(setKey(g))) continue;
        seen.add(setKey(g));
        const res = await sendGuess<QuadsCheck>(puzzle.ref, g).catch(() => null);
        if (cancelled || !res) break;
        apply(res, g, false);
      }
      guessesRef.current = saved.map((g) => g.slice());
      setBusy(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(
    (w: string) => {
      if (locked || !w) return;
      if (selected.includes(w)) {
        setSelected(selected.filter((x) => x !== w));
        api.announce(t.putDown(w, selected.length - 1));
        return;
      }
      if (selected.length >= 4) {
        api.announce(t.fourLifted);
        return;
      }
      setSelected([...selected, w]);
      play("pop", { step: selected.length });
      api.announce(t.lifted(w, selected.length + 1));
    },
    [api, locked, selected],
  );

  const submit = useCallback(async () => {
    if (locked || selected.length !== 4) return;
    const words = selected.slice();
    if (guessesRef.current.some((g) => setKey(g) === setKey(words))) {
      api.feedback(t.tried, "info", "info");
      api.announce(t.tried);
      return;
    }
    // Acknowledge at once: the four are marked as checking, and a slow answer gets a "Checking…" line.
    setBusy(true);
    setChecking(words);
    const slow = window.setTimeout(() => {
      api.feedback(t.checking, "info", "hourglass");
      api.announce(t.checking);
    }, CHECKING_AFTER_MS);
    const settle = () => {
      window.clearTimeout(slow);
      setBusy(false);
      setChecking([]);
    };
    let res: QuadsCheck;
    try {
      res = await sendGuess<QuadsCheck>(puzzle.ref, words);
    } catch {
      settle();
      api.feedback(t.offline, "danger", "wifi-slash");
      api.announce(t.offline);
      return;
    }
    settle();
    const next = [...guessesRef.current, words];
    guessesRef.current = next;
    const state = { guesses: next };
    if (res.ok) {
      streak.current++;
      apply(res, words, true);
      res.group.words.forEach((_, k) => setTimeout(() => play("chime", { step: k + res.group.level }), k * 40));
      const found = solved.length + 1;
      const level = t.levels[levelOf(res.group)];
      api.feedback(t.found(res.group.label, level, found), found === 4 ? "success" : "info", "check-circle");
      api.announce(t.foundSay(res.group.label, level, res.group.words, found));
      api.onMove(state, { correctStreak: streak.current });
      const done = found === 4;
      if (done) {
        setOver(true);
        setTimeout(() => play("jingle"), 200);
        api.onSolved(state);
      }
      return;
    }
    if (res.invalid) {
      api.feedback("");
      return;
    }
    streak.current = 0;
    apply(res, words, true);
    const left = slips - 1;
    setTimeout(() => setShaking([]), 400);
    // ruleBreak shows the line, buzzes and announces it once ("One away. 2 slips left.").
    api.ruleBreak(res.oneAway ? t.oneAway(left) : t.notGroup(left));
    api.onMove(state, { mistake: true });
    if (left <= 0) {
      setOver(true);
      api.feedback(t.outOfSlips, "danger", "warning");
      api.announce(t.outOfSlips);
      api.onFailed?.(state, "out of slips");
    }
  }, [api, apply, locked, puzzle.ref, selected, slips, solved.length]);

  const shuffle = useCallback(() => {
    setOrder((o) => {
      const a = o.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    });
    play("swoosh");
    api.announce(t.shuffled);
  }, [api]);

  useEffect(() => {
    api.setControls([
      // Shuffling only moves tiles, so it stays available while a guess is being checked.
      { id: "shuffle", label: t.shuffle, icon: "shuffle", onPress: shuffle, disabled: disabled || over },
      { id: "deselect", label: t.deselect, icon: "x", onPress: () => setSelected([]), disabled: !selected.length || locked },
      {
        id: "submit",
        label: t.submit,
        icon: "check",
        onPress: () => void submit(),
        disabled: selected.length !== 4 || locked,
        tone: selected.length === 4 ? "world" : "default",
      },
      { id: "hint", label: t.hint, icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, shuffle, submit, selected.length, locked, disabled, over]);

  const keys = useGridKeys(
    Math.max(1, Math.ceil(remaining.length / 4)),
    4,
    (i) => toggle(remaining[i]),
    () => void submit(),
  );
  const hinted = Array.isArray(hint?.target) ? (hint!.target as string[]) : [];
  const dur = reduce ? 0.001 : 0.22;

  return (
    <div
      className={`flex w-full max-w-[400px] flex-col gap-1.5 rounded-[20px] p-3 ${over && solved.length === 4 ? "board-pulse" : ""}`}
      style={{ background: "var(--board-bg)" }}
    >
      <AnimatePresence initial={false}>
        {solved.map((g) => {
          const level = t.levels[levelOf(g)];
          return (
            <motion.div
              key={g.label}
              layout
              initial={{ opacity: 0, transform: "scale(0.97)" }}
              animate={{ opacity: 1, transform: "scale(1)" }}
              transition={{ duration: dur, ease: EASE }}
              // Announced once by the board when found; the bar itself is a labelled group, not a live region.
              role="group"
              aria-label={t.groupSay(g.label, level, g.words)}
              data-level={levelOf(g)}
              className="flex h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-[12px] px-2 text-center"
              style={{ background: LEVEL_BG[levelOf(g)], color: INK }}
            >
              <span className="flex max-w-full min-w-0 items-center gap-1.5 text-[13px] leading-tight font-extrabold">
                <span
                  aria-hidden
                  className="flex-none rounded-full px-1.5 text-[10px] leading-[16px] font-bold tracking-[.06em] uppercase"
                  style={{ background: `color-mix(in srgb, ${INK} 16%, transparent)` }}
                >
                  {level}
                </span>
                <span aria-hidden className="truncate" style={{ fontFamily: "var(--font-display)" }}>
                  {g.label}
                </span>
              </span>
              <span aria-hidden className="max-w-full truncate text-[13px] leading-tight font-medium">
                {g.words.join(" · ")}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>

      <div
        role="listbox"
        aria-multiselectable
        aria-orientation="horizontal"
        aria-label={t.grid}
        aria-busy={checking.length > 0}
        onKeyDown={keys.onKeyDown}
        className="grid grid-cols-4 gap-1.5"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {remaining.map((w, i) => {
            const sel = selected.includes(w);
            const shake = shaking.includes(w);
            const check = checking.includes(w);
            return (
              <motion.div
                key={w}
                layout
                exit={{ opacity: 0, transform: "scale(0.96)" }}
                transition={{ duration: dur, ease: EASE }}
                role="option"
                data-i={i}
                tabIndex={keys.focus === i ? 0 : -1}
                aria-selected={sel}
                aria-label={t.wordSay(w, sel, hinted.includes(w), check)}
                onFocus={() => keys.setFocus(i)}
                onClick={() => {
                  keys.setFocus(i);
                  toggle(w);
                }}
                className={`flex h-[52px] min-w-0 cursor-pointer items-center justify-center rounded-[12px] px-[5px] outline-none ${shake ? (shakeN % 2 ? "cell-shake-a" : "cell-shake-b") : ""} ${hinted.includes(w) ? "hint-ring" : ""}`}
                style={{
                  background: sel ? "var(--text)" : "var(--surface-raised)",
                  color: sel ? "var(--bg)" : "var(--text)",
                  boxShadow: `0 3px 0 ${sel ? "var(--text-muted)" : "var(--depth)"}${shake ? ", inset 0 0 0 2px var(--danger)" : check ? ", inset 0 0 0 3px var(--world)" : hinted.includes(w) ? ", inset 0 0 0 3px var(--gold)" : ""}`,
                  translate: sel ? "0 -3px" : "0 0",
                  // Checking: the lifted four get a ring and dim the moment Submit is pressed.
                  opacity: check ? 0.75 : 1,
                  transition:
                    "translate 120ms var(--ease-out), background-color 120ms var(--ease-out), color 120ms var(--ease-out), opacity 120ms var(--ease-out)",
                }}
              >
                <span
                  className="block max-w-full text-center leading-[1.15] font-bold tracking-[0.01em] whitespace-nowrap"
                  style={{ fontSize: fontFor(w) }}
                >
                  {w}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-muted text-[13px] font-medium">{t.slipsLeft}</span>
        <div className="flex gap-[5px]" role="img" aria-label={t.slipsSay(slips, SLIPS)}>
          {Array.from({ length: SLIPS }, (_, k) => (
            <span
              key={k}
              className="size-3 rounded-full"
              style={
                k < slips
                  ? { background: "var(--world)" }
                  : { boxShadow: "inset 0 0 0 2px var(--line)", transition: "box-shadow 180ms var(--ease-out)" }
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
