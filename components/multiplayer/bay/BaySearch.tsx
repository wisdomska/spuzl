"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Spuz } from "@/components/brand/Spuz";
import { GameIcon3D } from "@/components/world/GameIcon3D";
import { api, HttpError, useMe } from "@/lib/client/api";
import { useChannel, useReduce } from "@/lib/client/multiplayer";
import { useBackOr } from "@/lib/client/nav";
import { GAME_BY_ID } from "@/lib/catalog";
import { formatClock } from "@/lib/format";
import { bayLive as T } from "@/lib/copy/bay-live";
import { BAY_QUEUE } from "@/lib/multiplayer/bayMatchmaking";
import { CLOCK_MINUTES, type BayGame } from "@/lib/multiplayer/bay";
import { TimePicker, useMinutes } from "./TimePicker";
import { LudoSetup, NO_KICKS, type LudoKicks } from "./LudoSetup";
import type { BayView } from "@/lib/multiplayer/types";
import { Cta, MpToast, Screen, TopButton, useToast } from "../ui";

type QueueReply =
  | { status: "idle" }
  | { status: "searching"; waitedMs: number; searching: number; timeoutMs: number }
  | { status: "matched"; matchId: string }
  | { status: "timeout" };

type Phase = { kind: "pick" } | { kind: "searching" } | { kind: "matched" } | { kind: "timeout" } | { kind: "refused"; message: string };

const QUEUE = "/api/v1/bay/queue";
/** Leaving the screen ends the search; keepalive lets the request finish while the page goes away. */
const leaveQueue = () => void api(QUEUE, { method: "DELETE", keepalive: true }).catch(() => {});

/**
 * /bay?live=<game>[&t=<minutes>]: Play live. The player picks a time control (skipped when `t` already names one
 * the game offers), then this joins the server's queue for that game and time, polls once a second and also listens on the player's own realtime topic, then opens the match on both devices at once.
 * After a minute with nobody found it stops and offers a friend invite or the bot. Cancel, Back and leaving the
 * page end the search; a reload rejoins and keeps the place in line.
 */
export function BaySearch({
  game,
  minutes: asked,
  rules,
  seats: askedSeats,
}: {
  game: BayGame;
  minutes?: number | null;
  rules?: LudoKicks;
  seats?: number;
}) {
  const router = useRouter();
  // Back where the player came from (a game card), or the Board Bay inbox on a fresh tab.
  const back = useBackOr("/bay");
  const me = useMe();
  const reduce = useReduce();
  const meta = GAME_BY_ID[game];
  const { toast, show } = useToast();
  const preset = asked != null && CLOCK_MINUTES[game].includes(asked);
  const [minutes, setMinutes] = useMinutes(game);
  const chosen = preset && game !== "ludo" ? asked! : minutes;
  const [kicks, setKicks] = useState<LudoKicks>(rules ?? NO_KICKS);
  // Ludo always opens on its setup (house rules) first, even with the time already chosen
  const [phase, setPhase] = useState<Phase>(preset && game !== "ludo" ? { kind: "searching" } : { kind: "pick" });
  const [seats, setSeats] = useState(Math.max(2, Math.min(4, askedSeats ?? 2)));
  const ludo = game === "ludo" ? kicks : undefined;
  const extra = ludo ? { ludo, seats } : {};
  const [waited, setWaited] = useState(0);
  const [others, setOthers] = useState(0);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const done = useRef(false);

  const open = useCallback(
    (matchId: string) => {
      if (done.current) return;
      done.current = true;
      setPhase({ kind: "matched" });
      router.replace(`/bay/${matchId}`);
    },
    [router],
  );

  const handle = useCallback(
    (r: QueueReply) => {
      if (done.current) return;
      if (r.status === "matched") open(r.matchId);
      else if (r.status === "timeout") {
        done.current = true;
        setPhase({ kind: "timeout" });
      } else if (r.status === "searching") {
        setWaited(r.waitedMs);
        setOthers(r.searching);
      } else if (r.status === "idle") {
        // The entry went missing (a late cancel from an earlier visit, another tab): rejoin, keeping the screen.
        void api<QueueReply>(QUEUE, { json: { game, minutes: chosen, ...(ludo ? { ludo, seats } : {}) } }).catch(() => {});
      }
    },
    [open, game, chosen, ludo, seats],
  );

  // Join, then poll. A new attempt ("Search again") rejoins.
  const picking = phase.kind === "pick";
  useEffect(() => {
    if (picking) return;
    done.current = false;
    let stop = false;
    let since = Date.now();
    void api<QueueReply>(QUEUE, { json: { game, minutes: chosen, ...extra } })
      .then((r) => {
        if (stop) return;
        if (r.status === "searching") since = Date.now() - r.waitedMs;
        handle(r);
      })
      .catch((e) => {
        if (stop) return;
        done.current = true;
        setPhase({
          kind: "refused",
          message: e instanceof HttpError && e.message !== e.code ? e.message : T.joinFailed,
        });
      });
    const t = setInterval(async () => {
      if (done.current) return;
      setWaited(Date.now() - since);
      // The server ends the search; if it can't be reached, stop here too (a little later).
      if (Date.now() - since > BAY_QUEUE.timeoutMs + 5_000) {
        done.current = true;
        leaveQueue();
        setPhase({ kind: "timeout" });
        return;
      }
      try {
        const r = await api<QueueReply>(QUEUE);
        if (!stop) handle(r);
      } catch {
        /* keep searching: a dropped request is retried next tick */
      }
    }, BAY_QUEUE.pollMs);
    const onHide = () => {
      if (!done.current) leaveQueue();
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      stop = true;
      clearInterval(t);
      window.removeEventListener("pagehide", onHide);
      if (!done.current) leaveQueue();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new search only on a new attempt, not while it runs
  }, [game, attempt, picking]);

  // Real time: the server tells both players on their own topic the moment they are paired.
  const { channel } = useChannel(me.data?.id ? `user:${me.data.id}` : null);
  useEffect(() => {
    if (!channel) return;
    return channel.onMessage("bay_matched", (p) => {
      const id = (p as { matchId?: unknown })?.matchId;
      if (typeof id === "string") open(id);
    });
  }, [channel, open]);

  const cancel = () => {
    done.current = true;
    leaveQueue();
    back();
  };
  const invite = async () => {
    setBusy(true);
    try {
      const v = await api<BayView>("/api/v1/bay", { json: { game, mode: "live", minutes: chosen, ...extra } });
      router.replace(`/bay/${v.id}`);
    } catch {
      setBusy(false);
      show(T.inviteFailed, "bad");
    }
  };

  const searching = phase.kind === "searching" || phase.kind === "matched";
  return (
    <Screen label={T.screenLabel} style={{ ["--world" as string]: "var(--accent)" }}>
      <MpToast toast={toast} />
      <div className="absolute top-[max(12px,env(safe-area-inset-top))] left-4 z-10">
        <TopButton icon="arrow-left" label={T.back} onClick={cancel} />
      </div>
      <div className="flex flex-1 flex-col items-center px-4 pt-[max(64px,env(safe-area-inset-top))] pb-[max(28px,env(safe-area-inset-bottom))]">
        <div className="bg-surface-raised flex items-center gap-2 rounded-full px-3.5 py-2 text-[14px] font-semibold">
          <Icon name="lightning" size={16} style={{ color: "var(--world)" }} />
          {picking ? T.chipPick : T.chip(chosen)}
        </div>

        {picking ? (
          <>
            <div className="mt-8">
              <GameIcon3D meta={meta} size={96} />
            </div>
            <h1 className="font-display mt-5 text-center text-[26px] font-black">{T.pickTitle(meta.name)}</h1>
            <p className="text-muted mt-2 max-w-[358px] text-center text-[15px]">{T.pickHint}</p>
            <div className="mt-6 w-full max-w-[528px]">
              <TimePicker game={game} value={minutes} onChange={setMinutes} />
            </div>
            {game === "ludo" && (
              <div className="mt-5 w-full max-w-[528px]">
                <LudoSetup kicks={kicks} onKicks={setKicks} seats={seats} onSeats={setSeats} />
                <p className="text-muted mt-2 text-[13px]">
                  Play live seats you with {seats === 2 ? "one player" : `${seats - 1} players`} who chose the same rules.
                </p>
              </div>
            )}
            <div className="mt-auto w-full max-w-[528px] pt-6">
              <Cta icon="lightning" onClick={() => setPhase({ kind: "searching" })} className="w-full">
                {T.findOpponent(minutes)}
              </Cta>
            </div>
          </>
        ) : searching ? (
          <>
            <div className="relative mt-8 flex size-[220px] max-w-full items-center justify-center" aria-hidden>
              <div className="absolute inset-0 rounded-full shadow-[inset_0_0_0_2px_var(--line)]" />
              <div className="absolute inset-[40px] rounded-full shadow-[inset_0_0_0_2px_var(--line)]" />
              {!reduce && <div className="mm-ping absolute inset-0 rounded-full shadow-[inset_0_0_0_3px_var(--world)]" />}
              <GameIcon3D meta={meta} size={88} />
            </div>
            <h1 className="font-display mt-6 text-center text-[26px] font-black" aria-live="polite">
              {phase.kind === "matched" ? T.found : T.title}
            </h1>
            <p className="text-muted mt-2 text-center text-[16px] font-medium">{T.sub(meta.name, chosen)}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              <div className="bg-surface flex flex-col items-center gap-0.5 rounded-[14px] px-4 py-2.5">
                <span className="num text-[22px] font-semibold">{formatClock(waited).replace(/^0/, "")}</span>
                <span className="text-muted text-[13px] font-medium">{T.searching}</span>
              </div>
              {others > 0 && (
                <div className="bg-surface flex items-center justify-center rounded-[14px] px-4 py-2.5">
                  <span className="text-muted text-[14px] font-semibold">{T.othersWaiting(others)}</span>
                </div>
              )}
            </div>
            <p className="text-muted mt-4 max-w-[358px] text-center text-[14px]">{T.hint}</p>
            <div className="mt-auto w-full max-w-[528px] pt-6">
              <Cta tone="raised" onClick={cancel} className="w-full" disabled={phase.kind === "matched"}>
                {T.cancel}
              </Cta>
            </div>
          </>
        ) : (
          <>
            <div className="mt-10">
              <Spuz mood="thinking" size={120} decorative />
            </div>
            <h1 className="font-display mt-6 text-center text-[24px] font-black" role="status">
              {phase.kind === "refused" ? phase.message : T.timeoutTitle}
            </h1>
            {phase.kind === "timeout" && <p className="text-muted mt-2 text-center text-[16px]">{T.timeoutBody}</p>}
            <div className="mt-auto flex w-full max-w-[528px] flex-col gap-3 pt-8">
              <Cta icon="user-plus" onClick={invite} disabled={busy} className="w-full">
                {T.inviteFriend}
              </Cta>
              <Cta tone="raised" icon="robot" onClick={() => router.push(`/play/${game}/bot`)} className="w-full">
                {T.playBot}
              </Cta>
              {phase.kind === "timeout" && (
                <button
                  type="button"
                  onClick={() => {
                    setPhase({ kind: "searching" });
                    setWaited(0);
                    setOthers(0);
                    setAttempt((n) => n + 1);
                  }}
                  className="text-muted min-h-12 text-[16px] font-semibold"
                >
                  {T.searchAgain}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}
