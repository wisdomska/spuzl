"use client";

import { RankChanges } from "./RankChanges";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { duelCopy } from "@/lib/copy/duel";
import { bayLive } from "@/lib/copy/bay-live";
import { gameMenuCopy } from "@/lib/copy/game-menu";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "@/components/ui/Icon";
import { AddFriend } from "./AddFriend";
import { GamePickerSheet } from "./GamePickerSheet";
import { Spuz, type SpuzMood } from "@/components/brand/Spuz";
import { MySpuz } from "@/components/meta/MySpuz";
import { SpuzWear } from "@/components/meta/SpuzWear";
import { play } from "@/lib/audio";
import { formatClock, formatNumber } from "@/lib/format";
import { gameName, RACE_GAMES } from "@/lib/multiplayer/games";
import { GAME_BY_ID, WORLD_BY_ID } from "@/lib/catalog";
import { GameIcon3D } from "@/components/world/GameIcon3D";
import { TIMING, type EmoteId } from "@/lib/multiplayer/constants";
import type { MatchPlayerView, MatchView } from "@/lib/multiplayer/types";
import { useReduce } from "@/lib/client/multiplayer";
import { useViewportHeight } from "@/components/game/useBoardSize";
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
  TopButton,
  formatTenths,
  HomeCorner,
} from "./ui";

/* ---------------- M1 Duel entry sheet ---------------- */

/** One way to duel: the primary (lemon) or the secondary (raised) card. Both are real, enabled buttons. */
function DuelOption({
  primary,
  icon,
  title,
  sub,
  onClick,
}: {
  primary: boolean;
  icon: string;
  title: string;
  sub: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`toy flex min-h-11 items-center gap-3.5 rounded-[22px] p-[18px] text-left ${primary ? "" : "bg-surface-raised [--btn-depth:var(--depth)]"}`}
      style={
        primary
          ? {
              background: "var(--accent)",
              color: "var(--on-accent)",
              ["--btn-depth" as string]: "var(--accent-depth)",
              boxShadow: "0 6px 0 var(--accent-depth)",
            }
          : { boxShadow: "0 6px 0 var(--depth)" }
      }
    >
      <Icon name={icon} size={32} className={primary ? undefined : "text-accent"} />
      <span className="flex flex-1 flex-col">
        <span className="font-display text-[19px] font-black">{title}</span>
        <span className={`text-[15px] font-medium ${primary ? "" : "text-muted"}`}>{sub}</span>
      </span>
      <Icon name="caret-right" size={20} className={primary ? undefined : "text-muted"} />
    </button>
  );
}

/**
 * R2-02: the Duel entry. "Game: <name> ▸" opens the full-height game picker (Any game by default, so the
 * buttons are never disabled). Quick Match is the primary action and Challenge a friend the second (Challenge a
 * friend leads while the profile loads). R3-06: 13 to 15 year olds get Quick Match too, with a line saying they
 * only meet players their age; the server pairs them only with other 13 to 15 players, whatever the screen.
 */
export function DuelEntrySheet({
  game,
  setGame,
  rating,
  onQuick,
  onFriend,
  onCode,
  onClose,
  live,
  teen = false,
  friendName,
}: {
  /** R3-06: a 13 to 15 player (Quick Match pairs them with players their age only) */
  teen?: boolean;
  /** a race game, or null for Any game */
  game: string | null;
  setGame: (g: string | null) => void;
  rating: number;
  onQuick: () => void;
  onFriend: () => void;
  /** opened from a friend's card: the sheet challenges them by name */
  friendName?: string | null;
  /** open the friend's-code box */
  onCode: () => void;
  onClose: () => void;
  /** may play Quick Match (any known band, in its own pool); null while the profile loads */
  live: boolean | null;
}) {
  const reduce = useReduce();
  const [picking, setPicking] = useState(false);
  const named = game ? gameName(game) : duelCopy.anyGame;
  const quickFirst = live === true && !friendName;
  const friendTitle = friendName ? duelCopy.friendNamed(friendName) : duelCopy.friend;
  // A page, not a modal: /duel is often opened straight from a shared link or the home screen, so
  // there is nothing behind it to dim. The app background, a Back header and the panel docked below.
  return (
    <div className="dotgrid flex flex-1 flex-col">
      <header className="flex items-center gap-3 px-4 pt-[max(56px,env(safe-area-inset-top))]">
        <TopButton icon="arrow-left" label={duelCopy.back} onClick={onClose} />
      </header>
      <div className="flex min-h-4 flex-1 items-center justify-center py-4 [@media(max-height:640px)]:[&>*]:hidden">
        <MySpuz mood="fire" size={120} decorative />
      </div>
      <motion.section
        aria-labelledby="duel-title"
        initial={reduce ? { opacity: 0 } : { transform: "translateY(100%)" }}
        animate={reduce ? { opacity: 1 } : { transform: "translateY(0%)" }}
        transition={{ duration: 0.32, ease: EASE_OUT }}
        className="bg-surface flex w-full flex-col gap-3.5 rounded-t-[32px] px-5 pt-5 pb-[max(28px,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center gap-3">
          <Icon name="sword" size={28} className="text-accent" />
          <h1 id="duel-title" className="font-display text-[26px] font-black">
            {friendName ? duelCopy.friendNamed(friendName) : duelCopy.entryTitle}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setPicking(true)}
          aria-haspopup="dialog"
          aria-label={duelCopy.gameRowLabel(named)}
          className="press bg-bg flex min-h-12 items-center gap-2 rounded-[16px] px-4 text-left text-[15px]"
        >
          <span className="text-muted font-semibold">{duelCopy.gameRow}:</span>
          <span className="min-w-0 flex-1 truncate font-bold">{named}</span>
          <Icon name="caret-right" size={18} className="text-accent shrink-0" />
        </button>
        <GamePickerSheet open={picking} onOpenChange={setPicking} value={game} onPick={setGame} />
        {quickFirst && (
          <DuelOption
            primary
            icon="lightning"
            title={duelCopy.quick}
            onClick={onQuick}
            sub={
              <>
                {duelCopy.quickSub} {duelCopy.quickRating} <span className="num">{formatNumber(rating)}</span>.
                {teen && <> {duelCopy.quickTeen}</>}
              </>
            }
          />
        )}
        <DuelOption primary={!quickFirst} icon="user-plus" title={friendTitle} sub={duelCopy.friendSub} onClick={onFriend} />
        <DuelOption primary={false} icon="keyboard" title={duelCopy.code.open} sub={duelCopy.code.openSub} onClick={onCode} />
        {/* Board games are played in Board Bay, not Duel: point there for live chess, draughts and the rest. */}
        <Link href="/bay" className="press flex min-h-11 items-center gap-2.5 rounded-[14px] px-1 text-[15px] font-semibold">
          <Icon name="horse" size={20} className="text-accent" />
          <span className="flex min-w-0 flex-1 flex-col">
            {bayLive.duelLink}
            <span className="text-muted text-[13px] font-medium">{bayLive.duelLinkSub}</span>
          </span>
          <Icon name="caret-right" size={16} className="text-muted" />
        </Link>
      </motion.section>
    </div>
  );
}

/* ---------------- D1 Matchmaking ---------------- */

export function Matchmaking({
  rating,
  game,
  waitedMs,
  searching,
  color,
  hat,
  onCancel,
  botReady,
  onBot,
  title = "Finding a rival",
  chip = "Quick Match, ranked",
}: {
  rating: number;
  game: string | null;
  waitedMs: number;
  searching: number | null;
  color: string;
  /** R3-15: the player's Shop hat */
  hat?: string | null;
  onCancel: () => void;
  botReady: boolean;
  onBot: () => void;
  title?: string;
  chip?: string;
}) {
  const reduce = useReduce();
  const meta = game ? RACE_GAMES.find((g) => g.id === game) : null;
  const world = meta ? WORLD_BY_ID[meta.world].name : null;
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
          <SpuzWear mood="thinking" size={120} color={color} hat={hat} />
        </div>
      </div>
      <h1 className="font-display mt-8 text-center text-[26px] font-black" aria-live="polite">
        {title}
      </h1>
      <p className="text-muted mt-2 text-[16px] font-medium">{meta ? `${meta.name}, ${world}, best of 3` : "Any game, best of 3"}</p>
      <div className="mt-5 flex gap-2.5">
        <div className="bg-surface flex flex-col items-center gap-0.5 rounded-[14px] px-4 py-2.5">
          <span className="num text-[22px] font-semibold">{formatClock(waitedMs).replace(/^0/, "")}</span>
          <span className="text-muted text-[13px] font-medium">{duelCopy.searching}</span>
        </div>
        {searching !== null && searching > 0 && (
          <div className="bg-surface flex flex-col items-center justify-center gap-0.5 rounded-[14px] px-4 py-2.5">
            <span className="text-muted text-[14px] font-semibold">{duelCopy.searchingNow(searching)}</span>
          </div>
        )}
      </div>
      <div className="mt-4 flex w-full max-w-[358px] flex-col items-center gap-2">
        <p className="text-muted text-center text-[14px]">{botReady ? duelCopy.botLate : duelCopy.botHint}</p>
        <Cta onClick={onBot} icon="robot" tone={botReady ? undefined : "raised"} className="w-full">
          {duelCopy.botNow}
        </Cta>
      </div>
      <div className="mt-auto w-full max-w-[528px] pt-6">
        <Cta tone="raised" onClick={onCancel} className="w-full">
          Cancel
        </Cta>
      </div>
    </div>
  );
}

/** All-time record against this rival: "You 3 – 2 Tracy", the leader in lime. */
export function HeadToHeadRow({
  h2h,
  them,
  className = "",
}: {
  h2h: { me: number; them: number; draws: number; played: number };
  them: string;
  className?: string;
}) {
  const lead = h2h.me > h2h.them ? "me" : h2h.them > h2h.me ? "them" : null;
  return (
    <div className={`bg-surface flex items-center gap-3 rounded-[16px] px-4 py-3 ${className}`} role="group" aria-label="Head to head">
      <span className="text-muted text-[13px] font-semibold whitespace-nowrap">Head to head</span>
      <span className="num flex min-w-0 flex-1 items-baseline justify-center gap-2 text-[18px] font-semibold">
        <span className={lead === "me" ? "text-accent" : undefined}>You {h2h.me}</span>
        <span className="text-muted">–</span>
        <span className="truncate" style={lead === "them" ? { color: "var(--danger)" } : undefined}>
          {h2h.them} {them}
        </span>
      </span>
      <span className="text-muted text-[13px] font-medium whitespace-nowrap">
        {h2h.played} {h2h.played === 1 ? "duel" : "duels"}
        {h2h.draws ? `, ${h2h.draws} drawn` : ""}
      </span>
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
  note,
  h2h,
  countdownMs = TIMING.countdownMs,
  beats,
}: {
  /** the countdown's length and numbers (setting party.countdownSeconds) */
  countdownMs?: number;
  beats?: number;
  me: MatchPlayerView;
  them: {
    nickname: string;
    color: string;
    hat?: string | null;
    rating: number;
    country: string | null;
    city: string | null;
    bot?: boolean;
  };
  msToStart: number;
  round: number;
  /** a line under the round, e.g. the rival is reading a new game's rule */
  note?: string | null;
  /** your record against this rival before this duel */
  h2h?: { me: number; them: number; draws: number; played: number } | null;
}) {
  const reduce = useReduce();
  useEffect(() => {
    play("whoosh");
  }, []);
  const countdown = msToStart <= countdownMs;
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
        <SpuzWear mood="proud" size={140} color={me.color} hat={me.hat} />
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
        <SpuzWear mood={them.bot ? "thinking" : "rage"} size={140} color={them.color} hat={them.hat} />
      </div>
      <div className="absolute inset-x-0 top-[380px] flex justify-center">
        {countdown ? (
          <CountdownNumber msToStart={msToStart} beats={beats} />
        ) : (
          <span className="font-display text-muted flex h-[100px] items-center text-[40px] font-black">vs</span>
        )}
      </div>
      <div className="text-muted absolute inset-x-0 top-[500px] text-center text-[15px] font-semibold">
        Round {round} of 3
        {round === 1 && h2h && h2h.played > 0 && (
          <p className="num mt-1 px-6 font-medium">
            Head to head: you {h2h.me}, {them.nickname} {h2h.them}
            {h2h.draws ? `, ${h2h.draws} drawn` : ""}
          </p>
        )}
        {note && (
          <p className="mt-1 px-6 font-medium" aria-live="polite">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}

function RankHex() {
  return (
    <span
      aria-hidden
      className="bg-gold text-on-gold flex h-[38px] w-[34px] items-center justify-center [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]"
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
  them: { nickname: string; color: string; hat?: string | null; progress: number; mistakes: number; finished: boolean; bot?: boolean };
  me: { nickname: string; color: string; hat?: string | null; progress: number };
  /** your round time, the same clock as the header timer (`duelClockMs`); null before the round starts */
  myMs: number | null;
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
        <Avatar name={them.nickname} color={stale ? "#5A5E78" : them.color} hat={them.hat} dim={stale}>
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
        <Avatar name={me.nickname} color={me.color} hat={me.hat} me>
          <EmoteBubble emote={myEmote?.e ?? null} n={myEmote?.n ?? 0} className="-top-[34px] -left-1.5" />
        </Avatar>
        <div className="flex flex-1 flex-col gap-[5px]">
          <div className="flex justify-between text-[14px] font-semibold">
            <span>You</span>
            {/* R4-18: the same clock as the header timer (the server round time); nothing running before the round. */}
            {myMs === null ? (
              <span className="text-muted flex items-center" data-strip-clock="waiting">
                <Icon name="timer" size={14} />
                <span className="sr-only">{gameMenuCopy.timerWaits}</span>
              </span>
            ) : (
              <span className="num text-muted" data-strip-clock="running">
                {formatClock(myMs)}
              </span>
            )}
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

/** Viewport height, in px, at or under which the result screens go compact (the `compact` CSS variant). */
const RESULT_COMPACT_H = 880;

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
  totalMs,
  onEmote,
  onChat,
  unread = 0,
  emote,
  note,
}: {
  round: number;
  meWon: boolean;
  draw: boolean;
  me: { nickname: string; color: string; hat?: string | null };
  them: { nickname: string; color: string; hat?: string | null };
  myMs: number | null;
  theirMs: number | null;
  rounds: ("me" | "them" | "draw")[];
  oppColor: string;
  msToNext: number;
  totalMs: number;
  /** a line under the next-round label, e.g. the rival is reading a new game's rule */
  note?: string | null;
  onEmote: (e: EmoteId) => void;
  onChat?: () => void;
  unread?: number;
  emote: { e: EmoteId; n: number } | null;
}) {
  const reduce = useReduce();
  // Under 880 px of height (phones, laptops): smaller Spuz, tighter spacing, so the countdown and the reactions stay
  // on screen without a scroll.
  const short = useViewportHeight() <= RESULT_COMPACT_H;
  useEffect(() => {
    play(meWon ? "success" : "fizzle");
  }, [meWon]);
  const won = rounds.filter((r) => r === "me").length;
  const lost = rounds.filter((r) => r === "them").length;
  const decider = won === 1 && lost === 1;
  const margin = myMs !== null && theirMs !== null ? Math.abs(myMs - theirMs) / 1000 : null;
  const title = duelCopy.roundTitle(round, draw ? "draw" : meWon ? "me" : "them", them.nickname);
  const line = duelCopy.roundLine(draw ? "draw" : meWon ? "me" : "them", margin);
  const card = (
    who: { nickname: string; color: string; hat?: string | null },
    ms: number | null,
    winner: boolean,
    mood: SpuzMood,
    label: string,
  ) => (
    <div className="compact:gap-1 flex min-w-0 flex-col items-center gap-2" style={{ opacity: winner ? 1 : 0.7 }}>
      {winner && <Icon name="crown-simple" size={short ? 26 : 34} className="text-gold compact:-mb-2.5 -mb-3.5" />}
      <SpuzWear mood={mood} size={short ? (winner ? 88 : 76) : winner ? 130 : 110} color={who.color} hat={who.hat} />
      <span className="max-w-[140px] truncate text-[16px] font-semibold">{label}</span>
      <span className="num compact:text-[19px] text-[22px] font-semibold" style={{ color: winner ? "var(--accent)" : undefined }}>
        {ms === null ? "DNF" : formatTenths(ms)}
      </span>
    </div>
  );
  return (
    <motion.div
      className="compact:gap-2 compact:pt-6 compact:pb-4 flex flex-1 flex-col items-center gap-4 px-5 pt-[90px] pb-7"
      data-screen-label="M2 Round end"
      initial={reduce ? { opacity: 0 } : { opacity: 0, transform: "translateY(12px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.28, ease: EASE_OUT }}
    >
      {/* the title already names the round; the compact layout drops this line */}
      <div className="text-muted compact:hidden text-[15px] font-semibold">Round {round} of 3</div>
      <h1
        className="font-display compact:text-[26px] compact:leading-[1.1] self-stretch text-center text-[34px] font-black tracking-[-0.02em]"
        aria-live="polite"
      >
        {title}
      </h1>
      <p className="compact:text-[15px] self-stretch text-center text-[17px] font-semibold">{line}</p>
      <div className="compact:mt-0 relative mt-2.5 flex items-end gap-3.5">
        {card(me, myMs, meWon, meWon ? "cheer" : "shocked", "You")}
        {card(them, theirMs, !meWon && !draw, !meWon && !draw ? "cheer" : "shocked", them.nickname)}
        <EmoteBubble emote={emote?.e ?? null} n={emote?.n ?? 0} className="-top-8 right-0" />
      </div>
      {/* the round dots and the score with what's next: one row in the compact layout */}
      <div className="compact:flex-row compact:gap-3 compact:mt-0 mt-2 flex flex-col items-center gap-4">
        <RoundDots rounds={rounds} current={round + 1} size={short ? 14 : 18} oppColor={oppColor} />
        <div className="text-muted text-[15px] font-medium">
          <span className="num">
            {won} - {lost}
          </span>
          . {duelCopy.nextRoundLabel(decider)}
        </div>
      </div>
      {note && (
        <p className="text-muted -mt-2 text-center text-[15px] font-medium" aria-live="polite">
          {note}
        </p>
      )}
      <div
        className="bg-line h-2 w-full max-w-[280px] overflow-hidden rounded-full"
        role="progressbar"
        aria-label={duelCopy.nextRoundLabel(decider)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(100 * (1 - Math.max(0, Math.min(1, msToNext / Math.max(1, totalMs)))))}
      >
        <div
          className="bg-accent h-full origin-left rounded-full"
          style={{ transform: `scaleX(${1 - Math.max(0, Math.min(1, msToNext / Math.max(1, totalMs)))})` }}
        />
      </div>
      <div className="mt-auto">
        <EmoteBar onSend={onEmote} size={short ? "md" : "lg"} onChat={onChat} unread={unread} />
      </div>
    </motion.div>
  );
}

/* ---------------- M3 Opponent disconnected ---------------- */

export function OppDisconnected({
  name,
  color,
  hat,
  progress,
  msLeft,
  onClaim,
  gameId,
}: {
  name: string;
  color: string;
  hat?: string | null;
  progress: number;
  msLeft: number;
  onClaim: () => void;
  /** the round's game: the paused board shows it (never a stand-in pattern from another game) */
  gameId?: string | null;
}) {
  const meta = gameId ? GAME_BY_ID[gameId] : undefined;
  const secs = Math.max(0, Math.ceil(msLeft / 1000));
  const pct = Math.round((secs / 20) * 100);
  return (
    <div className="flex flex-1 flex-col" data-screen-label="M3 Opp disconnected">
      <div className="bg-surface flex items-center gap-2.5 px-3 pt-[max(50px,env(safe-area-inset-top))] pb-3">
        <Avatar name={name} color={color} hat={hat} dim />
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
          Your clock is paused. If they&apos;re not back in 20&nbsp;s, the round is yours.
        </p>
      </div>
      <div className="flex flex-1 items-start justify-center px-4 pt-1.5">
        <div className="bg-surface flex w-full max-w-[420px] flex-col items-center gap-2 rounded-[24px] px-5 py-6 text-center">
          {meta && <GameIcon3D meta={meta} size={72} />}
          <p className="font-display text-[17px] font-extrabold">{meta ? `Your ${meta.name} board is saved` : "Your board is saved"}</p>
          <p className="text-muted text-[14px] leading-[1.45]">It resumes the moment they're back.</p>
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
  onChat,
  unread = 0,
  rematchWaiting,
  theyWantRematch,
}: {
  view: MatchView;
  me: MatchPlayerView;
  them: { id: string; nickname: string; color: string; hat?: string | null; roundsWon: number; bot?: boolean };
  onRematch: () => void;
  onShare: () => void;
  onHome: () => void;
  onChat?: () => void;
  unread?: number;
  rematchWaiting: boolean;
  theyWantRematch: boolean;
}) {
  const reduce = useReduce();
  const short = useViewportHeight() <= RESULT_COMPACT_H;
  const won = view.winnerId === me.id;
  const draw = view.result === "draw";
  const [skip, setSkip] = useState(false);
  const ratingDelta = me.ratingAfter !== null && me.ratingBefore !== null ? Math.round(me.ratingAfter - me.ratingBefore) : null;
  const [shownRating, setShownRating] = useState(me.ratingBefore ?? me.rating);
  useEffect(() => {
    play(won ? "duelWin" : draw ? "notify" : "duelLose");
  }, [won, draw]);
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
  // A duel that ended by someone dropping out or leaving has no round score worth showing ("You win 0-0").
  const forfeit = view.result === "abandon" || view.result === "left";
  const title = forfeit
    ? won
      ? "You win"
      : `${them.nickname} wins`
    : draw
      ? `Draw ${score}`
      : won
        ? `You win ${score}`
        : `${them.nickname} wins ${them.roundsWon}-${me.roundsWon}`;
  const r1 = view.rounds.filter((r) => r.playerId === me.id);
  const lostRound = r1.find((r) => !r.won && view.rounds.some((x) => x.round === r.round && x.won));
  const line =
    view.result === "abandon"
      ? `${them.nickname} dropped out. Win counts.`
      : view.result === "left"
        ? won
          ? `${them.nickname} left the duel. Win counts.`
          : view.isBot
            ? duelCopy.leftBot
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
      className="relative flex flex-1 flex-col items-center"
      // room under the content for the action bar (and the rematch note), which stays on screen
      style={{ paddingBottom: `calc(${theyWantRematch || rematchWaiting ? 148 : 96}px + max(28px, env(safe-area-inset-bottom)) - 28px)` }}
      onPointerDown={() => setSkip(true)}
      data-screen-label="D4 Match end"
    >
      <HomeCorner onClick={onHome} />
      <div className="compact:mt-[60px] compact:py-2 mt-[70px] w-full overflow-hidden py-3">
        <motion.div
          className="compact:h-[56px] flex h-[84px] w-full items-center justify-center"
          style={{ background: won ? "var(--accent)" : draw ? "var(--surface-raised)" : them.color }}
          initial={
            reduce || skip ? { opacity: 0, transform: "translateX(0%) skewY(-4deg)" } : { transform: "translateX(-110%) skewY(-4deg)" }
          }
          animate={{ opacity: 1, transform: "translateX(0%) skewY(-4deg)" }}
          transition={reduce || skip ? { duration: 0.2 } : { ...SPRING_PARTY, duration: 1.1 }}
        >
          <h1
            className="font-display compact:text-[30px] skew-y-[4deg] text-[36px] font-black tracking-[-0.03em]"
            style={{ color: draw ? "var(--text)" : won ? "var(--on-accent)" : "#0E0F1A" }}
            aria-live="polite"
          >
            {title}
          </h1>
        </motion.div>
      </div>
      {won ? (
        <motion.div
          aria-hidden
          className="compact:mt-2 compact:h-[72px] compact:w-[66px] bg-gold text-on-gold mt-6 flex h-[120px] w-[110px] items-center justify-center [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]"
          animate={reduce || skip ? undefined : { transform: ["perspective(400px) rotateY(0deg)", "perspective(400px) rotateY(360deg)"] }}
          transition={{ duration: 1.1, ease: EASE_IN_OUT }}
        >
          <Icon name="trophy" size={short ? 34 : 56} />
        </motion.div>
      ) : (
        <div className="compact:mt-3 mt-6 flex items-end gap-1.5">
          <SpuzWear mood={draw ? "thinking" : "sad"} size={short ? 68 : 110} color={me.color} hat={me.hat} />
          <SpuzWear mood={draw ? "thinking" : "party"} size={short ? 68 : 110} color={them.color} hat={them.hat} />
        </div>
      )}
      <p className="compact:mt-2 compact:text-[15px] mt-3.5 px-4 text-center text-[17px] font-semibold">{line}</p>
      <div className="compact:mt-3 mt-[18px] grid w-[calc(100%-32px)] grid-cols-3 gap-2">
        {[1, 2, 3].map((n) => {
          const mine = view.rounds.find((r) => r.round === n && r.playerId === me.id);
          const theirs = view.rounds.find((r) => r.round === n && r.playerId === them.id);
          if (!mine && !theirs && n > view.round) return <div key={n} />;
          const t = (r: typeof mine) => (r?.timeMs != null ? formatTenths(r.timeMs).replace(/\.\d$/, "") : "DNF");
          return (
            <div
              key={n}
              className="bg-surface compact:gap-0.5 compact:p-2 flex min-w-0 flex-col gap-1 rounded-[16px] p-2.5"
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
      {!view.isBot && <RankChanges matchId={view.id} setNo={view.setNo} className="mt-3 px-4" />}
      <div className="compact:mt-2 mt-3 grid w-[calc(100%-32px)] grid-cols-3 gap-2">
        <div className="bg-surface compact:p-2 flex min-w-0 flex-col gap-0.5 rounded-[16px] p-3">
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
        <div className="bg-surface compact:p-2 flex min-w-0 flex-col gap-0.5 rounded-[16px] p-3">
          <span className="text-muted text-[13px] font-semibold">XP</span>
          <span className="num text-accent text-[20px] font-semibold">+{xp}</span>
        </div>
        <div className="bg-surface compact:p-2 flex min-w-0 flex-col gap-0.5 rounded-[16px] p-3">
          <span className="text-muted text-[13px] font-semibold">{forfeit ? "Result" : "Score"}</span>
          <span className="num text-[20px] font-semibold">{forfeit ? (won ? "Forfeit win" : "Forfeit") : score}</span>
        </div>
      </div>
      {view.h2h && view.h2h.played > 0 && <HeadToHeadRow h2h={view.h2h} them={them.nickname} className="mt-3 w-[calc(100%-32px)]" />}
      {!them.bot && (
        <div className="mt-3 flex w-[calc(100%-32px)] items-center justify-center">
          <AddFriend id={them.id} nickname={them.nickname} />
        </div>
      )}
      {/* The actions stay on the screen's bottom edge on a phone (the card's on a laptop), over a fade, so Rematch is
          never below the fold or on top of the result. */}
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[560px] bg-[linear-gradient(to_top,var(--bg)_78%,transparent)] px-4 pt-3 pb-[max(28px,env(safe-area-inset-bottom))] lg:absolute lg:max-w-none">
        {(theyWantRematch || rematchWaiting) && (
          <div className="bg-surface-raised mb-2.5 flex items-center gap-2.5 rounded-[16px] px-3.5 py-2.5" role="status">
            <span className="bg-accent size-2 rounded-full" />
            <span className="text-[15px] font-medium">
              {theyWantRematch ? `${them.nickname} wants a rematch` : `Waiting for ${them.nickname}`}
            </span>
          </div>
        )}
        <div className="grid gap-2.5" style={{ gridTemplateColumns: onChat ? "1fr 60px 60px" : "1fr 60px" }}>
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
          {onChat && (
            <button
              type="button"
              aria-label={unread ? `Chat, ${unread} new` : "Chat"}
              onClick={onChat}
              className="toy bg-surface-raised relative flex h-[60px] items-center justify-center rounded-[20px] [--btn-depth:var(--depth)]"
              style={{ boxShadow: "0 6px 0 var(--depth)" }}
            >
              <Icon name="chat-circle-text" size={22} />
              {unread > 0 && (
                <span className="num bg-accent text-on-accent absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[12px] font-bold">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
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
