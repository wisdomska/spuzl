"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { play } from "@/lib/audio";
import { prefersReducedMotion, useSettings } from "@/lib/settings/store";
import { PENALTY_COPY as t } from "@/lib/copy/penalty";
import { HUMAN_FLOOR_MS } from "@/games/_shared/reflex";
import { sendGuess } from "@/games/_shared/guess";
import {
  LEFT_EDGE,
  METER_MAX,
  meterAt,
  OVER_BAR,
  POWER_SWEET,
  readKick,
  RIGHT_EDGE,
  timeoutOutcome,
  WIDE_EDGE,
  type Dive,
  type KickInput,
  type KickOutcome,
  type PenaltyCheck,
  type PenaltyPuzzle,
  type PenaltyState,
} from "./logic";

/** checking: a shot is with the server; retry: it could not be reached, the shot waits to be sent again */
type Phase = "ready" | "aim" | "power" | "checking" | "retry" | "result" | "over";
/** A kick as shown: its outcome and where the keeper went (null when no shot was taken). */
type Shown = KickOutcome & { dive: Dive | null };

/**
 * The outcome of one kick. A timeout needs no keeper; a shot goes to the server, which keeps it on the
 * attempt and only then says where the keeper went. Null when the server could not be reached.
 */
async function resolveKick(puzzle: PenaltyPuzzle, i: number, k: KickInput): Promise<Shown | null> {
  const r = readKick(puzzle, i, k);
  if (typeof r === "string") return null; // cannot happen: the board only records taps the logic accepts
  if (r.aim === null || r.power === null) return { ...timeoutOutcome(r.aim), dive: null };
  const res = await sendGuess<PenaltyCheck>(puzzle.ref, { kick: i, input: k }).catch(() => null);
  return res && res.ok ? { ...res.outcome, dive: res.dive } : null;
}
/** A second tap this soon after a kick lands does not start the next kick by accident. */
const NEXT_GUARD_MS = 500;

/* Goal drawing (SVG user units). Aim 0..100 maps across, power 0..100 maps up. */
const GX = (aim: number) => 20 + aim * 2.6;
const GY = (power: number) => 140 - power * 1.2;
const ZONE_X = [GX(20), GX(50), GX(80)];
const SPOT = { x: 150, y: 152 };

/* The keeper dive and the ball flight ease over 280 ms (transform only); reduced motion jumps straight there. */
const CSS = `
.pk-move { transition: transform 280ms cubic-bezier(.2,.8,.2,1); }
[data-motion="reduce"] .pk-move { transition: none; }
@media (prefers-reduced-motion: reduce) { .pk-move { transition: none; } }
`;

/**
 * Penalty King board. A goal with a keeper, an aim meter and a power meter, a per-kick time bar, and one
 * big (64 px) tap button that also answers Space. Tap once to lock the aim, again to lock the power. The
 * keeper's dive and where the ball went show after the kick, with words and icons, never colour alone.
 * Nothing flashes: the meters move a marker, and with reduced motion they step every 150 ms instead of
 * sweeping (the logic reads the same stepped value, so it stays fair).
 */
export default function PenaltyBoard({ puzzle, initialState, disabled, mode, api }: BoardProps<PenaltyPuzzle, PenaltyState>) {
  const total = puzzle.kicks.length;
  const reduce = prefersReducedMotion({ reducedMotion: useSettings((s) => s.reducedMotion) });
  const resumed = initialState?.kicks ?? [];
  const [kicks, setKicks] = useState<KickInput[]>(resumed);
  const [results, setResults] = useState<Shown[]>([]);
  // A resume asks the server for the kicks already taken (same taps, so nothing new is recorded).
  const [phase, setPhase] = useState<Phase>(() => (resumed.length ? "checking" : "ready"));
  const [aimVal, setAimVal] = useState(0);
  const [powerVal, setPowerVal] = useState(0);
  const [timeLeft, setTimeLeft] = useState(1);
  const kicksRef = useRef(kicks);
  const resultsRef = useRef<Shown[]>([]);
  /** what Try again re-sends: from which kick, and whether it is a new kick (feedback, scoring) or a resume */
  const retry = useRef({ from: 0, fresh: false });
  const kickStart = useRef(0);
  const aimTap = useRef(0);
  const aimAt = useRef(0);
  const stepped = useRef(false);
  const doneAt = useRef(0);
  const finishTimer = useRef<number | null>(null);
  useEffect(() => () => void (finishTimer.current && window.clearTimeout(finishTimer.current)), []);

  const outcomes = results;
  const shown = phase === "result" || phase === "over";
  const last: Shown | undefined = shown ? results[kicks.length - 1] : undefined;

  /** Resolves kicks from `from` on, then shows the latest (with feedback when it is a new kick). */
  const settle = useCallback(
    async (from: number, fresh: boolean) => {
      const list = kicksRef.current;
      setPhase("checking");
      const got = resultsRef.current.slice(0, from);
      for (let i = from; i < list.length; i++) {
        const r = await resolveKick(puzzle, i, list[i]);
        if (!r) {
          resultsRef.current = got;
          setResults(got);
          retry.current = { from: i, fresh };
          setPhase("retry");
          api.feedback(t.offline, "danger", "wifi-slash");
          api.announce(t.offline);
          return;
        }
        got.push(r);
      }
      resultsRef.current = got;
      setResults(got);
      doneAt.current = performance.now();
      const state = { kicks: list };
      const i = list.length - 1;
      const o = got[i];
      if (fresh && o) {
        if (o.aim !== null) setAimVal(o.aim);
        if (o.power !== null) setPowerVal(o.power);
        if (o.result === "goal") {
          api.onMove(state, { correctStreak: list.length });
          play("cheer");
          api.feedback(t.feedback.goal(o.accuracy), "success", "soccer-ball");
        } else {
          api.onMove(state, { mistake: true });
          play(o.result === "timeout" ? "fizzle" : "buzz");
          const text =
            o.result === "saved"
              ? o.power! < puzzle.soft
                ? t.feedback.softSaved
                : t.feedback.saved(o.dive ?? 1)
              : t.feedback[o.result as "wide" | "over" | "timeout"];
          api.feedback(text, "danger", o.result === "timeout" ? "timer" : "x");
        }
        api.announce(`${t.result[o.result]}. ${t.keeper(o.dive)}`);
      }
      if (list.length >= total) {
        setPhase("over");
        if (!fresh) return;
        const goals = got.filter((x) => x.result === "goal").length;
        const score = got.reduce((a, x) => a + x.points, 0);
        finishTimer.current = window.setTimeout(() => {
          play("jingle");
          api.feedback(t.finished(goals, total, score), "success", "check-circle");
          api.onSolved(state);
        }, 900);
      } else setPhase(list.length ? "result" : "ready");
    },
    [api, puzzle, total],
  );

  // Resume: get the outcomes of the kicks already taken.
  useEffect(() => {
    if (resumed.length) queueMicrotask(() => void settle(0, false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const record = useCallback(
    (k: KickInput) => {
      const next = [...kicksRef.current, k];
      kicksRef.current = next;
      setKicks(next);
      const r = readKick(puzzle, next.length - 1, k);
      if (typeof r !== "string") {
        if (r.aim !== null) setAimVal(r.aim);
        if (r.power !== null) setPowerVal(r.power);
        if (r.power !== null) api.announce(t.checkingSay);
      }
      void settle(next.length - 1, true);
    },
    [api, puzzle, settle],
  );

  const arm = useCallback(() => {
    const i = kicksRef.current.length;
    if (i >= total) return;
    stepped.current = reduce;
    kickStart.current = performance.now();
    setAimVal(0);
    setPowerVal(0);
    setTimeLeft(1);
    setPhase("aim");
    play("tick");
    api.announce(t.armAnnounce(i + 1));
  }, [api, reduce, total]);

  // Meters and the kick's time bar follow the clock while a kick is live. React skips renders while the
  // (stepped) values stay the same.
  useEffect(() => {
    if (phase !== "aim" && phase !== "power") return;
    const spec = puzzle.kicks[kicksRef.current.length];
    let raf = 0;
    const frame = () => {
      const now = performance.now();
      const el = now - kickStart.current;
      if (el > puzzle.kickMs) {
        record(phase === "aim" ? { aimAt: null, powerAt: null } : { aimAt: aimAt.current, powerAt: null, stepped: stepped.current });
        return;
      }
      const q = stepped.current ? 10 : 50;
      setTimeLeft(Math.ceil((1 - el / puzzle.kickMs) * q) / q);
      if (phase === "aim") setAimVal(meterAt(Math.round(el), spec.aimPeriod, stepped.current));
      else setPowerVal(meterAt(Math.round(now - aimTap.current), spec.powerPeriod, stepped.current));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, puzzle, record]);

  const press = useCallback(
    (at: number) => {
      if (disabled || phase === "checking") return;
      if (phase === "retry") return void settle(retry.current.from, retry.current.fresh);
      if (phase === "ready" || (phase === "result" && at - doneAt.current > NEXT_GUARD_MS)) return arm();
      if (phase === "aim") {
        const a = Math.round(at - kickStart.current);
        if (a < HUMAN_FLOOR_MS) return; // a double tap on Start, not an aim
        if (a > puzzle.kickMs) return record({ aimAt: null, powerAt: null });
        aimAt.current = a;
        aimTap.current = at;
        setAimVal(meterAt(a, puzzle.kicks[kicksRef.current.length].aimPeriod, stepped.current));
        setPhase("power");
        play("tick");
        api.announce(t.aimAnnounce(meterAt(a, puzzle.kicks[kicksRef.current.length].aimPeriod, stepped.current)));
        return;
      }
      if (phase === "power") {
        const p = Math.round(at - aimTap.current);
        if (p < HUMAN_FLOOR_MS) return;
        if (aimAt.current + p > puzzle.kickMs) return record({ aimAt: aimAt.current, powerAt: null, stepped: stepped.current });
        record({ aimAt: aimAt.current, powerAt: p, stepped: stepped.current });
      }
    },
    [api, arm, disabled, phase, puzzle, record, settle],
  );

  // Pause or lock mid kick: the kick is void and starts again from the top.
  const [wasDisabled, setWasDisabled] = useState(disabled);
  if (disabled !== wasDisabled) {
    setWasDisabled(disabled);
    if (disabled && (phase === "aim" || phase === "power")) {
      setPhase("ready");
      setAimVal(0);
      setPowerVal(0);
      setTimeLeft(1);
    }
  }

  // Space works anywhere on the page (not only when the button has focus), except inside other controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== " " || e.repeat || e.defaultPrevented) return;
      const el = e.target instanceof Element ? e.target : null;
      if (el && el !== document.body && el.closest("button, input, textarea, select, a, [role=button]")) return;
      e.preventDefault();
      press(performance.now());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  useEffect(() => {
    api.setControls([]);
    api.feedback(mode === "tutorial" ? t.tutorial : t.intro(total), "info", "soccer-ball");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const live = phase === "aim" || phase === "power";
  const label =
    phase === "aim"
      ? t.setAim
      : phase === "power"
        ? t.setPower
        : phase === "checking"
          ? t.checking
          : phase === "retry"
            ? t.retry
            : phase === "over"
              ? t.done
              : kicks.length
                ? t.next
                : t.start;
  const dive = last ? last.dive : null;
  const keeperX = dive === null ? ZONE_X[1] : ZONE_X[dive];
  const keeperTilt = dive === null || dive === 1 ? 0 : dive === 0 ? -24 : 24;
  const ball = last && last.aim !== null && last.power !== null ? { x: GX(last.aim), y: GY(last.power) } : SPOT;
  const score = results.reduce((a, o) => a + o.points, 0);

  return (
    <div className="flex w-[min(358px,calc(100vw-36px))] flex-col gap-3 rounded-[20px] p-3" style={{ background: "var(--board-bg)" }}>
      <style href="spuzl-penalty" precedence="default">
        {CSS}
      </style>

      {/* Goal */}
      <figure className="relative m-0 overflow-hidden rounded-[16px]" style={{ background: "var(--surface)" }}>
        <svg
          viewBox="0 0 300 164"
          className="block w-full"
          role="img"
          aria-label={`${t.goalLabel}. ${t.keeper(dive)}${last && last.aim !== null && last.power !== null ? ` ${t.ball(last.aim, last.power)}` : ""}`}
        >
          {/* net */}
          <g stroke="var(--line)" strokeWidth="1">
            {Array.from({ length: 12 }, (_, i) => (
              <line key={`v${i}`} x1={GX(WIDE_EDGE) + i * 19.5} y1={GY(OVER_BAR)} x2={GX(WIDE_EDGE) + i * 19.5} y2={140} />
            ))}
            {Array.from({ length: 6 }, (_, i) => (
              <line
                key={`h${i}`}
                x1={GX(WIDE_EDGE)}
                y1={GY(OVER_BAR) + i * 18.5}
                x2={GX(METER_MAX - WIDE_EDGE)}
                y2={GY(OVER_BAR) + i * 18.5}
              />
            ))}
          </g>
          {/* zone guides */}
          <g stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="4 5" opacity="0.6">
            <line x1={GX(LEFT_EDGE)} y1={GY(OVER_BAR)} x2={GX(LEFT_EDGE)} y2={140} />
            <line x1={GX(RIGHT_EDGE)} y1={GY(OVER_BAR)} x2={GX(RIGHT_EDGE)} y2={140} />
          </g>
          {/* ground and frame */}
          <line x1="0" y1="140" x2="300" y2="140" stroke="var(--line)" strokeWidth="2" />
          <path
            d={`M${GX(WIDE_EDGE)} 140 V${GY(OVER_BAR)} H${GX(METER_MAX - WIDE_EDGE)} V140`}
            fill="none"
            stroke="var(--text)"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          {/* keeper: body, head, arms; dives by sliding and tilting */}
          <g className="pk-move" style={{ transform: `translate(${keeperX}px, 0px)` }}>
            <g style={{ transform: `rotate(${keeperTilt}deg)`, transformOrigin: "0px 140px" }} className="pk-move">
              <rect x="-15" y="84" width="30" height="56" rx="10" fill="var(--world)" stroke="var(--text)" strokeWidth="2" />
              <circle cx="0" cy="72" r="11" fill="var(--world)" stroke="var(--text)" strokeWidth="2" />
              <rect x="-34" y="90" width="68" height="10" rx="5" fill="var(--world)" stroke="var(--text)" strokeWidth="2" />
            </g>
          </g>
          {/* ball */}
          <g className="pk-move" style={{ transform: `translate(${ball.x}px, ${ball.y}px)` }}>
            <circle r="8" fill="var(--text)" stroke="var(--bg)" strokeWidth="2" />
            <circle r="3" fill="var(--bg)" />
          </g>
        </svg>
        {last && (
          <figcaption
            className="font-display absolute top-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-1 text-[15px] font-black"
            style={{
              background: last.result === "goal" ? "var(--world)" : "var(--surface-raised)",
              color: last.result === "goal" ? "var(--on-accent)" : "var(--danger)",
              boxShadow: last.result === "goal" ? undefined : "inset 0 0 0 2px var(--danger)",
            }}
          >
            <Icon name={last.result === "goal" ? "soccer-ball" : last.result === "timeout" ? "timer" : "x"} size={16} />
            {t.result[last.result]}
          </figcaption>
        )}
      </figure>

      {/* Meters */}
      <Meter
        label={t.aimLabel}
        value={aimVal}
        active={phase === "aim"}
        aria={t.aimMeter(aimVal)}
        segments={[
          { from: 0, to: WIDE_EDGE, kind: "out" },
          { from: WIDE_EDGE, to: LEFT_EDGE, kind: "in", text: "L" },
          { from: LEFT_EDGE, to: RIGHT_EDGE, kind: "mid", text: "M" },
          { from: RIGHT_EDGE, to: METER_MAX - WIDE_EDGE, kind: "in", text: "R" },
          { from: METER_MAX - WIDE_EDGE, to: METER_MAX, kind: "out" },
        ]}
      />
      <Meter
        label={t.powerLabel}
        value={powerVal}
        active={phase === "power"}
        aria={t.powerMeter(powerVal)}
        sweet={POWER_SWEET}
        segments={[
          { from: 0, to: puzzle.soft, kind: "mid" },
          { from: puzzle.soft, to: OVER_BAR, kind: "in" },
          { from: OVER_BAR, to: METER_MAX, kind: "out" },
        ]}
      />

      {/* Per-kick time: a bar, never a second clock */}
      <div
        role="progressbar"
        aria-label={t.timeLeft}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((live ? timeLeft : 1) * 100)}
        className="h-1.5 overflow-hidden rounded-full"
        style={{ background: "var(--line)", opacity: live ? 1 : 0.4 }}
      >
        <span
          className="block h-full w-full rounded-full"
          style={{
            background: timeLeft < 0.25 && live ? "var(--danger)" : "var(--text-muted)",
            transform: `scaleX(${live ? timeLeft : 1})`,
            transformOrigin: "left center",
          }}
        />
      </div>

      {/* The tap target */}
      <button
        type="button"
        aria-label={`${label}. ${phase === "ready" ? t.readySmall(kicks.length + 1, total) : ""}`}
        data-phase={phase}
        aria-busy={phase === "checking"}
        disabled={disabled || phase === "over"}
        onPointerDown={(e) => {
          e.preventDefault();
          press(performance.now());
        }}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            if (!e.repeat) press(performance.now());
          }
        }}
        className="font-display flex min-h-16 w-full items-center justify-center gap-2 rounded-[18px] text-[20px] font-black outline-none focus-visible:ring-4 focus-visible:ring-[var(--text)]"
        style={{
          background: phase === "over" ? "var(--surface-raised)" : "var(--world)",
          color: phase === "over" ? "var(--text-muted)" : "var(--on-accent)",
          boxShadow: phase === "over" ? "0 4px 0 var(--depth)" : "0 6px 0 var(--world-depth)",
          touchAction: "manipulation",
        }}
      >
        <Icon
          name={
            phase === "over"
              ? "flag-checkered"
              : live
                ? "hand-tap"
                : phase === "checking"
                  ? "hourglass"
                  : phase === "retry"
                    ? "arrow-clockwise"
                    : "soccer-ball"
          }
          size={26}
        />
        {phase === "over" ? `${t.score} ${score}` : label}
      </button>

      <ol className="m-0 grid list-none grid-cols-5 gap-1.5 p-0" aria-label={t.kicksLabel}>
        {Array.from({ length: total }, (_, i) => {
          const o = outcomes[i];
          const goal = o?.result === "goal";
          return (
            <li
              key={i}
              aria-label={t.kickLabel(i, o?.result ?? null, o?.accuracy ?? 0)}
              className="flex h-11 flex-col items-center justify-center rounded-[12px] text-[12px] font-semibold"
              style={{
                background: goal ? "var(--world)" : "var(--surface)",
                color: goal ? "var(--on-accent)" : o ? "var(--danger)" : "var(--text-muted)",
                boxShadow:
                  o && !goal ? "inset 0 0 0 2px var(--danger)" : i === kicks.length && live ? "inset 0 0 0 2px var(--text)" : undefined,
              }}
            >
              {o ? <Icon name={goal ? "soccer-ball" : "x"} size={14} /> : <span className="num font-mono text-[13px]">{i + 1}</span>}
              {o && <span>{t.kickShort[o.result]}</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

interface Segment {
  from: number;
  to: number;
  /** out: a miss (hatched), mid: the weak zone, in: playable */
  kind: "out" | "mid" | "in";
  text?: string;
}

/** A horizontal meter with a marker. The marker moves by transform only. */
function Meter({
  label,
  value,
  active,
  aria,
  segments,
  sweet,
}: {
  label: string;
  value: number;
  active: boolean;
  aria: string;
  segments: Segment[];
  sweet?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-[13px] font-semibold" style={{ color: active ? "var(--text)" : "var(--text-muted)" }}>
        {label}
      </span>
      <div
        role="meter"
        aria-label={aria}
        aria-valuemin={0}
        aria-valuemax={METER_MAX}
        aria-valuenow={value}
        className="relative h-7 flex-1 overflow-hidden rounded-[8px]"
        style={{ background: "var(--surface)", boxShadow: active ? "inset 0 0 0 2px var(--text)" : "inset 0 0 0 1px var(--line)" }}
      >
        {segments.map((s, i) => (
          <span
            key={i}
            aria-hidden
            className={`absolute inset-y-0 flex items-center justify-center text-[11px] font-bold ${s.kind === "out" ? "hatch" : ""}`}
            style={{
              left: `${s.from}%`,
              width: `${s.to - s.from}%`,
              background: s.kind === "mid" ? "var(--surface-raised)" : undefined,
              color: "var(--text-muted)",
              borderLeft: i ? "1px solid var(--line)" : undefined,
            }}
          >
            {s.text}
          </span>
        ))}
        {sweet !== undefined && (
          <span
            aria-hidden
            className="absolute inset-y-1 w-0.5 rounded-full"
            style={{ left: `${sweet}%`, background: "var(--text-muted)" }}
          />
        )}
        <span aria-hidden className="absolute inset-0" style={{ transform: `translateX(${value}%)` }}>
          <span className="absolute inset-y-0 -left-[3px] w-1.5 rounded-full" style={{ background: "var(--text)" }} />
        </span>
      </div>
    </div>
  );
}
