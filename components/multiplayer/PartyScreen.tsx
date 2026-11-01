"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/ui/Icon";
import { Spuz } from "@/components/brand/Spuz";
import { api, HttpError, useMe } from "@/lib/client/api";
import { useCrew } from "@/lib/client/social";
import { matchAction, matchKey, useEmotes, useMatch, useProfileGate, useServerNow } from "@/lib/client/multiplayer";
import { useSettings } from "@/lib/settings/store";
import { useBackOrHome } from "@/lib/client/nav";
import { normalizeRoomCode } from "@/lib/multiplayer/roomCode";
import { partyPhase } from "@/lib/multiplayer/race";
import { raceGameParam, roomGamesName } from "@/lib/multiplayer/games";
import { PARTY_PICK_MIN } from "@/lib/multiplayer/constants";
import { partyCopy } from "@/lib/copy/party";
import type { MatchView } from "@/lib/multiplayer/types";
import { MatchBoard } from "./MatchBoard";
import {
  DifficultyPicker,
  GamePicker,
  HostRoom,
  JoinRoom,
  Lobby,
  PartyStart,
  Podium,
  RaceRail,
  TvMode,
  rowsOf,
  useJoinToasts,
  choiceReady,
  type Diff,
  type GameChoice,
  type PartyTab,
  type RoomRequest,
} from "./party";
import { Avatar, CountdownNumber, Cta, LoadingScreen, MpToast, NeedProfile, Screen, TopButton, useToast } from "./ui";

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
  if (gate === "loading") return <LoadingScreen />;
  if (gate === "no_profile") return <NeedProfile />;
  const open = async (r: RoomRequest) => {
    setBusy(true);
    try {
      const res = await api<{ code: string }>("/api/v1/rooms", { json: r });
      router.push(`/party/${res.code}${r.classroom ? "?view=tv" : ""}`);
    } catch {
      setBusy(false);
      show(partyCopy.host.failed, "bad");
    }
  };
  const join = (raw: string) => {
    const code = normalizeRoomCode(raw);
    if (!code) return show(partyCopy.join.badCode, "bad");
    router.push(`/party/${code}`);
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
        {tab === "host" ? <HostRoom initialGame={initialGame} busy={busy} onOpen={open} /> : <JoinRoom onJoin={join} />}
      </PartyStart>
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
  if (gate === "loading") return <LoadingScreen />;
  if (gate === "no_profile") return <NeedProfile />;
  const matchId = joined ?? (preview.data?.member ? preview.data.view.id : null);
  if (matchId) return <Room id={matchId} code={code} />;
  if (preview.isLoading) return <LoadingScreen />;
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
      setJoinErr(
        e instanceof HttpError
          ? e.code === "room_full"
            ? "This room is full."
            : e.message !== e.code
              ? e.message
              : "Couldn't join."
          : "Couldn't join.",
      );
    }
  };
  return (
    <Screen label="Join room">
      <div className="absolute top-[max(56px,env(safe-area-inset-top))] left-4">
        <TopButton icon="arrow-left" label="Back" onClick={back} />
      </div>
      <div className="flex flex-1 flex-col items-center gap-4 px-5 pt-[max(80px,env(safe-area-inset-top))] pb-[max(28px,env(safe-area-inset-bottom))] text-center">
        <Spuz mood="wave" size={130} />
        <h1 className="font-display text-[26px] font-black">{room.host ? `${room.host}'s party` : "Party room"}</h1>
        <p className="text-muted text-[16px]">
          {roomGamesName(room.game, room.chosen)}, 3 games. <span className="num">{room.count}</span> of{" "}
          <span className="num">{room.max}</span> in.
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
  const [settings, setSettings] = useState(false);
  useJoinToasts(view, show);

  const phase = view ? partyPhase({ status: view.status, roundStartedAt: view.roundStartedAt }, now) : "lobby";
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
  const leave = async () => {
    await matchAction(id, "leave").catch(() => {});
    router.push("/party");
  };

  if (tvParam || me.spectator)
    return (
      <TvFrame>
        <TvMode view={view} rows={rows} elapsedMs={elapsed} phase={phase === "final" ? "podium" : phase} msToStart={start - now} />
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
            Next game
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
        onReady={(r) => act("ready", { ready: r }).catch((e) => err(e, "Couldn't update."))}
        onStart={() => act("start").catch((e) => err(e, "Can't start yet."))}
        onLeave={leave}
        onSettings={() => setSettings(true)}
        onTv={() => router.push(`/party/${code}?view=tv`)}
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
      />
    );
  else if (view.puzzle) {
    const iFinished = rows.find((r) => r.id === view.me)?.finished ?? false;
    body = (
      <div className="relative flex flex-1 flex-col">
        <MatchBoard
          view={view}
          strip={<RaceRail view={view} rows={rows} onToast={show} />}
          locked={phase !== "race" || iFinished}
          label={`Game ${view.round} of ${view.games.length}`}
          onExit={leave}
          onFinished={onFinished}
          onRejected={onRejected}
        />
        {phase === "countdown" && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-[rgba(6,7,13,.8)]">
            <div className="flex flex-wrap justify-center gap-2.5 px-4">
              {view.players
                .filter((p) => !p.spectator && !p.left)
                .map((p) => (
                  <Avatar key={p.id} name={p.nickname} color={p.color} size={52} radius={16} />
                ))}
            </div>
            <CountdownNumber msToStart={start - now} />
            <p className="text-[17px] font-semibold text-[#A2A6C2]">Everyone gets the same puzzle. Go.</p>
          </div>
        )}
      </div>
    );
  } else body = <LoadingScreen />;

  return (
    <Screen label={`Party ${phase}`}>
      <MpToast toast={toast} />
      {body}
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
        />
      )}
    </Screen>
  );
}

function RoomSettings({
  view,
  onClose,
  onSave,
  onTv,
}: {
  view: MatchView;
  onClose: () => void;
  onSave: (s: { game: string | null; games: string[] | null; difficulty: Diff }) => void;
  onTv: () => void;
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
        <Cta disabled={!choiceReady(choice)} onClick={() => onSave({ game: choice.game, games: choice.picks, difficulty })}>
          {choiceReady(choice) ? "Save" : partyCopy.host.pickMore(PARTY_PICK_MIN)}
        </Cta>
      </div>
    </div>
  );
}

/** Scales the 1280 × 720 TV frame to the screen, letterboxed. */
function TvFrame({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / 1280, window.innerHeight / 720));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div className="bg-bg fixed inset-0 flex items-center justify-center overflow-hidden">
      <div style={{ width: 1280, height: 720, transform: `scale(${scale})`, transformOrigin: "center" }}>{children}</div>
    </div>
  );
}
