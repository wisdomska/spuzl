"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { play } from "@/lib/audio";
import { unseal } from "@/games/_shared/cluecave";
import { CLUE_COST, CLUES, judge, scoreFor, sealKey, type HunchPuzzle, type HunchSealed, type HunchState } from "./logic";

const INK = "#0E0F1A";

/**
 * Hunch board (Game Boards: Hunch). Numbered clue rows: open clues show an eye, the newest is ringed,
 * the next locked row reads "Tap to open, costs 20", the rest read "Locked". A typed guess is fuzzy
 * matched; close guesses are "warm". On a hit the rows flip to the world colour in a wave.
 */
export default function HunchBoard({ puzzle, initialState, disabled, mode, api }: BoardProps<HunchPuzzle, HunchState>) {
  const secret = useMemo(() => unseal<HunchSealed>(puzzle.sealed, sealKey(puzzle.ref)), [puzzle]);
  const clues = useMemo(() => [puzzle.first, ...secret.more], [puzzle.first, secret.more]);
  const [state, setState] = useState<HunchState>(() => initialState ?? { opened: 1, guesses: [] });
  const [text, setText] = useState("");
  const [shakeN, setShakeN] = useState(0);
  const [openN, setOpenN] = useState(0);
  const [warm, setWarm] = useState(false);
  const stateRef = useRef(state);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => state.guesses.map((g) => judge(g, secret.accept, secret.warm)), [state.guesses, secret]);
  const solved = results.includes("right");
  const misses = results.filter((r) => r !== "right").length;
  const out = !solved && state.guesses.length >= puzzle.maxGuesses;
  const over = solved || out;
  const locked = disabled || over;

  const commit = useCallback(
    (next: HunchState, info?: { mistake?: boolean }) => {
      stateRef.current = next;
      setState(next);
      api.onMove(next, info);
    },
    [api],
  );

  const openClue = useCallback(() => {
    const s = stateRef.current;
    if (locked || s.opened >= CLUES) return;
    const next = { ...s, opened: s.opened + 1 };
    setOpenN((n) => n + 1);
    play("chime", { step: next.opened });
    commit(next);
    api.feedback(`Clue ${next.opened} open. Worth ${scoreFor(next.opened, misses)} now.`, "info", "eye");
    api.announce(`Clue ${next.opened}: ${clues[next.opened - 1]}`);
  }, [api, clues, commit, locked, misses]);

  const submit = useCallback(() => {
    const s = stateRef.current;
    const guess = text.trim();
    if (locked || !guess) return;
    const r = judge(guess, secret.accept, secret.warm);
    const next = { ...s, guesses: [...s.guesses, guess] };
    setText("");
    if (r === "right") {
      setWarm(false);
      commit(next);
      const n = next.opened;
      play("jingle");
      api.feedback(`${secret.category}. Got it in ${n} ${n === 1 ? "clue" : "clues"}.`, "success", "check-circle");
      api.announce(`Correct. ${secret.category}. Score ${scoreFor(n, misses)}.`);
      api.onSolved(next);
      return;
    }
    setShakeN((k) => k + 1);
    commit(next, { mistake: true });
    const left = puzzle.maxGuesses - next.guesses.length;
    if (left <= 0) {
      api.ruleBreak(`Out of guesses. It was ${secret.category.toLowerCase()}.`);
      api.onFailed?.(next, "out of guesses");
      return;
    }
    if (r === "warm") {
      setWarm(true);
      play("pop", { step: 2 });
      api.feedback(`Warm. "${guess}" is close. ${left} ${left === 1 ? "guess" : "guesses"} left.`, "info", "thermometer-simple");
      api.announce(`Warm. ${left} guesses left.`);
    } else {
      setWarm(false);
      api.ruleBreak(`Not it. ${left} ${left === 1 ? "guess" : "guesses"} left.`);
    }
    inputRef.current?.focus();
  }, [api, commit, locked, misses, puzzle.maxGuesses, secret, text]);

  useEffect(() => {
    api.setControls([
      { id: "open", label: "Open clue", icon: "lock-simple", onPress: openClue, disabled: locked || state.opened >= CLUES },
      { id: "guess", label: "Guess", icon: "check", onPress: submit, tone: locked || !text.trim() ? "default" : "world", disabled: locked || !text.trim() },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, openClue, submit, locked, state.opened, text]);

  useEffect(() => {
    if (mode === "tutorial") api.feedback("Type a guess, or tap a locked card to open the next clue.", "info", "hand-pointing");
    else api.feedback(`${state.opened} ${state.opened === 1 ? "clue" : "clues"} open. Worth ${scoreFor(state.opened, misses)}.`, "info", "eye");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guessesLeft = puzzle.maxGuesses - state.guesses.length;

  return (
    <div className={`w-[min(358px,calc(100vw-36px))] ${solved ? "board-pulse" : ""}`}>
      <div className="flex flex-col gap-[7px] rounded-[20px] p-3.5" style={{ background: "var(--board-bg)", perspective: 600 }}>
        <ol className="m-0 flex list-none flex-col gap-[7px] p-0" aria-label="Clues">
          {clues.map((clue, i) => {
            const n = i + 1;
            const open = n <= state.opened;
            const newest = n === state.opened && !over;
            const next = n === state.opened + 1 && !over;
            const look = open
              ? { bg: "color-mix(in srgb, var(--world) 14%, var(--bg))", fg: "var(--text)", nc: "var(--world)", icon: "eye" }
              : next
                ? { bg: "var(--surface)", fg: "var(--text-muted)", nc: "color-mix(in srgb, var(--text-muted) 55%, transparent)", icon: "lock-simple" }
                : { bg: "var(--surface)", fg: "color-mix(in srgb, var(--text-muted) 55%, transparent)", nc: "color-mix(in srgb, var(--text-muted) 55%, transparent)", icon: "lock-simple" };
            const label = open || over ? clue : next ? `Tap to open, costs ${CLUE_COST}` : "Locked";
            const anim = n === state.opened && openN > 0 && !over ? (openN % 2 ? "cell-pop-a" : "cell-pop-b") : "";
            return (
              <li key={n} className="relative">
                <button
                  type="button"
                  disabled={!next || locked}
                  onClick={openClue}
                  aria-label={open ? `Clue ${n}: ${clue}` : next ? `Clue ${n}, locked. Open it for ${CLUE_COST} points.` : `Clue ${n}, locked`}
                  className={`relative flex h-11 w-full items-center gap-2.5 rounded-[12px] px-3 text-left outline-none disabled:cursor-default ${anim} ${next && !locked ? "press cursor-pointer" : ""}`}
                  style={{ background: look.bg, color: look.fg, boxShadow: newest ? "inset 0 0 0 2px var(--world)" : undefined }}
                >
                  {solved && (
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-[12px]"
                      style={{ background: "var(--world)", animation: `cell-flip 500ms var(--ease-out) ${i * 70}ms both, fade-in 1ms linear ${i * 70 + 250}ms both` }}
                    />
                  )}
                  <span className="num relative w-4 font-mono text-[13px] font-semibold" style={{ color: solved ? INK : look.nc }}>
                    {n}
                  </span>
                  <Icon name={look.icon} size={16} className="relative flex-none" style={solved ? { color: INK } : undefined} />
                  <span className="relative truncate text-[15px] font-medium" style={solved ? { color: INK } : undefined}>
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <form
          className={`mt-1 ${shakeN ? (shakeN % 2 ? "cell-shake-a" : "cell-shake-b") : ""}`}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {solved ? (
            <div className="flex h-12 items-center gap-2 rounded-[12px] px-3 text-[16px] font-semibold" style={{ background: "var(--world)", color: INK }}>
              <Icon name="check" size={18} />
              {secret.category}
            </div>
          ) : (
            <label className="block">
              <span className="sr-only">Your guess</span>
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={locked}
                maxLength={60}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="go"
                placeholder={out ? secret.category : "Type the category"}
                className="h-12 w-full rounded-[12px] px-3 text-[16px] font-medium outline-none placeholder:text-[var(--text-muted)] disabled:opacity-70"
                style={{
                  background: "var(--surface-raised)",
                  color: "var(--text)",
                  caretColor: "var(--world)",
                  boxShadow: out ? "inset 0 0 0 2px var(--danger)" : warm ? "inset 0 0 0 2px var(--gold)" : "inset 0 0 0 2px var(--world)",
                }}
              />
            </label>
          )}
        </form>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[13px] font-medium text-muted">Guesses left</span>
          <div className="flex gap-[5px]" aria-label={`${guessesLeft} of ${puzzle.maxGuesses} guesses left`} role="img">
            {Array.from({ length: puzzle.maxGuesses }, (_, i) => (
              <span
                key={i}
                className="h-3 w-3 rounded-full"
                style={i < guessesLeft ? { background: "var(--world)" } : { boxShadow: "inset 0 0 0 2px color-mix(in srgb, var(--text-muted) 55%, transparent)" }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
