"use client";

import { GameOverBanner, type GameOutcome } from "@/components/game/GameOverBanner";
import { gameOverCopy } from "@/lib/copy/game-over";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWide } from "@/components/game/useBoardSize";
import { useLeave } from "@/components/game/useLeave";
import { LeaveConfirm } from "@/components/game/LeaveConfirm";
import { leavePolicy, type LeaveContext } from "@/lib/game/leave";
import { sidePanel } from "@/lib/copy/side-panel";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import { boardGames } from "@/lib/copy/board-games";
import { Spuz } from "@/components/brand/Spuz";
import { DEFAULT_SKIN, MySpuz } from "@/components/meta/MySpuz";
import { SpuzWear } from "@/components/meta/SpuzWear";
import { shopCopy } from "@/lib/copy/shop";
import { YourMoveInbox, type InboxGame } from "@/components/board/YourMoveInbox";
import { api, HttpError } from "@/lib/client/api";
import { useBay, useEmotes, useMatchChat, useProfileGate, useServerNow } from "@/lib/client/multiplayer";
import { GAME_BY_ID } from "@/lib/catalog";
import { formatClock, formatNumber } from "@/lib/format";
import { play } from "@/lib/audio";
import { BAY_GAMES, isBayGame, loadRules, takebackPlies, type AnyRules, type BayGame, type BayRulesGame } from "@/lib/multiplayer/bay";
import { bayLive } from "@/lib/copy/bay-live";
import { playBayMove } from "@/lib/audio/boardMoves";
import { useSettings } from "@/lib/settings/store";
import { BaySearch } from "./BaySearch";
import { LudoSetup, NO_KICKS, kicksFromParam, kicksToParam, type LudoKicks } from "./LudoSetup";
import { TimePicker, useMinutes } from "./TimePicker";
import type { BayView } from "@/lib/multiplayer/types";
import { ShareCode } from "../party";
import { InviteFriends } from "../InviteFriends";
import { AddFriend } from "../AddFriend";
import { ChatPanel, ChatPopup } from "../chat";
import { alertIfAway, alertsAllowed, alertsSupported, askAlerts } from "@/lib/client/alerts";
import { Avatar, Cta, EmoteBar, EmoteBubble, LoadingScreen, MpToast, NeedProfile, Screen, TopButton, useToast } from "../ui";
import { LiveBoard } from "./boards";
import { Modal } from "@/components/ui/Modal";

/* ---------------- /bay: "Your move" inbox (B7) and new games ---------------- */

export function BayInbox() {
  const gate = useProfileGate();
  const router = useRouter();
  const sp = useSearchParams();
  const liveParam = sp.get("live");
  const newParam = sp.get("new");
  const liveGame = liveParam && isBayGame(liveParam) ? liveParam : null;
  const liveMinutes = Number(sp.get("t")) || null;
  const newGame = newParam && isBayGame(newParam) ? newParam : null;
  const { toast, show } = useToast();
  const [sheet, setSheet] = useState(!!newGame);
  const q = useQuery({
    queryKey: ["bay-inbox"],
    enabled: gate === "ready" && !liveGame,
    queryFn: () => api<{ games: InboxGame[] }>("/api/v1/bay"),
    refetchInterval: 30_000,
  });
  if (gate === "loading") return <LoadingScreen />;
  if (gate === "no_profile") return <NeedProfile />;
  if (liveGame)
    return (
      <BaySearch
        key={`${liveGame}-${liveMinutes}`}
        game={liveGame}
        minutes={liveMinutes}
        rules={kicksFromParam(sp.get("rules"))}
        seats={Number(sp.get("seats")) || 2}
      />
    );
  const action = async (id: string, a: "nudge" | "rematch") => {
    try {
      const v = await api<BayView>(`/api/v1/bay/${id}/action`, { json: { action: a } });
      if (a === "rematch") router.push(`/bay/${v.id}`);
      else {
        show("Nudged. They'll see it next time they open SPUZL.");
        void q.refetch();
      }
    } catch (e) {
      show(e instanceof HttpError && e.message !== e.code ? e.message : "Couldn't do that.", "bad");
    }
  };
  return (
    <Screen label="B7 Your move">
      <MpToast toast={toast} />
      <div className="absolute top-[max(12px,env(safe-area-inset-top))] left-4 z-10">
        <TopButton icon="arrow-left" label="Back" href="/" />
      </div>
      {q.isLoading ? (
        <LoadingScreen />
      ) : (
        <YourMoveInbox
          games={q.data?.games ?? []}
          onPlay={(id) => router.push(`/bay/${id}`)}
          onNudge={(id) => action(id, "nudge")}
          onRematch={(id) => action(id, "rematch")}
          onNewGame={() => setSheet(true)}
        />
      )}
      {sheet && (
        <NewBaySheet
          initialGame={newGame ?? "chess"}
          onClose={() => setSheet(false)}
          onCreated={(id) => router.push(`/bay/${id}`)}
          onLive={(g, m, r, n) => router.push(`/bay?live=${g}${m ? `&t=${m}` : ""}${r ? `&rules=${r}` : ""}${n > 2 ? `&seats=${n}` : ""}`)}
        />
      )}
    </Screen>
  );
}

function NewBaySheet({
  initialGame,
  onClose,
  onCreated,
  onLive,
}: {
  initialGame: BayGame;
  onClose: () => void;
  onCreated: (id: string) => void;
  onLive: (game: BayGame, minutes: number | null, rules: string, seats: number) => void;
}) {
  const relaxed = useSettings((s) => s.relaxed);
  const [game, setGame] = useState<BayGame>(initialGame);
  const [mode, setMode] = useState<"live" | "async">("async");
  const [minutes, setMinutes] = useMinutes(game);
  const [busy, setBusy] = useState(false);
  // Ludo house rules, chosen before the match (games with friends and the Practice bot; Quick Match stays standard)
  const [kicks, setKicks] = useState<LudoKicks>(NO_KICKS);
  // Ludo seats 2 to 4: with the bot the other seats are bots; with friends the game starts when that many joined
  const [seats, setSeats] = useState(2);
  const create = async (bot: boolean) => {
    setBusy(true);
    try {
      const v = await api<BayView>("/api/v1/bay", {
        json: { game, mode, bot, ...(mode === "live" ? { minutes } : {}), ...(game === "ludo" ? { ludo: kicks, seats } : {}) },
      });
      onCreated(v.id);
    } catch {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      zIndex={40}
      gap="gap-3.5"
      title="New game"
      style={{ ["--world" as string]: "var(--accent)" }}
    >
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Game">
        {BAY_GAMES.map((g) => (
          <button
            key={g}
            type="button"
            role="radio"
            aria-checked={game === g}
            onClick={() => setGame(g)}
            className="press flex h-[72px] flex-col items-center justify-center gap-1 rounded-[16px]"
            style={{
              background: game === g ? "color-mix(in srgb, var(--accent) 16%, var(--bg))" : "var(--surface-raised)",
              boxShadow: game === g ? "inset 0 0 0 2px var(--accent)" : undefined,
            }}
          >
            <Icon name={GAME_BY_ID[g].icon} size={22} />
            <span className="text-[14px] font-semibold">{GAME_BY_ID[g].name}</span>
          </button>
        ))}
      </div>
      <div className="bg-bg flex gap-1 rounded-[16px] p-1" role="radiogroup" aria-label="Pace">
        {(["async", "live"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className="flex h-11 flex-1 items-center justify-center rounded-[12px] text-[15px] font-semibold"
            style={mode === m ? { background: "var(--surface-raised)" } : { color: "var(--text-muted)" }}
          >
            {m === "async" ? "24 h per move" : "Live, timed"}
          </button>
        ))}
      </div>
      {mode === "live" && <TimePicker game={game} value={minutes} onChange={setMinutes} />}
      {game === "ludo" && <LudoSetup kicks={kicks} onKicks={setKicks} seats={seats} onSeats={setSeats} />}
      <Cta onClick={() => create(false)} disabled={busy} icon="user-plus">
        Invite a friend
      </Cta>
      {!relaxed && (
        <Cta
          tone="raised"
          onClick={() =>
            onLive(game, mode === "live" ? minutes : null, game === "ludo" ? kicksToParam(kicks) : "", game === "ludo" ? seats : 2)
          }
          disabled={busy}
          icon="lightning"
        >
          {bayLive.playLive}
        </Cta>
      )}
      <button type="button" onClick={() => create(true)} disabled={busy} className="text-muted min-h-12 text-[16px] font-semibold">
        Play the Practice bot
      </button>
    </Modal>
  );
}

/* ---------------- /bay/[matchId]: the shared board (B3) ---------------- */

const START_MATERIAL: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const GLYPH: Record<string, string> = { p: "♟︎", n: "♞︎", b: "♝︎", r: "♜︎", q: "♛︎" };
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
/** Pieces each side has taken, from the FEN (B3 shows them under each name). */
function captured(fen: string) {
  const board = fen.split(" ")[0];
  const count = (ch: string) => [...board].filter((c) => c === ch).length;
  const takenBy = (white: boolean) =>
    Object.keys(START_MATERIAL).flatMap((k) => {
      const lost = START_MATERIAL[k] - count(white ? k : k.toUpperCase());
      return Array.from({ length: Math.max(0, lost) }, () => k);
    });
  const w = takenBy(true),
    b = takenBy(false);
  const sum = (l: string[]) => l.reduce((s, k) => s + VALUE[k], 0);
  return { white: w, black: b, diff: sum(w) - sum(b) };
}

export function BayMatch({ id }: { id: string }) {
  const gate = useProfileGate();
  const router = useRouter();
  const join = useSearchParams().get("join");
  const { data: v, channel, set, error, refetch } = useBay(gate === "ready" ? id : null);
  const now = useServerNow(v?.serverNow, 250);
  const { toast, show } = useToast();
  const [rules, setRules] = useState<AnyRules | null>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState("");
  const [emoteOpen, setEmoteOpen] = useState(false);
  // Resign (and a draw offer to the bot, which it always takes) ends the game, so it asks first.
  const [asking, setAsking] = useState<{ id: string; kind: "resign" | "draw" } | null>(null);
  const meId = v && v.mySeat !== null ? v.players[v.mySeat]?.id : undefined;
  const emotes = useEmotes(channel, meId);
  // Chat with the other players (not with the Practice bot), from the moment the game starts.
  const chat = useMatchChat(v && !v.bot && v.mySeat !== null && v.status !== "waiting" ? v.id : null, channel, meId, "bay");
  const wide = useWide();
  // Leaving (lib/game/leave.ts): a live game against a person asks first and resigns, so they win at once;
  // an async game or one against the Practice bot waits in Your move.
  const leaveContext: LeaveContext = !v ? "bay-async" : v.bot ? "bay-bot" : v.mode === "live" ? "bay-live" : "bay-async";
  const leavePlan = leavePolicy({ context: leaveContext, over: !v || v.status !== "active" || v.mySeat === null });
  const leave = useLeave({
    policy: leavePlan,
    exit: () => router.push("/bay"),
    forfeit: ({ keepalive }) => (v ? api(`/api/v1/bay/${v.id}/action`, { json: { action: "resign" }, keepalive }) : undefined),
  });

  useEffect(() => {
    if (v?.game) void loadRules(v.game as BayRulesGame).then(setRules);
  }, [v?.game]);
  useEffect(() => {
    if (v?.rematchId) router.replace(`/bay/${v.rematchId}`);
  }, [v?.rematchId, router]);
  // The other side moved: the move's own sound, worked out from the board before and after (the live region below
  // announces it). Our own moves sound as they are sent, in move() below.
  const lastPly = v?.ply ?? 0;
  const lastSeat = v?.moves[v.moves.length - 1]?.seat;
  const prevBoard = useRef<{ ply: number; state: unknown } | null>(null);
  useEffect(() => {
    const prev = prevBoard.current;
    if (v) prevBoard.current = { ply: v.ply, state: v.state };
    if (!v || !prev || v.ply <= prev.ply) return;
    const last = v.moves[v.moves.length - 1];
    if (last && last.seat !== v.mySeat) playBayMove(v.game, prev.state, v.state, last.move);
  }, [lastPly]); // eslint-disable-line react-hooks/exhaustive-deps

  const legal = useMemo(() => {
    if (!v || !rules || v.mySeat === null || v.status !== "active") return [];
    try {
      return rules.turn(v.state) === v.mySeat ? rules.legalMoves(v.state, v.mySeat) : [];
    } catch {
      return [];
    }
  }, [v, rules]);

  // Your turn came round: a chime and a buzz, and in a background tab a flashing title (and a system notification
  // when allowed). The name row below lights up with "Your turn" too. The rest of the app hears it through the
  // inbox (components/shell/Inbox.tsx); this is the screen you are already on.
  const turnIsMine = !!v && v.status === "active" && v.mySeat !== null && v.turn === v.mySeat;
  const wasMine = useRef<boolean | null>(null);
  useEffect(() => {
    const prev = wasMine.current;
    wasMine.current = turnIsMine;
    if (prev !== false || !turnIsMine || !v) return;
    play("notify");
    alertIfAway("Your turn", `Your move in ${GAME_BY_ID[v.game]?.name ?? "your game"}.`, `/bay/${v.id}`, `turn:${v.id}`);
  }, [turnIsMine]); // eslint-disable-line react-hooks/exhaustive-deps
  const [alertsOn, setAlertsOn] = useState(() => alertsAllowed());

  /** Sends a move; resolves false when the server refused it (the toast says why), so the board can put it back. */
  const move = useCallback(
    async (m: unknown): Promise<boolean> => {
      if (!v || busy) return false;
      setBusy(true);
      try {
        const next = await api<BayView>(`/api/v1/bay/${v.id}/move`, { json: { ply: v.ply, move: m } });
        set(next);
        playBayMove(v.game, v.state, next.state, m);
        return true;
      } catch (e) {
        const code = e instanceof HttpError ? e.code : "";
        if (code === "illegal_move") {
          play("buzz");
          show("That move isn't legal here.", "bad");
        } else if (code === "stale_ply") show("The board moved on. Refreshing.", "bad");
        else if (code === "not_your_turn") show("Not your turn yet.", "bad");
        else show("Couldn't send that move.", "bad");
        void refetch();
        return false;
      } finally {
        setBusy(false);
      }
    },
    [v, busy, set, show, refetch],
  );
  const action = async (a: string, ok?: string) => {
    if (!v) return;
    try {
      set(await api<BayView>(`/api/v1/bay/${v.id}/action`, { json: { action: a } }));
      if (ok) show(ok);
    } catch (e) {
      show(e instanceof HttpError && e.message !== e.code ? e.message : "Couldn't do that.", "bad");
    }
  };

  if (gate === "loading") return <LoadingScreen />;
  if (gate === "no_profile") return <NeedProfile />;
  if (error && !v)
    return (
      <Screen label="Bay missing">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <Spuz mood="shocked" size={110} />
          <h1 className="font-display text-[24px] font-black">This game isn&apos;t yours</h1>
          <Cta onClick={() => router.push("/bay")} className="w-full max-w-[358px]">
            Your move
          </Cta>
        </div>
      </Screen>
    );
  if (!v) return <LoadingScreen />;

  const meta = GAME_BY_ID[v.game];
  const seat = v.mySeat;
  // Invite: not seated yet.
  if (seat === null)
    return (
      <Screen label="Bay invite" style={{ ["--world" as string]: "var(--accent)" }}>
        <MpToast toast={toast} />
        <div className="flex flex-1 flex-col items-center gap-4 px-5 pt-[max(80px,env(safe-area-inset-top))] pb-[max(28px,env(safe-area-inset-bottom))] text-center">
          {/* The host, wearing their look */}
          <SpuzWear
            mood="wave"
            size={120}
            color={v.players[0]?.color ?? DEFAULT_SKIN}
            hat={v.players[0]?.hat}
            label={v.players[0] ? shopCopy.theirSpuz(v.players[0].nickname) : undefined}
          />
          <h1 className="font-display text-[26px] font-black">
            {v.players[0]?.nickname} wants a game of {meta?.name}
          </h1>
          <p className="text-muted text-[16px]">
            {v.mode === "live"
              ? `Live, ${Math.round((v.clockBaseMs ?? 300_000) / 60_000)} minutes each.`
              : "24 h per move. Nudge after 12."}
          </p>
          <Cta
            className="mt-auto w-full"
            disabled={!join || v.status !== "waiting"}
            onClick={async () => {
              try {
                set(await api<BayView>(`/api/v1/bay/${v.id}/join`, { json: { code: join } }));
              } catch (e) {
                // R4-02: an under-16 host's invite is friends only; the server says how to get in.
                show(e instanceof HttpError && e.code === "friends_only" ? e.message : "This invite is closed.", "bad");
              }
            }}
          >
            {v.status === "waiting" ? "Join" : "Game already started"}
          </Cta>
        </div>
      </Screen>
    );

  const opp = v.players.find((p) => p.seat !== seat) ?? null;
  // A confirm belongs to this match only (a rematch opens a new one on the same screen).
  const ask = asking?.id === v.id ? asking.kind : null;
  const setAsk = (kind: "resign" | "draw" | null) => setAsking(kind ? { id: v.id, kind } : null);
  const me = v.players[seat];
  const myTurn = v.status === "active" && v.turn === seat;
  const clock = (s: number) => {
    if (!v.clockMs) return null;
    const run = v.status === "active" && v.turn === s && v.turnStartedAt ? now - v.turnStartedAt : 0;
    return Math.max(0, v.clockMs[s] - run);
  };
  const chess = v.game === "chess" ? captured((v.state as { fen: string }).fen) : null;
  const sans = v.game === "chess" ? ((v.state as { sans: string[] }).sans ?? []) : [];
  const lastMove = v.moves[v.moves.length - 1]?.move;
  const offerFromThem = (o: number | null) => o !== null && o !== seat;
  // A bot's win is stored without a winner id (the bot isn't a player row), so a finished bot match that isn't a
  // draw by its result is the bot's win.
  const DRAWS = ["draw", "agreed draw", "stalemate", "insufficient material", "fifty-move rule", "threefold repetition"];
  const botWon = v.status === "finished" && v.bot && !v.winnerId && !DRAWS.includes(v.result ?? "draw");
  const finishedLine =
    v.status === "finished" && botWon
      ? `The Practice bot won${v.result === "resign" ? ". You resigned." : v.result === "flag" || v.result === "timeout" ? " on time." : "."}`
      : v.status === "finished"
        ? v.winnerId === me.id
          ? `You won. ${v.result === "resign" ? "They resigned." : v.result === "flag" ? "Their flag fell." : v.result === "timeout" ? "They ran out of time." : ""}`
          : v.winnerId
            ? `${opp?.nickname ?? "They"} won${v.result === "resign" ? ". You resigned." : v.result === "flag" ? " on time." : "."}`
            : `A draw${v.result && v.result !== "draw" ? `, ${v.result}` : ""}.`
        : null;

  const row = (p: typeof me | null, mine: boolean) => {
    if (!p) return null;
    const c = clock(p.seat);
    const active = v.status === "active" && v.turn === p.seat;
    const taken = chess ? (p.seat === 0 ? chess.black : chess.white) : [];
    const diff = chess ? (p.seat === 0 ? -chess.diff : chess.diff) : 0;
    return (
      <div className="flex items-center gap-2.5 px-3">
        <Avatar name={p.nickname} color={p.color} hat={p.hat} me={mine} size={44} radius={14}>
          {!mine && (
            <EmoteBubble
              emote={emotes.last && emotes.last.from !== meId ? emotes.last.e : null}
              n={emotes.last && emotes.last.from !== meId ? emotes.last.n : 0}
              className="-top-[30px] left-[30px]"
            />
          )}
          {mine && (
            <EmoteBubble
              emote={emotes.last && emotes.last.from === meId ? emotes.last.e : null}
              n={emotes.last && emotes.last.from === meId ? emotes.last.n : 0}
              className="-top-[30px] left-[30px]"
            />
          )}
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2 text-[15px] font-semibold">
            <span className="truncate">
              {mine ? "You" : p.nickname} · <span className="num">{p.id.startsWith("00000000") ? "Bot" : formatNumber(p.rating)}</span>
            </span>
            {!mine && busy && v.bot && v.status === "active" && (
              <span className="text-muted flex flex-none items-center gap-1.5 text-[13px] font-semibold" role="status">
                <span aria-hidden className="bay-tick size-2 rounded-full bg-current" />
                {boardGames.match.thinking}
              </span>
            )}
            {mine && active && (
              <span
                key={v.turnStartedAt ?? 0}
                className="bay-your-turn bg-accent text-on-accent font-display flex-none rounded-full px-2.5 py-0.5 text-[13px] font-black"
              >
                Your turn
              </span>
            )}
          </span>
          {chess && (
            <span
              className="flex items-center gap-1 text-[16px] tracking-[1px]"
              style={{
                fontFamily: "'Segoe UI Symbol','Noto Sans Symbols 2','DejaVu Sans',serif",
                color: mine ? "var(--bay-captured-mine)" : "var(--text)",
              }}
            >
              {taken.map((k, i) => (
                <span key={i}>{GLYPH[k]}</span>
              ))}
              {diff > 0 && <span className="num text-muted ml-1 font-sans text-[12px] font-semibold">+{diff}</span>}
            </span>
          )}
          {/* Whose move, in words. Chess with a clock says it with the lit clock; without one (async) it needs this too. */}
          {(!chess || c === null) && v.status === "active" && (
            <span className="text-muted text-[13px]" data-turn-line>
              {active ? (mine ? boardGames.match.yourMove : boardGames.match.theirMove) : boardGames.match.waiting}
            </span>
          )}
        </div>
        {c !== null ? (
          <div
            role="timer"
            aria-label={`${mine ? "Your" : "Their"} clock ${formatClock(c)}`}
            className="num flex flex-none items-center gap-2 rounded-[14px] px-4 font-semibold"
            style={
              active && mine
                ? {
                    height: 48,
                    background: "var(--accent)",
                    color: "var(--on-accent)",
                    fontSize: 24,
                    boxShadow: "0 4px 0 var(--accent-depth)",
                  }
                : { height: 44, background: "var(--surface)", color: active ? "var(--text)" : "var(--text-muted)", fontSize: 22 }
            }
          >
            {active && <span className="bay-tick size-2 rounded-full bg-current" />}
            {formatClock(c)}
          </div>
        ) : v.moveDeadline && active ? (
          <span className="num text-muted text-[14px] font-semibold">
            {Math.max(0, Math.floor((v.moveDeadline - now) / 3_600_000))} h left
          </span>
        ) : null}
      </div>
    );
  };

  const tools = [
    v.game !== "ludo" && !v.rated
      ? {
          l: "Takeback",
          i: "arrow-u-up-left",
          c: "var(--text-muted)",
          on: () => action("takeback_request", v.bot ? undefined : "Takeback asked."),
          // Nothing of yours to take back yet: off, and it says why (the server refuses it too).
          off: takebackPlies(v.moves, seat) === 0 ? boardGames.match.noTakeback : undefined,
        }
      : null,
    { l: "Draw", i: "handshake", c: "var(--text)", on: () => (v.bot ? setAsk("draw") : action("draw_offer", "Draw offered.")) },
    { l: "Resign", i: "flag", c: "var(--danger)", on: () => setAsk("resign") },
    v.mode === "async" && !myTurn
      ? { l: "Nudge", i: "bell-ringing", c: "var(--text)", on: () => action("nudge", "Nudged.") }
      : { l: "Emote", i: "smiley", c: "var(--accent)", on: () => setEmoteOpen((o) => !o) },
    !v.bot
      ? { l: chat.unread ? `Chat (${chat.unread})` : "Chat", i: "chat-circle-text", c: "var(--accent)", on: () => chat.setOpen(true) }
      : null,
  ].filter(Boolean) as { l: string; i: string; c: string; on: () => void; off?: string }[];

  const oppRow = row(opp, false);
  const meRow = row(me, true);
  const board = (
    <LiveBoard
      game={v.game}
      state={v.state}
      seat={seat}
      legal={legal}
      disabled={!myTurn || busy}
      lastMove={lastMove}
      onMove={move}
      announce={setLive}
      explain={(text) => {
        play("buzz");
        show(text, "bad");
      }}
      names={[...v.players].sort((a, b) => a.seat - b.seat).map((p) => p.nickname)}
    />
  );
  const moves =
    sans.length > 0 &&
    (wide ? (
      <MoveList sans={sans} />
    ) : (
      <div
        className="bg-surface num text-muted mx-4 mt-3 flex items-center gap-2 overflow-hidden rounded-[14px] px-3 py-2 text-[14px] font-medium whitespace-nowrap"
        aria-label="Moves"
      >
        {sans.slice(-6).map((s, i, a) => {
          const ply = sans.length - a.length + i;
          return (
            <span key={ply} className="flex gap-2">
              {ply % 2 === 0 && <span>{ply / 2 + 1}.</span>}
              <span className={i === a.length - 1 ? "rounded-[6px] bg-[var(--accent)] px-1.5 text-[var(--square-ink)]" : "text-text"}>
                {s}
              </span>
            </span>
          );
        })}
      </div>
    ));
  const gap = wide ? "" : "mx-4 mt-3";
  const offer = (offerFromThem(v.drawOffer) || offerFromThem(v.takebackOffer)) && v.status === "active" && (
    <div className={`bg-surface-raised flex items-center gap-2 rounded-[16px] p-3 ${gap}`} role="alert">
      <span className="flex-1 text-[15px] font-medium">
        {offerFromThem(v.drawOffer) ? `${opp?.nickname} offers a draw.` : `${opp?.nickname} asks for a takeback.`}
      </span>
      <button
        type="button"
        className="press bg-accent text-on-accent min-h-11 rounded-[12px] px-3 text-[14px] font-bold"
        onClick={() => action(offerFromThem(v.drawOffer) ? "draw_accept" : "takeback_accept")}
      >
        Accept
      </button>
      <button
        type="button"
        className="press bg-surface min-h-11 rounded-[12px] px-3 text-[14px] font-bold"
        onClick={() => action(offerFromThem(v.drawOffer) ? "draw_decline" : "takeback_decline")}
      >
        Decline
      </button>
    </div>
  );
  const M = boardGames.match;
  // Your own draw offer, still standing: say so, and let it be taken back (the server checks it is yours).
  const myOffer = v.status === "active" && !v.bot && v.drawOffer === seat && (
    <div className={`bg-surface flex items-center gap-2 rounded-[16px] p-3 ${gap}`} role="status" data-bay-my-offer>
      <span className="flex-1 text-[15px] font-medium">{M.drawPending(opp?.nickname ?? "them")}</span>
      <button
        type="button"
        className="press bg-surface-raised min-h-11 rounded-[12px] px-3 text-[14px] font-bold"
        onClick={() => action("draw_withdraw", M.drawWithdrawn)}
      >
        {M.withdraw}
      </button>
    </div>
  );
  // Resign, or a draw the bot will take: one more tap to be sure (it used to end the game on the first tap).
  const confirm = ask && v.status === "active" && (
    <div className={`bg-surface-raised flex flex-wrap items-center gap-2 rounded-[16px] p-3 ${gap}`} role="alert" data-bay-confirm={ask}>
      <span className="min-w-0 flex-1 basis-[180px] text-[15px] font-medium">
        {ask === "draw" ? M.drawAskBot : v.bot ? M.resignAskBot : M.resignAsk(opp?.nickname ?? "They")}
      </span>
      <div className="flex gap-2">
        <Button
          size="md"
          variant={ask === "resign" ? "danger" : "primary"}
          icon={ask === "resign" ? "flag" : "handshake"}
          onClick={() => {
            setAsk(null);
            void action(ask === "resign" ? "resign" : "draw_offer");
          }}
        >
          {ask === "resign" ? M.resign : M.draw}
        </Button>
        <Button size="md" variant="secondary" autoFocus onClick={() => setAsk(null)}>
          {M.keep}
        </Button>
      </div>
    </div>
  );
  // The end of the game, made unmissable (owner: "I just won a game of chess and didn't even know").
  const iWon = v.status === "finished" && v.winnerId === me.id;
  const outcome: GameOutcome | null =
    v.status !== "finished" || v.mySeat === null ? null : iWon ? "won" : v.winnerId || botWon ? "lost" : "draw";
  const R = gameOverCopy.reason;
  const reason = (() => {
    switch (v.result) {
      case "checkmate":
        return R.checkmate;
      case "resign":
        return iWon ? R.resign : R.youResigned;
      case "flag":
        return iWon ? R.flag : R.yourFlag;
      case "timeout":
        return iWon ? R.timeout : R.yourTimeout;
      case "agreed draw":
        return R.agreed;
      case "stalemate":
        return R.stalemate;
      case null:
      case "win":
      case "draw":
        return undefined;
      default:
        return v.result ? v.result[0].toUpperCase() + v.result.slice(1) + "." : undefined;
    }
  })();
  const gameOver = (
    <GameOverBanner
      id={`bay:${v.id}`}
      metric={{ game: v.game, kind: v.bot ? "bot" : "bay" }}
      outcome={outcome}
      reason={reason}
      actionLabel={gameOverCopy.rematch}
      onAction={() => action("rematch")}
    />
  );
  const finished = finishedLine && (
    <div className={`bg-surface flex items-center gap-3 rounded-[18px] p-3.5 ${gap}`} role="status">
      <MySpuz mood={v.winnerId === me.id ? "party" : v.winnerId || botWon ? "sad" : "thinking"} size={56} decorative />
      <span className="flex-1 text-[16px] font-semibold">{finishedLine}</span>
    </div>
  );
  // After the game: add the people you played as friends (never the Practice bot)
  const addFriends = v.status === "finished" && !v.bot && (
    <div className={`flex flex-wrap items-center gap-2 ${gap}`}>
      {v.players
        .filter((p) => p.seat !== seat)
        .map((p) => (
          <span key={p.id} className="bg-surface flex items-center gap-2 rounded-[14px] p-1.5 pl-3">
            <span className="max-w-[140px] truncate text-[14px] font-semibold">{p.nickname}</span>
            <AddFriend id={p.id} nickname={p.nickname} onError={(t) => show(t, "bad")} />
          </span>
        ))}
    </div>
  );
  const emoteBar = emoteOpen && (
    <div className={gap}>
      <EmoteBar
        onSend={(e) => {
          if (emotes.send(e)) setEmoteOpen(false);
        }}
        onChat={
          v.bot
            ? undefined
            : () => {
                setEmoteOpen(false);
                chat.setOpen(true);
              }
        }
        unread={chat.unread}
      />
    </div>
  );
  const toolRow = (
    <div
      className={wide ? "grid gap-2 pt-1" : "mt-auto grid gap-2 px-4 pt-3 pb-[max(28px,env(safe-area-inset-bottom))]"}
      style={{ gridTemplateColumns: v.status === "finished" ? "minmax(0, 1fr) auto" : `repeat(${tools.length}, minmax(0, 1fr))` }}
    >
      {v.status === "finished" ? (
        <>
          <Cta icon="arrows-clockwise" onClick={() => action("rematch")}>
            Rematch
          </Cta>
          <Link
            href="/"
            aria-label="Home"
            className="toy bg-surface-raised flex h-[60px] w-[60px] items-center justify-center rounded-[20px] [--btn-depth:var(--depth)]"
            style={{ boxShadow: "0 6px 0 var(--depth)" }}
          >
            <Icon name="house" size={22} />
          </Link>
        </>
      ) : (
        tools.map((t) => (
          <button
            key={t.l}
            type="button"
            // An unavailable tool stays focusable (aria-disabled) so its reason is read out, and a tap shows it.
            onClick={t.off ? () => show(t.off!) : t.on}
            aria-disabled={t.off ? true : undefined}
            aria-describedby={t.off ? `bay-tool-off-${t.l}` : undefined}
            className={`toy flex h-[60px] flex-col items-center justify-center gap-[3px] rounded-[18px] px-1 [--btn-depth:var(--depth)] ${t.off ? "toy-disabled" : "bg-surface-raised"}`}
            style={t.off ? undefined : { boxShadow: "0 5px 0 var(--depth)", color: t.c }}
          >
            <Icon name={t.i} size={22} />
            <span className="text-[13px] font-semibold">{t.l}</span>
            {t.off && (
              <span id={`bay-tool-off-${t.l}`} className="sr-only">
                {t.off}
              </span>
            )}
          </button>
        ))
      )}
    </div>
  );

  return (
    <Screen label="B3 Bay match" wide={wide} style={{ ["--world" as string]: "var(--accent)", ["--world-ink" as string]: "var(--accent)" }}>
      <MpToast toast={toast} />
      <div aria-live="polite" className="sr-only">
        {live ||
          (lastSeat !== undefined && lastSeat !== seat
            ? `${v.players[lastSeat]?.nickname ?? "They"} moved. ${myTurn ? "Your move." : ""}`
            : "")}
      </div>
      <div
        className={
          wide
            ? "flex items-center gap-2 px-9 pt-[max(20px,env(safe-area-inset-top))] pb-2"
            : "flex items-center gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))]"
        }
      >
        <TopButton icon="arrow-left" label="Back" onClick={leave.request} />
        <h1 className="font-display flex-1 text-[22px] font-black text-[var(--accent)] [[data-theme=light]_&]:text-[var(--accent)]">
          {meta?.name}
        </h1>
        <span className="text-muted text-[14px] font-medium whitespace-nowrap">
          {v.mode === "live" ? "Live" : "24 h per move"}
          {v.bot ? " · Practice bot" : ""}
        </span>
        {!v.bot && alertsSupported() && !alertsOn && v.status !== "finished" && (
          <TopButton
            icon="bell"
            label="Alert me when it's my turn"
            onClick={async () => {
              const on = await askAlerts();
              setAlertsOn(on);
              show(
                on ? "We'll let you know when it's your turn." : "Turn alerts are blocked in your browser settings.",
                on ? undefined : "bad",
              );
            }}
          />
        )}
      </div>
      {v.status === "waiting" ? (
        <div className="flex flex-1 flex-col gap-4 px-4 pt-4">
          <p className="text-muted text-[16px]">Send this to a friend. The game starts when they join.</p>
          <ShareCode code={v.inviteCode ?? ""} url={`/bay/${v.id}?join=${v.inviteCode}`} text={`Play ${meta?.name} with me on SPUZL.`} />
          <InviteFriends kind="bay" target={v.id} />
          <Cta tone="raised" onClick={() => action("resign")} className="mt-auto mb-[max(28px,env(safe-area-inset-bottom))]">
            Cancel invite
          </Cta>
        </div>
      ) : (
        // Phone: one column (both wrappers are `display: contents`). Wide: the board fills the left column and
        // the players, moves, offers and tools sit in the side panel. The board keeps its place either way.
        <div className={wide ? "flex flex-1 items-start gap-8 px-6 pb-6" : "contents"}>
          <div className={wide ? "flex min-w-0 flex-1 justify-center p-3 pb-0" : "contents"}>
            {!wide && <div className="pt-3">{oppRow}</div>}
            <div className={wide ? "flex justify-center" : "flex justify-center px-3 py-3"}>{board}</div>
            {gameOver}
            {!wide && meRow}
            {!wide && moves}
            {!wide && confirm}
            {!wide && offer}
            {!wide && myOffer}
            {!wide && finished}
            {!wide && addFriends}
            {!wide && emoteBar}
            {!wide && toolRow}
          </div>
          {wide && (
            <aside className="flex w-[320px] shrink-0 flex-col gap-3 pt-3 pr-3 min-[1280px]:w-[360px]" aria-label={sidePanel.players}>
              <div className="bg-surface flex flex-col gap-2 rounded-[18px] py-2.5 [&>div]:px-2.5">
                {oppRow}
                {meRow}
              </div>
              {moves}
              {confirm}
              {offer}
              {myOffer}
              {finished}
              {addFriends}
              {emoteBar}
              {toolRow}
            </aside>
          )}
        </div>
      )}
      {leavePlan.kind !== "none" && (
        <LeaveConfirm
          kind={leavePlan.kind}
          open={leave.asking}
          busy={leave.busy}
          onKeep={leave.keep}
          onLeave={() => void leave.confirm()}
        />
      )}
      {!v.bot && v.mySeat !== null && (
        <>
          <ChatPanel chat={chat} me={meId ?? ""} onEmote={(e) => void emotes.send(e)} />
          <ChatPopup chat={chat} />
        </>
      )}
    </Screen>
  );
}

/** The whole move list (wide screens, in the side panel): numbered pairs, the last move marked, newest in view. */
function MoveList({ sans }: { sans: string[] }) {
  const box = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [sans.length]);
  const pairs = Array.from({ length: Math.ceil(sans.length / 2) }, (_, k) => [sans[k * 2], sans[k * 2 + 1]] as const);
  return (
    <section className="bg-surface flex flex-col gap-1 rounded-[18px] p-2.5" aria-label={sidePanel.moves}>
      <h2 className="text-muted px-1 text-[13px] font-semibold tracking-[.04em] uppercase">{sidePanel.moves}</h2>
      <ol ref={box} className="num grid max-h-[30dvh] grid-cols-[2.5rem_1fr_1fr] gap-x-2 gap-y-0.5 overflow-y-auto text-[15px] font-medium">
        {pairs.map(([w, b], k) => (
          <li key={k} className="contents">
            <span className="text-muted px-1 py-1">{k + 1}.</span>
            {[w, b].map((m, j) =>
              m === undefined ? (
                <span key={j} />
              ) : (
                <span
                  key={j}
                  aria-current={k * 2 + j === sans.length - 1 || undefined}
                  className={`rounded-[8px] px-1.5 py-1 ${k * 2 + j === sans.length - 1 ? "bg-[var(--accent)] text-[var(--square-ink)]" : ""}`}
                >
                  {m}
                </span>
              ),
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
