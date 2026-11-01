"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { GameShell } from "@/components/game/GameShell";
import { BoardSkeleton } from "@/components/game/BoardSkeleton";
import { Button } from "@/components/ui/Button";
import type { GameMeta } from "@/lib/catalog";
import type { BotGame, BotLevel } from "@/lib/bot";
import { boardGames } from "@/lib/copy/board-games";
import { HowToSheet, type HowToTip } from "./HowToSheet";
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
  const puzzle = useMemo<BotPuzzle>(() => ({ game, level }), [game, level]);
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
  const extra = useMemo<BotExtra>(() => ({ onLevel: changeLevel, onRestart: restart }), [changeLevel, restart]);
  const key = `${game}:${level}:${round}`;
  const harder: BotLevel | null = outcome === "won" ? (level === "easy" ? "medium" : level === "medium" ? "hard" : null) : null;

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
        onHelp={() => setHowTo(true)}
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
