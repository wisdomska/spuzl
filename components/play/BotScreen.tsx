"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { GameShell } from "@/components/game/GameShell";
import { BoardSkeleton } from "@/components/game/BoardSkeleton";
import { Button } from "@/components/ui/Button";
import type { GameMeta } from "@/lib/catalog";
import { BOT_LEVELS, type BotGame, type BotLevel } from "@/lib/bot";
import { boardGames } from "@/lib/copy/board-games";
import { bayLive } from "@/lib/copy/bay-live";
import { isBayGame } from "@/lib/multiplayer/bay";
import { useSettings } from "@/lib/settings/store";
import { liveHref } from "@/components/world/LiveEntry";
import { HowToSheet, type HowToTip } from "./HowToSheet";
import { Icon } from "@/components/ui/Icon";
import { LudoSetup, NO_KICKS, type LudoKicks } from "@/components/multiplayer/bay/LudoSetup";
import type { BotExtra, BotPuzzle } from "./BotBoard";

const t = boardGames.bot;
const BotBoard = dynamic(() => import("./BotBoard"), { ssr: false, loading: () => <BoardSkeleton /> });

type Outcome = "won" | "lost" | "draw";

/**
 * /play/<game>/bot: a casual full game against the computer inside the usual game shell. Nothing is
 * sent to the server and nothing is rewarded (no attempt, no XP, nothing ranked).
 */
export function BotScreen({ meta, game, initialLevel }: { meta: GameMeta; game: BotGame; initialLevel: BotLevel }) {
  const router = useRouter();
  const [level, setLevel] = useState<BotLevel>(initialLevel);
  const [round, setRound] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [howTo, setHowTo] = useState(false);
  // The puzzle rule under the title would be wrong here: show how a full game is played instead.
  const botMeta = useMemo(() => ({ ...meta, rule: t.rules[game] }), [meta, game]);
  // Ludo: set the table up before the game starts (players and house rules; the bots play by them too)
  const [setup, setSetup] = useState(game === "ludo");
  const [kicks, setKicks] = useState<LudoKicks>(NO_KICKS);
  const [seats, setSeats] = useState(2);
  const puzzle = useMemo<BotPuzzle>(
    () => (game === "ludo" ? { game, level, seats, opts: { ...kicks } } : { game, level }),
    [game, level, seats, kicks],
  );
  // Help for a game vs the bot: no Dailies, hints or XP here. Ludo has dice, so no Undo.
  const tips = useMemo<HowToTip[]>(
    () => [
      { icon: "robot", text: t.help.casual },
      { icon: "arrows-clockwise", text: t.help.level },
      ...(game === "ludo" ? [] : [{ icon: "arrow-counter-clockwise", text: t.help.undo }]),
    ],
    [game],
  );

  const restart = useCallback(() => {
    setOutcome(null);
    setRound((r) => r + 1);
  }, []);
  const changeLevel = useCallback(
    (l: BotLevel) => {
      setLevel(l);
      restart();
      router.replace(`/play/${game}/bot?level=${l}`, { scroll: false });
    },
    [game, restart, router],
  );
  const extra = useMemo<BotExtra>(() => ({ onRestart: restart }), [restart]);
  // The level lives in the game menu; picking another starts a new game at that level.
  const levelMenu = useMemo(
    () => ({
      value: level,
      options: BOT_LEVELS.map((l) => ({ id: l, label: t.levels[l] })),
      onChange: (l: string) => l !== level && changeLevel(l as BotLevel),
    }),
    [level, changeLevel],
  );
  const key = `${game}:${level}:${round}`;
  // Board Bay games: after a game vs the bot, offer a live game against a person (not in relaxed mode: clocks).
  const relaxed = useSettings((s) => s.relaxed);
  const live = isBayGame(game) && !relaxed;
  const harder: BotLevel | null = outcome === "won" ? (level === "easy" ? "medium" : level === "medium" ? "hard" : null) : null;

  if (setup)
    return (
      <main
        className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col gap-4 px-4 pt-[max(20px,env(safe-area-inset-top))] pb-[max(28px,env(safe-area-inset-bottom))]"
        style={{ ["--world" as string]: "var(--w-board)" }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={t.back}
            onClick={() => router.push(`/world/${meta.world}`)}
            className="press bg-surface flex size-11 flex-none items-center justify-center rounded-full"
          >
            <Icon name="arrow-left" size={20} />
          </button>
          <h1 className="font-display text-[24px] font-black">Ludo vs the bot</h1>
        </div>
        <p className="text-muted text-[15px]">Set up the table before you start.</p>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-muted pb-1 text-[13px] font-semibold">Bot level</legend>
          <div className="bg-bg flex gap-1 rounded-[16px] p-1" role="radiogroup" aria-label="Bot level">
            {BOT_LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={level === l}
                onClick={() => setLevel(l)}
                className="flex h-11 flex-1 items-center justify-center rounded-[12px] text-[15px] font-semibold"
                style={level === l ? { background: "var(--surface-raised)" } : { color: "var(--text-muted)" }}
              >
                {t.levels[l]}
              </button>
            ))}
          </div>
        </fieldset>
        <LudoSetup kicks={kicks} onKicks={setKicks} seats={seats} onSeats={setSeats} />
        <div className="mt-auto pt-2">
          <Button size="lg" icon="play" className="w-full" onClick={() => setSetup(false)}>
            Start game
          </Button>
        </div>
      </main>
    );

  return (
    <>
      <GameShell
        key={key}
        puzzleKey={key}
        meta={botMeta}
        Board={BotBoard}
        puzzle={puzzle}
        mode="free"
        label={t.label(level)}
        onSolved={() => setOutcome("won")}
        onFailed={(_s, reason) => setOutcome(reason === "draw" ? "draw" : "lost")}
        onExit={() => router.push(`/world/${meta.world}`)}
        leaveContext="bot"
        onHelp={() => setHowTo(true)}
        difficulty={outcome ? undefined : levelMenu}
        pausedExternally={howTo}
        celebrate={outcome === "won"}
        extra={extra as unknown as Record<string, unknown>}
        endBar={
          outcome ? (
            <div className="bg-surface flex flex-col gap-3 rounded-[22px] p-3.5" role="status" aria-live="polite">
              <span className="font-display px-1 text-[18px] font-black" style={{ color: outcome === "won" ? "var(--accent)" : undefined }}>
                {outcome === "won" ? t.won : outcome === "lost" ? t.lost : t.draw}
              </span>
              {harder ? (
                <Button size="lg" icon="arrow-fat-lines-up" className="w-full" onClick={() => changeLevel(harder)} autoFocus>
                  {t.tryLevel(harder)}
                </Button>
              ) : (
                <Button size="lg" icon="arrows-clockwise" className="w-full" onClick={restart} autoFocus>
                  {t.playAgain}
                </Button>
              )}
              {harder && (
                <Button size="lg" variant="secondary" className="w-full" onClick={restart}>
                  {t.playAgain}
                </Button>
              )}
              {live && (
                <Button
                  size="lg"
                  variant="secondary"
                  icon="lightning"
                  className="w-full"
                  aria-label={bayLive.playLiveAria(meta.name)}
                  onClick={() => router.push(liveHref(game))}
                >
                  {bayLive.playLive}
                </Button>
              )}
              {game === "ludo" && (
                <Button
                  size="lg"
                  variant="secondary"
                  icon="sliders-horizontal"
                  className="w-full"
                  onClick={() => {
                    setOutcome(null);
                    setSetup(true);
                  }}
                >
                  Change players or rules
                </Button>
              )}
              <Button size="lg" variant="secondary" className="w-full" onClick={() => router.push(`/world/${meta.world}`)}>
                {t.back}
              </Button>
            </div>
          ) : undefined
        }
      />
      <HowToSheet open={howTo} meta={botMeta} onClose={() => setHowTo(false)} tips={tips} />
    </>
  );
}
