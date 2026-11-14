"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { LiveBoard } from "@/components/multiplayer/bay/boards";
import { ShellAside } from "@/components/game/ShellAside";
import { loadBot, type AnyBot, type BotGame, type BotLevel } from "@/lib/bot";
import { createRng, type Rng } from "@/lib/rng";
import { play } from "@/lib/audio";
import { boardGames } from "@/lib/copy/board-games";
import { Button } from "@/components/ui/Button";
import type { LudoOpts } from "@/games/ludo/engine";

const t = boardGames.bot;

export interface BotPuzzle {
  game: BotGame;
  level: BotLevel;
  /** Ludo: 2 to 4 at the table (you and bots), and the house rules chosen before the game */
  seats?: number;
  opts?: LudoOpts;
}
/** Not saved anywhere: a casual game lives only on this screen. */
export interface BotState {
  plies: number;
}
/** The level is picked from the game menu (BotScreen); Restart there starts a new game. */
export interface BotExtra {
  onRestart: () => void;
}

/** The player is seat 0 (moves first); every other seat is the bot (seat 1, and in Ludo up to seat 3). */
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
  const { onRestart } = (extra ?? {}) as unknown as BotExtra;
  const [bot, setBot] = useState<AnyBot | null>(null);
  const [state, setState] = useState<unknown>(null);
  const [last, setLast] = useState<unknown>(null);
  const [history, setHistory] = useState<unknown[]>([]);
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
      const first = b.rules.initial(puzzle.seats ?? 2, rng.current);
      // Ludo house rules ride in the state, so the bots play by them too
      const opts = puzzle.opts && Object.values(puzzle.opts).some(Boolean) ? puzzle.opts : null;
      setState(opts ? { ...(first as object), opts } : first);
    });
    return () => {
      live = false;
    };
  }, [puzzle.game, puzzle.seats, puzzle.opts]);

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
    if (!bot || !state || !rng.current || over || turn === ME || disabled) return;
    const r = rng.current;
    const id = setTimeout(() => {
      const m = bot.choose(state, turn, puzzle.level, r);
      const next = bot.rules.apply(state, turn, m, r);
      plies.current++;
      // Chess sounds its own moves (capture, check, placement: bay/boards.tsx ChessLive).
      if (puzzle.game !== "chess") play(isRoll(m) ? "tick" : "clack");
      setLast(m);
      setState(next);
      const st = bot.rules.status(next);
      if (st.over) return;
      if (bot.rules.turn(next) !== ME) {
        const roll = ludo ? (next as { log: { roll: number }[] }).log.at(-1)?.roll : undefined;
        api.feedback(isRoll(m) && roll ? t.botRolled(roll) : t.botAgain, "info", "robot");
      } else {
        const text = ludo ? t.yourRoll : t.botMoved;
        api.feedback(text, "info", "hand-pointing");
        api.announce(text);
      }
    }, BOT_DELAY_MS);
    return () => clearTimeout(id);
  }, [bot, state, over, turn, disabled, puzzle.level, puzzle.game, api, ludo]);

  const thinking = !!bot && !!state && !over && turn !== ME && !disabled;
  // Restart confirm (Restart is in the game menu); a game with a move in it is worth asking about.
  const [askRestart, setAskRestart] = useState(false);
  const [moved, setMoved] = useState(false);

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
      if (puzzle.game !== "chess") play(isRoll(m) ? "tick" : "clack");
      // Undo goes back to the start of the player's move (Ludo has dice, so no undo there).
      if (!ludo && !isRoll(m)) setHistory((h) => [...h, state]);
      setLast(m);
      setState(next);
      api.onMove({ plies: plies.current });
      if (rules.status(next).over) return;
      if (rules.turn(next) !== ME) {
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
    [rules, state, disabled, over, turn, ludo, api, puzzle.game],
  );

  // A tap the rules refuse (a compulsory capture, an empty pit): the reason in the feedback line, with the slip
  // sound. Not a counted mistake: nothing is scored here.
  const explain = useCallback(
    (text: string) => {
      play("buzz");
      api.feedback(text, "danger", "warning");
    },
    [api],
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
      // Mid-game, Restart asks first (as Resign does in Board Bay); before the first move or after the end it just goes.
      // `confirms`: this board asks itself (below), so the shell's Restart confirm stays out of the way (no double ask).
      {
        id: "restart",
        label: t.restart,
        icon: "arrows-clockwise",
        confirms: true,
        onPress: () => (moved && !over ? setAskRestart(true) : onRestart?.()),
      },
    ]);
  }, [api, undo, history.length, over, ludo, onRestart, moved]);

  useEffect(() => {
    api.feedback(ludo ? t.yourRoll : t.yourMove, "info", "hand-pointing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex w-full flex-col items-center gap-3" data-board="bot" data-game={puzzle.game} data-level={puzzle.level}>
      {/* Whose turn it is: over the board on a phone, at the top of the side panel on a wide screen. */}
      <ShellAside>
        <Seats game={puzzle.game} state={state} turn={over ? -1 : turn} thinking={thinking} seats={puzzle.seats ?? 2} />
      </ShellAside>
      {askRestart && !over && (
        <div
          className="bg-surface-raised flex w-full flex-wrap items-center gap-2 rounded-[16px] p-3"
          role="alert"
          data-bot-restart-confirm
        >
          <span className="min-w-0 flex-1 basis-[180px] text-[15px] font-medium">{t.restartAsk}</span>
          <div className="flex gap-2">
            <Button
              size="md"
              icon="arrows-clockwise"
              onClick={() => {
                setAskRestart(false);
                onRestart?.();
              }}
            >
              {t.restart}
            </Button>
            <Button size="md" variant="secondary" autoFocus onClick={() => setAskRestart(false)}>
              {t.keep}
            </Button>
          </div>
        </div>
      )}
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
          explain={explain}
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
function Seats({ game, state, turn, thinking, seats }: { game: BotGame; state: unknown; turn: number; thinking: boolean; seats: number }) {
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
        key={s}
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
    <div className="flex w-full gap-2" aria-label={turn !== ME && thinking ? t.thinking : undefined}>
      {seat(ME, t.you)}
      {seats > 2 ? Array.from({ length: seats - 1 }, (_, i) => seat(i + 1, `${t.bot} ${i + 1}`)) : seat(BOT, t.bot)}
    </div>
  );
}
