"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { isKeyedInput, useGridKeys, viaKeys } from "@/components/game/useGridKeys";
import { SHORT_H, useViewportHeight, useWide } from "@/components/game/useBoardSize";
import { sfx } from "@/games/_shared/sfx";
import { market as t } from "@/lib/copy/market";
import { basketCost, clueText, costOf, MAX_Q, MIN_Q, ruleStatus, spendOf, type MarketPuzzle, type MarketState } from "./logic";

const DIGITS = Array.from({ length: MAX_Q - MIN_Q + 1 }, (_, k) => MIN_Q + k);
/** A rule's mark (kept, broken, open), never colour alone. */
const markOf = (s: boolean | null | undefined) => (s === true ? "check-circle" : s === false ? "x-circle" : "circle");
const toneOf = (s: boolean | null | undefined) =>
  s === true ? "text-[var(--accent)]" : s === false ? "text-[var(--danger)]" : "text-muted";
/** The shopping list, one item a row, or (folded, five items) two a row: name on top, price and count below. */
const ROW = {
  one: "short:min-h-12 tiny:min-h-11 tiny:py-0 min-h-[56px] items-center gap-3 px-3 py-1.5",
  two: "min-h-11 flex-col items-stretch gap-0 px-2.5 py-1",
};
const COUNT = {
  one: "relative h-11 w-11 rounded-[12px] text-[22px]",
  two: "absolute right-2 bottom-1 h-7 w-9 rounded-[9px] text-[17px]",
};

/**
 * Market Run board. The cash and the change to bring back sit on top with the live basket total; below, the
 * shopping list (one row per item: tap it, then a number on the pad) and the rules with a kept / broken / open
 * mark each. The basket is checked when the last item is filled; it clears when the change is exact and every
 * rule holds (the puzzle has one answer).
 *
 * Folded (a short screen, or a five-item board on a phone): the rules sit behind a one-line toggle with a mark
 * each, next to the change; open, they lie over the shopping list (the pad stays free) and any tap or Escape
 * closes them. Five items then go two a row, each card still the whole tap target.
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
  // The fold: short screens (the `short` CSS variant's height), and five items on any phone (the mega board).
  const vh = useViewportHeight();
  const wide = useWide();
  const fold = vh <= SHORT_H || (n >= 5 && !wide);
  const two = fold && n >= 5;
  const [rulesOpen, setRulesOpen] = useState(false);
  const rulesBtn = useRef<HTMLButtonElement>(null);
  const rulesId = useId();
  useEffect(() => {
    if (!rulesOpen) return;
    const away = (e: PointerEvent) => {
      if (!rulesBtn.current?.contains(e.target as Node)) setRulesOpen(false);
    };
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setRulesOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [rulesOpen]);

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
        sfx.remove();
        setBad(null);
        api.announce(t.erased(key));
        api.onMove({ qty: next });
        return;
      }
      // Typed quantities change without the pop (fast, repeated entry).
      if (!isKeyedInput()) setPop((p) => ({ i, n: (p?.n ?? 0) + 1 }));
      else setPop(null);
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
          sfx.place(streak.current + 1);
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
      sfx.place(++streak.current);
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
      viaKeys(() => enter(d));
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") {
      e.preventDefault();
      viaKeys(erase);
      return;
    }
    keys.onKeyDown(e);
  };

  const change = puzzle.cash - cost;
  const full = qty.every((q) => q != null);
  const kept = status.filter((s) => s === true).length;

  const ruleList = (
    <ul className="flex flex-col gap-1" data-market-rules>
      {rules.map((r, k) => {
        const s = status[k];
        return (
          <li key={k} className="tiny:leading-[18px] flex items-start gap-2 text-[14px] leading-snug">
            <Icon name={markOf(s)} size={16} className={`mt-[2px] shrink-0 ${toneOf(s)}`} />
            <span>
              {r}
              <span className="sr-only">, {s === true ? t.ruleOk : s === false ? t.ruleBroken : t.ruleOpen}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div
      // Short screens (a 375 x 667 or 320 x 568 phone): tighter gaps and padding; the top row holds the rules toggle
      // and the change (the spend rule says what to pay from and bring back, and the change follows the basket).
      className={`short:gap-2 tiny:gap-1.5 tiny:px-3 tiny:py-2 flex flex-col gap-3 rounded-[20px] p-4 ${done ? "board-pulse" : ""}`}
      style={{ width: "min(358px, calc(100vw - 36px))", background: "var(--board-bg)", boxShadow: "0 0 0 2px var(--line)" }}
    >
      {/* Money (and, folded, the rules toggle) */}
      <div className="relative flex items-start justify-between gap-2">
        <div className={`min-w-0 flex-col ${fold ? "hidden" : "flex"}`}>
          <span className="num tiny:text-[16px] text-[18px] leading-tight font-semibold whitespace-nowrap">{t.cash(puzzle.cash)}</span>
          <span className="text-muted short:hidden text-[13px] font-medium">{t.bringBack(puzzle.change)}</span>
        </div>
        {fold && (
          <button
            type="button"
            aria-expanded={rulesOpen}
            ref={rulesBtn}
            aria-controls={rulesOpen ? rulesId : undefined}
            onClick={() => setRulesOpen((o) => !o)}
            className="toy flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded-[14px] px-2.5 text-left text-[14px] font-semibold"
            style={{ background: "var(--surface-raised)", ["--btn-depth" as string]: "var(--depth)", boxShadow: "0 4px 0 var(--depth)" }}
          >
            <span className="whitespace-nowrap">{t.rulesToggle}</span>
            <span className="sr-only">, {t.rulesKept(kept, rules.length)}</span>
            <span aria-hidden className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
              {status.map((s, k) => (
                <Icon key={k} name={markOf(s)} size={13} className={`shrink-0 ${toneOf(s)}`} />
              ))}
            </span>
            <Icon name={rulesOpen ? "caret-up" : "caret-down"} size={14} className="text-muted tiny:hidden shrink-0" />
          </button>
        )}
        {fold && rulesOpen && (
          <div
            id={rulesId}
            className="absolute inset-x-0 top-[calc(100%+6px)] z-20 rounded-[16px] p-3"
            style={{ background: "var(--surface-raised)", boxShadow: "0 0 0 2px var(--line), 0 12px 32px rgb(0 0 0 / .35)" }}
          >
            {ruleList}
          </div>
        )}
        <div className={`flex flex-col items-end ${fold ? "self-center" : ""}`} aria-live="off">
          <span className="num short:hidden text-[15px] font-semibold whitespace-nowrap">{t.basket(cost)}</span>
          <span
            className="num short:text-[15px] tiny:text-[13px] flex items-center gap-1 text-[13px] font-semibold whitespace-nowrap"
            style={{ color: change < puzzle.change ? "var(--danger)" : full && change === puzzle.change ? "var(--accent)" : "var(--gold)" }}
          >
            {change < puzzle.change ? (
              <Icon name="warning" size={13} />
            ) : full && change === puzzle.change ? (
              <Icon name="check" size={13} />
            ) : (
              <Icon name="coins" size={13} className="tiny:hidden" />
            )}
            {t.changeNow(change)}
          </span>
        </div>
      </div>

      {/* Shopping list */}
      <div
        role="grid"
        aria-label={t.list}
        aria-rowcount={n}
        aria-colcount={1}
        onKeyDown={onKeyDown}
        className={`tiny:gap-1.5 gap-2 ${two ? "grid grid-cols-2" : "flex flex-col"}`}
      >
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
                  if (sel !== i && !locked) sfx.select();
                  setSel(i);
                }}
                className={`${two ? ROW.two : ROW.one} relative flex cursor-pointer rounded-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--text)] ${anim} ${hinted ? "hint-ring" : ""}`}
                style={{
                  background: "var(--surface-raised)",
                  boxShadow: `0 4px 0 var(--depth)${isBad ? ", inset 0 0 0 2px var(--danger)" : hinted ? ", inset 0 0 0 3px var(--accent)" : isSel ? ", inset 0 0 0 2px var(--world)" : ""}`,
                }}
              >
                {isBad && <span aria-hidden className="hatch absolute inset-0 rounded-[14px]" />}
                <div className="relative flex min-w-0 flex-1 flex-col">
                  <span className={`truncate font-semibold first-letter:uppercase ${two ? "text-[14px] leading-5" : "text-[15px]"}`}>
                    {t.many(it.key)}
                  </span>
                  <span className={`text-muted flex items-center gap-x-2 text-[12px] font-medium ${two ? "min-h-7 pr-10" : "flex-wrap"}`}>
                    <span className="num">{two ? t.cedis(it.price) : t.each(it.price)}</span>
                    {it.deal && (
                      <span className="flex items-center gap-1 font-semibold whitespace-nowrap text-[var(--gold)]">
                        <Icon name="gift" size={12} />
                        {!two && <span className="short:hidden">{t.deal}</span>}
                        {!two && <span className="short:inline hidden">{t.dealShort}</span>}
                      </span>
                    )}
                  </span>
                </div>
                <span aria-hidden className={`num text-muted relative w-[52px] text-right text-[13px] font-medium ${two ? "hidden" : ""}`}>
                  {q != null ? t.subtotal(costOf(it, q)) : ""}
                </span>
                <span
                  aria-hidden
                  className={`num flex shrink-0 items-center justify-center font-semibold ${two ? COUNT.two : COUNT.one} ${pop?.i === i && !isBad ? (pop.n % 2 ? "cell-pop-a" : "cell-pop-b") : ""}`}
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

      {/* Rules (unless folded into the top row) */}
      <div className={`flex-col gap-1 ${fold ? "hidden" : "flex"}`}>
        <span className="text-muted text-[12px] font-semibold tracking-wide uppercase">{t.rules}</span>
        {ruleList}
      </div>

      {/* Number pad */}
      {/* Each key makes its own sound (place, or the soft erase), not the generic tap. */}
      <div className="tiny:gap-1.5 grid grid-cols-5 gap-2" role="group" aria-label={t.pad} data-no-tick>
        {DIGITS.map((d) => {
          const hinted = hintT?.value === d && hintT.item === sel && qty[sel ?? -1] !== d;
          return (
            <button
              key={d}
              type="button"
              disabled={locked}
              onClick={() => enter(d)}
              aria-label={t.number(d)}
              className={`toy num tiny:h-11 flex h-12 items-center justify-center rounded-[14px] text-[22px] font-semibold ${hinted ? "hint-ring" : ""}`}
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
          className={`toy text-muted tiny:h-11 flex h-12 items-center justify-center rounded-[14px] ${hintT?.clear ? "hint-ring" : ""}`}
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
