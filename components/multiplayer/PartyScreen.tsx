"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/ui/Icon";
import { Spuz } from "@/components/brand/Spuz";
import { api, HttpError, useMe } from "@/lib/client/api";
import { useCrew } from "@/lib/client/social";
import {
  matchAction,
  matchKey,
  useCountdown,
  useEmotes,
  useMatch,
  useMatchChat,
  useProfileGate,
  useServerNow,
} from "@/lib/client/multiplayer";
import { track } from "@/lib/analytics/track";
import { ChatPanel, ChatPopup } from "./chat";
import { useSettings } from "@/lib/settings/store";
import { useBackOrHome } from "@/lib/client/nav";
import { codeHref } from "@/lib/client/codes";
import { normalizeRoomCode } from "@/lib/multiplayer/roomCode";
import { partyPhase } from "@/lib/multiplayer/race";
import { raceGameParam, roomGamesName } from "@/lib/multiplayer/games";
import { PARTY_PICK_MIN } from "@/lib/multiplayer/constants";
import { canHostTv, tvPath } from "@/lib/multiplayer/tv";
import { partyCopy } from "@/lib/copy/party";
import type { MatchPlayerView, MatchView } from "@/lib/multiplayer/types";
import type { RealtimeChannel } from "@/lib/realtime/transport";
import { useGameSettings } from "@/lib/game-settings/client";
import { canSeeAdultParty, canSeeFamilyDraw } from "@/lib/party-adult/gate";
import { isTurnMode, type PartyMode } from "@/lib/party-adult/modes";
import { ADULT_REWARD_MIN_PLAYERS } from "@/lib/party-adult/rewards";
import { adultPartyCopy } from "@/lib/copy/adult-party";
import { MatchBoard } from "./MatchBoard";
import { HostJoinRequests, RequestToJoin } from "./JoinRequests";
import type { JoinRequestStatus } from "@/lib/multiplayer/joinRules";
import { useWide } from "@/components/game/useBoardSize";
import { useLeave } from "@/components/game/useLeave";
import { LeaveConfirm } from "@/components/game/LeaveConfirm";
import { leavePolicy } from "@/lib/game/leave";
import { AdultNotice, AdultRound, KickConfirm, PlayersSheet, adultErrorText, adultLobbyLine, modeName } from "./adult-party";
import {
  DifficultyPicker,
  GamePicker,
  HostRoom,
  JoinRoom,
  Lobby,
  PartyStart,
  Podium,
  RaceRail,
  TvFrame,
  TvMode,
  rowsOf,
  useJoinToasts,
  choiceReady,
  type Diff,
  type GameChoice,
  type PartyTab,
  type RoomRequest,
} from "./party";
import { Avatar, CountdownNumber, CountdownOverlay, Cta, LoadingScreen, MpToast, NeedProfile, Screen, TopButton, useToast } from "./ui";

/* ---------------- /party ---------------- */

export function PartyHome() {
  const gate = useProfileGate();
  const router = useRouter();
  const sp = useSearchParams();
  // From a crew page (/party?crew=<id>): the room is for the crew; its code goes in the crew chat.
  const crewId = sp.get("crew");
  const back = useBackOrHome(); // SPZ-25: deep links go back to the Grid
  // Game-first (SPZ-13): /party?host=1&game=<id> opens the Host tab with that game picked; ?join=1 opens Join.
  const initialGame = raceGameParam(sp.get("game"));
  const [tab, setTab] = useState<PartyTab>(sp.get("join") === "1" && sp.get("host") !== "1" ? "join" : "host");
  const relaxed = useSettings((s) => s.relaxed);
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();
  // Draw It and Two Truths: only for signed-in 18+ players while the admin switch is on (the server checks again).
  const me = useMe(gate === "ready");
  const settings = useGameSettings();
  const adult = canSeeAdultParty(me.data, settings["features.adultParty"]);
  // Family Draw (R2-P5): signed-in players aged 16 and over while "party.familyDraw" is on.
  const family = canSeeFamilyDraw(me.data, settings["party.familyDraw"]);
  const [notice, setNotice] = useState<RoomRequest | null>(null);
  if (gate === "loading") return <LoadingScreen />;
  if (gate === "no_profile") return <NeedProfile />;
  const open = async (r: RoomRequest) => {
    setBusy(true);
    try {
      const res = await api<{ code: string }>("/api/v1/rooms", { json: r });
      router.push(`/party/${res.code}${r.classroom ? "?view=tv" : ""}`);
    } catch (e) {
      setBusy(false);
      // The one-time "Adults only" notice: confirm, then open the room.
      if (e instanceof HttpError && e.code === "needs_adult_notice") return setNotice(r);
      show(isTurnMode(r.mode) ? adultErrorText(e) : partyCopy.host.failed, "bad");
    }
  };
  // Any friend's code works here: a Party room, or a Duel or Board Games invite someone typed into the wrong box.
  const join = async (raw: string) => {
    const code = normalizeRoomCode(raw);
    if (!code) return show(partyCopy.join.badCode, "bad");
    try {
      router.push((await codeHref(code)) ?? `/party/${code}`);
    } catch {
      // unknown or expired: the room page says so in its own words
      router.push(`/party/${code}`);
    }
  };
  return (
    <Screen label={tab === "host" ? "P0 Host" : "P0 Join"}>
      <MpToast toast={toast} />
      <PartyStart
        tab={tab}
        onTab={setTab}
        onBack={back}
        note={
          <>
            {relaxed && (
              <p className="bg-surface text-muted rounded-[14px] px-3.5 py-2.5 text-[14px]" role="note">
                Relaxed mode hides race strips. Turn it off in Settings to race.
              </p>
            )}
            {crewId && /^[0-9a-f-]{36}$/i.test(crewId) && <CrewNote id={crewId} />}
          </>
        }
      >
        {tab === "host" ? (
          <HostRoom initialGame={initialGame} busy={busy} onOpen={open} adult={adult} family={family} />
        ) : (
          <JoinRoom onJoin={(c) => void join(c)} />
        )}
      </PartyStart>
      {notice && (
        <AdultNotice
          busy={busy}
          onCancel={() => setNotice(null)}
          onConfirm={() => {
            const r = notice;
            setNotice(null);
            void open({ ...r, adultNotice: true });
          }}
        />
      )}
    </Screen>
  );
}

function CrewNote({ id }: { id: string }) {
  const crew = useCrew(id);
  if (!crew.data?.member) return null;
  return (
    <p className="bg-surface flex items-center gap-2.5 rounded-[14px] px-3.5 py-2.5 text-[14px]" role="note">
      <span className="size-3 flex-none rounded-full" style={{ background: crew.data.color }} aria-hidden />
      <span>
        Party for <b className="font-semibold">{crew.data.name}</b>. Open a room, then share its code with your crew.
      </span>
    </p>
  );
}

/* ---------------- /party/[code] ---------------- */

type Preview =
  | { member: true; view: MatchView }
  | {
      member: false;
      room: {
        code: string;
        status: string;
        game: string | null;
        mix: boolean;
        chosen?: string[];
        count: number;
        max: number;
        host: string | null;
        mode?: PartyMode;
        /** R2-13: an under-16 host's room this player has to ask to join, and their latest request */
        friendsOnly?: boolean;
        request?: { id: string; status: JoinRequestStatus } | null;
      };
    };

export function PartyRoom({ code: raw }: { code: string }) {
  const gate = useProfileGate();
  const router = useRouter();
  const back = useBackOrHome();
  const code = normalizeRoomCode(raw) ?? raw.toUpperCase();
  const preview = useQuery({
    queryKey: ["room", code],
    enabled: gate === "ready",
    queryFn: () => api<Preview>(`/api/v1/rooms/${code}`),
    retry: false,
  });
  const [joined, setJoined] = useState<string | null>(null);
  const [joinErr, setJoinErr] = useState<string | null>(null);
  // R2-13: the join said "friends only" (the preview may be older than the host's setting or band).
  const [mustAsk, setMustAsk] = useState(false);
  if (gate === "loading") return <LoadingScreen />;
  if (gate === "no_profile") return <NeedProfile />;
  const matchId = joined ?? (preview.data?.member ? preview.data.view.id : null);
  if (matchId) return <Room id={matchId} code={code} />;
  if (preview.isLoading) return <LoadingScreen />;
  // An 18+ room this player may not enter: the server said why (403); say it plainly.
  if (preview.error instanceof HttpError && preview.error.status === 403)
    return (
      <Screen label="Room closed to you">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <Spuz mood="shocked" size={110} />
          <h1 className="font-display text-[24px] font-black">{adultErrorText(preview.error)}</h1>
          <Cta onClick={() => router.push("/party")} className="w-full max-w-[358px]">
            New party
          </Cta>
        </div>
      </Screen>
    );
  if (preview.error || !preview.data)
    return (
      <Screen label="Room missing">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <Spuz mood="shocked" size={110} />
          <h1 className="font-display text-[24px] font-black">No room called {code}</h1>
          <p className="text-muted">Codes expire 2 h after everyone leaves. Ask for a fresh one.</p>
          <Cta onClick={() => router.push("/party")} className="w-full max-w-[358px]">
            New party
          </Cta>
        </div>
      </Screen>
    );
  const room = (preview.data as Extract<Preview, { member: false }>).room;
  const join = async () => {
    try {
      const r = await api<{ matchId: string }>(`/api/v1/rooms/${code}/join`, { json: {} });
      setJoined(r.matchId);
    } catch (e) {
      if (e instanceof HttpError && e.code === "friends_only") return setMustAsk(true);
      setJoinErr(
        e instanceof HttpError
          ? e.code === "room_full"
            ? "This room is full."
            : adultPartyCopy.errors[e.code]
              ? adultErrorText(e)
              : e.message !== e.code
                ? e.message
                : "Couldn't join."
          : "Couldn't join.",
      );
    }
  };
  if ((room.friendsOnly || mustAsk) && room.status === "lobby")
    return (
      <Screen label="Join room friends only">
        <div className="absolute top-[max(56px,env(safe-area-inset-top))] left-4">
          <TopButton icon="arrow-left" label="Back" onClick={back} />
        </div>
        <RequestToJoin code={code} host={room.host} initial={room.request} onApproved={() => void join()} onBack={back} />
        {joinErr && (
          <p role="alert" className="px-5 pb-6 text-center text-[var(--danger)]">
            {joinErr}
          </p>
        )}
      </Screen>
    );
  return (
    <Screen label="Join room">
      <div className="absolute top-[max(56px,env(safe-area-inset-top))] left-4">
        <TopButton icon="arrow-left" label="Back" onClick={back} />
      </div>
      <div className="flex flex-1 flex-col items-center gap-4 px-5 pt-[max(80px,env(safe-area-inset-top))] pb-[max(28px,env(safe-area-inset-bottom))] text-center">
        <Spuz mood="wave" size={130} />
        <h1 className="font-display text-[26px] font-black">{room.host ? `${room.host}'s party` : "Party room"}</h1>
        <p className="text-muted text-[16px]">
          {room.mode && isTurnMode(room.mode)
            ? `${modeName(room.mode)}, ${room.mode === "drawfam" ? adultPartyCopy.modes.badgeFamily : adultPartyCopy.modes.badge}.`
            : `${roomGamesName(room.game, room.chosen)}, 3 games.`}{" "}
          <span className="num">{room.count}</span> of <span className="num">{room.max}</span> in.
        </p>
        <div className="flex gap-2" aria-label={`Room code ${code}`}>
          {code.split("").map((c, i) => (
            <span
              key={i}
              className="bg-surface-raised font-display text-accent flex h-[62px] w-14 items-center justify-center rounded-[16px] text-[32px] font-black"
            >
              {c}
            </span>
          ))}
        </div>
        {joinErr && (
          <p role="alert" className="text-[var(--danger)]">
            {joinErr}
          </p>
        )}
        <Cta className="mt-auto w-full" onClick={join} disabled={room.status !== "lobby" || room.count >= room.max}>
          {room.status !== "lobby" ? "Race in progress" : "Join"}
        </Cta>
      </div>
    </Screen>
  );
}

function Room({ id, code }: { id: string; code: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const qc = useQueryClient();
  const tvParam = sp.get("view") === "tv";
  // Presence only in the lobby: read the last known status from the cache to pick the channel options.
  const cached = qc.getQueryData<MatchView>(matchKey(id));
  const phaseKey = !cached || cached.status === "lobby" ? "lobby" : "other";
  const meQ = useMe();
  // Presence only in the lobby, keyed by the player id.
  const { data: view, channel, members, error } = useMatch(id, phaseKey === "lobby" && meQ.data?.id ? { presenceKey: meQ.data.id } : {});
  const now = useServerNow(view?.serverNow, 100);
  const { toast, show } = useToast();
  const emotes = useEmotes(channel, view?.me);
  const chat = useMatchChat(view?.id ?? null, channel, view?.me);
  const countdown = useCountdown(view);
  const [settings, setSettings] = useState(false);
  const [passAsk, setPassAsk] = useState(false);
  const tvOn = useGameSettings()["features.partyTv"];
  useJoinToasts(view, show);

  const phase = view ? partyPhase({ status: view.status, roundStartedAt: view.roundStartedAt }, now) : "lobby";
  const racing = phase === "countdown" || phase === "race";
  // A round starting (the host's Start or Next game) closes every sheet: chat, room settings, the skip question.
  // While a race game runs, chat stays shut and its pop-ups wait, so nothing ever covers the board.
  // (Adjusted while rendering, when the round changes: no frame ever shows a sheet over the countdown.)
  const liveRound = view && racing ? `${view.setNo}:${view.round}` : null;
  const [sheetsFor, setSheetsFor] = useState<string | null>(null);
  if (liveRound !== sheetsFor) {
    setSheetsFor(liveRound);
    if (liveRound) {
      if (chat.open) chat.setOpen(false);
      setSettings(false);
      setPassAsk(false);
    }
  }
  const raceLive = racing && !!view && !isTurnMode(view.mode);
  const chatUi = view && !raceLive && (
    <>
      <ChatPanel chat={chat} me={view.me} onEmote={(e) => emotes.send(e)} />
      <ChatPopup chat={chat} />
    </>
  );

  // Admin metric party_first_move: ms from the round's real start to this player's first move (server clock).
  const clock = useRef({ now, at: 0, start: null as number | null });
  useEffect(() => {
    clock.current = { now, at: Date.now(), start: view?.roundStartedAt ?? null };
  }, [now, view?.roundStartedAt]);
  const onFirstMove = useCallback((game: string) => {
    const c = clock.current;
    if (c.start === null) return;
    const ms = Math.round(c.now + (Date.now() - c.at) - c.start);
    if (ms >= 0) track("party_first_move", { game, mode: "race", ms });
  }, []);
  // Leaving a race in progress (lib/game/leave.ts): Back, the game menu, Escape or the back gesture ask first,
  // then the leave call takes the player out of the room so everyone else's race board updates at once.
  const wide = useWide();
  const spectating = !!view?.players.find((p) => p.id === view.me)?.spectator;
  const leaveRace = useLeave({
    policy: leavePolicy({ context: "party", over: !view || !racing || isTurnMode(view.mode) || spectating }),
    exit: () => router.push("/party"),
    forfeit: ({ keepalive }) => api(`/api/v1/matches/${id}/leave`, { json: {}, keepalive }),
  });
  useEffect(() => {
    if (channel && view && phase === "lobby") void channel.track({ id: view.me });
  }, [channel, view?.me, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFinished = useCallback((v: MatchView) => qc.setQueryData(matchKey(id), v), [qc, id]);
  const onRejected = useCallback(
    (c: string) =>
      show(
        c === "round_over" ? "The race already closed." : c === "not_solved" ? "Not quite solved yet." : "Couldn't send your clear.",
        "bad",
      ),
    [show],
  );

  if (error && !view)
    return (
      <Screen label="Room gone">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="font-display text-[24px] font-black">You&apos;re out of this room</h1>
          <Cta onClick={() => router.push("/party")} className="w-full max-w-[358px]">
            New party
          </Cta>
        </div>
      </Screen>
    );
  if (!view) return <LoadingScreen />;

  const me = view.players.find((p) => p.id === view.me)!;
  const host = view.hostId === view.me;
  const present = new Set(members.map((m) => m.key));
  const rows = rowsOf(view);
  const start = view.roundStartedAt ?? now;
  const elapsed = Math.max(0, now - start);
  const err = (e: unknown, fallback: string) => show(e instanceof HttpError && e.message !== e.code ? e.message : fallback, "bad");
  const act = (path: string, json: unknown = {}) =>
    api<unknown>(`/api/v1/rooms/${code}/${path}`, { json }).then(() => qc.invalidateQueries({ queryKey: matchKey(id) }));
  // Buttons hand their click event in as the first argument: only a string is a destination.
  const leave = async (to?: unknown) => {
    await matchAction(id, "leave").catch(() => {});
    router.push((typeof to === "string" ? to : "/party") as never);
  };
  const leaveHome = () => void leave("/");

  // Draw It and Two Truths (18+): their own lobby card, rounds and podium; no TV mode or classroom.
  if (isTurnMode(view.mode))
    return (
      <Screen label={`Party ${view.mode} ${phase}`}>
        <MpToast toast={toast} />
        <AdultRoom
          view={view}
          code={code}
          now={now}
          phase={phase}
          present={present}
          emote={emotes.last}
          onEmote={(e) => emotes.send(e)}
          act={act}
          err={err}
          show={show}
          onLeave={leave}
          onHome={leaveHome}
          channel={channel}
          onChat={() => chat.setOpen(true)}
          unread={chat.unread}
          beats={countdown.beats}
        />
        {chatUi}
      </Screen>
    );

  if (tvParam || me.spectator)
    return (
      <TvFrame>
        <TvMode
          view={view}
          rows={rows}
          elapsedMs={elapsed}
          phase={phase === "final" ? "podium" : phase}
          msToStart={start - now}
          beats={countdown.beats}
        />
        {me.spectator && host && phase === "lobby" && (
          <button
            type="button"
            onClick={() => act("start").catch((e) => err(e, "Can't start yet."))}
            className="toy bg-accent text-on-accent font-display fixed right-6 bottom-6 h-[60px] rounded-[20px] px-8 text-[20px] font-black [--btn-depth:var(--accent-depth)]"
          >
            Start
          </button>
        )}
        {me.spectator && host && phase === "podium" && (
          <button
            type="button"
            onClick={() => act("next")}
            className="toy bg-accent text-on-accent font-display fixed right-6 bottom-6 h-[60px] rounded-[20px] px-8 text-[20px] font-black [--btn-depth:var(--accent-depth)]"
          >
            {partyCopy.results.nextGame(view.round + 1, view.games.length)}
          </button>
        )}
        <MpToast toast={toast} />
      </TvFrame>
    );

  let body: React.ReactNode;
  if (phase === "lobby")
    body = (
      <Lobby
        view={view}
        present={present}
        emote={emotes.last}
        onEmote={(e) => emotes.send(e)}
        onChat={() => chat.setOpen(true)}
        unread={chat.unread}
        onReady={(r) => act("ready", { ready: r }).catch((e) => err(e, "Couldn't update."))}
        onStart={() => act("start").catch((e) => err(e, "Can't start yet."))}
        onLeave={leave}
        onSettings={() => setSettings(true)}
        onTv={() => router.push(`/party/${code}?view=tv`)}
        requests={host ? <HostJoinRequests matchId={id} channel={channel} /> : null}
      />
    );
  else if (phase === "podium" || phase === "final")
    body = (
      <Podium
        view={view}
        host={host}
        final={phase === "final"}
        onRunItBack={() => act("reset").catch((e) => err(e, "Couldn't reset."))}
        onNext={() => act("next").catch((e) => err(e, "Couldn't start the next game."))}
        onLeave={leave}
        onHome={leaveHome}
      />
    );
  else if (view.puzzle) {
    const iFinished = rows.find((r) => r.id === view.me)?.finished ?? false;
    const iPassed = !!view.players.find((p) => p.id === view.me)?.passed && !iFinished;
    const canPass = phase === "race" && !iFinished && !iPassed && !spectating && !isTurnMode(view.mode);
    const pass = async () => {
      setPassAsk(false);
      try {
        qc.setQueryData(matchKey(id), await api<MatchView>(`/api/v1/matches/${id}/pass`, { json: { round: view.round } }));
      } catch (e) {
        err(e, "Couldn't skip the round.");
      }
    };
    body = (
      <div className="relative flex flex-1 flex-col">
        <MatchBoard
          view={view}
          strip={
            <div className="flex flex-col">
              <RaceRail view={view} rows={rows} onToast={show} />
              {canPass &&
                (passAsk ? (
                  <div className="bg-surface -mx-3 flex items-center gap-2 px-3 pb-2.5" role="group" aria-label="Skip this round?">
                    <span className="text-muted min-w-0 flex-1 text-[13px]">Skip it? You score 0 for this game and play the next.</span>
                    <button
                      type="button"
                      onClick={() => setPassAsk(false)}
                      className="press bg-surface-raised h-9 flex-none rounded-[10px] px-3 text-[13px] font-semibold"
                    >
                      Keep playing
                    </button>
                    <button
                      type="button"
                      onClick={() => void pass()}
                      className="press bg-accent text-on-accent h-9 flex-none rounded-[10px] px-3 text-[13px] font-black"
                    >
                      Skip
                    </button>
                  </div>
                ) : (
                  <div className="bg-surface -mx-3 flex justify-end px-3 pb-2">
                    <button
                      type="button"
                      onClick={() => setPassAsk(true)}
                      className="press text-muted flex h-8 items-center gap-1.5 rounded-[10px] px-2 text-[13px] font-semibold"
                    >
                      <Icon name="fast-forward" size={15} />
                      Skip this round
                    </button>
                  </div>
                ))}
            </div>
          }
          locked={phase !== "race" || iFinished || iPassed}
          label={`Game ${view.round} of ${view.games.length}`}
          onExit={leaveRace.request}
          onFinished={onFinished}
          onRejected={onRejected}
          onFirstMove={onFirstMove}
        />
        {iPassed && phase === "race" && (
          <div className="absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(24px,env(safe-area-inset-bottom))]">
            <div
              role="status"
              className="bg-surface-raised flex items-center gap-3 rounded-[18px] px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,.45)]"
            >
              <Icon name="fast-forward" size={22} className="text-accent" />
              <span className="text-[15px] font-semibold">
                You skipped this game. {view.round < view.games.length ? `Back in for game ${view.round + 1}.` : "Results are coming."}
              </span>
            </div>
          </div>
        )}
        {phase === "countdown" && <RaceCountdown view={view} msToStart={start - now} beats={countdown.beats} />}
      </div>
    );
  } else if (phase === "countdown")
    // The puzzle is still on its way: the countdown runs on its own, the board drops in under it.
    body = (
      <div className="relative flex flex-1 flex-col">
        <RaceCountdown view={view} msToStart={start - now} beats={countdown.beats} />
      </div>
    );
  else body = <LoadingScreen />;

  return (
    <Screen label={`Party ${phase}`} wide={wide && racing && !!view.puzzle}>
      <MpToast toast={toast} />
      {body}
      {chatUi}
      <LeaveConfirm
        kind="party"
        open={leaveRace.asking}
        busy={leaveRace.busy}
        onKeep={leaveRace.keep}
        onLeave={() => void leaveRace.confirm()}
      />
      {settings && (
        <RoomSettings
          view={view}
          onClose={() => setSettings(false)}
          onSave={(s) =>
            act("settings", s)
              .then(() => setSettings(false))
              .catch((e) => err(e, "Couldn't save."))
          }
          onTv={() => router.push(`/party/${code}?view=tv`)}
          tv={
            tvOn
              ? {
                  open: !!view.tvOpen,
                  allowed: !!meQ.data && canHostTv(meQ.data),
                  url: `${typeof window === "undefined" ? "" : window.location.host}${tvPath(code)}`,
                  onToggle: (open) =>
                    act("tv", { open })
                      .then(() => show(partyCopy.tv.saved(open)))
                      .catch((e) => err(e, partyCopy.tv.failed)),
                  onOpen: () => window.open(tvPath(code), "_blank", "noopener"),
                }
              : null
          }
        />
      )}
    </Screen>
  );
}

/** The Party round-start countdown: Duel's 3-2-1-SPUZL! overlay, with the racers above it. Covers the whole board. */
function RaceCountdown({ view, msToStart, beats }: { view: MatchView; msToStart: number; beats: number }) {
  return (
    <CountdownOverlay msToStart={msToStart} beats={beats} blocking line={partyCopy.countdown.line(view.round, view.games.length)}>
      <div className="flex flex-wrap justify-center gap-2.5 px-4">
        {view.players
          .filter((p) => !p.spectator && !p.left)
          .map((p) => (
            <Avatar key={p.id} name={p.nickname} color={p.color} size={52} radius={16} />
          ))}
      </div>
    </CountdownOverlay>
  );
}

function RoomSettings({
  view,
  onClose,
  onSave,
  onTv,
  tv,
}: {
  view: MatchView;
  onClose: () => void;
  onSave: (s: { game: string | null; games: string[] | null; difficulty: Diff }) => void;
  onTv: () => void;
  /** R2-P5 big-screen view switch (admin "features.partyTv"); null hides it */
  tv: { open: boolean; allowed: boolean; url: string; onToggle: (open: boolean) => void; onOpen: () => void } | null;
}) {
  const [choice, setChoice] = useState<GameChoice>({
    game: view.gameId,
    picks: view.chosenGames.length ? view.chosenGames : null,
  });
  const [difficulty, setDifficulty] = useState<Diff>(view.difficulty as Diff);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-[rgba(6,7,13,.55)]" onClick={onClose} data-no-tick />
      <div
        role="dialog"
        aria-modal
        aria-label="Room settings"
        className="bg-surface relative flex w-full max-w-[560px] flex-col gap-3.5 rounded-t-[32px] px-5 pt-3.5 pb-[max(28px,env(safe-area-inset-bottom))]"
      >
        <div className="bg-line h-[5px] w-11 self-center rounded-[3px]" />
        <h2 className="font-display text-[22px] font-black">Room settings</h2>
        <GamePicker value={choice} onChange={setChoice} />
        <DifficultyPicker value={difficulty} onChange={setDifficulty} />
        <button
          type="button"
          onClick={onTv}
          className="press bg-surface-raised flex min-h-12 items-center justify-center gap-2 rounded-[16px] text-[16px] font-semibold"
        >
          <Icon name="television" size={20} />
          TV mode
        </button>
        {tv && <TvSwitch {...tv} />}
        <Cta disabled={!choiceReady(choice)} onClick={() => onSave({ game: choice.game, games: choice.picks, difficulty })}>
          {choiceReady(choice) ? "Save" : partyCopy.host.pickMore(PARTY_PICK_MIN)}
        </Cta>
      </div>
    </div>
  );
}

function AdultRoom({
  view,
  code,
  now,
  phase,
  present,
  emote,
  onEmote,
  act,
  err,
  show,
  onLeave,
  onHome,
  onChat,
  unread,
  channel,
  beats,
}: {
  view: MatchView;
  code: string;
  now: number;
  phase: ReturnType<typeof partyPhase>;
  /** the room's realtime channel (Draw It live ink) */
  channel: RealtimeChannel | null;
  present: Set<string>;
  emote: Parameters<typeof Lobby>[0]["emote"];
  onEmote: Parameters<typeof Lobby>[0]["onEmote"];
  act: (path: string, json?: unknown) => Promise<unknown>;
  err: (e: unknown, fallback: string) => void;
  show: (t: string, k?: "info" | "bad" | "pass") => void;
  onLeave: () => void;
  onHome: () => void;
  onChat: () => void;
  unread: number;
  /** the countdown's numbers (setting party.countdownSeconds) */
  beats: number;
}) {
  const qc = useQueryClient();
  const [players, setPlayers] = useState(false);
  const [kick, setKick] = useState<MatchPlayerView | null>(null);
  const host = view.hostId === view.me;
  // A round starting closes the players sheet and any kick question (chat is closed by the room).
  const [sheetsPhase, setSheetsPhase] = useState(phase);
  if (phase !== sheetsPhase) {
    setSheetsPhase(phase);
    if (phase === "countdown") {
      setPlayers(false);
      setKick(null);
    }
  }
  const mode = isTurnMode(view.mode) ? view.mode : "draw";
  const doKick = async () => {
    const p = kick;
    setKick(null);
    if (!p) return;
    try {
      await api(`/api/v1/rooms/${code}/kick`, { json: { playerId: p.id } });
      show(adultPartyCopy.kick.done(p.nickname), "info");
      void qc.invalidateQueries({ queryKey: matchKey(view.id) });
    } catch (e) {
      show(adultErrorText(e), "bad");
    }
  };
  let body: React.ReactNode;
  if (phase === "lobby")
    body = (
      <Lobby
        view={view}
        present={present}
        emote={emote}
        onEmote={onEmote}
        onChat={onChat}
        unread={unread}
        onReady={(r) => act("ready", { ready: r }).catch((e) => err(e, "Couldn't update."))}
        onStart={() => act("start").catch((e) => err(e, "Can't start yet."))}
        onLeave={onLeave}
        onSettings={() => setPlayers(true)}
        onTv={() => setPlayers(true)}
        adult={{ ...adultLobbyLine(mode), onPlayers: () => setPlayers(true) }}
      />
    );
  else if (phase === "final")
    body = (
      <Podium
        view={view}
        host={host}
        final
        subtitle={adultPartyCopy.podiumSub(modeName(mode), view.games.length, view.players.filter((p) => !p.spectator && !p.left).length)}
        rewardNote={
          view.players.filter((p) => !p.spectator && !p.left).length < ADULT_REWARD_MIN_PLAYERS
            ? adultPartyCopy.noReward.small(ADULT_REWARD_MIN_PLAYERS)
            : adultPartyCopy.noReward.idle
        }
        onRunItBack={() => act("reset").catch((e) => err(e, "Couldn't reset."))}
        onNext={() => undefined}
        onLeave={onLeave}
        onHome={onHome}
      />
    );
  else if (phase === "countdown")
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
        <h1 className="font-display text-[26px] font-black">{modeName(mode)}</h1>
        <CountdownNumber msToStart={(view.roundStartedAt ?? now) - now} beats={beats} />
      </div>
    );
  else if (view.party)
    body = <AdultRound view={view} code={code} now={now} host={host} channel={channel} onToast={show} onLeave={onLeave} />;
  else body = <LoadingScreen />;
  return (
    <>
      {body}
      {players && (
        <PlayersSheet
          view={view}
          host={host}
          onClose={() => setPlayers(false)}
          onKick={(p) => {
            setPlayers(false);
            setKick(p);
          }}
        />
      )}
      {kick && <KickConfirm player={kick} onConfirm={doKick} onClose={() => setKick(null)} />}
    </>
  );
}

/** Room settings: the host's big-screen view switch and its link (R2-P5). The server enforces both. */
function TvSwitch({
  open,
  allowed,
  url,
  onToggle,
  onOpen,
}: {
  open: boolean;
  allowed: boolean;
  url: string;
  onToggle: (open: boolean) => void;
  onOpen: () => void;
}) {
  const T = partyCopy.tv;
  return (
    <div className="bg-surface-raised flex flex-col gap-2.5 rounded-[16px] p-3.5">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span id="tv-switch-label" className="text-[16px] font-semibold">
            {T.switchLabel}
          </span>
          <span id="tv-switch-help" className="text-muted text-[14px] leading-snug">
            {allowed ? T.switchHelp : T.switchUnder16}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={open}
          aria-labelledby="tv-switch-label"
          aria-describedby="tv-switch-help"
          disabled={!allowed}
          onClick={() => onToggle(!open)}
          className={`press relative flex h-11 w-[68px] flex-none items-center rounded-full px-1 disabled:opacity-50 ${open ? "bg-accent" : "bg-line"}`}
        >
          <span
            aria-hidden
            className={`bg-bg size-9 rounded-full transition-transform duration-200 motion-reduce:transition-none ${open ? "translate-x-[24px]" : ""}`}
          />
        </button>
      </div>
      {open && allowed && (
        <div className="flex items-center gap-2">
          <span className="num text-muted min-w-0 flex-1 truncate text-[14px]">{T.linkLabel(url)}</span>
          <button
            type="button"
            onClick={onOpen}
            className="press bg-surface text-accent flex min-h-11 flex-none items-center gap-1.5 rounded-[12px] px-3 text-[14px] font-semibold"
          >
            <Icon name="arrow-square-out" size={18} />
            {T.openLink}
          </button>
        </div>
      )}
    </div>
  );
}
