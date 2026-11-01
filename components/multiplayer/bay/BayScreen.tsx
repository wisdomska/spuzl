"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/ui/Icon";
import { Spuz } from "@/components/brand/Spuz";
import { YourMoveInbox, type InboxGame } from "@/components/board/YourMoveInbox";
import { api, HttpError } from "@/lib/client/api";
import { useBay, useEmotes, useProfileGate, useServerNow } from "@/lib/client/multiplayer";
import { GAME_BY_ID } from "@/lib/catalog";
import { formatClock, formatNumber } from "@/lib/format";
import { play } from "@/lib/audio";
import { BAY_GAMES, loadRules, type AnyRules, type BayGame } from "@/lib/multiplayer/bay";
import type { BayView } from "@/lib/multiplayer/types";
import { ShareCode } from "../party";
import { Avatar, Cta, EmoteBar, EmoteBubble, LoadingScreen, MpToast, NeedProfile, Screen, TopButton, useToast } from "../ui";
import { LiveBoard } from "./boards";

/* ---------------- /bay: "Your move" inbox (B7) and new games ---------------- */

export function BayInbox() {
  const gate = useProfileGate();
  const router = useRouter();
  const { toast, show } = useToast();
  const [sheet, setSheet] = useState(false);
  const q = useQuery({
    queryKey: ["bay-inbox"],
    enabled: gate === "ready",
    queryFn: () => api<{ games: InboxGame[] }>("/api/v1/bay"),
    refetchInterval: 30_000,
  });
  if (gate === "loading") return <LoadingScreen />;
  if (gate === "no_profile") return <NeedProfile />;
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
      {sheet && <NewBaySheet onClose={() => setSheet(false)} onCreated={(id) => router.push(`/bay/${id}`)} />}
    </Screen>
  );
}

function NewBaySheet({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [game, setGame] = useState<BayGame>("chess");
  const [mode, setMode] = useState<"live" | "async">("async");
  const [busy, setBusy] = useState(false);
  const create = async (bot: boolean) => {
    setBusy(true);
    try {
      const v = await api<BayView>("/api/v1/bay", { json: { game, mode, bot } });
      onCreated(v.id);
    } catch {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" style={{ ["--world" as string]: "var(--w-board)" }}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-[rgba(6,7,13,.55)]" onClick={onClose} data-no-tick />
      <div
        role="dialog"
        aria-modal
        aria-label="New game with a friend"
        className="bg-surface relative flex w-full max-w-[560px] flex-col gap-3.5 rounded-t-[32px] px-5 pt-3.5 pb-[max(28px,env(safe-area-inset-bottom))]"
      >
        <div className="bg-line h-[5px] w-11 self-center rounded-[3px]" />
        <h2 className="font-display text-[22px] font-black">New game</h2>
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
                background: game === g ? "color-mix(in srgb, var(--w-board) 16%, var(--bg))" : "var(--surface-raised)",
                boxShadow: game === g ? "inset 0 0 0 2px var(--w-board)" : undefined,
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
              {m === "async" ? "24 h per move" : "Live, 5 min clocks"}
            </button>
          ))}
        </div>
        <Cta onClick={() => create(false)} disabled={busy} icon="user-plus">
          Invite a friend
        </Cta>
        <button type="button" onClick={() => create(true)} disabled={busy} className="text-muted min-h-12 text-[16px] font-semibold">
          Play the Practice bot
        </button>
      </div>
    </div>
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
  const meId = v && v.mySeat !== null ? v.players[v.mySeat]?.id : undefined;
  const emotes = useEmotes(channel, meId);

  useEffect(() => {
    if (v?.game) void loadRules(v.game as BayGame).then(setRules);
  }, [v?.game]);
  useEffect(() => {
    if (v?.rematchId) router.replace(`/bay/${v.rematchId}`);
  }, [v?.rematchId, router]);
  // The other side moved: clack (the live region below announces it).
  const lastPly = v?.ply ?? 0;
  const lastSeat = v?.moves[v.moves.length - 1]?.seat;
  useEffect(() => {
    if (lastPly && lastSeat !== undefined && lastSeat !== v?.mySeat) play("clack");
  }, [lastPly]); // eslint-disable-line react-hooks/exhaustive-deps

  const legal = useMemo(() => {
    if (!v || !rules || v.mySeat === null || v.status !== "active") return [];
    try {
      return rules.turn(v.state) === v.mySeat ? rules.legalMoves(v.state, v.mySeat) : [];
    } catch {
      return [];
    }
  }, [v, rules]);

  const move = useCallback(
    async (m: unknown) => {
      if (!v || busy) return;
      setBusy(true);
      try {
        const next = await api<BayView>(`/api/v1/bay/${v.id}/move`, { json: { ply: v.ply, move: m } });
        set(next);
        play("clack");
      } catch (e) {
        const code = e instanceof HttpError ? e.code : "";
        if (code === "illegal_move") {
          play("buzz");
          show("That move isn't legal here.", "bad");
        } else if (code === "stale_ply") show("The board moved on. Refreshing.", "bad");
        else if (code === "not_your_turn") show("Not your turn yet.", "bad");
        else show("Couldn't send that move.", "bad");
        void refetch();
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
      <Screen label="Bay invite" style={{ ["--world" as string]: "var(--w-board)" }}>
        <MpToast toast={toast} />
        <div className="flex flex-1 flex-col items-center gap-4 px-5 pt-[max(80px,env(safe-area-inset-top))] pb-[max(28px,env(safe-area-inset-bottom))] text-center">
          <Spuz mood="wave" size={120} />
          <h1 className="font-display text-[26px] font-black">
            {v.players[0]?.nickname} wants a game of {meta?.name}
          </h1>
          <p className="text-muted text-[16px]">{v.mode === "live" ? "Live, 5 minutes each." : "24 h per move. Nudge after 12."}</p>
          <Cta
            className="mt-auto w-full"
            disabled={!join || v.status !== "waiting"}
            onClick={async () => {
              try {
                set(await api<BayView>(`/api/v1/bay/${v.id}/join`, { json: { code: join } }));
              } catch {
                show("This invite is closed.", "bad");
              }
            }}
          >
            {v.status === "waiting" ? "Join" : "Game already started"}
          </Cta>
        </div>
      </Screen>
    );

  const opp = v.players.find((p) => p.seat !== seat) ?? null;
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
  const finishedLine =
    v.status === "finished"
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
        <Avatar name={p.nickname} color={p.color} size={44} radius={14}>
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
          <span className="truncate text-[15px] font-semibold">
            {mine ? "You" : p.nickname} · <span className="num">{p.id.startsWith("00000000") ? "Bot" : formatNumber(p.rating)}</span>
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
          {!chess && <span className="text-muted text-[13px]">{active ? (mine ? "Your move" : "Their move") : "Waiting"}</span>}
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
        }
      : null,
    { l: "Draw", i: "handshake", c: "var(--text)", on: () => action("draw_offer", v.bot ? undefined : "Draw offered.") },
    { l: "Resign", i: "flag", c: "var(--danger)", on: () => action("resign") },
    v.mode === "async" && !myTurn
      ? { l: "Nudge", i: "bell-ringing", c: "var(--text)", on: () => action("nudge", "Nudged.") }
      : { l: "Emote", i: "smiley", c: "var(--accent)", on: () => setEmoteOpen((o) => !o) },
  ].filter(Boolean) as { l: string; i: string; c: string; on: () => void }[];

  return (
    <Screen label="B3 Bay match" style={{ ["--world" as string]: "var(--w-board)", ["--world-ink" as string]: "var(--w-board-ink)" }}>
      <MpToast toast={toast} />
      <div aria-live="polite" className="sr-only">
        {live ||
          (lastSeat !== undefined && lastSeat !== seat
            ? `${v.players[lastSeat]?.nickname ?? "They"} moved. ${myTurn ? "Your move." : ""}`
            : "")}
      </div>
      <div className="flex items-center gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))]">
        <TopButton icon="arrow-left" label="Back" href="/bay" />
        <h1 className="font-display flex-1 text-[22px] font-black text-[var(--w-board)] [[data-theme=light]_&]:text-[var(--w-board-ink)]">
          {meta?.name}
        </h1>
        <span className="text-muted text-[14px] font-medium whitespace-nowrap">
          {v.mode === "live" ? "Live" : "24 h per move"}
          {v.bot ? " · Practice bot" : ""}
        </span>
      </div>
      {v.status === "waiting" ? (
        <div className="flex flex-1 flex-col gap-4 px-4 pt-4">
          <p className="text-muted text-[16px]">Send this to a friend. The game starts when they join.</p>
          <ShareCode code={v.inviteCode ?? ""} url={`/bay/${v.id}?join=${v.inviteCode}`} text={`Play ${meta?.name} with me on SPUZL.`} />
          <Cta tone="raised" onClick={() => action("resign")} className="mt-auto mb-[max(28px,env(safe-area-inset-bottom))]">
            Cancel invite
          </Cta>
        </div>
      ) : (
        <>
          <div className="pt-3">{row(opp, false)}</div>
          <div className="flex justify-center px-3 py-3">
            <LiveBoard
              game={v.game}
              state={v.state}
              seat={seat}
              legal={legal}
              disabled={!myTurn || busy}
              lastMove={lastMove}
              onMove={move}
              announce={setLive}
            />
          </div>
          {row(me, true)}
          {sans.length > 0 && (
            <div
              className="bg-surface num text-muted mx-4 mt-3 flex items-center gap-2 overflow-hidden rounded-[14px] px-3 py-2 text-[14px] font-medium whitespace-nowrap"
              aria-label="Moves"
            >
              {sans.slice(-6).map((s, i, a) => {
                const ply = sans.length - a.length + i;
                return (
                  <span key={ply} className="flex gap-2">
                    {ply % 2 === 0 && <span>{ply / 2 + 1}.</span>}
                    <span
                      className={i === a.length - 1 ? "rounded-[6px] bg-[var(--w-board)] px-1.5 text-[var(--square-ink)]" : "text-text"}
                    >
                      {s}
                    </span>
                  </span>
                );
              })}
            </div>
          )}
          {(offerFromThem(v.drawOffer) || offerFromThem(v.takebackOffer)) && v.status === "active" && (
            <div className="bg-surface-raised mx-4 mt-3 flex items-center gap-2 rounded-[16px] p-3" role="alert">
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
          )}
          {finishedLine && (
            <div className="bg-surface mx-4 mt-3 flex items-center gap-3 rounded-[18px] p-3.5" role="status">
              <Spuz mood={v.winnerId === me.id ? "party" : v.winnerId ? "sad" : "thinking"} size={56} decorative />
              <span className="flex-1 text-[16px] font-semibold">{finishedLine}</span>
            </div>
          )}
          {emoteOpen && (
            <div className="mx-4 mt-3">
              <EmoteBar
                onSend={(e) => {
                  if (emotes.send(e)) setEmoteOpen(false);
                }}
              />
            </div>
          )}
          <div
            className="mt-auto grid gap-2 px-4 pt-3 pb-[max(28px,env(safe-area-inset-bottom))]"
            style={{ gridTemplateColumns: `repeat(${v.status === "finished" ? 1 : tools.length}, minmax(0, 1fr))` }}
          >
            {v.status === "finished" ? (
              <Cta icon="arrows-clockwise" onClick={() => action("rematch")}>
                Rematch
              </Cta>
            ) : (
              tools.map((t) => (
                <button
                  key={t.l}
                  type="button"
                  onClick={t.on}
                  className="toy bg-surface-raised flex h-[60px] flex-col items-center justify-center gap-[3px] rounded-[18px] px-1 [--btn-depth:var(--depth)]"
                  style={{ boxShadow: "0 5px 0 var(--depth)", color: t.c }}
                >
                  <Icon name={t.i} size={22} />
                  <span className="text-[13px] font-semibold">{t.l}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </Screen>
  );
}
