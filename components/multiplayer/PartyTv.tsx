"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Spuz } from "@/components/brand/Spuz";
import { api, HttpError } from "@/lib/client/api";
import { useCountdown, useServerNow } from "@/lib/client/multiplayer";
import { useGameSettings } from "@/lib/game-settings/client";
import { normalizeRoomCode } from "@/lib/multiplayer/roomCode";
import { partyPhase } from "@/lib/multiplayer/race";
import { TV_POLL_MS } from "@/lib/multiplayer/tv";
import type { MatchView } from "@/lib/multiplayer/types";
import { partyCopy } from "@/lib/copy/party";
import { track } from "@/lib/analytics/track";
import { TvFrame, TvMode, rowsOf } from "./party";

const T = partyCopy.tv;

/**
 * /party/<code>/tv (R2-P5): the big-screen spectator view for a classroom projector or a TV. Joins by room code
 * with no player profile, read only: the server sends nicknames and scores only, and there is no chat, no emote
 * bar and nothing to tap. It polls every 2 s (TV_POLL_MS) and keeps asking every 10 s while the room is closed,
 * so it fills in on its own when the host turns Big-screen view on.
 */
export function PartyTv({ code: raw }: { code: string }) {
  const code = normalizeRoomCode(raw) ?? raw.toUpperCase();
  const on = useGameSettings()["features.partyTv"];
  const q = useQuery({
    queryKey: ["room-tv", code],
    queryFn: () => api<MatchView>(`/api/v1/rooms/${code}/tv`),
    enabled: on,
    retry: false,
    refetchInterval: (query) => (query.state.error ? 10_000 : TV_POLL_MS),
    refetchIntervalInBackground: true,
  });
  const view = q.data;
  const now = useServerNow(view?.serverNow, 100);
  const countdown = useCountdown(view);
  const live = !!view && !q.error;
  useEffect(() => {
    if (live) track("party_tv_view", { status: view?.status ?? "" });
  }, [live]); // eslint-disable-line react-hooks/exhaustive-deps -- once per load

  const err = q.error instanceof HttpError ? q.error : null;
  if (!on || err || !view) {
    const why = !on || err?.code === "tv_off" ? "off" : err?.status === 403 ? "closed" : err ? "missing" : "loading";
    const title = why === "off" ? T.offTitle : why === "closed" ? T.closedTitle : why === "missing" ? T.missingTitle(code) : T.loading;
    const body = why === "off" ? T.offBody : why === "closed" ? T.closedBody : why === "missing" ? T.missingBody : null;
    return (
      <main
        className="bg-bg text-text flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center"
        data-screen-label={`Party TV ${why}`}
        aria-busy={why === "loading"}
      >
        <Spuz mood={why === "loading" ? "idle" : "sleepy"} size={140} decorative />
        <h1 className="font-display max-w-[640px] text-[28px] leading-tight font-black">{title}</h1>
        {body && <p className="text-muted max-w-[520px] text-[18px]">{body}</p>}
        {why === "closed" && <p className="text-muted text-[14px]">{T.retrying}</p>}
      </main>
    );
  }

  const phase = partyPhase({ status: view.status, roundStartedAt: view.roundStartedAt }, now);
  const start = view.roundStartedAt ?? now;
  return (
    <main aria-label={T.pageTitle} data-testid="party-tv">
      <h1 className="sr-only">{T.pageTitle}</h1>
      <TvFrame>
        <TvMode
          view={view}
          rows={rowsOf(view)}
          elapsedMs={Math.max(0, now - start)}
          phase={phase === "final" ? "podium" : phase}
          msToStart={start - now}
          beats={countdown.beats}
        />
      </TvFrame>
    </main>
  );
}
