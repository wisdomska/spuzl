"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { play } from "@/lib/audio";
import { hilo as t } from "@/lib/copy/hilo";
import { answer, CALLS, MAX_SLIPS, replay, show, valueOf, type Call, type HiloPuzzle, type HiloState } from "./logic";

/**
 * Higher or Lower board. The card now showing (with its value) sits above the next card (value hidden).
 * Tap Higher or Lower (or press the up and down arrow keys); the next card turns over, the feedback line
 * says if the call was right, and it becomes the card now showing. Ten calls a run; the third slip ends it.
 */
export default function HiloBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<HiloPuzzle, HiloState>) {
  const values = useMemo(() => puzzle.cards.map(valueOf), [puzzle.cards]);
  const [calls, setCalls] = useState<Call[]>(() => initialState?.calls.slice(0, CALLS) ?? []);
  const [flipN, setFlipN] = useState(0);
  const [shakeN, setShakeN] = useState(0);
  const callsRef = useRef(calls);
  const streak = useRef(0);

  const r = useMemo(() => replay(values, calls), [values, calls]);
  const over = r.over;
  const locked = disabled || over;
  const at = Math.min(calls.length, CALLS - 1);
  const anchor = puzzle.cards[at];
  const next = puzzle.cards[at + 1];
  const anchorV = values[at];
  const nextV = values[at + 1];
  const hintT = hint?.target as { card?: number; value?: number } | undefined;
  const hinted = !over && hintT?.card === at + 1;
  // after the last call the next card stays turned over
  const shown = over ? nextV : hinted ? (hintT?.value ?? null) : null;

  useEffect(() => {
    if (initialState?.calls.length) api.restoreMistakes?.(replay(values, initialState.calls.slice(0, CALLS)).slips);
    api.feedback(mode === "tutorial" ? t.startTutorial : t.start, "info", mode === "tutorial" ? "hand-pointing" : "arrows-down-up");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const call = useCallback(
    (c: Call) => {
      const prev = callsRef.current;
      if (locked || prev.length >= CALLS) return;
      const i = prev.length;
      const nextCalls = [...prev, c];
      callsRef.current = nextCalls;
      setCalls(nextCalls);
      setFlipN((n) => n + 1);
      const res = replay(values, nextCalls);
      const truth = answer(values, i);
      const word = truth === "hi" ? t.higherWord : t.lowerWord;
      const expr = show(puzzle.cards[i + 1]);
      const ok = c === truth;
      if (ok) {
        streak.current++;
        play("pop", { step: streak.current });
        const msg = t.right(expr, values[i + 1], word, values[i]);
        api.feedback(msg, "success", "check-circle");
        api.announce(msg);
      } else {
        streak.current = 0;
        setShakeN((n) => n + 1);
        api.ruleBreak(t.slip(expr, values[i + 1], word, values[i], MAX_SLIPS - res.slips));
      }
      api.onMove({ calls: nextCalls }, { correctStreak: streak.current, mistake: !ok });
      if (res.failed) {
        api.feedback(t.out(res.right), "danger", "x-circle");
        api.onFailed?.({ calls: nextCalls }, "out of slips");
      } else if (res.over) {
        play("jingle");
        const msg = t.cleared(res.right, CALLS);
        api.feedback(msg, "success", "trophy");
        api.announce(msg);
        api.onSolved({ calls: nextCalls });
      }
    },
    [api, locked, puzzle.cards, values],
  );

  useEffect(() => {
    api.setControls([{ id: "hint", label: t.hint, icon: "lightbulb", onPress: () => {}, tone: "gold" }]);
  }, [api]);

  // Arrow keys and H / L call from anywhere on the page while the board is live.
  useEffect(() => {
    if (locked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowUp" || e.key === "h" || e.key === "H") {
        e.preventDefault();
        call("hi");
      } else if (e.key === "ArrowDown" || e.key === "l" || e.key === "L") {
        e.preventDefault();
        call("lo");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [call, locked]);

  const card = "flex flex-col items-center justify-center gap-1 rounded-[20px] px-4 text-center";

  return (
    <div
      className={`flex flex-col gap-3 rounded-[20px] p-4 ${over && !r.failed ? "board-pulse" : ""}`}
      style={{ width: "min(358px, calc(100vw - 36px))", background: "var(--board-bg)", boxShadow: "0 0 0 2px var(--line)" }}
      aria-label={t.board}
      role="group"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="num text-[13px] font-semibold" aria-live="off">
          {over ? t.callsDone(CALLS) : t.progress(calls.length, CALLS)}
        </span>
        <span className="num flex items-center gap-1 text-[13px] font-semibold" aria-label={t.slipsLabel(r.slips, MAX_SLIPS)}>
          {Array.from({ length: MAX_SLIPS }, (_, k) => (
            <Icon
              key={k}
              name={k < r.slips ? "x-circle" : "circle"}
              size={16}
              className={k < r.slips ? "text-[var(--danger)]" : "text-muted"}
            />
          ))}
          <span aria-hidden className="ml-1">
            {t.slips(r.slips, MAX_SLIPS)}
          </span>
        </span>
      </div>

      <ol className="grid grid-cols-10 gap-1" aria-label={t.calls}>
        {Array.from({ length: CALLS }, (_, k) => {
          const res = k < r.results.length ? (r.results[k] ? "right" : "slip") : "open";
          return (
            <li
              key={k}
              aria-label={t.pip(k + 1, res)}
              className="flex h-6 items-center justify-center rounded-full"
              style={{
                background: res === "right" ? "var(--world)" : res === "slip" ? "var(--danger-tint)" : "var(--surface)",
                color: res === "right" ? "var(--on-accent)" : res === "slip" ? "var(--danger)" : "var(--text-muted)",
                boxShadow: k === calls.length && !over ? "inset 0 0 0 2px var(--world)" : undefined,
              }}
            >
              {res === "right" ? <Icon name="check" size={12} /> : res === "slip" ? <Icon name="x" size={12} /> : null}
            </li>
          );
        })}
      </ol>

      <div
        key={`a-${at}`}
        className={`${card} min-h-[96px] ${flipN && !over ? (flipN % 2 ? "cell-pop-a" : "cell-pop-b") : ""}`}
        style={{ background: "var(--surface-raised)", boxShadow: "0 4px 0 var(--depth)" }}
        aria-label={t.anchorCard(show(anchor), anchorV)}
      >
        <span className="text-muted text-[13px] font-medium">{t.anchor}</span>
        <span className="num text-[24px] leading-tight font-semibold">{show(anchor)}</span>
        <span className="num text-[32px] leading-none font-semibold text-[var(--world)] [[data-theme=light]_&]:text-[var(--world-ink)]">
          {anchorV}
        </span>
      </div>

      <div
        className={`${card} relative min-h-[120px] ${hinted ? "hint-ring" : ""} ${shakeN ? (shakeN % 2 ? "cell-shake-a" : "cell-shake-b") : ""}`}
        style={{
          background: "var(--surface-raised)",
          boxShadow: `0 4px 0 var(--depth), inset 0 0 0 ${hinted ? "3px var(--accent)" : "2px var(--world)"}`,
        }}
        aria-label={t.challengerCard(show(next), shown)}
        aria-live="off"
      >
        <span className="text-muted text-[13px] font-medium">{t.challenger}</span>
        <span className="num text-[32px] leading-tight font-semibold">{show(next)}</span>
        <span className="num text-muted text-[28px] leading-none font-semibold">{shown ?? t.hidden}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["hi", "lo"] as const).map((c) => (
          <button
            key={c}
            type="button"
            disabled={locked}
            onClick={() => call(c)}
            aria-label={c === "hi" ? t.higherLabel(show(next), anchorV) : t.lowerLabel(show(next), anchorV)}
            className="toy flex h-14 items-center justify-center gap-2 rounded-[16px] text-[18px] font-bold"
            style={{
              background: "var(--world)",
              color: "var(--on-accent)",
              ["--btn-depth" as string]: "var(--world-depth)",
              boxShadow: "0 5px 0 var(--world-depth)",
            }}
          >
            <Icon name={c === "hi" ? "arrow-up" : "arrow-down"} size={22} />
            {c === "hi" ? t.higher : t.lower}
          </button>
        ))}
      </div>
    </div>
  );
}
