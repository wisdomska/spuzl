"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { play } from "@/lib/audio";
import { sendGuess } from "@/games/_shared/guess";
import { ROUNDS, type RemixCheck, type RemixPuzzle, type RemixState } from "./rules";

const INK = "#0E0F1A";

/**
 * Remix board. Three rounds; each shows a scrambled word as letter tiles. Tap tiles (or type) to fill the
 * answer slots, tap a slot to send its letter back. A full row is checked on the server; right answers
 * flip to world green and the next round slides in.
 */
export default function RemixBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<RemixPuzzle, RemixState>) {
  const [answers, setAnswers] = useState<string[]>(() => initialState?.answers?.slice(0, ROUNDS) ?? []);
  const round = Math.min(answers.length, ROUNDS - 1);
  const [order, setOrder] = useState<number[]>(() => puzzle.rounds[round].letters.map((_, i) => i));
  const [picks, setPicks] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [shakeN, setShakeN] = useState(0);
  const [flash, setFlash] = useState(false);
  const [tapN, setTapN] = useState(0);
  const streak = useRef(0);
  const reduce = useReducedMotion();
  const done = answers.length >= ROUNDS;
  const off = disabled || done || busy || flash;
  const letters = puzzle.rounds[round].letters;
  const word = picks.map((i) => letters[i]).join("");
  const start = puzzle.starts?.[round];

  useEffect(() => {
    api.feedback(
      mode === "tutorial" ? "Tap the letters in order to spell the word." : `Round ${round + 1} of ${ROUNDS}. Unscramble it.`,
      "info",
      "shuffle",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = useCallback(
    async (w: string) => {
      setBusy(true);
      let res: RemixCheck;
      try {
        res = await sendGuess<RemixCheck>(puzzle.ref, { round, word: w });
      } catch {
        setBusy(false);
        api.feedback("No connection. Press Enter to try again.", "danger", "wifi-slash");
        return;
      }
      setBusy(false);
      if (!res.ok) {
        streak.current = 0;
        setShakeN((n) => n + 1);
        api.ruleBreak("Not the word. Try another order.");
        api.onMove({ answers }, { mistake: true });
        setTimeout(() => setPicks([]), 380);
        return;
      }
      w.split("").forEach((_, k) => setTimeout(() => play("chime", { step: k }), k * 40));
      const next = [...answers, w];
      setFlash(true);
      api.announce(`${w}. Round ${round + 1} solved.`);
      api.onMove({ answers: next }, { correctStreak: ++streak.current });
      setTimeout(() => {
        setFlash(false);
        setAnswers(next);
        setPicks([]);
        if (next.length >= ROUNDS) {
          play("jingle");
          api.feedback("Three for three. Remixed.", "success", "check-circle");
          api.onSolved({ answers: next });
        } else {
          setOrder(puzzle.rounds[next.length].letters.map((_, i) => i));
          api.feedback(`Round ${next.length + 1} of ${ROUNDS}.`, "info", "shuffle");
          api.announce(`Round ${next.length + 1}. Letters: ${puzzle.rounds[next.length].letters.join(", ")}`);
        }
      }, 650);
    },
    [api, answers, puzzle.ref, puzzle.rounds, round],
  );

  const pick = useCallback(
    (i: number) => {
      if (off || picks.includes(i)) return;
      const next = [...picks, i];
      setPicks(next);
      setTapN((t) => t + 1);
      play("pop", { step: next.length });
      api.announce(`${letters[i]}. ${next.map((k) => letters[k]).join("")}`);
      if (next.length === letters.length) void submit(next.map((k) => letters[k]).join(""));
    },
    [off, picks, letters, api, submit],
  );
  const unpick = useCallback((slot: number) => !off && setPicks((p) => p.filter((_, k) => k !== slot)), [off]);

  // typing picks the first free tile with that letter
  useEffect(() => {
    if (off) return;
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Backspace") {
        e.preventDefault();
        setPicks((p) => p.slice(0, -1));
        return;
      }
      const k = e.key.toUpperCase();
      if (k.length !== 1) return;
      const i = order.find((x) => letters[x] === k && !picks.includes(x));
      if (i !== undefined) {
        e.preventDefault();
        pick(i);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [off, order, letters, picks, pick]);

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
  }, []);

  useEffect(() => {
    api.setControls([
      { id: "shuffle", label: "Shuffle", icon: "shuffle", onPress: shuffle, disabled: off },
      { id: "clear", label: "Clear", icon: "eraser", onPress: () => setPicks([]), disabled: !picks.length || off },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, shuffle, picks.length, off]);

  const hintPrefix =
    (hint?.target as { round?: number; prefix?: string } | undefined)?.round === round ? (hint!.target as { prefix: string }).prefix : "";
  const tile = 48;

  return (
    <div className="flex w-full max-w-[400px] flex-col items-center gap-5">
      {/* rounds */}
      <div
        className="flex items-center gap-2"
        role="img"
        aria-label={`Round ${Math.min(answers.length + 1, ROUNDS)} of ${ROUNDS}, ${answers.length} solved`}
      >
        {Array.from({ length: ROUNDS }, (_, k) => (
          <span
            key={k}
            className="flex h-8 items-center gap-1 rounded-[10px] px-2.5 text-[13px] font-bold"
            style={{
              background: k < answers.length ? "var(--world)" : k === round ? "var(--surface-raised)" : "var(--surface)",
              color: k < answers.length ? INK : "var(--text-muted)",
            }}
          >
            {k < answers.length ? <Icon name="check" size={12} /> : null}
            {k < answers.length ? answers[k] : `Round ${k + 1}`}
          </span>
        ))}
      </div>

      {/* answer slots */}
      <div
        className={`flex gap-1.5 ${shakeN && !flash ? (shakeN % 2 ? "cell-shake-a" : "cell-shake-b") : ""}`}
        role="group"
        aria-label={`Your word: ${word || "empty"}`}
        style={{ perspective: 600 }}
      >
        {letters.map((_, k) => {
          const ch = picks[k] !== undefined ? letters[picks[k]] : "";
          const ghost = !ch && (k === 0 && start ? start : (hintPrefix[k] ?? ""));
          return (
            <button
              key={`${round}-${k}`}
              type="button"
              onClick={() => unpick(k)}
              aria-label={ch ? `Slot ${k + 1}, ${ch}. Tap to remove.` : `Slot ${k + 1}, empty`}
              className={`font-display flex items-center justify-center rounded-[12px] text-[22px] font-extrabold ${ch && k === picks.length - 1 ? (tapN % 2 ? "cell-pop-a" : "cell-pop-b") : ""}`}
              style={{
                width: tile - 4,
                height: tile + 4,
                background: flash ? "var(--world)" : ch ? "var(--surface-raised)" : "transparent",
                color: flash ? INK : "var(--text)",
                boxShadow: flash ? "none" : ch ? "0 3px 0 var(--depth)" : "inset 0 0 0 2px var(--line)",
                animation: flash ? `cell-flip 500ms var(--ease-out) ${k * 70}ms both` : undefined,
              }}
            >
              {ch || (ghost ? <span style={{ opacity: 0.4 }}>{ghost}</span> : "")}
            </button>
          );
        })}
      </div>

      {/* scrambled tiles */}
      <div
        role="grid"
        aria-label="Scrambled letters"
        className="flex flex-wrap justify-center gap-2 rounded-[20px] p-3"
        style={{ background: "var(--board-bg)" }}
      >
        <div role="row" className="contents">
          {order.map((i) => {
            const used = picks.includes(i);
            return (
              // stable key per tile, so Shuffle slides tiles to their new places instead of redrawing them
              <motion.button
                key={`${round}-${i}`}
                layout={reduce ? false : "position"}
                transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
                type="button"
                role="gridcell"
                onClick={() => pick(i)}
                disabled={off || used}
                aria-label={`${letters[i]}${used ? ", used" : ""}`}
                className="toy font-display flex items-center justify-center rounded-[14px] text-[24px] font-extrabold"
                style={{
                  width: tile,
                  height: tile,
                  background: used ? "var(--surface)" : "var(--surface-raised)",
                  color: used ? "transparent" : "var(--text)",
                  ["--btn-depth" as string]: "var(--depth)",
                  opacity: used ? 0.5 : 1,
                  transition: "opacity 120ms var(--ease-out)",
                }}
              >
                {letters[i]}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
