"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { LiveBoard } from "@/components/multiplayer/bay/boards";
import { BOT_LEVELS, loadBot, type AnyBot, type BotGame, type BotLevel } from "@/lib/bot";
import { createRng, type Rng } from "@/lib/rng";
import { play } from "@/lib/audio";
import { boardGames } from "@/lib/copy/board-games";

const t = boardGames.bot;

export interface BotPuzzle {
  game: BotGame;
  level: BotLevel;
}
/** Not saved anywhere: a casual game lives only on this screen. */
export interface BotState {
  plies: number;
}
export interface BotExtra {
  onLevel: (l: BotLevel) => void;
  onRestart: () => void;
}

/** The player is seat 0 (moves first); the bot is seat 1. */
const ME = 0,
  BOT = 1;
/** A beat before the bot moves so the player sees their own move land. */
const BOT_DELAY_MS = 450;

/**
 * "Play vs bot" board: the Board Bay live board for the game, driven by the same match rules on this
 * device, with a computer opponent. Rendered inside GameShell (timer, pause, help); reports the end of
 * the game through the shell (a win is "solved", a loss or draw is "failed") and never talks to the server.
 */
export default function BotBoard({ puzzle, disabled, api, extra }: BoardProps<BotPuzzle, BotState>) {
  const { onLevel, onRestart } = (extra ?? {}) as unknown as BotExtra;
  const [bot, setBot] = useState<AnyBot | null>(null);
  const [state, setState] = useState<unknown>(null);
  const [last, setLast] = useState<unknown>(null);
  const [history, setHistory] = useState<unknown[]>([]);
  const [moved, setMoved] = useState(false);
  const rng = useRef<Rng | null>(null);
  const plies = useRef(0);
  const reported = useRef(false);

  useEffect(() => {
    let live = true;
    void loadBot(puzzle.game).then((b) => {
      if (!live) return;
      // A fresh game every time (Ludo dice included); casual games are never replayed or checked.
      rng.current = createRng(`${Date.now()}:${Math.random()}`);
      setBot(b);
      setState(b.rules.initial(2, rng.current));
    });
    return () => {
      live = false;
    };
  }, [puzzle.game]);

  const rules = bot?.rules;
  const status = useMemo(() => (rules && state ? rules.status(state) : null), [rules, state]);
  const turn = rules && state ? rules.turn(state) : ME;
  const over = !!status?.over;
  const ludo = puzzle.game === "ludo";

  // Game end: a win goes to the shell as solved, a loss or draw as failed. Reported once.
  useEffect(() => {
    if (!status?.over || reported.current) return;
    reported.current = true;
    const s = { plies: plies.current };
    if (status.winner === ME) {
      play("jingle");
      api.feedback(t.won, "success", "trophy");
      api.announce(t.won);
      api.onSolved(s);
    } else {
      const text = status.winner === null ? `${t.draw} ${status.reason ? t.over(status.reason) : ""}`.trim() : t.lost;
      api.feedback(text, "info", status.winner === null ? "handshake" : "robot");
      api.announce(text);
      api.onFailed?.(s, status.winner === null ? "draw" : "lost");
    }
  }, [status, api]);

  // The bot's turn: think after a beat, then move. Waits while paused; Undo or Restart cancels it.
  useEffect(() => {
    if (!bot || !state || !rng.current || over || turn !== BOT || disabled) return;
    const r = rng.current;
    const id = setTimeout(() => {
      const m = bot.choose(state, BOT, puzzle.level, r);
      const next = bot.rules.apply(state, BOT, m, r);
      plies.current++;
      play(isRoll(m) ? "tick" : "clack");
      setLast(m);
      setState(next);
      const st = bot.rules.status(next);
      if (st.over) return;
      if (bot.rules.turn(next) === BOT) {
        const roll = ludo ? (next as { log: { roll: number }[] }).log.at(-1)?.roll : undefined;
        api.feedback(isRoll(m) && roll ? t.botRolled(roll) : t.botAgain, "info", "robot");
      } else {
        const text = ludo ? t.yourRoll : t.botMoved;
        api.feedback(text, "info", "hand-pointing");
        api.announce(text);
      }
    }, BOT_DELAY_MS);
    return () => clearTimeout(id);
  }, [bot, state, over, turn, disabled, puzzle.level, api, ludo]);

  const thinking = !!bot && !!state && !over && turn === BOT && !disabled;

  const legal = useMemo(() => {
    if (!rules || !state || over || turn !== ME) return [];
    return rules.legalMoves(state, ME);
  }, [rules, state, over, turn]);

  const move = useCallback(
    (m: unknown) => {
      if (!rules || !state || !rng.current || disabled || over || turn !== ME || !rules.isLegal(state, ME, m)) return;
      const next = rules.apply(state, ME, m, rng.current);
      plies.current++;
      setMoved(true);
      play(isRoll(m) ? "tick" : "clack");
      // Undo goes back to the start of the player's move (Ludo has dice, so no undo there).
      if (!ludo && !isRoll(m)) setHistory((h) => [...h, state]);
      setLast(m);
      setState(next);
      api.onMove({ plies: plies.current });
      if (rules.status(next).over) return;
      if (rules.turn(next) === BOT) {
        if (ludo && isRoll(m) && (next as { roll: number | null }).roll === null) {
          const roll = (next as { log: { roll: number }[] }).log.at(-1)?.roll ?? 0;
          api.feedback(t.noMove(roll), "info", "dice-six");
          api.announce(t.noMove(roll));
        } else api.feedback(t.thinking, "info", "robot");
      } else if (ludo) {
        const roll = (next as { roll: number | null }).roll;
        const text = roll !== null ? t.youRolled(roll) : t.youAgain;
        api.feedback(text, "info", "dice-six");
        api.announce(text);
      } else {
        // Flip: the bot had no move and passes.
        api.feedback(t.passed, "info", "hand-pointing");
        api.announce(t.passed);
      }
    },
    [rules, state, disabled, over, turn, ludo, api],
  );

  const undo = useCallback(() => {
    if (!history.length || over) return;
    setState(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setLast(null);
    api.feedback(t.yourMove, "info", "hand-pointing");
  }, [history, over, api]);

  useEffect(() => {
    api.setControls([
      ...(ludo ? [] : [{ id: "undo", label: t.undo, icon: "arrow-counter-clockwise", onPress: undo, disabled: !history.length || over }]),
      { id: "restart", label: t.restart, icon: "arrows-clockwise", onPress: () => onRestart?.() },
    ]);
  }, [api, undo, history.length, over, ludo, onRestart]);

  useEffect(() => {
    api.feedback(ludo ? t.yourRoll : t.yourMove, "info", "hand-pointing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const started = moved && !over;

  return (
    <div className="flex w-full flex-col items-center gap-3" data-board="bot" data-game={puzzle.game}>
      <div
        role="radiogroup"
        aria-label={t.levelGroup}
        aria-describedby={started ? "bot-level-locked" : undefined}
        className="bg-surface flex w-full gap-1 rounded-[16px] p-1"
      >
        {BOT_LEVELS.map((l) => {
          const on = l === puzzle.level;
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={started && !on}
              onClick={() => !on && onLevel?.(l)}
              className="press flex h-11 flex-1 items-center justify-center rounded-[12px] text-[15px] font-semibold disabled:opacity-50"
              style={on ? { background: "var(--world)", color: "var(--square-ink)" } : { color: "var(--text-muted)" }}
            >
              {t.levels[l]}
            </button>
          );
        })}
      </div>
      <p id="bot-level-locked" className="text-muted min-h-5 text-[13px]">
        {started ? t.levelLocked : t.casual}
      </p>
      <Seats game={puzzle.game} state={state} turn={over ? -1 : turn} thinking={thinking} />
      {bot && state ? (
        <LiveBoard
          game={puzzle.game}
          state={state}
          seat={ME}
          legal={legal}
          disabled={!!disabled || over || turn !== ME || thinking}
          lastMove={last}
          onMove={move}
          announce={api.announce}
          coords
        />
      ) : (
        <p className="text-muted py-10 text-[15px]" role="status">
          {t.loading}
        </p>
      )}
    </div>
  );
}

const isRoll = (m: unknown) => !!m && typeof m === "object" && (m as { kind?: string }).kind === "roll";

/** Whose turn it is (not by colour alone: the active side is bold, outlined and says so), plus disc counts in Flip and stones left in Dara. */
function Seats({ game, state, turn, thinking }: { game: BotGame; state: unknown; turn: number; thinking: boolean }) {
  const count = (who: number) =>
    !state
      ? null
      : game === "flip"
        ? (state as { grid: number[] }).grid.filter((x) => x === who).length
        : game === "dara"
          ? (state as { board: number[] }).board.filter((x) => x === who).length + (state as { hand: number[] }).hand[who - 1]
          : null;
  const seat = (s: number, name: string) => {
    const active = turn === s;
    const n = count(s + 1);
    return (
      <span
        className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[12px] text-[14px]"
        style={{
          background: active ? "color-mix(in srgb, var(--world) 18%, var(--surface))" : "var(--surface)",
          boxShadow: active ? "inset 0 0 0 2px var(--world)" : undefined,
          fontWeight: active ? 700 : 500,
          color: active ? "var(--text)" : "var(--text-muted)",
        }}
      >
        {name}
        {n !== null && <span className="num">{n}</span>}
      </span>
    );
  };
  return (
    <div className="flex w-full gap-2" aria-label={turn === BOT && thinking ? t.thinking : undefined}>
      {seat(ME, t.you)}
      {seat(BOT, t.bot)}
    </div>
  );
}
