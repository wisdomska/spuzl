"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/ui/Icon";
import { api, HttpError, useMe } from "@/lib/client/api";
import { matchAction, matchKey, useEmotes, useMatch, useProfileGate, useServerNow } from "@/lib/client/multiplayer";
import { useSettings } from "@/lib/settings/store";
import { botProgress, duelPhase, BOT_ID } from "@/lib/multiplayer/duel";
import { DUEL_DEFAULT_GAME, gameName } from "@/lib/multiplayer/games";
import { TIMING, type EmoteId } from "@/lib/multiplayer/constants";
import type { MatchView } from "@/lib/multiplayer/types";
import { MatchBoard } from "./MatchBoard";
import { DuelEntrySheet, EdgeCard, MatchEnd, Matchmaking, OppDisconnected, OpponentStrip, RematchWipe, RoundEnd, Versus } from "./duel";
import { CountdownNumber, Cta, EmoteBar, LoadingScreen, MpToast, NeedProfile, Screen, TopButton, useToast } from "./ui";
import { ShareCode } from "./party";

type Outcome = "me" | "them" | "draw";

/** /duel: entry sheet, matchmaking and friend invites; /duel?m=<id>: the match; /duel?code=<code>: join a friend. */
export function DuelScreen() {
  const gate = useProfileGate();
  const sp = useSearchParams();
  const m = sp.get("m");
  const code = sp.get("code");
  if (gate === "loading") return <LoadingScreen />;
  if (gate === "no_profile") return <NeedProfile />;
  if (m) return <DuelMatch id={m} />;
  return <DuelLobby joinCode={code} />;
}

/* ---------------- Entry, matchmaking, friend invite ---------------- */

function DuelLobby({ joinCode }: { joinCode: string | null }) {
  const router = useRouter();
  const me = useMe();
  const relaxed = useSettings((s) => s.relaxed);
  const [game, setGame] = useState<string | null>(DUEL_DEFAULT_GAME ?? null);
  const [mode, setMode] = useState<"sheet" | "search" | "friend">("sheet");
  const [waited, setWaited] = useState(0);
  const [usual, setUsual] = useState(12_000);
  const [queueRating, setRating] = useState<number | null>(null);
  const rating = queueRating ?? Math.round(me.data?.ratings?.duel ?? 1000);
  const [friend, setFriend] = useState<{ code: string; matchId: string } | null>(null);
  const { toast, show } = useToast();
  const since = useRef(0);

  // Joining a friend's Duel by link.
  useEffect(() => {
    if (!joinCode) return;
    api<{ matchId: string }>("/api/v1/duel/friend/join", { json: { code: joinCode } })
      .then((r) => router.replace(`/duel?m=${r.matchId}`))
      .catch((e) =>
        show(e instanceof HttpError && e.code === "duel_full" ? "That duel already started." : "That link has expired.", "bad"),
      );
  }, [joinCode, router]); // eslint-disable-line react-hooks/exhaustive-deps

  // Searching: poll the queue once a second; the server pairs as soon as a rival is compatible.
  useEffect(() => {
    if (mode !== "search") return;
    let stop = false;
    const t = setInterval(async () => {
      setWaited(Date.now() - since.current);
      try {
        const r = await api<{ status: string; matchId?: string; usualWaitMs?: number }>("/api/v1/duel/queue");
        if (stop) return;
        if (r.usualWaitMs) setUsual(r.usualWaitMs);
        if (r.status === "matched" && r.matchId) router.replace(`/duel?m=${r.matchId}`);
      } catch {
        /* keep searching */
      }
    }, 1000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [mode, router]);

  // Friend invite: wait for them to join.
  useEffect(() => {
    if (mode !== "friend" || !friend) return;
    const t = setInterval(async () => {
      try {
        const v = await api<MatchView>(`/api/v1/matches/${friend.matchId}`);
        if (v.status === "playing") router.replace(`/duel?m=${friend.matchId}`);
      } catch {
        /* keep waiting */
      }
    }, 1500);
    return () => clearInterval(t);
  }, [mode, friend, router]);

  const quick = async () => {
    try {
      since.current = Date.now();
      setWaited(0);
      setMode("search");
      const r = await api<{ status: string; matchId?: string; rating?: number }>("/api/v1/duel/queue", { json: { game } });
      if (r.rating) setRating(r.rating);
      if (r.status === "matched" && r.matchId) router.replace(`/duel?m=${r.matchId}`);
    } catch (e) {
      setMode("sheet");
      show(e instanceof HttpError && e.message !== e.code ? e.message : "Couldn't join the queue. Try again.", "bad");
    }
  };
  const cancel = async () => {
    await api("/api/v1/duel/queue", { method: "DELETE" }).catch(() => {});
    if (friend) await matchAction(friend.matchId, "leave").catch(() => {});
    setFriend(null);
    setMode("sheet");
  };
  const bot = async () => {
    try {
      const r = await api<{ matchId: string }>("/api/v1/duel/bot", { json: { game } });
      router.replace(`/duel?m=${r.matchId}`);
    } catch {
      show("Couldn't start the Practice bot.", "bad");
    }
  };
  const challengeFriend = async () => {
    try {
      const r = await api<{ matchId: string; code: string }>("/api/v1/duel/friend", { json: { game } });
      setFriend(r);
      setMode("friend");
    } catch {
      show("Couldn't make a link. Try again.", "bad");
    }
  };

  if (relaxed)
    return (
      <Screen label="Duel relaxed">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <Icon name="timer" size={40} className="text-muted" />
          <h1 className="font-display text-[24px] font-black">Duels need the clock</h1>
          <p className="text-muted text-[16px]">
            Relaxed mode hides timers, so Duels and Party Races are off. Turn it off in Settings to race.
          </p>
          <Cta tone="raised" onClick={() => router.push("/")} className="w-full max-w-[358px]">
            Back to The Grid
          </Cta>
        </div>
      </Screen>
    );

  return (
    <Screen label={mode === "search" ? "D1 Matchmaking" : "M1 Duel entry"}>
      <MpToast toast={toast} />
      {mode === "search" && (
        <Matchmaking
          rating={rating}
          game={game}
          waitedMs={waited}
          usualMs={usual}
          color={me.data?.avatar_color ?? "#B8F23A"}
          onCancel={cancel}
          botReady={waited >= TIMING.botAfterMs}
          onBot={bot}
        />
      )}
      {mode === "friend" && friend && (
        <div className="flex flex-1 flex-col gap-4 px-4 pt-[max(56px,env(safe-area-inset-top))] pb-[max(28px,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            <TopButton icon="arrow-left" label="Back" onClick={cancel} />
            <h1 className="font-display text-[22px] font-black">Challenge a friend</h1>
          </div>
          <p className="text-muted text-[16px]">
            Unranked. {game ? gameName(game) : "Any game"}, best of 3. The duel starts the moment they join.
          </p>
          <ShareCode code={friend.code} url={`/duel?code=${friend.code}`} text="Duel me on SPUZL. Best of 3." />
          <div className="text-muted mt-2 flex items-center gap-2 text-[15px]" aria-live="polite">
            <span className="bg-accent size-2 animate-pulse rounded-full" />
            Waiting for your friend
          </div>
          <div className="mt-auto">
            <Cta tone="raised" className="w-full" onClick={cancel}>
              Cancel
            </Cta>
          </div>
        </div>
      )}
      {mode === "sheet" && (
        <DuelEntrySheet
          game={game}
          setGame={setGame}
          rating={rating}
          onQuick={quick}
          onFriend={challengeFriend}
          onClose={() => router.push("/")}
          youngster={me.data?.age_band === "13-15"}
        />
      )}
    </Screen>
  );
}

/* ---------------- The match ---------------- */

function outcomes(v: MatchView, meId: string, themId: string | null): Outcome[] {
  const done = v.status === "finished" ? v.round : v.round - 1;
  const out: Outcome[] = [];
  for (let r = 1; r <= done; r++) {
    const mine = v.rounds.find((x) => x.round === r && x.playerId === meId);
    const theirs = themId ? v.rounds.find((x) => x.round === r && x.playerId === themId) : null;
    if (!mine && !theirs) continue;
    if (mine?.won) out.push("me");
    else if (theirs?.won) out.push("them");
    else if (v.isBot) out.push("them");
    else out.push("draw");
  }
  return out;
}

function DuelMatch({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: view, channel, offline, error } = useMatch(id);
  const now = useServerNow(view?.serverNow, 100);
  const { toast, show } = useToast();
  const emotes = useEmotes(channel, view?.me);
  const [emoteOpen, setEmoteOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [rematchWaiting, setRematchWaiting] = useState(false);
  const [wipe, setWipe] = useState(0);
  const toasted = useRef<string>("");

  const me = view?.players.find((p) => p.id === view.me);
  const themP = view?.players.find((p) => p.id !== view.me && !p.spectator) ?? null;
  const them = useMemo(
    () =>
      view?.isBot
        ? {
            id: BOT_ID,
            nickname: "Practice bot",
            color: "#A2A6C2",
            rating: 0,
            country: null,
            city: null,
            roundsWon: view.bot?.roundsWon ?? 0,
            bot: true,
          }
        : themP
          ? { ...themP, bot: false }
          : null,
    [view, themP],
  );

  // A rematch both players agreed to: follow it.
  useEffect(() => {
    if (view?.rematchId && view.rematchId !== id) {
      const t = setTimeout(() => router.replace(`/duel?m=${view.rematchId}`), 300);
      return () => clearTimeout(t);
    }
  }, [view?.rematchId, id, router]);

  const start = view?.roundStartedAt ?? 0;
  const phase = view
    ? duelPhase({ status: view.status, round: view.round, roundStartedAt: start, pausedAt: view.pausedAt }, now)
    : "versus";
  const elapsed = Math.max(0, now - start - (view?.pauseMs ?? 0) - (view?.pausedAt ? now - view.pausedAt : 0));
  const botP = view?.isBot && view.bot?.finishMs ? botProgress(elapsed, view.bot.finishMs) : 0;
  const theyFinished = view?.isBot ? !!view.bot?.finishMs && elapsed >= view.bot.finishMs : themP?.finishedMs != null;
  const iFinished = me?.finishedMs != null;

  useEffect(() => {
    if (phase !== "playing" || !view) return;
    const k = `${view.round}:${theyFinished}`;
    if (theyFinished && !iFinished && toasted.current !== k) {
      toasted.current = k;
      show(`${them?.nickname ?? "They"} cleared first.`, "bad");
    }
  }, [phase, theyFinished, iFinished, view, them, show]);

  const onFinished = useCallback((v: MatchView) => qc.setQueryData(matchKey(id), v), [qc, id]);
  const onRejected = useCallback(
    (code: string) =>
      show(
        code === "round_over"
          ? "Too late. The round is over."
          : code === "not_solved"
            ? "Not quite solved yet."
            : "Couldn't send your clear. Retrying.",
        "bad",
      ),
    [show],
  );
  const sendEmote = (e: EmoteId) => {
    if (emotes.send(e)) setEmoteOpen(false);
  };

  if (error && !view)
    return (
      <Screen label="Duel missing">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="font-display text-[24px] font-black">This duel is gone</h1>
          <p className="text-muted">It may have finished, or the link is not yours.</p>
          <Cta onClick={() => router.replace("/duel")} className="w-full max-w-[358px]">
            New duel
          </Cta>
        </div>
      </Screen>
    );
  if (!view || !me || !them) return <LoadingScreen />;

  const rounds = outcomes(view, me.id, themP?.id ?? null);
  const myEmote = emotes.last && emotes.last.from === me.id ? emotes.last : null;
  const theirEmote = emotes.last && emotes.last.from !== me.id ? emotes.last : null;
  const leave = async () => {
    setConfirmLeave(false);
    await matchAction(id, "leave").catch(() => {});
    void qc.invalidateQueries({ queryKey: matchKey(id) });
  };
  const rematch = async () => {
    setRematchWaiting(true);
    try {
      const r = await matchAction<{ matchId: string | null; waiting: boolean }>(id, "rematch");
      if (r.matchId) {
        setWipe((w) => w + 1);
        setTimeout(() => router.replace(`/duel?m=${r.matchId}`), 300);
      }
    } catch {
      setRematchWaiting(false);
      show("Couldn't start a rematch.", "bad");
    }
  };
  const share = async () => {
    const text = `${view.winnerId === me.id ? "Won" : "Played"} a SPUZL Duel ${me.roundsWon}-${them.roundsWon} vs ${them.nickname} ⚔️`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        show("Copied. Paste it anywhere.");
      }
    } catch {
      /* cancelled */
    }
  };

  const stale = !view.isBot && !!themP?.stale && phase !== "match_end";
  const pausedFor = view.pausedAt ? now - view.pausedAt : 0;

  let body: React.ReactNode;
  if (phase === "match_end")
    body = (
      <MatchEnd
        view={view}
        me={me}
        them={them}
        onRematch={rematch}
        onShare={share}
        onHome={() => router.push("/")}
        rematchWaiting={rematchWaiting && !themP?.rematch}
        theyWantRematch={!!themP?.rematch && !me.rematch}
      />
    );
  else if (phase === "versus" || (phase === "countdown" && view.round === 1))
    body = <Versus me={me} them={them} msToStart={start - now} round={view.round} />;
  else if (phase === "round_end") {
    const prev = view.round - 1;
    const mine = view.rounds.find((r) => r.round === prev && r.playerId === me.id);
    const theirs = themP ? view.rounds.find((r) => r.round === prev && r.playerId === themP.id) : null;
    const res = rounds[prev - 1];
    body = (
      <RoundEnd
        round={prev}
        meWon={res === "me"}
        draw={res === "draw"}
        me={{ nickname: me.nickname, color: me.color }}
        them={them}
        myMs={mine?.timeMs ?? null}
        theirMs={view.isBot ? (res === "them" ? (view.bot?.times[prev - 1] ?? null) : null) : (theirs?.timeMs ?? null)}
        rounds={rounds}
        oppColor={them.color}
        msToNext={start - TIMING.countdownMs - now}
        onEmote={sendEmote}
        emote={theirEmote ?? myEmote}
      />
    );
  } else if (stale && view.pausedAt)
    body = (
      <OppDisconnected
        name={them.nickname}
        color={them.color}
        progress={themP?.progress ?? 0}
        msLeft={TIMING.reconnectMs - pausedFor}
        onClaim={() => {
          void matchAction(id, "tick").then((v) => qc.setQueryData(matchKey(id), v));
          if (pausedFor < TIMING.reconnectMs)
            show(`Hang on. ${them.nickname} has ${Math.ceil((TIMING.reconnectMs - pausedFor) / 1000)} s to get back.`);
        }}
      />
    );
  else if (view.puzzle) {
    const strip = (
      <div className="relative">
        <OpponentStrip
          them={{
            nickname: them.nickname,
            color: them.color,
            progress: view.isBot ? (theyFinished ? 1 : botP) : (themP?.progress ?? 0),
            mistakes: view.isBot ? 0 : (themP?.mistakes ?? 0),
            finished: theyFinished,
            bot: view.isBot,
          }}
          me={{ color: me.color, progress: me.progress }}
          myMs={phase === "countdown" ? 0 : elapsed}
          rounds={rounds}
          round={view.round}
          emote={theirEmote}
          myEmote={myEmote}
          stale={!!themP?.stale}
        />
        <button
          type="button"
          aria-label="Emote"
          aria-expanded={emoteOpen}
          onClick={() => setEmoteOpen((o) => !o)}
          className="press bg-surface-raised text-accent absolute right-0 bottom-2.5 flex size-11 items-center justify-center rounded-[14px]"
        >
          <Icon name="smiley" size={22} />
        </button>
        {emoteOpen && (
          <div className="bg-surface absolute top-full right-0 z-30 mt-1 rounded-[18px] p-2 shadow-[0_10px_30px_rgba(0,0,0,.4)]">
            <EmoteBar onSend={sendEmote} />
          </div>
        )}
      </div>
    );
    body = (
      <div
        className="relative flex flex-1 flex-col"
        style={{ opacity: theyFinished && !iFinished ? 0.45 : 1, transition: "opacity 400ms cubic-bezier(.23,1,.32,1)" }}
      >
        <MatchBoard
          view={view}
          strip={strip}
          locked={phase !== "playing" || theyFinished || iFinished}
          label="Their board stays hidden"
          onExit={() => setConfirmLeave(true)}
          onFinished={onFinished}
          onRejected={onRejected}
        />
        {phase === "countdown" && (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-[rgba(6,7,13,.55)]">
            <div className="flex flex-col items-center gap-4">
              <CountdownOverlay ms={start - now} round={view.round} />
            </div>
          </div>
        )}
      </div>
    );
  } else body = <LoadingScreen />;

  return (
    <Screen label={`Duel ${phase}`}>
      <MpToast toast={toast} />
      <RematchWipe n={view?.rematchId ? wipe + 1 : wipe} />
      {body}
      {offline && phase !== "match_end" && (
        <div className="fixed inset-x-4 bottom-[max(24px,env(safe-area-inset-bottom))] z-50 mx-auto max-w-[528px]">
          <EdgeCard
            mood="shocked"
            title="You dropped out"
            body="Reconnecting. Your board is saved and your clock is paused for 20 s."
            action={`Retrying in ${3 - (Math.floor(now / 1000) % 3)}`}
            tone="warn"
          />
        </div>
      )}
      {confirmLeave && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(6,7,13,.55)]"
          role="dialog"
          aria-modal
          aria-label="Leave the duel"
        >
          <div className="bg-surface flex w-full max-w-[560px] flex-col gap-3 rounded-t-[32px] p-5 pb-[max(28px,env(safe-area-inset-bottom))]">
            <h2 className="font-display text-[22px] font-black">Leave the duel?</h2>
            <p className="text-muted text-[15px]">Leaving counts as a loss. Your rival gets the win.</p>
            <Cta onClick={() => setConfirmLeave(false)}>Keep playing</Cta>
            <button type="button" onClick={leave} className="text-muted min-h-12 text-[16px] font-semibold">
              Leave and lose
            </button>
          </div>
        </div>
      )}
    </Screen>
  );
}

function CountdownOverlay({ ms, round }: { ms: number; round: number }) {
  return (
    <>
      <CountdownNumber msToStart={ms} />
      <div className="text-[15px] font-semibold text-[#A2A6C2]">Round {round} of 3</div>
    </>
  );
}
