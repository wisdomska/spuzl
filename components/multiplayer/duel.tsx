"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import { Spuz, type SpuzMood } from "@/components/brand/Spuz";
import { play } from "@/lib/audio";
import { haptic } from "@/lib/haptics";
import { formatClock, formatNumber } from "@/lib/format";
import { gameName, RACE_GAMES } from "@/lib/multiplayer/games";
import { TIMING, type EmoteId } from "@/lib/multiplayer/constants";
import type { MatchPlayerView, MatchView } from "@/lib/multiplayer/types";
import { useReduce } from "@/lib/client/multiplayer";
import {
  Avatar,
  CountdownNumber,
  Cta,
  EASE_IN_OUT,
  EASE_OUT,
  EmoteBar,
  EmoteBubble,
  RoundDots,
  SPRING_PARTY,
  SPRING_PRESS,
  formatTenths,
} from "./ui";

/* ---------------- M1 Duel entry sheet ---------------- */

export function DuelEntrySheet({
  game,
  setGame,
  rating,
  onQuick,
  onFriend,
  onClose,
  youngster,
}: {
  game: string | null;
  setGame: (g: string | null) => void;
  rating: number;
  onQuick: () => void;
  onFriend: () => void;
  onClose: () => void;
  youngster: boolean;
}) {
  const reduce = useReduce();
  const [picking, setPicking] = useState(false);
  const named = game ? gameName(game) : "Sixer";
  return (
    <div className="fixed inset-0 z-40 bg-[radial-gradient(#22253C_1.5px,transparent_1.5px)] [background-size:24px_24px] [[data-theme=light]_&]:bg-[radial-gradient(#D8DCE8_1.5px,transparent_1.5px)]">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[rgba(6,7,13,.55)]" data-no-tick />
      <motion.div
        role="dialog"
        aria-modal
        aria-labelledby="duel-title"
        initial={reduce ? { opacity: 0 } : { transform: "translateY(100%)" }}
        animate={reduce ? { opacity: 1 } : { transform: "translateY(0%)" }}
        transition={{ duration: 0.32, ease: EASE_OUT }}
        className="bg-surface absolute inset-x-0 bottom-0 mx-auto flex max-w-[560px] flex-col gap-3.5 rounded-t-[32px] px-5 pt-3.5 pb-[max(28px,env(safe-area-inset-bottom))]"
      >
        <div className="bg-line h-[5px] w-11 self-center rounded-[3px]" />
        <div className="flex items-center gap-3">
          <Icon name="sword" size={28} className="text-accent" />
          <h2 id="duel-title" className="font-display text-[26px] font-black">
            Duel
          </h2>
        </div>
        <div className="bg-bg flex gap-2 rounded-[16px] p-1" role="radiogroup" aria-label="Game">
          <button
            type="button"
            role="radio"
            aria-checked={game !== null}
            onClick={() => (game === null ? setPicking(true) : setPicking((p) => !p))}
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[12px] text-[15px] font-semibold"
            style={game !== null ? { background: "var(--surface-raised)" } : { color: "var(--text-muted)" }}
          >
            {named}
            <Icon name="caret-down" size={14} />
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={game === null}
            onClick={() => {
              setGame(null);
              setPicking(false);
            }}
            className="flex h-11 flex-1 items-center justify-center rounded-[12px] text-[15px] font-semibold"
            style={game === null ? { background: "var(--surface-raised)" } : { color: "var(--text-muted)" }}
          >
            Any game
          </button>
        </div>
        {picking && (
          <div className="grid max-h-[180px] grid-cols-3 gap-2 overflow-y-auto" role="listbox" aria-label="Pick a game">
            {RACE_GAMES.map((g) => (
              <button
                key={g.id}
                type="button"
                role="option"
                aria-selected={game === g.id}
                onClick={() => {
                  setGame(g.id);
                  setPicking(false);
                }}
                className="press bg-surface-raised h-11 rounded-[12px] px-2 text-[14px] font-semibold"
                style={game === g.id ? { boxShadow: "inset 0 0 0 2px var(--accent)" } : undefined}
              >
                {g.name}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={onQuick}
          disabled={youngster}
          className="toy flex items-center gap-3.5 rounded-[22px] p-[18px] text-left"
          style={{
            background: "var(--accent)",
            color: "var(--on-accent)",
            ["--btn-depth" as string]: "var(--accent-depth)",
            boxShadow: "0 6px 0 var(--accent-depth)",
          }}
        >
          <Icon name="lightning" size={32} />
          <span className="flex flex-1 flex-col">
            <span className="font-display text-[19px] font-black">Quick Match</span>
            <span className="text-[15px] font-medium">
              {youngster ? (
                "Opens at 16. Challenge a friend."
              ) : (
                <>
                  Ranked. Rating <span className="num">{formatNumber(rating)}</span>. Best of 3.
                </>
              )}
            </span>
          </span>
          <Icon name="caret-right" size={20} />
        </button>
        <button
          type="button"
          onClick={onFriend}
          className="toy bg-surface-raised flex items-center gap-3.5 rounded-[22px] p-[18px] text-left [--btn-depth:var(--depth)]"
          style={{ boxShadow: "0 6px 0 var(--depth)" }}
        >
          <Icon name="user-plus" size={32} className="text-accent" />
          <span className="flex flex-1 flex-col">
            <span className="font-display text-[19px] font-black">Challenge a friend</span>
            <span className="text-muted text-[15px] font-medium">Unranked. Send them a link.</span>
          </span>
          <Icon name="caret-right" size={20} className="text-muted" />
        </button>
      </motion.div>
    </div>
  );
}

/* ---------------- D1 Matchmaking ---------------- */

export function Matchmaking({
  rating,
  game,
  waitedMs,
  usualMs,
  color,
  onCancel,
  botReady,
  onBot,
  title = "Finding a rival",
  chip = "Quick Match, ranked",
}: {
  rating: number;
  game: string | null;
  waitedMs: number;
  usualMs: number;
  color: string;
  onCancel: () => void;
  botReady: boolean;
  onBot: () => void;
  title?: string;
  chip?: string;
}) {
  const reduce = useReduce();
  const meta = game ? RACE_GAMES.find((g) => g.id === game) : null;
  const world = meta
    ? {
        logic: "Logic Lab",
        line: "Line Lane",
        shape: "Shape Shed",
        number: "Number Den",
        word: "Word Woods",
        clue: "Clue Cave",
        reflex: "Reflex Rink",
        rage: "Rage Ridge",
        board: "Board Bay",
      }[meta.world]
    : null;
  return (
    <div className="flex flex-1 flex-col items-center px-4 pb-[max(32px,env(safe-area-inset-bottom))]">
      <div className="bg-surface-raised mt-[60px] flex items-center gap-2 rounded-full px-3.5 py-2 text-[14px] font-semibold">
        <Icon name="sword" size={16} className="text-accent" />
        {chip}
        <span className="num text-muted">{formatNumber(rating)}</span>
      </div>
      <div className="relative mt-10 size-[310px] max-w-full" aria-hidden>
        <div className="absolute inset-0 rounded-full shadow-[inset_0_0_0_2px_var(--line)]" />
        <div className="absolute inset-[55px] rounded-full shadow-[inset_0_0_0_2px_var(--line)]" />
        <div className="absolute inset-[110px] rounded-full shadow-[inset_0_0_0_2px_var(--line)]" />
        {!reduce && (
          <>
            <div className="mm-radar absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,rgba(184,242,58,.32),rgba(184,242,58,0)_70deg,transparent_360deg)]" />
            <div className="mm-ping absolute inset-0 rounded-full shadow-[inset_0_0_0_3px_var(--accent)]" />
          </>
        )}
        <div className="absolute top-[70px] left-[52px] size-[30px] rounded-[10px] bg-[var(--w-shape)] opacity-70" />
        <div className="absolute top-[196px] left-[222px] size-[26px] rounded-[9px] bg-[var(--w-logic)] opacity-50" />
        <div className="absolute top-[95px] left-[95px]">
          <Spuz mood="thinking" size={120} color={color} decorative />
        </div>
      </div>
      <h1 className="font-display mt-8 text-center text-[26px] font-black" aria-live="polite">
        {title}
      </h1>
      <p className="text-muted mt-2 text-[16px] font-medium">{meta ? `${meta.name}, ${world}, best of 3` : "Any game, best of 3"}</p>
      <div className="mt-5 flex gap-2.5">
        <div className="bg-surface flex flex-col items-center gap-0.5 rounded-[14px] px-4 py-2.5">
          <span className="num text-[22px] font-semibold">{formatClock(waitedMs).replace(/^0/, "")}</span>
          <span className="text-muted text-[13px] font-medium">searching</span>
        </div>
        <div className="bg-surface flex flex-col items-center gap-0.5 rounded-[14px] px-4 py-2.5">
          <span className="num text-muted text-[22px] font-semibold">~{formatClock(usualMs).replace(/^0/, "")}</span>
          <span className="text-muted text-[13px] font-medium">usual wait</span>
        </div>
      </div>
      {botReady ? (
        <div className="mt-4 flex w-full max-w-[358px] flex-col items-center gap-2">
          <p className="text-muted text-center text-[14px]">Nobody yet. Warm up with a Practice bot. No rating on the line.</p>
          <Cta onClick={onBot} icon="robot" className="w-full">
            Play the Practice bot
          </Cta>
        </div>
      ) : (
        <p className="text-muted mt-3.5 max-w-[280px] text-center text-[14px]">
          No one by 0:20? You&apos;ll get a Practice bot. No rating on the line.
        </p>
      )}
      <div className="mt-auto w-full max-w-[528px] pt-6">
        <Cta tone="raised" onClick={onCancel} className="w-full">
          Cancel
        </Cta>
      </div>
    </div>
  );
}

/* ---------------- D2 Versus intro + countdown ---------------- */

export function placeOf(p: Pick<MatchPlayerView, "country" | "city">) {
  return [p.country, p.city].filter(Boolean).join(", ");
}

export function Versus({
  me,
  them,
  msToStart,
  round,
}: {
  me: MatchPlayerView;
  them: { nickname: string; color: string; rating: number; country: string | null; city: string | null; bot?: boolean };
  msToStart: number;
  round: number;
}) {
  const reduce = useReduce();
  useEffect(() => {
    play("whoosh");
  }, []);
  const countdown = msToStart <= TIMING.countdownMs;
  const slide = (from: string) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
      : { initial: { transform: from }, animate: { transform: "translateX(0px)" } };
  return (
    <div className="relative flex-1 overflow-hidden" data-screen-label="D2 Versus">
      <motion.div
        {...slide("translateX(-60px)")}
        transition={reduce ? { duration: 0.2 } : { ...SPRING_PRESS, duration: 0.5 }}
        className="absolute inset-x-0 top-0 h-[460px] bg-[#162019] [clip-path:polygon(0_0,100%_0,100%_78%,0_100%)] [[data-theme=light]_&]:bg-[#E3F2C6]"
      />
      <motion.div
        {...slide("translateX(60px)")}
        transition={reduce ? { duration: 0.2 } : { ...SPRING_PRESS, duration: 0.5 }}
        className="absolute inset-x-0 bottom-0 h-[460px] bg-[#24151A] [clip-path:polygon(0_22%,100%_0,100%_100%,0_100%)] [[data-theme=light]_&]:bg-[#F6DDE0]"
      />
      <div className="absolute top-[max(70px,env(safe-area-inset-top))] left-6 flex flex-col gap-2.5">
        <Spuz mood="proud" size={140} color={me.color} decorative />
        <span className="font-display text-[30px] font-black">{me.nickname}</span>
        <div className="flex items-center gap-2">
          <RankHex />
          <span className="num text-[18px] font-semibold">{formatNumber(me.rating)}</span>
          {placeOf(me) && <span className="bg-surface-raised rounded-[8px] px-2 py-[3px] text-[13px] font-semibold">{placeOf(me)}</span>}
        </div>
      </div>
      <div className="absolute right-6 bottom-[70px] flex flex-col items-end gap-2.5">
        <span className="font-display text-[30px] font-black">{them.nickname}</span>
        <div className="flex items-center gap-2">
          {them.bot ? (
            <span className="bg-surface-raised rounded-[8px] px-2 py-[3px] text-[13px] font-semibold">No rating on the line</span>
          ) : (
            <>
              {placeOf(them) && (
                <span className="bg-surface-raised rounded-[8px] px-2 py-[3px] text-[13px] font-semibold">{placeOf(them)}</span>
              )}
              <span className="num text-[18px] font-semibold">{formatNumber(them.rating)}</span>
              <RankHex />
            </>
          )}
        </div>
        <Spuz mood={them.bot ? "thinking" : "rage"} size={140} color={them.color} decorative />
      </div>
      <div className="absolute inset-x-0 top-[380px] flex justify-center">
        {countdown ? (
          <CountdownNumber msToStart={msToStart} />
        ) : (
          <span className="font-display text-muted flex h-[100px] items-center text-[40px] font-black">vs</span>
        )}
      </div>
      <div className="text-muted absolute inset-x-0 top-[500px] text-center text-[15px] font-semibold">Round {round} of 3</div>
    </div>
  );
}

function RankHex() {
  return (
    <span
      aria-hidden
      className="flex h-[38px] w-[34px] items-center justify-center bg-[var(--gold)] text-[#0E0F1A] [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]"
    >
      <Icon name="crown-simple" size={16} />
    </span>
  );
}

/* ---------------- D3 Opponent strip ---------------- */

export function OpponentStrip({
  them,
  me,
  myMs,
  rounds,
  round,
  emote,
  myEmote,
  stale,
}: {
  them: { nickname: string; color: string; progress: number; mistakes: number; finished: boolean; bot?: boolean };
  me: { color: string; progress: number };
  myMs: number;
  rounds: ("me" | "them" | "draw")[];
  round: number;
  emote: { e: EmoteId; n: number } | null;
  myEmote: { e: EmoteId; n: number } | null;
  stale: boolean;
}) {
  const reduce = useReduce();
  const flashed = useRef(false);
  useEffect(() => {
    if (them.finished && !flashed.current) {
      flashed.current = true;
      play("sting");
    }
    if (!them.finished) flashed.current = false;
  }, [them.finished]);
  const bar = (p: number, color: string) => (
    <div className="bg-line relative h-2.5 overflow-hidden rounded-[5px]">
      <motion.div
        className="absolute inset-0 origin-left rounded-[5px]"
        style={{ background: color }}
        initial={false}
        animate={{ transform: `scaleX(${Math.max(0, Math.min(1, p))})` }}
        transition={{ duration: reduce ? 0 : 0.5, ease: EASE_IN_OUT }}
      />
    </div>
  );
  return (
    <div className="bg-surface -mx-3 flex flex-col gap-2.5 px-3 pt-1 pb-2.5" data-screen-label="D3 strip">
      <motion.div
        className="flex items-center gap-2.5"
        animate={them.finished && !reduce ? { transform: ["scale(1)", "scale(1.06)", "scale(1)"] } : undefined}
        transition={{ ...SPRING_PARTY, duration: 0.4 }}
      >
        <Avatar name={them.nickname} color={stale ? "#5A5E78" : them.color} dim={stale}>
          <EmoteBubble emote={emote?.e ?? null} n={emote?.n ?? 0} className="-top-[34px] -left-1.5" />
          <AnimatePresence>
            {them.finished && (
              <motion.span
                className="text-gold absolute -top-[22px] left-2"
                initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(-40px) scale(0.8)" }}
                animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
                transition={reduce ? { duration: 0.15 } : SPRING_PARTY}
              >
                <Icon name="crown-simple" size={22} />
              </motion.span>
            )}
          </AnimatePresence>
        </Avatar>
        <div className="flex flex-1 flex-col gap-[5px]">
          <div className="flex justify-between text-[14px] font-semibold">
            <span className="flex items-center gap-1.5">
              {them.nickname}
              {them.bot && <span className="bg-surface-raised text-muted rounded-[6px] px-1.5 text-[12px]">Practice bot</span>}
              {stale && <Icon name="wifi-slash" size={14} className="text-gold" />}
            </span>
            <span className="flex items-center gap-1 text-[var(--danger)]" aria-label={`${them.mistakes} mistakes`}>
              <Icon name="x-circle" size={16} />
              <span className="num">{them.mistakes}</span>
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={`${them.nickname} progress`}
            aria-valuenow={Math.round(them.progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            {bar(them.progress, stale ? "#5A5E78" : them.color)}
          </div>
        </div>
        <RoundDots rounds={rounds} current={round} oppColor={them.color} />
      </motion.div>
      <div className="flex items-center gap-2.5">
        <Avatar name="You" color={me.color}>
          <EmoteBubble emote={myEmote?.e ?? null} n={myEmote?.n ?? 0} className="-top-[34px] -left-1.5" />
        </Avatar>
        <div className="flex flex-1 flex-col gap-[5px]">
          <div className="flex justify-between text-[14px] font-semibold">
            <span>You</span>
            <span className="num text-muted">{formatClock(myMs)}</span>
          </div>
          <div
            role="progressbar"
            aria-label="Your progress"
            aria-valuenow={Math.round(me.progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            {bar(me.progress, "var(--accent)")}
          </div>
        </div>
        <div className="w-[46px]" />
      </div>
    </div>
  );
}

/* ---------------- M2 Round end ---------------- */

export function RoundEnd({
  round,
  meWon,
  draw,
  me,
  them,
  myMs,
  theirMs,
  rounds,
  oppColor,
  msToNext,
  onEmote,
  emote,
}: {
  round: number;
  meWon: boolean;
  draw: boolean;
  me: { nickname: string; color: string };
  them: { nickname: string; color: string };
  myMs: number | null;
  theirMs: number | null;
  rounds: ("me" | "them" | "draw")[];
  oppColor: string;
  msToNext: number;
  onEmote: (e: EmoteId) => void;
  emote: { e: EmoteId; n: number } | null;
}) {
  const reduce = useReduce();
  useEffect(() => {
    play(meWon ? "chime" : "fizzle", { step: 4 });
  }, [meWon]);
  const won = rounds.filter((r) => r === "me").length;
  const lost = rounds.filter((r) => r === "them").length;
  const decider = won === 1 && lost === 1;
  const margin = myMs !== null && theirMs !== null ? Math.abs(myMs - theirMs) / 1000 : null;
  const title = draw ? "Dead level" : meWon ? "Round to you" : `${them.nickname} took it`;
  const line = draw
    ? "Same tenth, same slips. Nobody scores."
    : meWon
      ? margin !== null
        ? `You won by ${margin.toFixed(1)} seconds. They felt it.`
        : "They saw your board land. They felt it."
      : margin !== null
        ? `You lost by ${margin.toFixed(1)} seconds. Rematch is literally next.`
        : "Close one. Next board is yours.";
  const card = (who: { nickname: string; color: string }, ms: number | null, winner: boolean, mood: SpuzMood, label: string) => (
    <div className="flex flex-col items-center gap-2" style={{ opacity: winner ? 1 : 0.7 }}>
      {winner && <Icon name="crown-simple" size={34} className="text-gold -mb-3.5" />}
      <Spuz mood={mood} size={winner ? 130 : 110} color={who.color} decorative />
      <span className="text-[16px] font-semibold">{label}</span>
      <span className="num text-[22px] font-semibold" style={{ color: winner ? "var(--accent)" : undefined }}>
        {ms === null ? "DNF" : formatTenths(ms)}
      </span>
    </div>
  );
  return (
    <motion.div
      className="flex flex-1 flex-col items-center gap-4 px-5 pt-[90px] pb-7"
      data-screen-label="M2 Round end"
      initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(12px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.28, ease: EASE_OUT }}
    >
      <div className="text-muted text-[15px] font-semibold">Round {round} of 3</div>
      <h1 className="font-display self-stretch text-center text-[34px] font-black tracking-[-0.02em]" aria-live="polite">
        {title}
      </h1>
      <p className="self-stretch text-center text-[17px] font-semibold">{line}</p>
      <div className="relative mt-2.5 flex items-end gap-3.5">
        {card(me, myMs, meWon, meWon ? "cheer" : "shocked", "You")}
        {card(them, theirMs, !meWon && !draw, !meWon && !draw ? "cheer" : "shocked", them.nickname)}
        <EmoteBubble emote={emote?.e ?? null} n={emote?.n ?? 0} className="-top-8 right-0" />
      </div>
      <div className="mt-2">
        <RoundDots rounds={rounds} current={round + 1} size={18} oppColor={oppColor} />
      </div>
      <div className="text-muted text-[15px] font-medium">
        <span className="num">
          {won} - {lost}
        </span>
        . {decider ? "Decider in" : "Next round in"}
      </div>
      <div className="num text-accent text-[64px] leading-none font-semibold" aria-live="off">
        {Math.max(0, Math.ceil(msToNext / 1000))}
      </div>
      <div className="mt-auto">
        <EmoteBar onSend={onEmote} size="lg" />
      </div>
    </motion.div>
  );
}

/* ---------------- M3 Opponent disconnected ---------------- */

export function OppDisconnected({
  name,
  color,
  progress,
  msLeft,
  onClaim,
}: {
  name: string;
  color: string;
  progress: number;
  msLeft: number;
  onClaim: () => void;
}) {
  const secs = Math.max(0, Math.ceil(msLeft / 1000));
  const pct = Math.round((secs / 20) * 100);
  return (
    <div className="flex flex-1 flex-col" data-screen-label="M3 Opp disconnected">
      <div className="bg-surface flex items-center gap-2.5 px-3 pt-[max(50px,env(safe-area-inset-top))] pb-3">
        <Avatar name={name} color={color} dim />
        <div className="flex flex-1 flex-col gap-1">
          <span className="flex items-center gap-1.5 text-[14px] font-semibold">
            {name} <Icon name="wifi-slash" size={14} className="text-gold" />
          </span>
          <div className="bg-line relative h-2.5 overflow-hidden rounded-[5px]">
            <div className="absolute inset-0 origin-left rounded-[5px] bg-[#5A5E78]" style={{ transform: `scaleX(${progress})` }} />
          </div>
        </div>
      </div>
      <div
        className="bg-surface m-4 flex flex-col items-center gap-2.5 rounded-[24px] p-5 shadow-[inset_0_0_0_2px_var(--gold)]"
        role="alert"
      >
        <div
          className="flex size-24 items-center justify-center rounded-full"
          style={{ background: `conic-gradient(var(--gold) 0 ${pct}%, var(--line) ${pct}% 100%)` }}
          role="timer"
          aria-label={`${secs} seconds left`}
        >
          <div className="bg-surface num flex size-20 items-center justify-center rounded-full text-[30px] font-semibold">{secs}</div>
        </div>
        <h2 className="font-display self-stretch text-center text-[18px] font-extrabold">{name} lost signal</h2>
        <p className="text-muted self-stretch text-center text-[15px] leading-[1.45]">
          Your clock is paused. If they&apos;re not back in 20 s, the round is yours.
        </p>
      </div>
      <div className="flex flex-1 items-start justify-center pt-1.5 opacity-40" aria-hidden>
        <div className="grid grid-cols-6 gap-[3px]">
          {Array.from({ length: 36 }, (_, i) => (
            <div
              key={i}
              className="size-12 rounded-[9px]"
              style={{ background: ["#4A3F8F", "#1F5468", "#6B3A6E", "#3F5A2E", "#7A4A2A", "#2B3F80"][(i * 7 + Math.floor(i / 6)) % 6] }}
            />
          ))}
        </div>
      </div>
      <div className="px-4 pt-3 pb-[max(28px,env(safe-area-inset-bottom))]">
        <Cta tone="raised" className="w-full" onClick={onClaim}>
          Claim win now
        </Cta>
      </div>
    </div>
  );
}

/* ---------------- M4 edge cards ---------------- */

export function EdgeCard({
  mood,
  title,
  body,
  action,
  onAction,
  tone,
}: {
  mood: SpuzMood;
  title: string;
  body: string;
  action: string;
  onAction?: () => void;
  tone: "warn" | "ok";
}) {
  const reduce = useReduce();
  return (
    <motion.div
      role="alertdialog"
      aria-label={title}
      initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(16px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.32, ease: EASE_OUT }}
      className="bg-surface flex items-center gap-3.5 rounded-[28px] p-5"
      style={{ boxShadow: `inset 0 0 0 2px ${tone === "warn" ? "var(--gold)" : "var(--line)"}` }}
    >
      <Spuz mood={mood} size={96} decorative />
      <div className="flex flex-1 flex-col gap-1.5">
        <span className="font-display text-[18px] font-extrabold">{title}</span>
        <span className="text-muted text-[15px] leading-[1.45]">{body}</span>
        <button
          type="button"
          onClick={onAction}
          disabled={!onAction}
          className="press mt-1 min-h-11 self-start rounded-[14px] px-3.5 text-[14px] font-bold"
          style={
            tone === "warn"
              ? { background: "var(--warn-tint)", color: "var(--gold)" }
              : { background: "var(--accent)", color: "var(--on-accent)" }
          }
        >
          {action}
        </button>
      </div>
    </motion.div>
  );
}

/* ---------------- D4 Match end ---------------- */

export function MatchEnd({
  view,
  me,
  them,
  onRematch,
  onShare,
  onHome,
  rematchWaiting,
  theyWantRematch,
}: {
  view: MatchView;
  me: MatchPlayerView;
  them: { id: string; nickname: string; color: string; roundsWon: number; bot?: boolean };
  onRematch: () => void;
  onShare: () => void;
  onHome: () => void;
  rematchWaiting: boolean;
  theyWantRematch: boolean;
}) {
  const reduce = useReduce();
  const won = view.winnerId === me.id;
  const draw = view.result === "draw";
  const [skip, setSkip] = useState(false);
  const ratingDelta = me.ratingAfter !== null && me.ratingBefore !== null ? Math.round(me.ratingAfter - me.ratingBefore) : null;
  const [shownRating, setShownRating] = useState(me.ratingBefore ?? me.rating);
  useEffect(() => {
    if (won) {
      play("cheer", { silentHaptic: true });
      haptic([30, 10, 30]);
    } else play("fizzle");
  }, [won]);
  // Rating count-up (You win, Handoff): 1,100 ms; reduced motion or a tap swaps the number.
  useEffect(() => {
    if (me.ratingAfter === null || me.ratingBefore === null) return;
    if (reduce || skip) return;
    const from = me.ratingBefore,
      to = me.ratingAfter,
      t0 = performance.now();
    let raf = 0;
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / 1100);
      setShownRating(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [me.ratingAfter, me.ratingBefore, reduce, skip]);
  const displayRating = reduce || skip ? (me.ratingAfter ?? me.rating) : shownRating;
  const score = `${me.roundsWon}-${them.roundsWon}`;
  const title = draw ? `Draw ${score}` : won ? `You win ${score}` : `${them.nickname} wins ${them.roundsWon}-${me.roundsWon}`;
  const r1 = view.rounds.filter((r) => r.playerId === me.id);
  const lostRound = r1.find((r) => !r.won && view.rounds.some((x) => x.round === r.round && x.won));
  const line =
    view.result === "abandon"
      ? `${them.nickname} dropped out. Win counts.`
      : view.result === "left"
        ? won
          ? `${them.nickname} left the duel. Win counts.`
          : "You left the duel. It counts as a loss."
        : draw
          ? "Level after three. Fewer slips next time breaks it."
          : won
            ? lostRound
              ? `${them.nickname} had you in round ${lostRound.round}. Not after.`
              : `Clean sweep. ${them.nickname} never got going.`
            : `${them.nickname} edged it. Run it back.`;
  const xp = view.reward?.xp ?? (view.isBot ? 10 : won ? 40 : 10);
  return (
    <div
      className="relative flex flex-1 flex-col items-center pb-[max(28px,env(safe-area-inset-bottom))]"
      onPointerDown={() => setSkip(true)}
      data-screen-label="D4 Match end"
    >
      <div className="mt-[70px] w-full overflow-hidden py-3">
        <motion.div
          className="flex h-[84px] w-full items-center justify-center"
          style={{ background: won ? "var(--accent)" : draw ? "var(--surface-raised)" : them.color }}
          initial={
            reduce || skip ? { opacity: 0, transform: "translateX(0%) skewY(-4deg)" } : { transform: "translateX(-110%) skewY(-4deg)" }
          }
          animate={{ opacity: 1, transform: "translateX(0%) skewY(-4deg)" }}
          transition={reduce || skip ? { duration: 0.2 } : { ...SPRING_PARTY, duration: 1.1 }}
        >
          <h1
            className="font-display skew-y-[4deg] text-[36px] font-black tracking-[-0.03em]"
            style={{ color: draw ? "var(--text)" : "#0E0F1A" }}
            aria-live="polite"
          >
            {title}
          </h1>
        </motion.div>
      </div>
      {won ? (
        <motion.div
          aria-hidden
          className="mt-6 flex h-[120px] w-[110px] items-center justify-center bg-[var(--gold)] text-[#0E0F1A] [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]"
          animate={reduce || skip ? undefined : { transform: ["perspective(400px) rotateY(0deg)", "perspective(400px) rotateY(360deg)"] }}
          transition={{ duration: 1.1, ease: EASE_IN_OUT }}
        >
          <Icon name="trophy" size={56} />
        </motion.div>
      ) : (
        <div className="mt-6 flex items-end gap-1.5">
          <Spuz mood={draw ? "thinking" : "sad"} size={110} color={me.color} decorative />
          <Spuz mood={draw ? "thinking" : "party"} size={110} color={them.color} decorative />
        </div>
      )}
      <p className="mt-3.5 px-4 text-center text-[17px] font-semibold">{line}</p>
      <div className="mt-[18px] grid w-[calc(100%-32px)] grid-cols-3 gap-2">
        {[1, 2, 3].map((n) => {
          const mine = view.rounds.find((r) => r.round === n && r.playerId === me.id);
          const theirs = view.rounds.find((r) => r.round === n && r.playerId === them.id);
          if (!mine && !theirs && n > view.round) return <div key={n} />;
          const t = (r: typeof mine) => (r?.timeMs != null ? formatTenths(r.timeMs).replace(/\.\d$/, "") : "DNF");
          return (
            <div
              key={n}
              className="bg-surface flex flex-col gap-1 rounded-[16px] p-2.5"
              style={{ boxShadow: mine?.won ? "inset 0 0 0 2px var(--accent)" : undefined }}
            >
              <span className="text-muted text-[13px] font-semibold">Round {n}</span>
              <span className="num text-[16px] font-semibold">You {t(mine)}</span>
              <span className="num text-muted truncate text-[14px] font-medium">
                {them.bot ? "Bot" : them.nickname} {theirs ? t(theirs) : view.isBot && view.bot ? "" : "DNF"}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 grid w-[calc(100%-32px)] grid-cols-3 gap-2">
        <div className="bg-surface flex flex-col gap-0.5 rounded-[16px] p-3">
          <span className="text-muted text-[13px] font-semibold">Rating</span>
          {ratingDelta !== null ? (
            <>
              <span className="num text-[20px] font-semibold" style={{ color: ratingDelta >= 0 ? "var(--accent)" : "var(--danger)" }}>
                {ratingDelta >= 0 ? `+${ratingDelta}` : ratingDelta}
              </span>
              <span className="num text-muted text-[13px] font-medium">{formatNumber(Math.round(displayRating))}</span>
            </>
          ) : (
            <span className="text-muted text-[15px] font-semibold">Unranked</span>
          )}
        </div>
        <div className="bg-surface flex flex-col gap-0.5 rounded-[16px] p-3">
          <span className="text-muted text-[13px] font-semibold">XP</span>
          <span className="num text-accent text-[20px] font-semibold">+{xp}</span>
        </div>
        <div className="bg-surface flex flex-col gap-0.5 rounded-[16px] p-3">
          <span className="text-muted text-[13px] font-semibold">Score</span>
          <span className="num text-[20px] font-semibold">{score}</span>
        </div>
      </div>
      {(theyWantRematch || rematchWaiting) && (
        <div
          className="bg-surface-raised absolute inset-x-4 bottom-[106px] flex items-center gap-2.5 rounded-[16px] px-3.5 py-2.5"
          role="status"
        >
          <span className="bg-accent size-2 rounded-full" />
          <span className="text-[15px] font-medium">
            {theyWantRematch ? `${them.nickname} wants a rematch` : `Waiting for ${them.nickname}`}
          </span>
        </div>
      )}
      <div className="absolute inset-x-4 bottom-[max(28px,env(safe-area-inset-bottom))] grid grid-cols-[1fr_60px] gap-2.5">
        <Cta icon="arrows-clockwise" onClick={onRematch} disabled={rematchWaiting}>
          Rematch
        </Cta>
        <button
          type="button"
          aria-label="Share"
          onClick={onShare}
          className="toy bg-surface-raised flex h-[60px] items-center justify-center rounded-[20px] [--btn-depth:var(--depth)]"
          style={{ boxShadow: "0 6px 0 var(--depth)" }}
        >
          <Icon name="share-fat" size={22} />
        </button>
      </div>
      <button type="button" onClick={onHome} className="sr-only focus:not-sr-only">
        Back to The Grid
      </button>
    </div>
  );
}

/* ---------------- Rematch wipe (Handoff: 600 ms, spring-press, bump + wipe) ---------------- */

export function RematchWipe({ n }: { n: number }) {
  const reduce = useReduce();
  useEffect(() => {
    if (!n) return;
    play("bump");
    play("whoosh", { silentHaptic: true });
  }, [n]);
  return (
    <AnimatePresence>
      {n > 0 && (
        <motion.div
          key={n}
          aria-hidden
          className="bg-accent pointer-events-none fixed inset-0 z-50"
          initial={reduce ? { opacity: 0 } : { clipPath: "inset(0 100% 0 0)" }}
          animate={reduce ? { opacity: [0, 0.6, 0] } : { clipPath: ["inset(0 100% 0 0)", "inset(0 0% 0 0)", "inset(0 0% 0 100%)"] }}
          transition={{ duration: 0.6, ease: EASE_IN_OUT }}
        />
      )}
    </AnimatePresence>
  );
}
