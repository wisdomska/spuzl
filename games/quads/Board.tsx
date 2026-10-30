"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { sendGuess } from "@/games/_shared/guess";
import { reducedMotion } from "@/games/_shared/fly";
import { setKey, SLIPS, type QuadsCheck, type QuadsPuzzle, type QuadsState, type SolvedGroup } from "./rules";

const INK = "#0E0F1A";
const EASE = [0.23, 1, 0.32, 1] as const;

const fontFor = (w: string) =>
  w.length >= 11 ? 9.5 : w.length >= 10 ? 10 : w.length >= 9 ? 10.5 : w.length >= 8 ? 11 : w.length >= 7 ? 12 : 13;

/**
 * Quads board (Game Boards: Quads). 4 × 4 word tiles; tap four to lift them, then Submit. Solved groups
 * become world-green bars with their name and words. Four slips, shown as dots that empty (hollow, so
 * the state never relies on colour). One away? The feedback line says so.
 */
export default function QuadsBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<QuadsPuzzle, QuadsState>) {
  const [order, setOrder] = useState<string[]>(() => puzzle.words.slice());
  const [solved, setSolved] = useState<SolvedGroup[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [slips, setSlips] = useState(SLIPS);
  const [shakeN, setShakeN] = useState(0);
  const [shaking, setShaking] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
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
      api.feedback(
        mode === "tutorial"
          ? "Tap four words that share something, then Submit."
          : puzzle.starter
            ? `Starter group: ${puzzle.starter}.`
            : "Find four groups of four.",
        "info",
        "hand-pointing",
      );
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
        api.announce(`${w} put down. ${selected.length - 1} of 4 lifted.`);
        return;
      }
      if (selected.length >= 4) {
        api.announce("Four already lifted. Submit or put one down.");
        return;
      }
      setSelected([...selected, w]);
      play("pop", { step: selected.length });
      api.announce(`${w} lifted. ${selected.length + 1} of 4.`);
    },
    [api, locked, selected],
  );

  const submit = useCallback(async () => {
    if (locked || selected.length !== 4) return;
    const words = selected.slice();
    if (guessesRef.current.some((g) => setKey(g) === setKey(words))) {
      api.feedback("You tried those four already.", "info", "info");
      api.announce("You tried those four already.");
      return;
    }
    setBusy(true);
    let res: QuadsCheck;
    try {
      res = await sendGuess<QuadsCheck>(puzzle.ref, words);
    } catch {
      setBusy(false);
      api.feedback("No connection. Submit again.", "danger", "wifi-slash");
      return;
    }
    setBusy(false);
    const next = [...guessesRef.current, words];
    guessesRef.current = next;
    const state = { guesses: next };
    if (res.ok) {
      streak.current++;
      apply(res, words, true);
      res.group.words.forEach((_, k) => setTimeout(() => play("chime", { step: k + res.group.level }), k * 40));
      const done = solved.length + 1 === 4;
      api.feedback(
        `${res.group.label}. ${done ? "All four groups." : `${solved.length + 1} of 4 groups.`}`,
        done ? "success" : "info",
        "check-circle",
      );
      api.announce(`Group found: ${res.group.label}: ${res.group.words.join(", ")}.`);
      api.onMove(state, { correctStreak: streak.current });
      if (done) {
        setOver(true);
        setTimeout(() => play("jingle"), 200);
        api.onSolved(state);
      }
      return;
    }
    if (res.invalid) return;
    streak.current = 0;
    apply(res, words, true);
    const left = slips - 1;
    setTimeout(() => setShaking([]), 400);
    api.ruleBreak(res.oneAway ? "One away." : "Not a group.");
    api.onMove(state, { mistake: true });
    if (left <= 0) {
      setOver(true);
      api.feedback("Out of slips. The groups stay hidden this time.", "danger", "warning");
      api.onFailed?.(state, "out of slips");
    } else {
      api.announce(`${res.oneAway ? "One away" : "Not a group"}. ${left} ${left === 1 ? "slip" : "slips"} left.`);
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
    api.announce("Words shuffled.");
  }, [api]);

  useEffect(() => {
    api.setControls([
      { id: "shuffle", label: "Shuffle", icon: "shuffle", onPress: shuffle, disabled: locked },
      { id: "deselect", label: "Deselect", icon: "x", onPress: () => setSelected([]), disabled: !selected.length || locked },
      {
        id: "submit",
        label: "Submit",
        icon: "check",
        onPress: () => void submit(),
        disabled: selected.length !== 4 || locked,
        tone: selected.length === 4 ? "world" : "default",
      },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, shuffle, submit, selected.length, locked]);

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
        {solved.map((g) => (
          <motion.div
            key={g.label}
            layout
            initial={{ opacity: 0, transform: "scale(0.97)" }}
            animate={{ opacity: 1, transform: "scale(1)" }}
            transition={{ duration: dur, ease: EASE }}
            role="status"
            className="flex h-[52px] flex-col items-center justify-center rounded-[12px] px-2 text-center"
            style={{ background: "var(--world)", color: INK }}
          >
            <span
              className="flex items-center gap-1.5 text-[13px] leading-tight font-extrabold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              <Icon name="check" size={12} />
              {g.label}
            </span>
            <span className="truncate text-[13px] leading-tight font-medium">{g.words.join(" · ")}</span>
          </motion.div>
        ))}
      </AnimatePresence>

      <div
        role="grid"
        aria-label="Quads words"
        aria-rowcount={Math.ceil(remaining.length / 4)}
        aria-colcount={4}
        onKeyDown={keys.onKeyDown}
        className="grid grid-cols-4 gap-1.5"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {remaining.map((w, i) => {
            const sel = selected.includes(w);
            const shake = shaking.includes(w);
            return (
              <motion.div
                key={w}
                layout
                exit={{ opacity: 0, transform: "scale(0.96)" }}
                transition={{ duration: dur, ease: EASE }}
                role="gridcell"
                data-i={i}
                tabIndex={keys.focus === i ? 0 : -1}
                aria-selected={sel}
                aria-label={`${w}${sel ? ", lifted" : ""}${hinted.includes(w) ? ", hinted" : ""}`}
                onFocus={() => keys.setFocus(i)}
                onClick={() => {
                  keys.setFocus(i);
                  toggle(w);
                }}
                className={`flex h-[52px] min-w-0 cursor-pointer items-center justify-center rounded-[12px] px-[5px] outline-none ${shake ? (shakeN % 2 ? "cell-shake-a" : "cell-shake-b") : ""} ${hinted.includes(w) ? "hint-ring" : ""}`}
                style={{
                  background: sel ? "var(--text)" : "var(--surface-raised)",
                  color: sel ? "var(--bg)" : "var(--text)",
                  boxShadow: `0 3px 0 ${sel ? "var(--text-muted)" : "var(--depth)"}${shake ? ", inset 0 0 0 2px var(--danger)" : hinted.includes(w) ? ", inset 0 0 0 3px var(--gold)" : ""}`,
                  translate: sel ? "0 -3px" : "0 0",
                  transition: "translate 120ms var(--ease-out), background-color 120ms var(--ease-out), color 120ms var(--ease-out)",
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
        <span className="text-muted text-[13px] font-medium">Slips left</span>
        <div className="flex gap-[5px]" role="img" aria-label={`${slips} of ${SLIPS} slips left`}>
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
