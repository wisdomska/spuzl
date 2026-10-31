"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import { Spuz, type SpuzMood } from "@/components/brand/Spuz";
import { play } from "@/lib/audio";
import { haptic } from "@/lib/haptics";
import { formatClock, formatNumber } from "@/lib/format";
import { GAME_BY_ID, WORLD_BY_ID } from "@/lib/catalog";
import { useSettings } from "@/lib/settings/store";
import { gameName, ROOM_PICKS } from "@/lib/multiplayer/games";
import { overtakes, raceOrder } from "@/lib/multiplayer/race";
import type { EmoteId } from "@/lib/multiplayer/constants";
import type { MatchPlayerView, MatchView } from "@/lib/multiplayer/types";
import { useReduce } from "@/lib/client/multiplayer";
import { Avatar, Cta, EASE_IN_OUT, EASE_OUT, EmoteBar, EmoteBubble, PODIUM, SPRING_PARTY, TopButton, placeLabel } from "./ui";

/* ---------------- Share: code tiles, WhatsApp, QR, link ---------------- */

export function ShareCode({ code, url, text, count }: { code: string; url: string; text: string; count?: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const full = typeof window !== "undefined" ? `${window.location.origin}${url}` : url;
  const showQr = async () => {
    if (qr) return setQr(null);
    const QR = (await import("qrcode")).default;
    setQr(await QR.toDataURL(full, { margin: 1, width: 240, color: { dark: "#0E0F1A", light: "#FFFFFF" } }));
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };
  const wa = `https://wa.me/?text=${encodeURIComponent(`${text} Code ${code} 🎉 ${full}`)}`;
  return (
    <div className="bg-surface flex flex-col gap-3 rounded-[22px] p-4">
      <div className="text-muted flex items-center justify-between text-[14px] font-medium">
        <span>Room code</span>
        {count && <span>{count}</span>}
      </div>
      <div className="flex gap-2" aria-label={`Room code ${code.split("").join(" ")}`} role="img">
        {code.split("").map((ch, i) => (
          <div
            key={i}
            className="bg-surface-raised font-display text-accent flex h-[62px] flex-1 items-center justify-center rounded-[16px] text-[32px] font-black shadow-[inset_0_-5px_0_var(--depth)]"
          >
            {ch}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          className="toy flex h-12 items-center justify-center gap-1.5 rounded-[14px] text-[15px] font-semibold"
          style={{
            background: "var(--accent)",
            color: "var(--on-accent)",
            ["--btn-depth" as string]: "var(--accent-depth)",
            boxShadow: "0 4px 0 var(--accent-depth)",
          }}
        >
          <Icon name="whatsapp-logo" size={18} />
          WhatsApp
        </a>
        <button
          type="button"
          onClick={showQr}
          aria-expanded={!!qr}
          className="toy bg-surface-raised flex h-12 items-center justify-center gap-1.5 rounded-[14px] text-[15px] font-semibold [--btn-depth:var(--depth)]"
          style={{ boxShadow: "0 4px 0 var(--depth)" }}
        >
          <Icon name="qr-code" size={18} />
          QR
        </button>
        <button
          type="button"
          onClick={copy}
          className="toy bg-surface-raised flex h-12 items-center justify-center gap-1.5 rounded-[14px] text-[15px] font-semibold [--btn-depth:var(--depth)]"
          style={{ boxShadow: "0 4px 0 var(--depth)" }}
        >
          <Icon name={copied ? "check" : "link"} size={18} />
          {copied ? "Copied" : "Link"}
        </button>
      </div>
      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt={`QR code to join room ${code}`} className="mx-auto size-[200px] rounded-[16px] bg-white p-2" />
      )}
    </div>
  );
}

/* ---------------- P0 Create room ---------------- */

const DIFFS = ["easy", "medium", "hard", "expert"] as const;
export type Diff = (typeof DIFFS)[number];

export function GamePicker({ value, onChange }: { value: string | null; onChange: (g: string | null) => void }) {
  const tiles = [
    { id: null as string | null, n: "Random mix", i: "shuffle", c: "var(--accent)" },
    ...ROOM_PICKS.map((id) => ({ id, n: GAME_BY_ID[id].name, i: GAME_BY_ID[id].icon, c: WORLD_BY_ID[GAME_BY_ID[id].world].color })),
  ];
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Game">
      {tiles.map((g) => {
        const on = value === g.id;
        return (
          <button
            key={g.n}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(g.id)}
            className="press flex h-[92px] flex-col items-center justify-center gap-1.5 rounded-[18px]"
            style={{
              background: on ? "color-mix(in srgb, var(--accent) 14%, var(--bg))" : "var(--surface)",
              boxShadow: on ? "inset 0 0 0 2px var(--accent)" : undefined,
            }}
          >
            <span className="flex size-10 items-center justify-center rounded-[12px] text-[#0E0F1A]" style={{ background: g.c }}>
              <Icon name={g.i} size={20} />
            </span>
            <span className="text-[14px] font-semibold">{g.n}</span>
          </button>
        );
      })}
    </div>
  );
}

export function DifficultyPicker({ value, onChange }: { value: Diff; onChange: (d: Diff) => void }) {
  return (
    <div className="bg-surface flex gap-1 rounded-[16px] p-1" role="radiogroup" aria-label="Difficulty">
      {DIFFS.map((d) => (
        <button
          key={d}
          type="button"
          role="radio"
          aria-checked={value === d}
          onClick={() => onChange(d)}
          className="flex h-11 flex-1 items-center justify-center rounded-[12px] text-[15px] font-semibold capitalize"
          style={value === d ? { background: "var(--surface-raised)" } : { color: "var(--text-muted)" }}
        >
          {d}
        </button>
      ))}
    </div>
  );
}

export function CreateRoom({
  onOpen,
  busy,
  onBack,
  onJoin,
}: {
  onOpen: (r: { game: string | null; difficulty: Diff; maxPlayers: number; classroom: boolean }) => void;
  busy: boolean;
  onBack: () => void;
  onJoin: (code: string) => void;
}) {
  const [game, setGame] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Diff>("medium");
  const [size, setSize] = useState(8);
  const [classroom, setClassroom] = useState(false);
  const [code, setCode] = useState("");
  return (
    <div
      className="flex flex-1 flex-col gap-3.5 px-5 pt-[max(56px,env(safe-area-inset-top))] pb-[max(28px,env(safe-area-inset-bottom))]"
      data-screen-label="P0 Create room"
    >
      <div className="flex items-center gap-3">
        <TopButton icon="arrow-left" label="Back" onClick={onBack} />
        <h1 className="font-display text-[22px] font-black">New party</h1>
      </div>
      <span className="text-[15px] font-semibold" id="game-label">
        Game
      </span>
      <GamePicker value={game} onChange={setGame} />
      <span className="mt-1 text-[15px] font-semibold">Difficulty</span>
      <DifficultyPicker value={difficulty} onChange={setDifficulty} />
      <label htmlFor="room-size" className="mt-1 text-[15px] font-semibold">
        Room size
      </label>
      <div className="flex items-center gap-3.5 py-1.5">
        <input
          id="room-size"
          type="range"
          min={2}
          max={8}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="room-range h-11 flex-1"
          style={{ ["--fill" as string]: `${((size - 2) / 6) * 100}%` }}
        />
        <span className="num w-10 text-right text-[20px] font-semibold">{size}</span>
      </div>
      <label className="bg-surface flex min-h-14 cursor-pointer items-center justify-between rounded-[16px] px-4 py-3.5">
        <span className="flex flex-col">
          <span className="text-[16px] font-semibold">Classroom mode</span>
          {classroom && <span className="text-muted text-[14px]">You host on the big screen and don&apos;t race.</span>}
        </span>
        <input type="checkbox" role="switch" checked={classroom} onChange={(e) => setClassroom(e.target.checked)} className="mp-switch" />
      </label>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) onJoin(code);
        }}
      >
        <label htmlFor="join-code" className="sr-only">
          Room code
        </label>
        <input
          id="join-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
          placeholder="Got a code?"
          autoCapitalize="characters"
          autoComplete="off"
          className="bg-surface font-display placeholder:text-muted h-12 min-w-0 flex-1 rounded-[14px] px-4 text-[18px] font-black tracking-[.2em] placeholder:font-sans placeholder:text-[16px] placeholder:font-medium placeholder:tracking-normal"
        />
        <button
          type="submit"
          disabled={code.trim().length !== 4}
          className="press bg-surface-raised h-12 rounded-[14px] px-5 text-[15px] font-semibold disabled:opacity-50"
        >
          Join
        </button>
      </form>
      <Cta className="mt-auto" disabled={busy} onClick={() => onOpen({ game, difficulty, maxPlayers: size, classroom })}>
        Open room
      </Cta>
    </div>
  );
}

/* ---------------- P1 Lobby ---------------- */

export function Lobby({
  view,
  present,
  emote,
  onEmote,
  onReady,
  onStart,
  onLeave,
  onSettings,
  onTv,
}: {
  view: MatchView;
  present: Set<string>;
  emote: { from: string; e: EmoteId; n: number } | null;
  onEmote: (e: EmoteId) => void;
  onReady: (r: boolean) => void;
  onStart: () => void;
  onLeave: () => void;
  onSettings: () => void;
  onTv: () => void;
}) {
  const reduce = useReduce();
  const here = view.players.filter((p) => !p.left && !p.spectator);
  const me = view.players.find((p) => p.id === view.me)!;
  const host = view.hostId === view.me;
  const ready = here.filter((p) => p.ready).length;
  const all = here.length >= 2 && ready === here.length;
  const slots = Array.from({ length: view.maxPlayers }, (_, i) => here[i] ?? null);
  const gameLine = view.mix ? "Random mix, 3 games" : `${gameName(view.gameId)}, 3 games`;
  return (
    <div className="flex flex-1 flex-col pb-[max(28px,env(safe-area-inset-bottom))]" data-screen-label="P1 Lobby">
      <div className="flex items-center justify-between px-4 pt-[max(52px,env(safe-area-inset-top))]">
        <TopButton icon="x" label="Leave room" onClick={onLeave} />
        <h1 className="font-display text-[18px] font-extrabold">{view.classroom ? "Classroom" : "Party room"}</h1>
        {host ? (
          <TopButton icon="sliders-horizontal" label="Room settings" onClick={onSettings} />
        ) : (
          <TopButton icon="television" label="TV mode" onClick={onTv} />
        )}
      </div>
      <div className="mx-4 mt-4">
        <ShareCode
          code={view.code ?? ""}
          url={`/party/${view.code}`}
          text="Join my SPUZL party!"
          count={`${here.length} of ${view.maxPlayers} in`}
        />
      </div>
      <ul className="mx-4 mt-3.5 grid grid-cols-4 gap-2" aria-label="Players">
        <AnimatePresence initial={false}>
          {slots.map((p, i) =>
            p ? (
              <motion.li
                key={p.id}
                initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-40px) scale(0.8)" }}
                animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
                transition={reduce ? { duration: 0.2 } : { ...SPRING_PARTY, duration: 0.42 }}
                className="bg-surface relative flex h-[104px] flex-col items-center justify-center gap-1.5 rounded-[18px]"
                style={{ boxShadow: p.ready ? "inset 0 0 0 2px var(--accent)" : undefined }}
                aria-label={`${p.id === view.me ? "You" : p.nickname}${p.host ? ", host" : ""}, ${p.ready ? "ready" : "not ready"}${present.size && !present.has(p.id) ? ", away" : ""}`}
              >
                <Avatar name={p.nickname} color={p.color} size={44} radius={14} dim={present.size > 0 && !present.has(p.id)} />
                <span className="max-w-full truncate px-1 text-[14px] font-semibold">{p.id === view.me ? "You" : p.nickname}</span>
                {p.ready && (
                  <span className="bg-accent absolute top-1.5 right-1.5 flex size-[22px] items-center justify-center rounded-[8px] text-[#0E0F1A]">
                    <Icon name="check" size={13} />
                  </span>
                )}
                {p.host && <Icon name="crown-simple" size={16} className="text-gold absolute top-1.5 left-1.5" />}
                {emote?.from === p.id && <EmoteBubble emote={emote.e} n={emote.n} className="-top-6 left-1/2" />}
              </motion.li>
            ) : (
              <li
                key={`open-${i}`}
                className="flex h-[104px] flex-col items-center justify-center gap-1.5 rounded-[18px] shadow-[inset_0_0_0_2px_var(--line)]"
              >
                <span className="size-11" />
                <span className="text-[14px] font-semibold text-[#5A5E78] [[data-theme=light]_&]:text-[#8A8EA8]">Open</span>
              </li>
            ),
          )}
        </AnimatePresence>
      </ul>
      <button
        type="button"
        onClick={host ? onSettings : undefined}
        disabled={!host}
        className="bg-surface mx-4 mt-3.5 flex items-center gap-3 rounded-[18px] px-3.5 py-3 text-left"
      >
        <span className="bg-surface-raised text-accent flex size-11 items-center justify-center rounded-[14px]">
          <Icon name={view.mix ? "shuffle" : (GAME_BY_ID[view.gameId ?? ""]?.icon ?? "shuffle")} size={22} />
        </span>
        <span className="flex flex-1 flex-col">
          <span className="text-[16px] font-semibold">{gameLine}</span>
          <span className="text-muted text-[14px] capitalize">{view.difficulty}. Host can change.</span>
        </span>
        {host && <Icon name="caret-right" size={18} className="text-muted" />}
      </button>
      <div className="mx-4 mt-3">
        <EmoteBar onSend={onEmote} />
      </div>
      <div className="mx-4 mt-auto pt-4">
        {view.classroom && host ? (
          <Cta onClick={onStart} disabled={!all} sub={all ? `${ready} of ${here.length} ready` : "Waiting for the class"}>
            Start
          </Cta>
        ) : host ? (
          <Cta
            onClick={onStart}
            tone={all ? "accent" : "raised"}
            sub={all ? `${ready} of ${here.length} ready` : here.length < 2 ? "Share the code" : `${ready} of ${here.length} ready`}
          >
            Start
          </Cta>
        ) : (
          <Cta onClick={() => onReady(!me.ready)} tone={me.ready ? "raised" : "accent"} icon={me.ready ? "check" : undefined}>
            {me.ready ? "Ready. Waiting for the host" : "Ready"}
          </Cta>
        )}
      </div>
    </div>
  );
}

/* ---------------- P2 Race rail ---------------- */

export const ROW = 34;

export interface RailRow {
  id: string;
  nickname: string;
  color: string;
  progress: number;
  finished: boolean;
  gone: boolean;
}

/** Racers in this set: everyone who isn't spectating, minus people who left before scoring anything. */
export const inSet = (view: MatchView) =>
  view.players.filter((p) => !p.spectator && (!p.left || p.points > 0 || p.progress > 0 || view.rounds.some((r) => r.playerId === p.id)));

export function rowsOf(view: MatchView): RailRow[] {
  const round = view.round;
  const list = inSet(view).map((p) => {
    const r = view.rounds.find((x) => x.round === round && x.playerId === p.id);
    const timeMs = r?.timeMs ?? p.finishedMs ?? null;
    return {
      id: p.id,
      nickname: p.nickname,
      color: p.color,
      progress: timeMs !== null ? 1 : p.progress,
      finished: timeMs !== null,
      gone: p.left || p.stale,
      timeMs,
      mistakes: p.mistakes,
    };
  });
  return raceOrder(list);
}

/** Live race rail (P2): rows reorder by translateY in 34 px slots; bars are scaleX. Swoosh on overtake. */
export function RaceRail({
  view,
  rows,
  elapsedMs,
  onToast,
}: {
  view: MatchView;
  rows: RailRow[];
  elapsedMs: number;
  onToast: (t: string, kind: "pass" | "info") => void;
}) {
  const reduce = useReduce();
  const order = rows.map((r) => r.id);
  const prev = useRef<string[]>(order);
  const prevDone = useRef(new Set(rows.filter((r) => r.finished).map((r) => r.id)));
  useEffect(() => {
    const passes = overtakes(prev.current, order, view.me);
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const p of passes) {
      play("swoosh");
      if (p.passed === view.me) onToast(`${byId.get(p.passer)?.nickname ?? "Someone"} passed you. Swoosh.`, "pass");
      else onToast(`You passed ${byId.get(p.passed)?.nickname ?? "someone"}.`, "pass");
      break;
    }
    for (const r of rows)
      if (r.finished && !prevDone.current.has(r.id)) {
        prevDone.current.add(r.id);
        if (r.id !== view.me) onToast(`${r.nickname} cleared it.`, "info");
      }
    prev.current = order;
  }, [order.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = rows.length;
  return (
    <div className="bg-surface -mx-3 flex flex-col gap-1.5 px-3 pt-1 pb-2.5" data-screen-label="P2 rail">
      <div className="text-muted flex justify-between px-1 pb-1 text-[14px] font-medium">
        <span>
          Game {view.round} of {view.games.length}
        </span>
        <span className="num text-text">{formatClock(elapsedMs)}</span>
      </div>
      <ol className="relative" style={{ height: n * ROW }} aria-label="Race standings">
        {rows.map((r, i) => {
          const me = r.id === view.me;
          const [pbg, pfg] = i < 3 ? [PODIUM[i], "#0E0F1A"] : ["var(--surface-raised)", "var(--text-muted)"];
          return (
            <motion.li
              key={r.id}
              className="absolute inset-x-0 top-0 flex h-[28px] items-center gap-2 rounded-[10px] px-1.5"
              style={{
                background: me ? "color-mix(in srgb, var(--accent) 16%, var(--surface))" : "transparent",
                opacity: r.gone ? 0.5 : 1,
              }}
              initial={false}
              animate={{ transform: `translateY(${i * ROW}px)` }}
              transition={{ duration: reduce ? 0 : 0.5, ease: EASE_IN_OUT }}
              aria-label={`${placeLabel(i + 1)}, ${me ? "you" : r.nickname}, ${Math.round(r.progress * 100)} percent${r.finished ? ", cleared" : ""}`}
            >
              <span
                className="num flex h-[22px] w-[30px] items-center justify-center rounded-[7px] text-[12px] font-bold"
                style={{ background: pbg, color: pfg }}
              >
                {placeLabel(i + 1)}
              </span>
              <Avatar name={r.nickname} color={r.color} size={22} radius={7} />
              <span className="w-[58px] truncate text-[14px]" style={{ fontWeight: me ? 700 : 500 }}>
                {me ? "You" : r.nickname}
              </span>
              <div className="bg-line relative h-2 flex-1 overflow-hidden rounded-[4px]">
                <motion.div
                  className="absolute inset-0 origin-left rounded-[4px]"
                  style={{ background: me ? "var(--accent)" : "#5A5E78" }}
                  initial={false}
                  animate={{ transform: `scaleX(${r.progress})` }}
                  transition={{ duration: reduce ? 0 : 0.5, ease: EASE_IN_OUT }}
                />
              </div>
              <span className="text-accent flex w-4 justify-center">{r.finished && <Icon name="check" size={14} />}</span>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

/* ---------------- P3 Podium ---------------- */

export function Podium({
  view,
  host,
  final,
  onRunItBack,
  onNext,
  onLeave,
}: {
  view: MatchView;
  host: boolean;
  final: boolean;
  onRunItBack: () => void;
  onNext: () => void;
  onLeave: () => void;
}) {
  const reduce = useReduce();
  const lowData = useSettings((s) => s.lowData);
  const [skip, setSkip] = useState(false);
  const standing = inSet(view).sort((a, b) => b.points - a.points || (a.place ?? 9) - (b.place ?? 9));
  const top = standing[0];
  useEffect(() => {
    play("cheer");
  }, []);
  const title = top?.id === view.me ? "You take it!" : `${top?.nickname ?? "Someone"} takes it`;
  const sub = `${view.mix ? "Random mix" : gameName(view.gameId)}, ${final ? `${view.games.length} games` : `game ${view.round} of ${view.games.length}`}, ${standing.length} Spuzlers`;
  const podium: [MatchPlayerView | undefined, number][] = [
    [standing[1], 1],
    [standing[0], 0],
    [standing[2], 2],
  ];
  const confetti = useMemo(() => {
    const cs = ["#B8F23A", "#FFC93C", "#FF6B6B", "#2FD3E0", "#8B7CFF", "#FF8A3D", "#F4F5FB"];
    return Array.from({ length: lowData ? 12 : 24 }, (_, i) => ({
      x: (i * 37) % 380,
      c: cs[i % cs.length],
      d: 2.8 + ((i * 13) % 12) / 10,
      dl: ((i * 7) % 10) / 10,
    }));
  }, [lowData]);
  const hostName = view.players.find((p) => p.id === view.hostId)?.nickname ?? "the host";
  return (
    <div
      className="relative flex flex-1 flex-col overflow-hidden pb-[max(28px,env(safe-area-inset-bottom))]"
      onPointerDown={() => setSkip(true)}
      data-screen-label="P3 Podium"
    >
      {!reduce && !skip && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {confetti.map((k, i) => (
            <span
              key={i}
              className="mp-confetti absolute top-0 h-[14px] w-[9px] rounded-[2px]"
              style={{ left: k.x, background: k.c, animationDuration: `${k.d}s`, animationDelay: `${k.dl}s` }}
            />
          ))}
        </div>
      )}
      <h1 className="font-display px-5 pt-[60px] text-center text-[28px] font-black" aria-live="polite">
        {title}
      </h1>
      <p className="text-muted mt-1.5 text-center text-[15px] font-medium">{sub}</p>
      <div className="mt-7 flex items-end justify-center gap-2 px-4">
        {podium.map(([p, rank]) =>
          p ? (
            <motion.div
              key={p.id}
              className="flex flex-1 flex-col items-center gap-2"
              initial={reduce || skip ? { opacity: 0 } : { opacity: 0, transform: "translateY(-40px) scale(0.8)" }}
              animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
              transition={reduce || skip ? { duration: 0.15 } : { ...SPRING_PARTY, delay: [0.3, 0.15, 0.45][rank] }}
            >
              <Spuz
                mood={(rank === 0 ? "party" : p.id === view.me ? "proud" : "cheer") as SpuzMood}
                size={[110, 90, 84][rank]}
                color={p.color}
                decorative
              />
              <span className="max-w-full truncate text-[16px] font-bold">{p.id === view.me ? "You" : p.nickname}</span>
              <div
                className="flex w-full flex-col items-center gap-1 rounded-t-[18px] pt-3 shadow-[inset_0_-8px_0_rgba(0,0,0,.2)]"
                style={{ height: [150, 110, 80][rank], background: PODIUM[rank] }}
              >
                <span className="font-display text-[34px] font-black text-[#0E0F1A]">{rank + 1}</span>
                <span className="num text-[14px] font-semibold text-[#0E0F1A]">{formatNumber(p.points)}</span>
              </div>
            </motion.div>
          ) : (
            <div key={rank} className="flex-1" />
          ),
        )}
      </div>
      <ol className="flex flex-col px-4" start={4}>
        {standing.slice(3).map((p, i) => (
          <li key={p.id} className="bg-surface border-line flex h-[52px] items-center gap-2.5 border-t px-3">
            <span className="num text-muted w-[22px] text-[15px] font-semibold">{i + 4}</span>
            <Avatar name={p.nickname} color={p.color} size={28} radius={9} />
            <span className="flex-1 text-[16px] font-medium">{p.id === view.me ? "You" : p.nickname}</span>
            <span className="num text-[15px] font-semibold">{formatNumber(p.points)}</span>
          </li>
        ))}
      </ol>
      <div className="mt-auto grid grid-cols-2 gap-2.5 px-4 pt-3">
        {host ? (
          <>
            <Cta onClick={onRunItBack}>Run it back</Cta>
            {final ? (
              <Cta tone="raised" onClick={onLeave}>
                Leave
              </Cta>
            ) : (
              <Cta tone="raised" onClick={onNext}>
                Next game
              </Cta>
            )}
          </>
        ) : (
          <>
            <div className="text-muted col-span-2 text-center text-[15px]" role="status">
              {final ? `Waiting for ${hostName} to run it back` : `Waiting for ${hostName} to start the next game`}
            </div>
            <Cta tone="raised" className="col-span-2" onClick={onLeave}>
              Leave
            </Cta>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- T1 TV mode (1280 × 720, readable at 3 m) ---------------- */

export function TvMode({
  view,
  rows,
  elapsedMs,
  phase,
  msToStart,
}: {
  view: MatchView;
  rows: RailRow[];
  elapsedMs: number;
  phase: string;
  msToStart: number;
}) {
  const reduce = useReduce();
  const game = view.games[view.round - 1];
  const meta = game ? GAME_BY_ID[game] : null;
  const racers = view.players.filter((p) => !p.spectator && !p.left);
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (phase !== "lobby") return;
    void import("qrcode").then((Q) =>
      Q.default.toDataURL(`${window.location.origin}/party/${view.code}`, { margin: 1, width: 280 }).then(setQr),
    );
  }, [phase, view.code]);
  const standing = [...racers].sort((a, b) => b.points - a.points);
  const list =
    phase === "race" || phase === "countdown"
      ? rows.map((r) => ({ id: r.id, name: r.nickname, p: r.progress, sub: null as string | null }))
      : standing.map((p) => ({
          id: p.id,
          name: p.nickname,
          p: phase === "lobby" ? (p.ready ? 1 : 0) : 1,
          sub: phase === "lobby" ? (p.ready ? "Ready" : "Joining") : `${formatNumber(p.points)} pts`,
        }));
  return (
    <div className="bg-bg grid h-[720px] w-[1280px] grid-cols-[1fr_420px] overflow-hidden" data-screen-label="T1 TV mode">
      <div className="flex flex-col gap-5 p-12">
        <div className="flex items-center justify-between">
          <div className="font-display flex items-end text-[44px] leading-[.9] font-black tracking-[-0.05em]" aria-label="SPUZL">
            <span>SPU</span>
            <span className="text-accent">Z</span>
            <span>L</span>
          </div>
          <div className="flex items-center gap-3.5">
            <span className="text-muted text-[26px] font-semibold">Join with</span>
            <span className="bg-surface-raised font-display text-accent rounded-[16px] px-[18px] py-2 text-[40px] font-black tracking-[.1em]">
              {view.code}
            </span>
          </div>
        </div>
        {phase === "lobby" ? (
          <>
            <div className="font-display mt-2.5 text-[64px] font-black tracking-[-0.03em]">
              {view.mix ? "Random mix" : gameName(view.gameId)}
            </div>
            <div className="text-muted text-[30px] font-semibold">
              {racers.length} Spuzlers in · spuzl.app/party/{view.code}
            </div>
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt={`QR code for room ${view.code}`} className="mt-auto size-[220px] rounded-[20px] bg-white p-3" />
            )}
          </>
        ) : (
          <>
            <div
              className="font-display mt-2.5 text-[64px] font-black tracking-[-0.03em]"
              style={{ color: meta ? WORLD_BY_ID[meta.world].color : undefined }}
            >
              {meta?.name ?? "Party"}
            </div>
            <div className="text-muted text-[30px] font-semibold">
              Game {view.round} of {view.games.length} · {racers.length} Spuzlers{" "}
              {phase === "race" ? "racing" : phase === "countdown" ? "ready" : "done"}
            </div>
            <div className="mt-auto flex items-end gap-6">
              <div className="num text-[120px] leading-none font-semibold">
                {phase === "countdown" ? Math.max(1, Math.ceil(msToStart / 1000)) : formatClock(elapsedMs)}
              </div>
              <Spuz mood={phase === "race" ? "shocked" : "party"} size={180} decorative />
            </div>
          </>
        )}
      </div>
      <ol className="bg-surface relative flex flex-col gap-3.5 px-7 py-10" aria-label="Standings">
        <AnimatePresence initial={false}>
          {list.slice(0, 6).map((r, i) => (
            <motion.li
              key={r.id}
              layout={!reduce}
              transition={{ duration: 0.5, ease: EASE_IN_OUT }}
              className="flex h-[80px] items-center gap-3.5 rounded-[20px] px-4"
              style={{ background: i === 0 && phase !== "lobby" ? "color-mix(in srgb, var(--gold) 14%, var(--surface))" : "transparent" }}
            >
              <span
                className="font-display flex size-14 items-center justify-center rounded-[16px] text-[24px] font-black"
                style={{
                  background: i < 3 && phase !== "lobby" ? PODIUM[i] : "var(--surface-raised)",
                  color: i < 3 && phase !== "lobby" ? "#0E0F1A" : "var(--text-muted)",
                }}
              >
                {i + 1}
              </span>
              <div className="flex flex-1 flex-col gap-2.5">
                <span className="flex items-baseline justify-between text-[30px] font-bold">
                  <span className="truncate">{r.name}</span>
                  {r.sub && <span className="num text-muted text-[26px] font-semibold">{r.sub}</span>}
                </span>
                <div className="bg-line relative h-3.5 overflow-hidden rounded-[7px]">
                  <motion.div
                    className="absolute inset-0 origin-left rounded-[7px]"
                    style={{ background: i === 0 ? "var(--accent)" : "#5A5E78" }}
                    initial={false}
                    animate={{ transform: `scaleX(${r.p})` }}
                    transition={{ duration: reduce ? 0 : 0.5, ease: EASE_IN_OUT }}
                  />
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
        {list.length > 6 && <li className="text-muted px-4 text-[26px] font-semibold">+ {list.length - 6} more</li>}
      </ol>
    </div>
  );
}

/** Player joined: pop + [8] haptic, toast like the prototype ("Kofi joined. Room is heating up."). */
export function useJoinToasts(view: MatchView | undefined, show: (t: string, k?: "info" | "bad" | "pass") => void) {
  const known = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!view) return;
    const here = view.players.filter((p) => !p.left && !p.spectator);
    if (!known.current) {
      known.current = new Set(here.map((p) => p.id));
      return;
    }
    let k = 0;
    for (const p of here)
      if (!known.current.has(p.id)) {
        known.current.add(p.id);
        play("pop", { step: ++k, silentHaptic: true });
        haptic([8]);
        if (p.id !== view.me) show(here.length >= 4 ? `${p.nickname} joined. Room is heating up.` : `${p.nickname} joined.`);
      }
    for (const id of [...known.current]) if (!here.some((p) => p.id === id)) known.current.delete(id);
  }, [view, show]);
}

export { EASE_OUT };
