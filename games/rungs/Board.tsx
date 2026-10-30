"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { play } from "@/lib/audio";
import { sendGuess } from "@/games/_shared/guess";
import { LetterKeyboard } from "@/games/_shared/LetterKeyboard";
import { changedAt, diffCount, LEN, RUNGS, type RungsCheck, type RungsGuess, type RungsPuzzle, type RungsState } from "./rules";

const PITCH = 52; // 44 px row + 8 px gap
type Active = { kind: "rung"; k: number } | { kind: "cap"; c: 0 | 1 } | null;

/**
 * Rungs board (Game Boards: Rungs). Top and bottom stay blank until the ladder is locked. Tap a rung and
 * type its answer with the SPUZL keyboard; right answers lock in green. Drag a rung by its handle (or
 * focus the handle and use the arrow keys) so each word changes one letter; the changed letter glows.
 */
export default function RungsBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<RungsPuzzle, RungsState>) {
  const [answers, setAnswers] = useState<string[]>(() => initialState?.answers?.slice() ?? Array(RUNGS).fill(""));
  const [order, setOrder] = useState<number[]>(() => initialState?.order?.slice() ?? [0, 1, 2, 3, 4]);
  const [caps, setCaps] = useState<[string, string]>(() => (initialState?.caps?.slice() as [string, string]) ?? ["", ""]);
  const [entry, setEntry] = useState("");
  const [active, setActive] = useState<Active>(() => (initialState?.answers?.every(Boolean) ? null : { kind: "rung", k: 0 }));
  const [locked, setLocked] = useState(() => !!initialState?.answers?.every(Boolean) && ladderOk(initialState.answers, initialState.order));
  const [shake, setShake] = useState<{ key: string; n: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState<{ id: number; from: number; dy: number } | null>(null);
  const [done, setDone] = useState(() => !!initialState?.caps?.every(Boolean));
  const streak = useRef(0);
  const off = disabled || done || busy;

  const words = order.map((k) => answers[k]);
  const allAnswered = answers.every(Boolean);

  const state = useCallback((a = answers, o = order, c = caps): RungsState => ({ answers: a.slice(), order: o.slice(), caps: [c[0], c[1]] }), [answers, order, caps]);

  useEffect(() => {
    api.feedback(mode === "tutorial" ? "Tap a rung, type its answer. Then drag rungs into a ladder." : "Answer the clues. Tap a rung to type.", "info", "hand-pointing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextRung = (a: string[], from: number) => {
    for (let s = 1; s <= RUNGS; s++) {
      const k = order[(order.indexOf(from) + s) % RUNGS];
      if (!a[k]) return k;
    }
    return -1;
  };

  /** Once all five are in, a valid local ladder is confirmed by the server, which also says if it is upside down. */
  const tryLock = useCallback(
    async (a: string[], o: number[]) => {
      if (!a.every(Boolean) || !ladderOk(a, o)) return;
      setBusy(true);
      const res = await sendGuess<RungsCheck>(puzzle.ref, { kind: "order", order: o } satisfies RungsGuess).catch(() => null);
      setBusy(false);
      if (!res?.ok) return;
      const fixed = res.reversed ? o.slice().reverse() : o;
      setOrder(fixed);
      setLocked(true);
      setActive({ kind: "cap", c: 0 });
      setEntry("");
      play("synth", { step: 5 });
      api.feedback("Ladder locked. Now crack the top and bottom.", "success", "check-circle");
      api.announce("Ladder locked. Top word clue: " + puzzle.caps[0]);
      api.onMove(state(a, fixed), { correctStreak: ++streak.current });
    },
    [api, puzzle.ref, puzzle.caps, state],
  );

  const submit = useCallback(
    async (word: string) => {
      if (!active || off) return;
      const rowKey = active.kind === "rung" ? `r${active.k}` : `c${active.c}`;
      if (active.kind === "cap") {
        const neighbour = active.c === 0 ? words[0] : words[RUNGS - 1];
        if (diffCount(word, neighbour) !== 1) {
          api.feedback(`Change exactly one letter of ${neighbour}.`, "info", "info");
          api.announce(`Change exactly one letter of ${neighbour}.`);
          setEntry("");
          return;
        }
      }
      setBusy(true);
      const guess: RungsGuess = active.kind === "rung" ? { kind: "rung", rung: active.k, word } : { kind: "cap", cap: active.c, word };
      let res: RungsCheck;
      try {
        res = await sendGuess<RungsCheck>(puzzle.ref, guess);
      } catch {
        setBusy(false);
        api.feedback("No connection. Press Enter to try again.", "danger", "wifi-slash");
        return;
      }
      setBusy(false);
      if (!res.ok) {
        streak.current = 0;
        setShake((s) => ({ key: rowKey, n: (s?.n ?? 0) + 1 }));
        setEntry("");
        api.ruleBreak("Not that one. Try again.");
        api.onMove(state(), { mistake: true });
        return;
      }
      word.split("").forEach((_, i) => setTimeout(() => play("chime", { step: i }), i * 40));
      setEntry("");
      if (active.kind === "rung") {
        const a = answers.slice();
        a[active.k] = word;
        setAnswers(a);
        api.announce(`${word}. Correct.`);
        api.onMove(state(a), { correctStreak: ++streak.current });
        if (a.every(Boolean)) {
          setActive(null);
          if (ladderOk(a, order)) void tryLock(a, order);
          else api.feedback("All five in. Drag the rungs so each changes one letter.", "info", "dots-six-vertical");
        } else {
          setActive({ kind: "rung", k: nextRung(a, active.k) });
          api.feedback(`${a.filter(Boolean).length} of 5 rungs.`, "info", "ladder");
        }
        return;
      }
      const c = caps.slice() as [string, string];
      c[active.c] = word;
      setCaps(c);
      const st = state(answers, order, c);
      if (c[0] && c[1]) {
        setDone(true);
        setActive(null);
        play("jingle");
        api.feedback("Top to bottom. Ladder cleared.", "success", "check-circle");
        api.announce("Ladder cleared.");
        api.onMove(st, { correctStreak: ++streak.current });
        api.onSolved(st);
      } else {
        setActive({ kind: "cap", c: active.c === 0 ? 1 : 0 });
        api.announce(`${word}. Correct. ${active.c === 0 ? "Bottom" : "Top"} word next: ${puzzle.caps[active.c === 0 ? 1 : 0]}`);
        api.onMove(st, { correctStreak: ++streak.current });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, off, words, puzzle.ref, puzzle.caps, answers, caps, order, state, api, tryLock],
  );

  const onLetter = useCallback(
    (ch: string) => {
      if (!active || off || entry.length >= LEN) return;
      const next = entry + ch;
      setEntry(next);
      play("tick", { step: next.length });
      if (next.length === LEN) void submit(next);
    },
    [active, off, entry, submit],
  );
  const onBackspace = useCallback(() => setEntry((e) => e.slice(0, -1)), []);

  /** Move display rung `id` to position `to`. */
  const moveTo = useCallback(
    (id: number, to: number) => {
      if (locked || off) return;
      const o = order.filter((x) => x !== id);
      o.splice(Math.max(0, Math.min(RUNGS - 1, to)), 0, id);
      if (o.join() === order.join()) return;
      setOrder(o);
      play("clack");
      api.announce(`Rung moved to position ${o.indexOf(id) + 1}. Order: ${o.map((k) => answers[k] || "blank").join(", ")}`);
      api.onMove(state(answers, o));
      void tryLock(answers, o);
    },
    [locked, off, order, answers, api, state, tryLock],
  );

  useEffect(() => {
    api.setControls([
      { id: "clear", label: "Clear", icon: "eraser", onPress: () => setEntry(""), disabled: !entry || off },
      { id: "hint", label: "Hint", icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, entry, off]);

  // pointer drag on a handle
  const onHandleDown = (id: number) => (e: React.PointerEvent) => {
    if (locked || off) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id, from: order.indexOf(id), dy: 0 });
    dragStart.current = e.clientY;
  };
  const dragStart = useRef(0);
  const onHandleMove = (e: React.PointerEvent) => {
    if (!drag) return;
    setDrag({ ...drag, dy: e.clientY - dragStart.current });
  };
  const onHandleUp = () => {
    if (!drag) return;
    const to = drag.from + Math.round(drag.dy / PITCH);
    setDrag(null);
    moveTo(drag.id, to);
  };
  const dragTarget = drag ? Math.max(0, Math.min(RUNGS - 1, drag.from + Math.round(drag.dy / PITCH))) : -1;

  const hintTarget = (hint?.target ?? null) as { rung?: number; cap?: number } | null;

  /* ---------- rendering ---------- */
  const cell = (ch: string, opts: { bg: string; fg?: string; ring?: string; placeholder?: string; key: string; mark?: boolean }) => (
    <div
      key={opts.key}
      className="relative flex h-11 w-10 items-center justify-center rounded-[10px] text-[20px] font-extrabold"
      style={{ background: opts.bg, color: opts.fg ?? "var(--text)", boxShadow: opts.ring, fontFamily: "var(--font-display)", transition: "background-color 180ms var(--ease-out)" }}
    >
      {ch || (opts.placeholder ? <span style={{ color: "var(--text-muted)", opacity: 0.5 }}>{opts.placeholder}</span> : "")}
      {opts.mark && <span aria-hidden className="absolute bottom-1 h-[3px] w-3 rounded-full" style={{ background: "var(--hl)" }} />}
    </div>
  );

  const tint = "color-mix(in srgb, var(--world) 24%, var(--surface-raised))";
  const capRow = (c: 0 | 1) => {
    const word = caps[c];
    const isActive = active?.kind === "cap" && active.c === c;
    const text = isActive ? entry : word;
    const hinted = hintTarget?.cap === c;
    const key = `c${c}`;
    return (
      <div
        role="row"
        key={key}
        onClick={() => locked && !word && !off && setActive({ kind: "cap", c })}
        className={`flex items-center gap-2.5 ${shake?.key === key ? (shake.n % 2 ? "cell-shake-a" : "cell-shake-b") : ""} ${hinted ? "hint-ring" : ""}`}
      >
        <div role="gridcell" aria-label={`${c === 0 ? "Top" : "Bottom"} word. ${locked ? puzzle.caps[c] : "Crack it last"}. ${word || (text ? `typed ${text}` : "blank")}`} className="flex gap-1">
          {Array.from({ length: LEN }, (_, i) =>
            cell(text[i] ?? "", {
              key: `${key}${i}`,
              bg: word ? "var(--world)" : locked ? "var(--surface-raised)" : "var(--surface)",
              fg: word ? "#0E0F1A" : undefined,
              ring: isActive && i === Math.min(text.length, LEN - 1) ? "inset 0 0 0 3px var(--world)" : hinted ? "inset 0 0 0 3px var(--gold)" : !locked ? "inset 0 0 0 2px var(--line)" : undefined,
            }),
          )}
        </div>
        <span className="flex-1 text-[13px] leading-[1.3] text-muted">{locked ? puzzle.caps[c] : `${c === 0 ? "Top" : "Bottom"}: crack it last`}</span>
        <span className="w-[44px]" aria-hidden />
      </div>
    );
  };

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div role="grid" aria-label="Rungs ladder" className={`flex w-full max-w-[400px] flex-col gap-2 rounded-[20px] p-4 [--hl:var(--world)] [[data-theme=light]_&]:[--hl:var(--world-ink)] ${done ? "board-pulse" : ""}`} style={{ background: "var(--board-bg)" }}>
        {capRow(0)}
        <div className="relative flex flex-col gap-2">
          {order.map((id, pos) => {
            const word = answers[id];
            const isActive = active?.kind === "rung" && active.k === id;
            const text = isActive ? entry : word;
            const above = pos > 0 ? answers[order[pos - 1]] : "";
            const broken = allAnswered && !locked && !!above && diffCount(above, word) !== 1;
            const hl = word && above ? changedAt(above, word) : -1;
            const hinted = hintTarget?.rung === id;
            const key = `r${id}`;
            let y = 0;
            if (drag) {
              if (drag.id === id) y = drag.dy;
              else if (pos > drag.from && pos <= dragTarget) y = -PITCH;
              else if (pos < drag.from && pos >= dragTarget) y = PITCH;
            }
            return (
              <div
                role="row"
                key={id}
                className={`flex items-center gap-2.5 ${shake?.key === key ? (shake.n % 2 ? "cell-shake-a" : "cell-shake-b") : ""} ${hinted ? "hint-ring" : ""}`}
                style={{
                  transform: `translateY(${y}px)`,
                  transition: drag?.id === id ? "none" : "transform 180ms var(--ease-out)",
                  zIndex: drag?.id === id ? 2 : 1,
                  position: "relative",
                }}
              >
                <div
                  role="gridcell"
                  tabIndex={-1}
                  aria-label={`Rung ${pos + 1}. ${puzzle.clues[id]}. ${word ? word : text ? `typed ${text}` : "blank"}${broken ? `. Changes ${diffCount(above, word)} letters from ${above}` : ""}`}
                  onClick={() => !word && !off && setActive({ kind: "rung", k: id })}
                  className="flex cursor-pointer gap-1"
                >
                  {Array.from({ length: LEN }, (_, i) =>
                    cell(text[i] ?? "", {
                      key: `${key}${i}`,
                      bg: word ? tint : "var(--surface-raised)",
                      fg: broken && above[i] !== word[i] ? "var(--danger)" : i === hl ? "var(--hl)" : undefined,
                      ring: isActive && i === Math.min(text.length, LEN - 1) ? "inset 0 0 0 3px var(--world)" : hinted ? "inset 0 0 0 3px var(--gold)" : broken ? "inset 0 0 0 2px var(--danger)" : undefined,
                      placeholder: puzzle.starts && i === 0 && !text ? puzzle.starts[id] : undefined,
                      mark: i === hl,
                    }),
                  )}
                </div>
                <span className="flex flex-1 items-center gap-1.5 text-[13px] leading-[1.3] text-muted" onClick={() => !word && !off && setActive({ kind: "rung", k: id })}>
                  {broken && <Icon name="link-break" size={14} style={{ color: "var(--danger)", flex: "none" }} label="Two or more letters changed" />}
                  {puzzle.clues[id]}
                </span>
                <button
                  type="button"
                  aria-label={`Move rung ${pos + 1}, ${puzzle.clues[id]}. Use up and down arrows.`}
                  disabled={locked || off}
                  onPointerDown={onHandleDown(id)}
                  onPointerMove={onHandleMove}
                  onPointerUp={onHandleUp}
                  onPointerCancel={() => setDrag(null)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                      e.preventDefault();
                      moveTo(id, pos + (e.key === "ArrowUp" ? -1 : 1));
                    }
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-[10px] disabled:opacity-40"
                  style={{ color: "var(--text-muted)", touchAction: "none", cursor: locked ? "default" : "grab" }}
                >
                  <Icon name={locked ? "check" : "dots-six-vertical"} size={18} />
                </button>
              </div>
            );
          })}
        </div>
        {capRow(1)}
      </div>
      {!done && <LetterKeyboard onLetter={onLetter} onBackspace={onBackspace} onEnter={() => entry.length === LEN && void submit(entry)} onUndo={() => setEntry("")} undoLabel="Clear word" disabled={off || !active} />}
    </div>
  );
}

function ladderOk(answers: string[], order: number[]): boolean {
  const w = order.map((k) => answers[k]);
  return w.every(Boolean) && w.every((x, i) => i === 0 || diffCount(w[i - 1], x) === 1);
}
