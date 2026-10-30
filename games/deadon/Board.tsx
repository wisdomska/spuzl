"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { apply, BREAK_COPY, closest, OP_GLYPH, OPS, replay, type DeadOnPuzzle, type DeadOnState, type Op, type Step } from "./logic";

const INK = "#0E0F1A";
const KEY_OP: Record<string, Op> = { "+": "+", "-": "-", "*": "*", x: "*", X: "*", "/": "/", "÷": "/", "×": "*" };

/** Which tile id each of the six slots shows: a result takes the left tile's slot, the right tile fades in place. */
function slotsFor(n: number, steps: Step[]): number[] {
  const slots = Array.from({ length: n }, (_, i) => i);
  steps.forEach(([a], k) => {
    const s = slots.indexOf(a);
    if (s >= 0) slots[s] = n + k;
  });
  return slots;
}

/**
 * Dead On board (Game Boards: Dead On). Tap a number, an operator, then a number; the result becomes a
 * new tile in the first tile's slot and the second fades out. Undo sits in the operator row like the
 * design. Lock in submits the closest tile; hitting the target submits at once.
 */
export default function DeadOnBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<DeadOnPuzzle, DeadOnState>) {
  const n = puzzle.numbers.length;
  const [steps, setSteps] = useState<Step[]>(() => initialState?.steps.slice() ?? []);
  const [sel, setSel] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [bad, setBad] = useState<{ slot: number; text: string; n: number } | null>(null);
  const [popN, setPopN] = useState(0);
  const [done, setDone] = useState(false);
  const [locked, setLocked] = useState(false);
  const streak = useRef(0);
  const stepsRef = useRef(steps);

  const r = useMemo(() => replay(puzzle, steps), [puzzle, steps]);
  const slots = useMemo(() => slotsFor(n, steps), [n, steps]);
  const live = useMemo(() => new Set(r.live), [r.live]);
  const at = closest(puzzle, r);
  const off = Math.abs(at - puzzle.target);
  const over = done || locked;
  const lastSlot = steps.length ? slots.indexOf(n + steps.length - 1) : -1;

  const commit = useCallback(
    (next: Step[]) => {
      stepsRef.current = next;
      setSteps(next);
    },
    [],
  );

  const tapSlot = useCallback(
    (s: number) => {
      if (disabled || over) return;
      const id = slots[s];
      if (!live.has(id)) {
        api.feedback("That tile is used up. Undo to get it back.", "info", "hand-pointing");
        return;
      }
      const v = r.values[id];
      if (sel === null || op === null) {
        // first pick, or change the first pick before an operator is chosen
        setSel(sel === id && op === null ? null : id);
        play("tick");
        api.announce(sel === id ? `${v} deselected` : `${v} selected. Pick an operator.`);
        return;
      }
      if (id === sel) {
        setSel(null);
        setOp(null);
        play("tick");
        api.announce(`${v} deselected`);
        return;
      }
      const a = r.values[sel];
      const res = apply(a, op, v);
      const expr = `${a} ${OP_GLYPH[op]} ${v}`;
      if ("error" in res) {
        streak.current = 0;
        setBad((b) => ({ slot: s, text: expr, n: (b?.n ?? 0) + 1 }));
        api.ruleBreak(BREAK_COPY[res.error]);
        api.announce(`${expr}. ${BREAK_COPY[res.error]}`);
        api.onMove({ steps: stepsRef.current }, { correctStreak: 0, mistake: true });
        return;
      }
      const next: Step[] = [...stepsRef.current, [sel, op, id]];
      commit(next);
      setSel(null);
      setOp(null);
      setBad(null);
      setPopN((p) => p + 1);
      const hit = res.value === puzzle.target;
      const said = `${expr} = ${res.value}`;
      if (hit) {
        setDone(true);
        play("jingle");
        api.feedback(`${puzzle.target}. Dead on.`, "success", "target");
        api.announce(`${said}. Dead on.`);
      } else {
        streak.current++;
        play("pop", { step: streak.current });
        const nr = replay(puzzle, next);
        const d = Math.abs(closest(puzzle, nr) - puzzle.target);
        api.announce(`${said}. ${d} off.`);
        api.feedback(mode === "tutorial" && next.length === 1 ? "The result is a new tile. Keep going." : `${said}. ${d} off.`, "info", "target");
      }
      api.onMove({ steps: next }, { correctStreak: streak.current });
      if (hit) api.onSolved({ steps: next });
    },
    [api, commit, disabled, live, mode, op, over, puzzle, r.values, sel, slots],
  );

  const pickOp = useCallback(
    (o: Op) => {
      if (disabled || over) return;
      if (sel === null) {
        api.feedback("Pick a number first.", "info", "hand-pointing");
        return;
      }
      setOp(op === o ? null : o);
      play("tick");
      api.announce(`${r.values[sel]} ${OP_GLYPH[o]}`);
    },
    [api, disabled, op, over, r.values, sel],
  );

  const undo = useCallback(() => {
    if (disabled || over) return;
    if (sel !== null) {
      setSel(null);
      setOp(null);
      return;
    }
    const prev = stepsRef.current;
    if (!prev.length) return;
    const next = prev.slice(0, -1);
    commit(next);
    setBad(null);
    play("tick");
    api.announce("Step undone");
    api.onMove({ steps: next });
  }, [api, commit, disabled, over, sel]);

  const reset = useCallback(() => {
    if (disabled || over || !stepsRef.current.length) return;
    commit([]);
    setSel(null);
    setOp(null);
    setBad(null);
    play("tick");
    api.announce("Tiles reset");
    api.onMove({ steps: [] });
    api.feedback(`Target ${puzzle.target}`, "info", "target");
  }, [api, commit, disabled, over, puzzle.target]);

  const lockIn = useCallback(() => {
    if (disabled || over) return;
    setLocked(true);
    play("chime");
    api.feedback(`Locked in at ${at}, ${off} off.`, "info", "target");
    api.announce(`Locked in at ${at}, ${off} off.`);
    api.onSolved({ steps: stepsRef.current });
  }, [api, at, disabled, off, over]);

  useEffect(() => {
    api.setControls([
      { id: "reset", label: "Reset", icon: "arrows-clockwise", onPress: reset, disabled: !steps.length || over },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
      { id: "lock", label: "Lock in", icon: "check", onPress: lockIn, disabled: over, tone: "world" },
    ]);
  }, [api, reset, lockIn, steps.length, over]);

  useEffect(() => {
    api.feedback(mode === "tutorial" ? "Tap a number, an operator, then another number." : `Target ${puzzle.target}`, "info", mode === "tutorial" ? "hand-pointing" : "target");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keys = useGridKeys(2, 3, tapSlot);
  const onKeyDown = (e: KeyboardEvent) => {
    const o = KEY_OP[e.key];
    if (o) {
      e.preventDefault();
      pickOp(o);
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      undo();
      return;
    }
    keys.onKeyDown(e);
  };

  const hintT = hint?.target as { tiles?: number[]; op?: Op; undo?: boolean } | undefined;
  const lines = steps.map(([a, o, b], k) => `${r.values[a]} ${OP_GLYPH[o]} ${r.values[b]} = ${r.values[n + k]}`);

  return (
    <div
      className={`flex flex-col gap-3 rounded-[20px] p-4 ${done ? "board-pulse" : ""}`}
      style={{ width: "min(358px, calc(100vw - 36px))", background: "var(--board-bg)", boxShadow: "0 0 0 2px var(--line)" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[13px] font-medium text-muted">Target</span>
          <span className="num text-[44px] leading-none font-semibold text-[var(--world)] [[data-theme=light]_&]:text-[var(--world-ink)]">{puzzle.target}</span>
        </div>
        <div className="flex flex-col items-end" aria-live="off">
          <span className="text-[13px] font-medium text-muted">You&apos;re at</span>
          <span className="num text-[28px] leading-tight font-semibold">{at}</span>
          <span className="num flex items-center gap-1 text-[13px] font-semibold" style={{ color: off === 0 ? "var(--accent)" : "var(--gold)" }}>
            {off === 0 ? <><Icon name="check" size={13} />Dead on</> : `${off} off`}
          </span>
        </div>
      </div>

      <div className="num flex min-h-[44px] flex-col justify-end gap-1 text-[15px] font-medium text-muted" aria-label="Your working">
        {lines.length === 0 && <span className="opacity-60">Combine two tiles to start.</span>}
        {lines.slice(-3).map((l, k, arr) => (
          <span key={`${steps.length}-${k}`} style={k === arr.length - 1 ? { color: "var(--text)" } : undefined}>
            {l}
          </span>
        ))}
      </div>

      <div role="grid" aria-label="Number tiles" aria-rowcount={2} aria-colcount={3} onKeyDown={onKeyDown} className="grid grid-cols-3 gap-2" style={{ perspective: 600 }}>
        {[0, 1].map((row) => (
          <div role="row" key={row} className="contents">
            {[0, 1, 2].map((col) => {
              const s = row * 3 + col;
              const id = slots[s];
              const v = r.values[id];
              const isLive = live.has(id);
              const isSel = sel === id;
              const isBad = bad?.slot === s;
              const hinted = !!hintT?.tiles?.includes(id) && isLive;
              const dist = lastSlot < 0 ? 0 : Math.abs(row - Math.floor(lastSlot / 3)) + Math.abs(col - (lastSlot % 3));
              let anim = "";
              if (isBad) anim = bad!.n % 2 ? "cell-shake-a" : "cell-shake-b";
              else if (s === lastSlot && !done) anim = popN % 2 ? "cell-pop-a" : "cell-pop-b";
              const world = isSel || (done && isLive);
              return (
                <div
                  key={s}
                  role="gridcell"
                  data-i={s}
                  tabIndex={keys.focus === s ? 0 : -1}
                  aria-selected={isSel}
                  aria-disabled={!isLive}
                  aria-label={`${v}${isSel ? ", selected" : ""}${isLive ? "" : ", used"}`}
                  onClick={() => {
                    keys.setFocus(s);
                    tapSlot(s);
                  }}
                  className={`num relative flex h-[52px] cursor-pointer items-center justify-center rounded-[14px] text-[22px] font-semibold outline-none ${anim} ${hinted ? "hint-ring" : ""}`}
                  style={{
                    background: world ? "var(--world)" : isLive ? "var(--surface-raised)" : "var(--surface)",
                    color: world ? INK : isBad ? "var(--danger)" : "var(--text)",
                    boxShadow: `0 4px 0 ${world ? "var(--world-depth)" : "var(--depth)"}${isBad ? ", inset 0 0 0 2px var(--danger)" : hinted ? ", inset 0 0 0 3px var(--accent)" : ""}`,
                    opacity: isLive ? 1 : 0.3,
                    transform: isSel ? "translateY(-2px)" : undefined,
                    transition: "transform var(--dur-instant) var(--ease-out), opacity var(--dur-fast) var(--ease-out)",
                    ...(done && isLive ? { animation: `cell-flip 500ms var(--ease-out) ${dist * 70}ms both` } : {}),
                  }}
                >
                  {isBad && <span aria-hidden className="hatch absolute inset-0 rounded-[14px]" />}
                  <span className="relative">{v}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Operators">
        {OPS.map((o) => {
          const on = op === o;
          const hinted = hintT?.op === o && !on;
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              aria-label={{ "+": "Plus", "-": "Minus", "*": "Times", "/": "Divide" }[o]}
              disabled={disabled || over}
              onClick={() => pickOp(o)}
              className={`press num flex h-11 items-center justify-center rounded-[12px] text-[20px] font-semibold ${hinted ? "hint-ring" : ""}`}
              style={{
                background: "var(--surface-raised)",
                color: on ? "var(--world)" : "var(--text)",
                boxShadow: on ? "inset 0 0 0 2px var(--world)" : hinted ? "inset 0 0 0 3px var(--accent)" : undefined,
              }}
            >
              <span className="[[data-theme=light]_&]:text-[var(--text)]">{OP_GLYPH[o]}</span>
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Undo"
          disabled={disabled || over || (!steps.length && sel === null)}
          onClick={undo}
          className={`press flex h-11 items-center justify-center rounded-[12px] text-muted disabled:opacity-40 ${hintT?.undo ? "hint-ring" : ""}`}
          style={{ background: "var(--surface-raised)", boxShadow: hintT?.undo ? "inset 0 0 0 3px var(--accent)" : undefined }}
        >
          <Icon name="arrow-u-up-left" size={20} />
        </button>
      </div>
    </div>
  );
}
