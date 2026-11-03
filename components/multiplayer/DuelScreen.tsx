"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/ui/Icon";
import { api, HttpError, useMe } from "@/lib/client/api";
import { matchAction, matchKey, useEmotes, useMatch, useMatchChat, useProfileGate, useServerNow } from "@/lib/client/multiplayer";
import { ChatPanel, ChatPopup } from "./chat";
import { useSettings } from "@/lib/settings/store";
import { useBackOrHome } from "@/lib/client/nav";
import { useGameSettings } from "@/lib/game-settings/client";
import { duelCopy } from "@/lib/copy/duel";
import { botProgress, duelPhase, inRulesBreak, roundOutcomes, BOT_ID } from "@/lib/multiplayer/duel";
import { DUEL_DEFAULT_GAME, gameName, raceGameParam } from "@/lib/multiplayer/games";
import { TIMING, type EmoteId } from "@/lib/multiplayer/constants";
import type { MatchView } from "@/lib/multiplayer/types";
import { GAME_BY_ID } from "@/lib/catalog";
import { ShareSheet } from "@/components/share/ShareSheet";
import { cardUrl } from "@/lib/share/urls";
import { duelShareText } from "@/lib/share/text";
import { MatchBoard } from "./MatchBoard";
import { useLeave } from "@/components/game/useLeave";
import { useWide } from "@/components/game/useBoardSize";
import { LeaveConfirm } from "@/components/game/LeaveConfirm";
import { leavePolicy } from "@/lib/game/leave";
import { DuelEntrySheet, EdgeCard, MatchEnd, Matchmaking, OppDisconnected, OpponentStrip, RematchWipe, RoundEnd, Versus } from "./duel";
import { CountdownNumber, Cta, EmoteBar, LoadingScreen, MpToast, NeedProfile, Screen, TopButton, useToast } from "./ui";
import { ShareCode } from "./party";

type Outcome = "me" | "them" | "draw";

/**
 * /duel: entry sheet, matchmaking and friend invites; /duel?m=<id>: the match; /duel?code=<code>: join a friend;
 * /duel?friend=<nickname>: from a friend's card, opens straight on a challenge link to send them.
 * Game-first (SPZ-13): /duel?game=<id> preselects a race game on the entry sheet, and
 * /duel?game=<id>&invite=1 makes the challenge-a-friend link for that game at once.
 */
export function DuelScreen() {
  const gate = useProfileGate();
  const sp = useSearchParams();
  const m = sp.get("m");
  const code = sp.get("code");
  const friendName = sp.get("friend")?.slice(0, 16) || null;
  const game = raceGameParam(sp.get("game"));
  const invite = sp.get("invite") === "1";
  if (gate === "loading") return <LoadingScreen />;
  if (gate === "no_profile") return <NeedProfile />;
  if (m) return <DuelMatch id={m} />;
  return <DuelLobby joinCode={code} friendName={friendName} initialGame={game} invite={invite} />;
}

/* ---------------- Entry, matchmaking, friend invite ---------------- */

function DuelLobby({
  joinCode,
  friendName,
  initialGame,
  invite,
}: {
  joinCode: string | null;
  friendName: string | null;
  initialGame: string | null;
  invite: boolean;
}) {
  const router = useRouter();
  const back = useBackOrHome();
  const me = useMe();
  const relaxed = useSettings((s) => s.relaxed);
  const [game, setGame] = useState<string | null>(initialGame ?? DUEL_DEFAULT_GAME ?? null);
  const [mode, setMode] = useState<"sheet" | "search" | "friend">("sheet");
  const [waited, setWaited] = useState(0);
  const [searching, setSearching] = useState<number | null>(null);
  const [rulesFor, setRulesFor] = useState<{ game: string; rule: string } | null>(null);
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
        const r = await api<{ status: string; matchId?: string; searching?: number }>("/api/v1/duel/queue");
        if (stop) return;
        setSearching(typeof r.searching === "number" ? r.searching : null);
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

  const quick = async (rulesSeen = false) => {
    try {
      since.current = Date.now();
      setWaited(0);
      setRulesFor(null);
      setMode("search");
      const r = await api<{ status: string; matchId?: string; rating?: number; searching?: number }>("/api/v1/duel/queue", {
        json: { game, rulesSeen },
      });
      setSearching(typeof r.searching === "number" ? r.searching : null);
      if (r.rating) setRating(r.rating);
      if (r.status === "matched" && r.matchId) router.replace(`/duel?m=${r.matchId}`);
    } catch (e) {
      setMode("sheet");
      if (e instanceof HttpError && e.code === "needs_rules" && game) {
        setRulesFor({ game, rule: e.message });
        return;
      }
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

  // From a friend's card (/duel?friend=<nickname>) or a game card (/duel?game=<id>&invite=1): make the challenge link at once.
  const autoChallenged = useRef(false);
  useEffect(() => {
    if ((!friendName && !invite) || joinCode || relaxed || autoChallenged.current) return;
    autoChallenged.current = true;
    void challengeFriend();
  }, [friendName, invite, joinCode, relaxed]); // eslint-disable-line react-hooks/exhaustive-deps

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
          searching={searching}
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
            <h1 className="font-display min-w-0 truncate text-[22px] font-black">
              {friendName ? `Challenge ${friendName}` : "Challenge a friend"}
            </h1>
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
      {mode === "sheet" && rulesFor && (
        <QueueRulesCard game={rulesFor.game} rule={rulesFor.rule} onReady={() => quick(true)} onBack={() => setRulesFor(null)} />
      )}
      {mode === "sheet" && !rulesFor && (
        <DuelEntrySheet
          game={game}
          setGame={setGame}
          rating={rating}
          onQuick={() => quick()}
          onFriend={challengeFriend}
          onClose={back}
          youngster={me.data?.age_band === "13-15"}
        />
      )}
    </Screen>
  );
}

/* ---------------- The match ---------------- */

function outcomes(v: MatchView, meId: string, themId: string | null): Outcome[] {
  return roundOutcomes(v.rounds, meId, themId, v.status === "finished" ? v.round : v.round - 1, v.isBot);
}

function DuelMatch({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: view, channel, offline, error } = useMatch(id);
  const now = useServerNow(view?.serverNow, 100);
  const { toast, show } = useToast();
  const emotes = useEmotes(channel, view?.me);
  // Chat with the other player (not with the Practice bot).
  const chat = useMatchChat(view && !view.isBot ? view.id : null, channel, view?.me);
  const openChat = view && !view.isBot ? () => chat.setOpen(true) : undefined;
  const [emoteOpen, setEmoteOpen] = useState(false);
  const [rematchWaiting, setRematchWaiting] = useState(false);
  const [wipe, setWipe] = useState(0);
  // The share sheet for the match-end card: story or square, names shown or hidden (as in SPIL).
  const [shareOpen, setShareOpen] = useState(false);
  const [cardFormat, setCardFormat] = useState<"story" | "square">("story");
  const [hideNames, setHideNames] = useState(false);
  // The round whose in-match rules card the player closed with "Got it".
  const [rulesClosed, setRulesClosed] = useState(0);
  const toasted = useRef<string>("");
  const roundResultMs = useGameSettings()["duel.roundResultMs"];

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

  // Leaving (lib/game/leave.ts), from any phase of a live match: Back, the game menu, Escape or the back gesture
  // ask first, then the leave call hands the win to the rival at once. Against the Practice bot nothing is lost,
  // so there is no question, but the leave call still closes the match.
  const wide = useWide();
  const leave = useLeave({
    policy: leavePolicy({ context: view?.isBot ? "duel-bot" : "duel", over: !view || view.status !== "playing" }),
    exit: () => router.push("/duel"),
    forfeit: ({ keepalive }) => api(`/api/v1/matches/${id}/leave`, { json: {}, keepalive }),
  });

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
    // Duels with a person get the picture card; a bot duel shares a line of text.
    if (!view.isBot) return setShareOpen(true);
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
  // A ranked round of a game new to someone: the last stretch before its countdown is a rules break.
  const rulesFor = view.rulesFor ?? [];
  const rulesBreak = rulesFor.length > 0 && (phase === "versus" || phase === "round_end");
  const upcoming = view.games[view.round - 1];
  const myRules = rulesBreak && inRulesBreak(start - now) && rulesFor.includes(me.id) && rulesClosed !== view.round && !!upcoming;
  const rivalReading = rulesBreak && rulesFor.some((p) => p !== me.id) ? duelCopy.rivalReading(them.nickname) : null;
  const pausedFor = view.pausedAt ? now - view.pausedAt : 0;

  let body: React.ReactNode;
  // The board is up (the two-column game shell on a wide screen).
  let onBoard = false;
  if (phase === "match_end")
    body = (
      <MatchEnd
        view={view}
        me={me}
        them={them}
        onRematch={rematch}
        onShare={share}
        onChat={openChat}
        unread={chat.unread}
        onHome={() => router.push("/")}
        rematchWaiting={rematchWaiting && !themP?.rematch}
        theyWantRematch={!!themP?.rematch && !me.rematch}
      />
    );
  else if (myRules)
    body = (
      <RulesCard
        game={upcoming}
        rule={GAME_BY_ID[upcoming]?.rule ?? ""}
        body={duelCopy.rulesMatchBody}
        auto={duelCopy.rulesMatchAuto}
        ready={duelCopy.rulesMatchReady}
        progress={1 - (start - TIMING.countdownMs - now) / TIMING.rulesMs}
        onReady={() => setRulesClosed(view.round)}
      />
    );
  else if (phase === "versus" || (phase === "countdown" && view.round === 1))
    body = <Versus me={me} them={them} msToStart={start - now} round={view.round} note={rivalReading} h2h={view.h2h} />;
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
        totalMs={roundResultMs + (rulesBreak ? TIMING.rulesMs : 0)}
        note={rivalReading}
        onEmote={sendEmote}
        onChat={openChat}
        unread={chat.unread}
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
        gameId={view.games[view.round - 1] ?? view.gameId}
        onClaim={() => {
          void matchAction(id, "tick").then((v) => qc.setQueryData(matchKey(id), v));
          if (pausedFor < TIMING.reconnectMs)
            show(`Hang on. ${them.nickname} has ${Math.ceil((TIMING.reconnectMs - pausedFor) / 1000)} s to get back.`);
        }}
      />
    );
  else if (view.puzzle) {
    onBoard = true;
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
          me={{ nickname: me.nickname, color: me.color, progress: me.progress }}
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
          {chat.unread > 0 && <span aria-hidden className="bg-accent absolute -top-1 -right-1 size-3 rounded-full" />}
        </button>
        {emoteOpen && (
          <div className="bg-surface absolute top-full right-0 z-30 mt-1 w-[300px] rounded-[18px] p-2 shadow-[0_10px_30px_rgba(0,0,0,.4)]">
            <EmoteBar
              onSend={sendEmote}
              onChat={
                openChat &&
                (() => {
                  setEmoteOpen(false);
                  openChat();
                })
              }
              unread={chat.unread}
            />
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
          onExit={leave.request}
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
    <Screen label={`Duel ${phase}`} wide={wide && onBoard}>
      <MpToast toast={toast} />
      <RematchWipe n={view?.rematchId ? wipe + 1 : wipe} />
      {body}
      {view && !view.isBot && (
        <>
          <ChatPanel chat={chat} me={view.me} onEmote={sendEmote} />
          <ChatPopup chat={chat} />
        </>
      )}
      {view && view.status === "finished" && !view.isBot && (
        <ShareSheet
          open={shareOpen}
          onOpenChange={setShareOpen}
          kind="duel"
          title="Share your duel"
          fileName={`spuzl-duel-${cardFormat}.png`}
          image={cardUrl("duel", view.id, { player: view.me, format: cardFormat, anon: hideNames })}
          preview={
            cardFormat === "story" ? { width: 108, height: 192, alt: "Your duel card" } : { width: 150, height: 150, alt: "Your duel card" }
          }
          text={duelShareText({
            gameId: view.games[0] ?? view.gameId ?? "",
            me: hideNames ? "Me" : (view.players.find((p) => p.id === view.me)?.nickname ?? "Me"),
            them: hideNames ? "Rival" : (view.players.find((p) => p.id !== view.me && !p.spectator)?.nickname ?? "Rival"),
            rounds: outcomes(view, view.me, view.players.find((p) => p.id !== view.me && !p.spectator)?.id ?? null)
              .filter((o) => o === "me" || o === "them")
              .map((o) => (o === "me" ? "won" : "lost")),
            rating: view.players.find((p) => p.id === view.me)?.ratingAfter ?? null,
          })}
          options={
            <div className="flex gap-2">
              <div className="bg-bg flex flex-1 gap-1 rounded-[14px] p-1" role="radiogroup" aria-label="Card size">
                {(["story", "square"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="radio"
                    aria-checked={cardFormat === f}
                    onClick={() => setCardFormat(f)}
                    className="flex h-10 flex-1 items-center justify-center rounded-[10px] text-[14px] font-semibold"
                    style={cardFormat === f ? { background: "var(--surface)" } : { color: "var(--text-muted)" }}
                  >
                    {f === "story" ? "Story 9:16" : "Square 1:1"}
                  </button>
                ))}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={hideNames}
                onClick={() => setHideNames((h) => !h)}
                className="bg-bg flex h-12 items-center gap-2 rounded-[14px] px-3 text-[14px] font-semibold"
                style={hideNames ? { color: "var(--accent)" } : { color: "var(--text-muted)" }}
              >
                <Icon name={hideNames ? "eye-slash" : "eye"} size={18} />
                Hide names
              </button>
            </div>
          }
        />
      )}
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
      <LeaveConfirm kind="match" open={leave.asking} busy={leave.busy} onKeep={leave.keep} onLeave={() => void leave.confirm()} />
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

/** SPZ-12: a ranked game the player has never cleared gets its rule first; search starts by itself after 20 s. */
function QueueRulesCard({ game, rule, onReady, onBack }: { game: string; rule: string; onReady: () => void; onBack: () => void }) {
  const [left, setLeft] = useState(20_000);
  useEffect(() => {
    const t0 = Date.now();
    const t = setInterval(() => setLeft(Math.max(0, 20_000 - (Date.now() - t0))), 200);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left === 0) onReady();
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <RulesCard
      game={game}
      rule={rule}
      body={duelCopy.rulesBody}
      auto={duelCopy.rulesAuto}
      ready={duelCopy.rulesReady}
      progress={1 - left / 20_000}
      onReady={onReady}
      onBack={onBack}
    />
  );
}

/**
 * The rules card for a game that is new to the player: before a ranked Quick Match search, and before a ranked
 * round of a game they have never cleared (the round waits for it). `progress` (0 to 1) fills towards the moment
 * it moves on by itself.
 */
function RulesCard(p: {
  game: string;
  rule: string;
  body: string;
  auto: string;
  ready: string;
  progress: number;
  onReady: () => void;
  onBack?: () => void;
}) {
  const progress = Math.max(0, Math.min(1, p.progress));
  return (
    <div
      className="flex flex-1 flex-col gap-4 px-4 pt-[max(56px,env(safe-area-inset-top))] pb-[max(28px,env(safe-area-inset-bottom))]"
      data-screen-label="Rules card"
    >
      <div className="flex items-center gap-3">
        {p.onBack && <TopButton icon="arrow-left" label="Back" onClick={p.onBack} />}
        <h1 className="font-display min-w-0 text-[22px] leading-tight font-black">{duelCopy.rulesTitle(gameName(p.game))}</h1>
      </div>
      <p className="text-muted text-[15px]">{p.body}</p>
      <div className="bg-surface rounded-[20px] p-4 text-[18px] leading-[1.45] font-semibold">{p.rule}</div>
      <div
        className="bg-line h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-label={p.auto}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(100 * progress)}
      >
        <div className="bg-accent h-full origin-left rounded-full" style={{ transform: `scaleX(${progress})` }} />
      </div>
      <div className="mt-auto">
        <Cta className="w-full" onClick={p.onReady}>
          {p.ready}
        </Cta>
      </div>
    </div>
  );
}
