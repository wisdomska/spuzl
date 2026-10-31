"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { GameShell } from "@/components/game/GameShell";
import { Icon } from "@/components/ui/Icon";
import { Spuz } from "@/components/brand/Spuz";
import { BOARDS } from "@/games/board-registry";
import { GAME_BY_ID, WORLD_BY_ID } from "@/lib/catalog";
import { api, finishAttempt, HttpError } from "@/lib/client/api";
import { useProfileGate, useReduce } from "@/lib/client/multiplayer";
import { formatClock } from "@/lib/format";
import { play } from "@/lib/audio";
import { haptic } from "@/lib/haptics";
import { Avatar, Cta, EASE_OUT, LoadingScreen, MpToast, NeedProfile, Screen, TopButton, formatTenths, useToast } from "./ui";

export interface ChallengeCardData {
  code: string;
  game: string;
  label: string;
  sender: { id: string; nickname: string; color: string; level: number; city: string | null };
  senderMs: number;
  hints: number;
  mistakes: number;
  senderTimeline: [number, number][];
  mine: boolean;
  result: { attemptId: string | null; timeMs: number; won: boolean; hints: number; mistakes: number; timeline: [number, number][] } | null;
  expiresAt: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/* ---------------- A1 Challenge card ---------------- */

export function ChallengeCard({ c, onAccept, onLater }: { c: ChallengeCardData; onAccept: () => void; onLater: () => void }) {
  const meta = GAME_BY_ID[c.game];
  const world = meta ? WORLD_BY_ID[meta.world] : null;
  return (
    <div
      className="flex flex-1 flex-col gap-4 px-5 pt-[max(70px,env(safe-area-inset-top))] pb-[max(28px,env(safe-area-inset-bottom))]"
      data-screen-label="A1 Challenge card"
    >
      <p className="text-muted self-stretch text-center text-[15px] font-semibold">You&apos;ve been challenged</p>
      <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-[32px] bg-[#1B1835] p-6 text-[#F4F5FB]">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(#2E2858_1.5px,transparent_1.5px)] bg-[size:20px_20px]" />
        <div className="relative flex items-center gap-3">
          <Avatar name={c.sender.nickname} color={c.sender.color} size={64} radius={20} />
          <div className="flex flex-col">
            <span className="font-display text-[20px] font-extrabold">{c.sender.nickname}</span>
            <span className="text-[14px] font-medium text-[#C9C4FF]">
              Level <span className="num">{c.sender.level}</span>
              {c.sender.city ? ` · ${c.sender.city}` : ""}
            </span>
          </div>
        </div>
        <p className="relative self-stretch text-center text-[17px] font-semibold">&ldquo;Beat my time. I&apos;ll wait.&rdquo;</p>
        <div className="relative flex items-center gap-3 rounded-[18px] bg-[#0E0F1A] px-4 py-3">
          <span className="flex size-12 items-center justify-center rounded-[15px] text-[#0E0F1A]" style={{ background: world?.color }}>
            <Icon name={meta?.icon ?? "puzzle-piece"} size={24} />
          </span>
          <span className="flex flex-col">
            <span className="font-display text-[16px] font-extrabold" style={{ color: world?.color }}>
              {meta?.name ?? c.game}
            </span>
            <span className="text-[14px] font-medium text-[#A2A6C2]">{c.label}</span>
          </span>
          <span className="num ml-4 text-[28px] font-semibold">{formatClock(c.senderMs)}</span>
        </div>
        <div className="relative flex gap-2.5 text-[14px] font-medium text-[#C9C4FF]">
          <span className="flex items-center gap-1">
            <Icon name="lightbulb" size={15} /> {plural(c.hints, "hint", "hints")}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="x-circle" size={15} /> {plural(c.mistakes, "slip", "slips")}
          </span>
        </div>
      </div>
      <div className="bg-surface text-muted flex items-center gap-2.5 rounded-[16px] px-3.5 py-3 text-[15px] leading-[1.4]">
        <Icon name="ghost" size={22} className="text-text flex-none" />
        {c.sender.nickname}&apos;s ghost timer runs beside yours, so you&apos;ll know if you&apos;re ahead.
      </div>
      <div className="mt-auto flex flex-col gap-2.5">
        <Cta onClick={onAccept}>Accept</Cta>
        <button type="button" onClick={onLater} className="text-muted min-h-12 rounded-[16px] text-[16px] font-semibold">
          Not now
        </button>
      </div>
    </div>
  );
}

/* ---------------- A2 Head-to-head result with ghost timeline ---------------- */

function aheadLine(name: string, mine: [number, number][], theirs: [number, number][], won: boolean) {
  // Who was ahead at each of your samples (by progress at that time).
  const at = (tl: [number, number][], ms: number) => tl.filter(([t]) => t <= ms).reduce((p, [, v]) => Math.max(p, v), 0);
  let flip: number | null = null;
  let leadThem = false;
  for (const [ms, p] of mine) {
    const them = at(theirs, ms);
    if (them > p) leadThem = true;
    if (leadThem && p > them && flip === null) flip = ms;
  }
  if (won && leadThem && flip !== null) return `${name} was ahead until ${formatClock(flip)}. You closed it after that.`;
  if (won) return `You led from the start. ${name} never caught up.`;
  if (!leadThem) return `You led early, then ${name}'s ghost pulled away.`;
  return `${name}'s ghost led most of the way.`;
}

export function ChallengeResult({ c, onSendBack, onShare }: { c: ChallengeCardData; onSendBack: () => void; onShare: () => void }) {
  const reduce = useReduce();
  const r = c.result!;
  const margin = Math.abs(c.senderMs - r.timeMs) / 1000;
  useEffect(() => {
    if (r.won) {
      play("cheer", { silentHaptic: true });
      haptic([30, 10, 30]);
    } else play("fizzle");
  }, [r.won]);
  const total = Math.max(c.senderMs, r.timeMs, 1);
  const rows = [10, 30, 50, 70, 90, 110];
  const dots = (tl: [number, number][]) =>
    tl
      .filter(([, p], i, a) => i === 0 || p !== a[i - 1][1])
      .map(([ms, p]) => ({ x: (ms / total) * 100, y: rows[Math.min(5, Math.round(p * 5))] }));
  const mine = dots(r.timeline.length ? r.timeline : [[r.timeMs, 1]]);
  const theirs = dots(c.senderTimeline.length ? c.senderTimeline : [[c.senderMs, 1]]);
  return (
    <div
      className="flex flex-1 flex-col gap-4 px-5 pt-[max(70px,env(safe-area-inset-top))] pb-[max(28px,env(safe-area-inset-bottom))]"
      data-screen-label="A2 Challenge result"
    >
      <h1 className="font-display self-stretch text-center text-[30px] leading-[1.1] font-black tracking-[-0.02em]" aria-live="polite">
        {r.won ? `You beat ${c.sender.nickname}` : `${c.sender.nickname} holds on`}
        <br />
        by <span className={r.won ? "text-accent" : "text-[var(--danger)]"}>{margin.toFixed(1)} s</span>
      </h1>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
        <div
          className="flex flex-col items-center gap-1 rounded-[20px] p-3.5"
          style={
            r.won
              ? { background: "color-mix(in srgb, var(--accent) 14%, var(--bg))", boxShadow: "inset 0 0 0 2px var(--accent)" }
              : { background: "var(--surface)" }
          }
        >
          <span className="text-[15px] font-semibold">You</span>
          <span className="num text-[30px] font-semibold" style={{ color: r.won ? "var(--accent)" : undefined }}>
            {formatTenths(r.timeMs)}
          </span>
          <span className="text-muted text-[13px] font-medium">
            {plural(r.hints, "hint", "hints")} · {plural(r.mistakes, "slip", "slips")}
          </span>
        </div>
        <span className="font-display text-muted text-[18px] font-black">vs</span>
        <div
          className="flex flex-col items-center gap-1 rounded-[20px] p-3.5"
          style={
            !r.won
              ? { background: "color-mix(in srgb, var(--accent) 14%, var(--bg))", boxShadow: "inset 0 0 0 2px var(--accent)" }
              : { background: "var(--surface)" }
          }
        >
          <span className="text-[15px] font-semibold">{c.sender.nickname}</span>
          <span className="num text-[30px] font-semibold">{formatTenths(c.senderMs)}</span>
          <span className="text-muted text-[13px] font-medium">
            {plural(c.hints, "hint", "hints")} · {plural(c.mistakes, "slip", "slips")}
          </span>
        </div>
      </div>
      <div className="bg-surface flex flex-col gap-3 rounded-[22px] p-4">
        <div className="flex justify-between text-[15px] font-semibold">
          <span>Ghost timeline</span>
          <span className="text-muted font-medium">progress over time</span>
        </div>
        <div
          className="relative h-[120px]"
          role="img"
          aria-label={`Your clear ${formatTenths(r.timeMs)}, ${c.sender.nickname} ${formatTenths(c.senderMs)}`}
        >
          {rows.map((y) => (
            <div key={y} className="bg-line absolute inset-x-0 h-px" style={{ top: y }} />
          ))}
          {theirs.map((d, i) => (
            <motion.span
              key={`t${i}`}
              className="absolute -mt-[7px] -ml-[7px] size-3.5 rounded-[3px] opacity-70"
              style={{ left: `${d.x}%`, top: d.y, background: c.sender.color }}
              initial={reduce ? false : { opacity: 0, transform: "scale(0.6)" }}
              animate={{ opacity: 0.7, transform: "scale(1)" }}
              transition={{ duration: 0.3, ease: EASE_OUT, delay: reduce ? 0 : i * 0.06 }}
            />
          ))}
          {mine.map((d, i) => (
            <motion.span
              key={`m${i}`}
              className="bg-accent absolute -mt-[7px] -ml-[7px] size-3.5 rounded-full"
              style={{ left: `${d.x}%`, top: d.y }}
              initial={reduce ? false : { opacity: 0, transform: "scale(0.6)" }}
              animate={{ opacity: 1, transform: "scale(1)" }}
              transition={{ duration: 0.3, ease: EASE_OUT, delay: reduce ? 0 : 0.2 + i * 0.06 }}
            />
          ))}
        </div>
        <div className="num text-muted flex justify-between text-[13px] font-medium">
          <span>0:00</span>
          <span>{formatClock(total / 2)}</span>
          <span>{formatClock(total)}</span>
        </div>
        <div className="flex gap-4 text-[14px] font-medium">
          <span className="flex items-center gap-1.5">
            <span className="bg-accent size-3 rounded-full" />
            You
          </span>
          <span className="text-muted flex items-center gap-1.5">
            <span className="size-3 rounded-[3px] opacity-70" style={{ background: c.sender.color }} />
            {c.sender.nickname}&apos;s ghost
          </span>
        </div>
        <p className="text-muted text-[14px] leading-[1.4]">{aheadLine(c.sender.nickname, r.timeline, c.senderTimeline, r.won)}</p>
      </div>
      <div className="mt-auto grid grid-cols-[1fr_60px] gap-2.5">
        <Cta onClick={onSendBack}>Send it back</Cta>
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
    </div>
  );
}

/* ---------------- Ghost timer strip while playing ---------------- */

function GhostTimer({ name, color, senderMs, startedAt }: { name: string; color: string; senderMs: number; startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  const ms = now - startedAt;
  const left = senderMs - ms;
  return (
    <div
      className="bg-surface -mx-3 flex flex-col gap-2 rounded-[16px] px-3 py-2.5"
      role="timer"
      aria-label={`${name}'s time ${formatClock(senderMs)}`}
    >
      <div className="flex justify-between text-[14px] font-semibold">
        <span className="flex items-center gap-1.5">
          <Icon name="ghost" size={16} /> vs {name}&apos;s time, <span className="num">{formatClock(senderMs)}</span>
        </span>
        <span className="num" style={{ color: left >= 0 ? "var(--accent)" : "var(--danger)" }}>
          {left >= 0 ? `${formatClock(left)} left` : `${formatClock(-left)} over`}
        </span>
      </div>
      <div className="bg-line relative h-2.5 rounded-[5px]">
        <div
          className="absolute inset-0 origin-left rounded-[5px] opacity-60"
          style={{ background: color, transform: `scaleX(${Math.min(1, ms / senderMs)})` }}
        />
      </div>
    </div>
  );
}

/* ---------------- /challenge/[code] ---------------- */

export function ChallengeScreen({ code }: { code: string }) {
  const gate = useProfileGate();
  const router = useRouter();
  const { toast, show } = useToast();
  const q = useQuery({
    queryKey: ["challenge", code],
    enabled: gate === "ready",
    queryFn: () => api<ChallengeCardData>(`/api/v1/challenges/${code}`),
    retry: false,
  });
  const [play_, setPlay] = useState<{ attemptId: string; puzzle: unknown; startedAt: number } | null>(null);
  const [result, setResult] = useState<ChallengeCardData | null>(null);
  const samples = useRef<{ ms: number; state: unknown }[]>([]);
  const lastSample = useRef(0);
  const c = result ?? q.data;

  const onMove = useCallback((state: unknown, ms: number) => {
    if (ms - lastSample.current < 1500 || samples.current.length >= 40) return;
    lastSample.current = ms;
    samples.current.push({ ms: Math.round(ms), state });
  }, []);
  const onSolved = useCallback(
    async (state: unknown, ms: number, stats: { hints: number; mistakes: number }) => {
      if (!play_) return;
      try {
        const fin = await finishAttempt(play_.attemptId, { state, activeMs: ms, mistakes: stats.mistakes });
        if (!fin.ok) return show("That didn't verify. Try again.", "bad");
        const r = await api<ChallengeCardData>(`/api/v1/challenges/${code}/result`, {
          json: { attemptId: play_.attemptId, timeline: samples.current },
        });
        setResult(r);
        setPlay(null);
      } catch {
        show("Couldn't save your time.", "bad");
      }
    },
    [play_, code, show],
  );

  const accept = async () => {
    try {
      const r = await api<{ attemptId: string; puzzle: unknown; startedAt: string }>(`/api/v1/challenges/${code}/accept`, { json: {} });
      samples.current = [];
      lastSample.current = 0;
      setPlay({ attemptId: r.attemptId, puzzle: r.puzzle, startedAt: Date.now() });
    } catch (e) {
      show(e instanceof HttpError && e.message !== e.code ? e.message : "Couldn't start.", "bad");
    }
  };
  const share = async (text: string, url: string) => {
    const full = `${window.location.origin}${url}`;
    try {
      if (navigator.share) await navigator.share({ text, url: full });
      else {
        await navigator.clipboard.writeText(`${text} ${full}`);
        show("Link copied.");
      }
    } catch {
      /* cancelled */
    }
  };
  const sendBack = async () => {
    if (!c?.result?.attemptId) return;
    try {
      const att = await api<{ code: string }>("/api/v1/challenges", { json: { attemptId: c.result.attemptId } });
      await share(`Your turn. Beat ${formatClock(c.result.timeMs)} on SPUZL 😤`, `/challenge/${att.code}`);
    } catch {
      show("Couldn't make the link.", "bad");
    }
  };

  const meta = c ? GAME_BY_ID[c.game] : null;
  const Board = c ? BOARDS[c.game] : null;

  if (gate === "loading") return <LoadingScreen />;
  if (gate === "no_profile") return <NeedProfile />;
  if (q.isLoading) return <LoadingScreen />;
  if (!c)
    return (
      <Screen label="Challenge missing">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <Spuz mood="sleepy" size={110} />
          <h1 className="font-display text-[24px] font-black">This challenge ran out</h1>
          <p className="text-muted">Challenges last 7 days. Ask for a fresh link.</p>
          <Cta onClick={() => router.push("/")} className="w-full max-w-[358px]">
            Back to The Grid
          </Cta>
        </div>
      </Screen>
    );

  if (play_ && meta && Board)
    return (
      <>
        <MpToast toast={toast} />
        <GameShell
          meta={meta}
          Board={Board}
          puzzle={play_.puzzle}
          mode="challenge"
          label={c.label}
          onMove={onMove}
          onSolved={onSolved}
          onExit={() => setPlay(null)}
          strip={<GhostTimer name={c.sender.nickname} color={c.sender.color} senderMs={c.senderMs} startedAt={play_.startedAt} />}
          puzzleKey={play_.attemptId}
        />
      </>
    );

  return (
    <Screen label="Challenge">
      <MpToast toast={toast} />
      {c.mine && !c.result ? (
        <div className="flex flex-1 flex-col gap-4 px-5 pt-[max(56px,env(safe-area-inset-top))] pb-[max(28px,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            <TopButton icon="arrow-left" label="Back" href="/" />
            <h1 className="font-display text-[22px] font-black">Your challenge</h1>
          </div>
          <p className="text-muted text-[16px]">
            {meta?.name}, {c.label}. Your time: <span className="num text-text">{formatClock(c.senderMs)}</span>. Send it to a friend.
          </p>
          <Cta
            className="mt-auto"
            icon="share-fat"
            onClick={() => share(`Beat my ${formatClock(c.senderMs)} on ${meta?.name} 😤`, `/challenge/${c.code}`)}
          >
            Share
          </Cta>
        </div>
      ) : c.result ? (
        <ChallengeResult
          c={c}
          onSendBack={sendBack}
          onShare={() => share(`${c.result!.won ? "I beat" : "I raced"} ${c.sender.nickname} on ${meta?.name} 👻`, `/challenge/${c.code}`)}
        />
      ) : (
        <ChallengeCard c={c} onAccept={accept} onLater={() => router.push("/")} />
      )}
    </Screen>
  );
}
