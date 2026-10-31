"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GameShell } from "@/components/game/GameShell";
import { Spuz } from "@/components/brand/Spuz";
import { BOARDS } from "@/games/board-registry";
import { GAME_BY_ID } from "@/lib/catalog";
import { api, finishAttempt, HttpError } from "@/lib/client/api";
import { useProfileGate } from "@/lib/client/multiplayer";
import type { InputLog } from "@/games/types";
import { play } from "@/lib/audio";
import { haptic } from "@/lib/haptics";
import { Cta, LoadingScreen, MpToast, NeedProfile, Screen, formatTenths, useToast } from "./ui";

interface Ghost {
  name: string;
  log: InputLog;
  timeMs: number;
  deaths: number;
  runId: string;
  mine: boolean;
}
interface Start {
  attemptId: string;
  puzzle: unknown;
  ghost: Ghost | null;
}

/**
 * Ghost Race (Overlays GR): today's Rage Ridge track against a friend's best replay. The board
 * (Dash, Flipside or Ghosted) gets the ghost through GameShell `extra` and draws the GR HUD itself.
 * Your verified run becomes a ghost others can race.
 */
export function GhostScreen({ game }: { game: string }) {
  const gate = useProfileGate();
  const router = useRouter();
  const run = useSearchParams().get("run") ?? undefined;
  const [start, setStart] = useState<Start | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ timeMs: number; deaths: number; runId: string | null } | null>(null);
  const { toast, show } = useToast();
  const meta = GAME_BY_ID[game];
  const Board = BOARDS[game];

  const [round, setRound] = useState(0);
  useEffect(() => {
    if (gate !== "ready") return;
    let dead = false;
    api<Start>(`/api/v1/ghosts/${game}`, { json: run ? { run } : {} })
      .then((r) => !dead && setStart(r))
      .catch(
        (e) =>
          !dead &&
          setErr(
            e instanceof HttpError && e.status === 404 ? "Ghost Races run on Dash, Flipside and Ghosted." : "Couldn't load today's track.",
          ),
      );
    return () => {
      dead = true;
    };
  }, [gate, game, run, round]);

  const onSolved = useCallback(
    async (state: unknown, ms: number, stats: { mistakes: number }) => {
      if (!start) return;
      const st = state as { deaths?: number; timeMs?: number };
      try {
        const fin = await finishAttempt(start.attemptId, { state, activeMs: ms, mistakes: stats.mistakes, deaths: st.deaths ?? 0 });
        if (!fin.ok) return show("That run didn't verify.", "bad");
        const saved = await api<{ runId: string }>("/api/v1/ghosts", { json: { attemptId: start.attemptId } }).catch(() => null);
        setDone({ timeMs: st.timeMs ?? ms, deaths: st.deaths ?? 0, runId: saved?.runId ?? null });
      } catch {
        show("Couldn't save your run.", "bad");
      }
    },
    [start, show],
  );

  if (gate === "loading") return <LoadingScreen />;
  if (gate === "no_profile") return <NeedProfile />;
  if (err || !meta || !Board)
    return (
      <Screen label="Ghost missing">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <Spuz mood="shocked" size={110} />
          <h1 className="font-display text-[24px] font-black">{err ?? "No Ghost Race here"}</h1>
          <Cta onClick={() => router.push("/")} className="w-full max-w-[358px]">
            Back to The Grid
          </Cta>
        </div>
      </Screen>
    );
  if (!start) return <LoadingScreen />;

  if (done) {
    const g = start.ghost;
    const beat = g ? done.deaths < g.deaths || (done.deaths === g.deaths && done.timeMs < g.timeMs) : true;
    return (
      <GhostResult
        game={meta.name}
        ghost={g}
        done={done}
        beat={beat}
        onAgain={() => {
          setDone(null);
          setRound((n) => n + 1);
        }}
        onShare={async () => {
          if (!done.runId) return;
          const url = `${window.location.origin}/ghost/${game}?run=${done.runId}`;
          const text = `Race my ${meta.name} ghost on SPUZL 👻`;
          try {
            if (navigator.share) await navigator.share({ text, url });
            else {
              await navigator.clipboard.writeText(`${text} ${url}`);
              show("Link copied.");
            }
          } catch {
            /* cancelled */
          }
        }}
      />
    );
  }

  return (
    <>
      <MpToast toast={toast} />
      <GameShell
        meta={meta}
        Board={Board}
        puzzle={start.puzzle}
        mode="challenge"
        label={start.ghost ? `Ghost Race vs ${start.ghost.name}` : "Ghost Race"}
        onSolved={onSolved}
        onExit={() => router.push("/")}
        puzzleKey={start.attemptId}
        extra={{ ghost: start.ghost ? { name: start.ghost.mine ? "Your best" : start.ghost.name, log: start.ghost.log } : null }}
      />
    </>
  );
}

function GhostResult({
  game,
  ghost,
  done,
  beat,
  onAgain,
  onShare,
}: {
  game: string;
  ghost: Ghost | null;
  done: { timeMs: number; deaths: number; runId: string | null };
  beat: boolean;
  onAgain: () => void;
  onShare: () => void;
}) {
  useEffect(() => {
    if (beat) {
      play("cheer", { silentHaptic: true });
      haptic([30, 10, 30]);
    } else play("fizzle");
  }, [beat]);
  const title = !ghost
    ? "Your ghost is set"
    : beat
      ? `You beat ${ghost.mine ? "your best" : `${ghost.name}'s ghost`}`
      : `${ghost.mine ? "Your best" : `${ghost.name}'s ghost`} holds`;
  return (
    <Screen label="Ghost result">
      <div className="flex flex-1 flex-col items-center gap-4 px-5 pt-[max(80px,env(safe-area-inset-top))] pb-[max(28px,env(safe-area-inset-bottom))] text-center">
        <Spuz mood={beat ? "party" : "shocked"} size={130} />
        <h1 className="font-display text-[30px] leading-[1.1] font-black" aria-live="polite">
          {title}
        </h1>
        <p className="text-muted text-[16px]">
          {game}. You: <span className="num text-text">{formatTenths(done.timeMs)}</span>, {done.deaths}{" "}
          {done.deaths === 1 ? "death" : "deaths"}.
          {ghost && (
            <>
              {" "}
              Ghost: <span className="num text-text">{formatTenths(ghost.timeMs)}</span>, {ghost.deaths}{" "}
              {ghost.deaths === 1 ? "death" : "deaths"}.
            </>
          )}
        </p>
        <div className="mt-auto grid w-full grid-cols-2 gap-2.5">
          <Cta onClick={onAgain}>Race again</Cta>
          <Cta tone="raised" icon="share-fat" onClick={onShare} disabled={!done.runId}>
            Share ghost
          </Cta>
        </div>
      </div>
    </Screen>
  );
}
