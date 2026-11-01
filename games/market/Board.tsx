"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { useGridKeys } from "@/components/game/useGridKeys";
import { play } from "@/lib/audio";
import { market as t } from "@/lib/copy/market";
import { basketCost, clueText, costOf, MAX_Q, MIN_Q, ruleStatus, spendOf, type MarketPuzzle, type MarketState } from "./logic";

const DIGITS = Array.from({ length: MAX_Q - MIN_Q + 1 }, (_, k) => MIN_Q + k);

/**
 * Market Run board. The cash and the change to bring back sit on top with the live basket total; below, the
 * shopping list (one row per item: tap it, then a number on the pad) and the rules with a kept / broken / open
 * mark each. The basket is checked when the last item is filled; it clears when the change is exact and every
 * rule holds (the puzzle has one answer).
 */
export default function MarketBoard({ puzzle, initialState, hint, disabled, mode, api }: BoardProps<MarketPuzzle, MarketState>) {
  const n = puzzle.items.length;
  const spend = spendOf(puzzle);
  const [qty, setQty] = useState<(number | null)[]>(() => initialState?.qty.slice(0, n) ?? puzzle.items.map(() => null));
  const [sel, setSel] = useState<number | null>(0);
  const [history, setHistory] = useState<(number | null)[][]>([]);
  const [bad, setBad] = useState<{ i: number; n: number } | null>(null);
  const [pop, setPop] = useState<{ i: number; n: number } | null>(null);
  const [done, setDone] = useState(false);
  const qtyRef = useRef(qty);
  const streak = useRef(0);
  const locked = disabled || done;

  const cost = useMemo(() => basketCost(puzzle, qty), [puzzle, qty]);
  const status = useMemo(() => ruleStatus(puzzle, qty), [puzzle, qty]);
  const rules = useMemo(() => [t.clue.spend(puzzle.cash, puzzle.change), ...puzzle.clues.map((c) => clueText(puzzle, c))], [puzzle]);
  const hintT = hint?.target as { item?: number; value?: number; clear?: boolean } | undefined;

  useEffect(() => {
    api.feedback(mode === "tutorial" ? t.startTutorial : t.start, "info", mode === "tutorial" ? "hand-pointing" : "storefront");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new hint selects the item it talks about (adjusted during render, not in an effect).
  const [seenHint, setSeenHint] = useState(hint);
  if (hint !== seenHint) {
    setSeenHint(hint);
    if (typeof hintT?.item === "number") setSel(hintT.item);
  }

  const commit = useCallback(
    (next: (number | null)[], i: number, entered: boolean) => {
      setHistory((h) => [...h, qtyRef.current]);
      qtyRef.current = next;
      setQty(next);
      const c = basketCost(puzzle, next);
      const key = puzzle.items[i].key;
      if (!entered) {
        play("tick");
        setBad(null);
        api.announce(t.erased(key));
        api.onMove({ qty: next });
        return;
      }
      setPop((p) => ({ i, n: (p?.n ?? 0) + 1 }));
      const full = next.every((q) => q != null);
      if (c > spend) {
        streak.current = 0;
        setBad((b) => ({ i, n: (b?.n ?? 0) + 1 }));
        api.ruleBreak(t.over(c, spend));
        api.onMove({ qty: next }, { correctStreak: 0, mistake: true });
        return;
      }
      if (full) {
        const st = ruleStatus(puzzle, next);
        const broken = st.findIndex((s) => s !== true);
        if (broken < 0) {
          setDone(true);
          setBad(null);
          play("jingle");
          api.feedback(t.cleared(puzzle.change), "success", "check-circle");
          api.announce(t.cleared(puzzle.change));
          api.onMove({ qty: next }, { correctStreak: ++streak.current });
          api.onSolved({ qty: next });
          return;
        }
        streak.current = 0;
        setBad((b) => ({ i, n: (b?.n ?? 0) + 1 }));
        api.ruleBreak(t.notYet(rules[broken]));
        api.onMove({ qty: next }, { correctStreak: 0, mistake: true });
        return;
      }
      setBad(null);
      play("pop", { step: ++streak.current });
      const msg = t.set(key, next[i]!, c);
      api.feedback(msg, "info", "storefront");
      api.announce(msg);
      api.onMove({ qty: next }, { correctStreak: streak.current });
      // move on to the next empty item
      for (let k = 1; k <= n; k++) {
        const j = (i + k) % n;
        if (next[j] == null) {
          setSel(j);
          break;
        }
      }
    },
    [api, n, puzzle, rules, spend],
  );

  const enter = useCallback(
    (d: number) => {
      if (locked) return;
      if (sel === null) {
        api.feedback(t.pickFirst, "info", "hand-pointing");
        return;
      }
      if (qtyRef.current[sel] === d) return;
      const next = qtyRef.current.slice();
      next[sel] = d;
      commit(next, sel, true);
    },
    [api, commit, locked, sel],
  );

  const erase = useCallback(() => {
    if (locked || sel === null || qtyRef.current[sel] == null) return;
    const next = qtyRef.current.slice();
    next[sel] = null;
    commit(next, sel, false);
  }, [commit, locked, sel]);

  const undo = useCallback(() => {
    if (locked || !history.length) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    qtyRef.current = prev;
    setQty(prev);
    setBad(null);
    play("tick");
    api.announce(t.undone);
    api.onMove({ qty: prev });
  }, [api, history, locked]);

  useEffect(() => {
    api.setControls([
      { id: "undo", label: t.undo, icon: "arrow-u-up-left", onPress: undo, disabled: locked || !history.length },
      { id: "hint", label: t.hintLabel, icon: "lightbulb", onPress: () => {}, tone: "gold" },
    ]);
  }, [api, undo, locked, history.length]);

  const keys = useGridKeys(n, 1, (i) => setSel(i));
  const onKeyDown = (e: KeyboardEvent) => {
    const d = Number(e.key);
    if (Number.isInteger(d) && d >= MIN_Q && d <= MAX_Q) {
      e.preventDefault();
      enter(d);
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
      e.preventDefault();
      erase();
      return;
    }
    keys.onKeyDown(e);
  };

  const change = puzzle.cash - cost;
  const full = qty.every((q) => q != null);

  return (
    <div
      className={`flex flex-col gap-3 rounded-[20px] p-4 ${done ? "board-pulse" : ""}`}
      style={{ width: "min(358px, calc(100vw - 36px))", background: "var(--board-bg)", boxShadow: "0 0 0 2px var(--line)" }}
    >
      {/* Money */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="num text-[18px] leading-tight font-semibold whitespace-nowrap">{t.cash(puzzle.cash)}</span>
          <span className="text-muted text-[13px] font-medium">{t.bringBack(puzzle.change)}</span>
        </div>
        <div className="flex flex-col items-end" aria-live="off">
          <span className="num text-[15px] font-semibold">{t.basket(cost)}</span>
          <span
            className="num flex items-center gap-1 text-[13px] font-semibold"
            style={{ color: change < puzzle.change ? "var(--danger)" : full && change === puzzle.change ? "var(--accent)" : "var(--gold)" }}
          >
            {change < puzzle.change ? (
              <Icon name="warning" size={13} />
            ) : full && change === puzzle.change ? (
              <Icon name="check" size={13} />
            ) : (
              <Icon name="coins" size={13} />
            )}
            {t.changeNow(change)}
          </span>
        </div>
      </div>

      {/* Shopping list */}
      <div role="grid" aria-label={t.list} aria-rowcount={n} aria-colcount={1} onKeyDown={onKeyDown} className="flex flex-col gap-2">
        {puzzle.items.map((it, i) => {
          const q = qty[i];
          const isSel = sel === i && !locked;
          const isBad = bad?.i === i;
          const hinted = hintT?.item === i;
          let anim = "";
          if (isBad) anim = bad!.n % 2 ? "cell-shake-a" : "cell-shake-b";
          return (
            <div role="row" key={it.key} className="contents">
              <div
                role="gridcell"
                data-i={i}
                tabIndex={keys.focus === i ? 0 : -1}
                aria-selected={isSel}
                aria-label={t.row(i + 1, it.key, it.price, it.deal, q)}
                onClick={() => {
                  keys.setFocus(i);
                  setSel(i);
                }}
                className={`relative flex min-h-[56px] cursor-pointer items-center gap-3 rounded-[14px] px-3 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--text)] ${anim} ${hinted ? "hint-ring" : ""}`}
                style={{
                  background: "var(--surface-raised)",
                  boxShadow: `0 4px 0 var(--depth)${isBad ? ", inset 0 0 0 2px var(--danger)" : hinted ? ", inset 0 0 0 3px var(--accent)" : isSel ? ", inset 0 0 0 2px var(--world)" : ""}`,
                }}
              >
                {isBad && <span aria-hidden className="hatch absolute inset-0 rounded-[14px]" />}
                <div className="relative flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold first-letter:uppercase">{t.many(it.key)}</span>
                  <span className="text-muted flex flex-wrap items-center gap-x-2 text-[12px] font-medium">
                    <span className="num">{t.each(it.price)}</span>
                    {it.deal && (
                      <span className="flex items-center gap-1 font-semibold text-[var(--gold)]">
                        <Icon name="gift" size={12} />
                        {t.deal}
                      </span>
                    )}
                  </span>
                </div>
                <span aria-hidden className="num text-muted relative w-[52px] text-right text-[13px] font-medium">
                  {q != null ? t.subtotal(costOf(it, q)) : ""}
                </span>
                <span
                  aria-hidden
                  className={`num relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] text-[22px] font-semibold ${pop?.i === i && !isBad ? (pop.n % 2 ? "cell-pop-a" : "cell-pop-b") : ""}`}
                  style={{
                    background: done ? "var(--world)" : isSel ? "color-mix(in srgb, var(--world) 22%, var(--surface))" : "var(--surface)",
                    color: done ? "var(--on-accent)" : isBad ? "var(--danger)" : "var(--text)",
                    boxShadow: isSel ? "inset 0 0 0 2px var(--world)" : "inset 0 0 0 2px var(--line)",
                  }}
                >
                  {q ?? ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rules */}
      <div className="flex flex-col gap-1">
        <span className="text-muted text-[12px] font-semibold tracking-wide uppercase">{t.rules}</span>
        <ul className="flex flex-col gap-1">
          {rules.map((r, k) => {
            const s = status[k];
            return (
              <li key={k} className="flex items-start gap-2 text-[14px] leading-snug">
                <Icon
                  name={s === true ? "check-circle" : s === false ? "x-circle" : "circle"}
                  size={16}
                  className={`mt-[2px] shrink-0 ${s === true ? "text-[var(--accent)]" : s === false ? "text-[var(--danger)]" : "text-muted"}`}
                />
                <span>
                  {r}
                  <span className="sr-only">, {s === true ? t.ruleOk : s === false ? t.ruleBroken : t.ruleOpen}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Number pad */}
      <div className="grid grid-cols-5 gap-2" role="group" aria-label={t.pad}>
        {DIGITS.map((d) => {
          const hinted = hintT?.value === d && hintT.item === sel && qty[sel ?? -1] !== d;
          return (
            <button
              key={d}
              type="button"
              disabled={locked}
              onClick={() => enter(d)}
              aria-label={t.number(d)}
              className={`toy num flex h-12 items-center justify-center rounded-[14px] text-[22px] font-semibold ${hinted ? "hint-ring" : ""}`}
              style={{
                background: "var(--surface-raised)",
                ["--btn-depth" as string]: "var(--depth)",
                boxShadow: `0 5px 0 var(--depth)${hinted ? ", inset 0 0 0 3px var(--accent)" : ""}`,
              }}
            >
              {d}
            </button>
          );
        })}
        <button
          type="button"
          disabled={locked || sel === null || qty[sel] == null}
          onClick={erase}
          aria-label={t.erase}
          className={`toy text-muted flex h-12 items-center justify-center rounded-[14px] ${hintT?.clear ? "hint-ring" : ""}`}
          style={{
            background: "var(--surface-raised)",
            ["--btn-depth" as string]: "var(--depth)",
            boxShadow: `0 5px 0 var(--depth)${hintT?.clear ? ", inset 0 0 0 3px var(--accent)" : ""}`,
          }}
        >
          <Icon name="backspace" size={20} />
        </button>
      </div>
    </div>
  );
}
