"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardProps } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { play } from "@/lib/audio";
import { prefersReducedMotion, useSettings } from "@/lib/settings/store";
import { BEATTAP_COPY as t } from "@/lib/copy/beattap";
import { HUMAN_FLOOR_MS } from "@/games/_shared/reflex";
import { judge, songEnd, STRAY_PENALTY, type BeatPuzzle, type BeatState, type Mark } from "./logic";

type Phase = "ready" | "play" | "over";
/** An approach ring starts this long before its beat. */
const APPROACH_MS = 1000;
const R = 60;
const CIRC = 2 * Math.PI * R;
/** A second tap this soon after the song ends does not count for anything. */
const END_PAUSE_MS = 400;

/**
 * Beat Tap board. One big square pad (a real button, also Space anywhere on the page). A fixed target
 * circle sits in the middle; for each beat an outline ring closes in on it and meets it on the beat. Rings
 * only change size, never brightness, and beats are at least 500 ms apart, so nothing flashes. With reduced
 * motion the pad shows one static ring that fills around like a clock and is full on the beat. Each tap is
 * judged with the same pure `judge` the server runs; the word and its icon show under the circle, so the
 * judgement never relies on colour. A tick plays on each beat when sound is on; it plays fine muted.
 */
export default function BeatTapBoard({ puzzle, initialState, disabled, mode, api }: BoardProps<BeatPuzzle, BeatState>) {
  const total = puzzle.beats.length;
  const end = songEnd(puzzle);
  const reduce = prefersReducedMotion({ reducedMotion: useSettings((s) => s.reducedMotion) });
  const restored = initialState?.done ? initialState : null;
  const [taps, setTaps] = useState<number[]>(() => restored?.taps ?? []);
  const [phase, setPhase] = useState<Phase>(() => (restored ? "over" : "ready"));
  const [now, setNow] = useState(restored ? end : -1);
  const [lastMark, setLastMark] = useState<Mark | "stray" | null>(null);
  const tapsRef = useRef(taps);
  const startAt = useRef(0);
  const ticked = useRef(0);
  const reportedMiss = useRef(-1);
  const finishTimer = useRef<number | null>(null);
  useEffect(() => () => void (finishTimer.current && window.clearTimeout(finishTimer.current)), []);

  const j = judge(puzzle.beats, taps, puzzle.perfectMs, puzzle.goodMs);

  const finish = useCallback(() => {
    setPhase("over");
    setNow(end);
    const state = { taps: tapsRef.current, done: true };
    const fj = judge(puzzle.beats, state.taps, puzzle.perfectMs, puzzle.goodMs);
    api.onMove(state);
    finishTimer.current = window.setTimeout(() => {
      play("jingle");
      api.feedback(t.finished(fj.score, fj.perfect, total), "success", "check-circle");
      api.onSolved(state);
    }, 600);
  }, [api, end, puzzle, total]);

  const start = useCallback(() => {
    tapsRef.current = [];
    setTaps([]);
    setLastMark(null);
    ticked.current = 0;
    reportedMiss.current = -1;
    startAt.current = performance.now();
    setNow(0);
    setPhase("play");
    api.announce(t.startAnnounce);
  }, [api]);

  // The song clock: render, tick on each beat, report beats that slipped by untapped, end the song.
  useEffect(() => {
    if (phase !== "play") return;
    let raf = 0;
    const frame = () => {
      const el = performance.now() - startAt.current;
      while (ticked.current < total && puzzle.beats[ticked.current] <= el + 15) {
        play("tick");
        ticked.current++;
      }
      const jj = judge(puzzle.beats, tapsRef.current, puzzle.perfectMs, puzzle.goodMs);
      for (let b = reportedMiss.current + 1; b < total && puzzle.beats[b] + puzzle.goodMs < el; b++) {
        reportedMiss.current = b;
        if (jj.marks[b] === "miss") {
          setLastMark("miss");
          api.feedback(t.missFeedback, "danger", "x");
        }
      }
      if (el > end + END_PAUSE_MS) return finish();
      setNow(el);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [api, end, finish, phase, puzzle, total]);

  const press = useCallback(
    (at: number) => {
      if (disabled) return;
      if (phase === "ready") return start();
      if (phase !== "play") return;
      const tap = Math.round(at - startAt.current);
      const prev = tapsRef.current[tapsRef.current.length - 1] ?? 0;
      // Under the human floor or after the last window: not a tap the server would accept, so not one at all.
      if (tap - prev < HUMAN_FLOOR_MS || tap > end) return;
      const next = [...tapsRef.current, tap];
      tapsRef.current = next;
      setTaps(next);
      const jj = judge(puzzle.beats, next, puzzle.perfectMs, puzzle.goodMs);
      const b = jj.tapBeat[next.length - 1];
      const state = { taps: next, done: false };
      if (b === -1) {
        setLastMark("stray");
        api.onMove(state, { mistake: true });
        api.feedback(t.strayFeedback(STRAY_PENALTY), "danger", "prohibit");
        play("bump");
      } else {
        const m = jj.marks[b];
        setLastMark(m);
        api.onMove(state, { correctStreak: jj.perfect + jj.good });
        if (m === "perfect") play("pop", { step: Math.min(7, jj.perfect), silentHaptic: true });
        api.announce(t.mark[m]);
      }
    },
    [api, disabled, end, phase, puzzle, start],
  );

  // Pause or lock mid song: the run is void and starts again from the top next time.
  const [wasDisabled, setWasDisabled] = useState(disabled);
  if (disabled !== wasDisabled) {
    setWasDisabled(disabled);
    if (disabled && phase === "play") {
      setPhase("ready");
      setNow(-1);
      setTaps([]);
      setLastMark(null);
    }
  }
  useEffect(() => {
    if (disabled && phase === "ready" && tapsRef.current.length) {
      tapsRef.current = [];
      api.feedback(t.restart, "info", "metronome");
    }
  }, [api, disabled, phase]);

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
    api.feedback(mode === "tutorial" ? t.tutorial : reduce ? t.introReduced(total) : t.intro(total), "info", "metronome");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // What the pad shows right now.
  const playing = phase === "play";
  const nextBeat = playing ? puzzle.beats.findIndex((b) => b + puzzle.goodMs >= now) : -1;
  const beforeFirst = playing && now < puzzle.beats[0] - APPROACH_MS;
  const rings = playing
    ? puzzle.beats
        .map((b, i) => ({ i, d: b - now }))
        .filter(({ i, d }) => d <= APPROACH_MS && d >= -puzzle.goodMs && j.marks[i] === "miss")
        .map(({ i, d }) => ({ i, r: R * (1 + Math.max(0, d) / APPROACH_MS), o: 0.35 + 0.65 * (1 - Math.max(0, d) / APPROACH_MS) }))
    : [];
  // Reduced motion: one ring fills from the previous beat (or Start) to the next.
  const fill = (() => {
    if (!playing || nextBeat === -1) return phase === "over" ? 1 : 0;
    const to = puzzle.beats[nextBeat];
    const from = nextBeat ? puzzle.beats[nextBeat - 1] : Math.max(0, to - APPROACH_MS * 2);
    return Math.max(0, Math.min(1, (now - from) / (to - from)));
  })();
  const markIcon = lastMark === "perfect" ? "star" : lastMark === "good" ? "check" : lastMark === "stray" ? "prohibit" : "x";
  const markText = lastMark === null ? null : lastMark === "stray" ? t.stray : t.mark[lastMark];
  const status =
    phase === "ready"
      ? t.start
      : phase === "over"
        ? `${t.score} ${j.score}`
        : beforeFirst
          ? t.getReady
          : t.beatOf(Math.min(total, (nextBeat === -1 ? total : nextBeat) + 1), total);

  return (
    <div className="flex w-[min(358px,calc(100vw-36px))] flex-col gap-3 rounded-[20px] p-3" style={{ background: "var(--board-bg)" }}>
      <button
        type="button"
        aria-label={t.padLabel(`${status}.${markText ? ` ${markText}.` : ""}`)}
        data-phase={phase}
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
        className="relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-[28px] outline-none focus-visible:ring-4 focus-visible:ring-[var(--text)]"
        style={{ background: "var(--surface)", boxShadow: "0 6px 0 var(--depth)", touchAction: "manipulation", color: "var(--text)" }}
      >
        <svg viewBox="0 0 300 300" className="absolute inset-0 h-full w-full" aria-hidden>
          {reduce ? (
            <>
              <circle cx="150" cy="150" r={R + 30} fill="none" stroke="var(--line)" strokeWidth="14" />
              <circle
                cx="150"
                cy="150"
                r={R + 30}
                fill="none"
                stroke="var(--world)"
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={`${fill * 2 * Math.PI * (R + 30)} ${2 * Math.PI * (R + 30)}`}
                transform="rotate(-90 150 150)"
              />
            </>
          ) : (
            rings.map(({ i, r, o }) => (
              <circle key={i} cx="150" cy="150" r={r} fill="none" stroke="var(--world)" strokeWidth="5" opacity={o} />
            ))
          )}
          <circle cx="150" cy="150" r={R} fill="var(--surface-raised)" stroke="var(--text)" strokeWidth="6" />
          <circle
            cx="150"
            cy="150"
            r={R - 14}
            fill="none"
            stroke="var(--line)"
            strokeWidth="2"
            strokeDasharray={`${CIRC / 40} ${CIRC / 40}`}
          />
        </svg>
        <span className="relative flex flex-col items-center gap-1">
          <Icon name={phase === "over" ? "flag-checkered" : markText && playing ? markIcon : "metronome"} size={40} />
          <span className="font-display text-[22px] font-black">{playing && markText ? markText : phase === "over" ? j.score : t.tap}</span>
        </span>
        <span className="absolute inset-x-0 bottom-5 text-center text-[15px] font-semibold" style={{ color: "var(--text-muted)" }}>
          {phase === "ready" ? t.start : playing ? (beforeFirst ? t.getReadySmall : reduce ? t.onFull : t.onBeat) : t.done}
        </span>
        <span className="absolute inset-x-0 top-4 text-center text-[13px] font-semibold" style={{ color: "var(--text-muted)" }}>
          {status}
        </span>
      </button>

      {/* Song position: a bar, never a second clock */}
      <div
        role="progressbar"
        aria-label={t.songProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(Math.max(0, Math.min(1, now / end)) * 100)}
        className="h-1.5 overflow-hidden rounded-full"
        style={{ background: "var(--line)" }}
      >
        <span
          className="block h-full w-full rounded-full"
          style={{
            background: "var(--text-muted)",
            transform: `scaleX(${Math.max(0, Math.min(1, now / end))})`,
            transformOrigin: "left center",
          }}
        />
      </div>

      <ul className="m-0 grid list-none grid-cols-4 gap-1.5 p-0" aria-label={t.tallyLabel}>
        {(
          [
            ["star", t.mark.perfect, j.perfect, "var(--world)"],
            ["check", t.mark.good, j.good, "var(--text)"],
            [
              "x",
              t.mark.miss,
              phase === "over" ? j.miss : j.marks.filter((m, i) => m === "miss" && puzzle.beats[i] + puzzle.goodMs < now).length,
              "var(--danger)",
            ],
            ["prohibit", t.stray, j.strays, "var(--danger)"],
          ] as const
        ).map(([icon, label, n, color]) => (
          <li
            key={label}
            aria-label={t.tally(label, n)}
            className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-[12px] text-[12px] font-semibold"
            style={{ background: "var(--surface)", color: "var(--text-muted)" }}
          >
            <span className="flex items-center gap-1" style={{ color }}>
              <Icon name={icon} size={14} />
              <span className="num font-mono text-[15px]">{n}</span>
            </span>
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
