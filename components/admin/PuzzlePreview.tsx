"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BOARDS } from "@/games/board-registry";
import { setGuessTransport } from "@/games/_shared/guess";
import type { BoardApi, ControlSpec, FeedbackTone } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { GAME_BY_ID, WORLD_BY_ID } from "@/lib/catalog";
import { dayMonth } from "@/lib/admin/dates";
import { SOLVED_STATE } from "@/lib/admin/solved-state";
import { api } from "@/lib/client/api";
import { errorText, useAdminAction, useAdminQuery } from "@/lib/client/admin";
import type { Slot } from "./DailySlot";
import { Btn, Notice, Pill, ReadField, RowsSkeleton, textareaCls } from "./ui";

interface Check {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail" | "info";
  value: string;
}
interface Report {
  ok: boolean;
  checks: Check[];
  ranAt: string;
}
interface Detail {
  puzzle: {
    id: string;
    game_id: string;
    seed: string;
    difficulty: string;
    grade: number;
    data: Record<string, unknown>;
    solution: unknown;
    source: string;
    status: string;
    check_report: Report | null;
    reviewer_note: string | null;
    reviewed_at: string | null;
  };
  dailies: { date: string; locked: boolean; number: number }[];
}

const CHECK_ICON = {
  pass: { icon: "check-circle", cls: "text-accent" },
  warn: { icon: "warning", cls: "text-gold" },
  fail: { icon: "x-circle", cls: "text-danger" },
  info: { icon: "info", cls: "text-muted" },
} as const;

function sizeOf(p: Record<string, unknown>): string {
  const n = (k: string) => (typeof p[k] === "number" ? (p[k] as number) : null);
  if (n("size")) return `${n("size")} × ${n("size")}`;
  if (n("rows") && n("cols")) return `${n("rows")} × ${n("cols")}`;
  if (n("w") && n("h")) return `${n("w")} × ${n("h")}`;
  return "n/a";
}

/**
 * Puzzle preview (design: Admin preview): the game's real Board in a phone frame, the solve-check list and the
 * publish panel. Show solution renders the solved board where the game has a solved-state shape; Play test
 * lets the reviewer solve it and asks the server's verify() for the verdict.
 */
export function PuzzlePreview({
  puzzleId,
  game,
  date,
  slot,
  canWrite,
  canSwap,
}: {
  puzzleId: string;
  game: string;
  date?: string;
  slot?: Slot;
  canWrite: boolean;
  canSwap: boolean;
}) {
  const q = useAdminQuery<Detail>(["puzzle", puzzleId], `/api/admin/puzzles/${puzzleId}`);
  const check = useAdminAction<void, Report>("POST", `/api/admin/puzzles/${puzzleId}/check${date ? `?date=${date}` : ""}`);
  const approve = useAdminAction<{ note?: string; date?: string }>("POST", `/api/admin/puzzles/${puzzleId}/approve`);
  const regen = useAdminAction<{ date: string; game: string }, { puzzleId: string }>("POST", "/api/admin/dailies/regenerate");
  const lock = useAdminAction<{ date: string; game: string; locked: boolean }>("POST", "/api/admin/dailies/lock");
  const swap = useAdminAction<{ game: string; date: string; reason: string }, { to: string }>("POST", "/api/admin/dailies/swap");
  const saveNote = useAdminAction<{ note: string }>("PATCH", `/api/admin/puzzles/${puzzleId}`);
  const [note, setNote] = useState<string | null>(null);
  const [swapReason, setSwapReason] = useState<string | null>(null);
  const autoRan = useRef(false);

  const meta = GAME_BY_ID[game];
  const world = WORLD_BY_ID[meta.world];
  const p = q.data?.puzzle;
  const report = check.data ?? p?.check_report ?? null;

  // Open a slot that was never checked: run the solve-check once for writers.
  useEffect(() => {
    if (p && !p.check_report && canWrite && !autoRan.current) {
      autoRan.current = true;
      check.mutate();
    }
  }, [p, canWrite, check]);

  if (q.isPending) return <RowsSkeleton rows={8} height={44} />;
  if (q.error || !p)
    return (
      <div className="p-6">
        <Notice tone="danger" icon="warning">
          {errorText(q.error)}
        </Notice>
      </div>
    );

  const review = p.status === "draft" || p.status === "in_review";
  const locked = !!slot?.slot?.locked;
  const isToday = !!slot && date === slot.today;
  const future = !!slot && !!date && date > slot.today;
  const err = check.error ?? approve.error ?? regen.error ?? lock.error ?? swap.error ?? saveNote.error;
  const tags = [
    p.difficulty,
    date && [0, 6].includes(new Date(date + "T00:00:00Z").getUTCDay()) ? "weekend" : null,
    p.source === "human" ? "written" : "generated",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="grid min-h-dvh grid-cols-1 xl:grid-cols-[1fr_420px]">
      <div className="flex min-w-0 flex-col gap-3.5 px-6 py-5">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={date ? "/admin/calendar" : "/admin/puzzles"}
            aria-label="Back"
            className="hover:bg-surface-raised -ml-2 flex size-11 items-center justify-center rounded-[10px]"
          >
            <Icon name="arrow-left" size={20} />
          </Link>
          <h1 className="font-display text-[20px] font-extrabold">
            {meta.name} · {date ? dayMonth(date) : p.difficulty}
          </h1>
          {p.status === "retired" ? <Pill>retired</Pill> : review ? <Pill tone="warn">needs review</Pill> : <Pill tone="ok">verified</Pill>}
          {locked && (
            <Pill>
              <Icon name="lock-simple" size={12} />
              locked
            </Pill>
          )}
          {slot?.slot?.swapped_from && (
            <Pill tone="warn">
              <Icon name="swap" size={12} />
              swapped
            </Pill>
          )}
        </div>
        {err && (
          <Notice tone="danger" icon="warning">
            {errorText(err)}
          </Notice>
        )}
        <div className="flex flex-col gap-5 lg:flex-row">
          <BoardFrame
            key={p.id}
            game={game}
            puzzle={p.data}
            solution={p.solution}
            puzzleId={p.id}
            worldColor={world.color}
            worldInk={world.ink}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            {report ? (
              report.checks.map((c) => (
                <div key={c.id} className="bg-surface flex min-h-11 items-center gap-2.5 rounded-[10px] px-3 py-2 text-[14px] font-medium">
                  <Icon name={CHECK_ICON[c.status].icon} size={18} className={CHECK_ICON[c.status].cls} label={c.status} />
                  <span className="flex-1">{c.label}</span>
                  <span className="num text-muted text-right text-[13px] font-semibold">{c.value}</span>
                </div>
              ))
            ) : check.isPending ? (
              <RowsSkeleton rows={6} height={44} />
            ) : (
              <Notice icon="info">Not solve-checked yet.</Notice>
            )}
            {canWrite && (
              <div className="flex items-center gap-2 pt-1">
                <Btn size="sm" icon="arrows-clockwise" disabled={check.isPending} onClick={() => check.mutate()}>
                  {check.isPending ? "Checking" : "Run solve-check"}
                </Btn>
                {report && (
                  <span className="num text-muted text-[12px]">checked {new Date(report.ranAt).toISOString().slice(11, 16)} GMT</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <aside aria-label="Publish" className="bg-surface border-line flex flex-col gap-3 border-t p-5 xl:border-t-0 xl:border-l">
        <h2 className="font-display text-[16px] font-extrabold">Publish</h2>
        <ReadField
          label="Daily number"
          value={slot ? `#${slot.number}` : q.data.dailies[0] ? `#${q.data.dailies[0].number}` : "Not scheduled"}
        />
        <ReadField
          label="Release"
          value={date ? `${dayMonth(date)} 00:00 GMT` : q.data.dailies.map((d) => dayMonth(d.date)).join(", ") || "Not scheduled"}
        />
        <ReadField label="Size" value={sizeOf(p.data)} />
        <ReadField label="Tags" value={tags} />
        <ReadField label="Grade" value={<span className="num">{(p.grade / 10).toFixed(1)} / 10</span>} />
        <div className="flex flex-col gap-1">
          <label htmlFor="note" className="num text-muted text-[12px] font-semibold">
            Reviewer note
          </label>
          <textarea
            id="note"
            rows={4}
            readOnly={!canWrite}
            value={note ?? p.reviewer_note ?? ""}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== null && note !== (p.reviewer_note ?? "") && saveNote.mutate({ note })}
            placeholder={canWrite ? "What should the next reviewer know?" : "No note"}
            className={`${textareaCls} text-muted min-h-[90px] resize-y`}
          />
        </div>

        {canWrite && slot?.slot && date && future && (
          <Btn
            size="md"
            icon={locked ? "lock-simple-open" : "lock-simple"}
            disabled={lock.isPending}
            onClick={() => lock.mutate({ date, game, locked: !locked })}
            className="self-start"
          >
            {locked ? "Unlock" : "Lock this Daily"}
          </Btn>
        )}

        {canSwap && slot?.slot && date && (isToday || (future && locked)) && (
          <div className="bg-bg flex flex-col gap-2 rounded-[12px] p-3 shadow-[inset_0_0_0_1px_var(--line)]">
            <span className="text-[14px] font-semibold">Emergency swap</span>
            <span className="text-muted text-[13px] leading-[1.4]">
              Replaces {isToday ? "today's" : "this"} puzzle with a fresh verified one. Players mid-solve finish their current puzzle.
            </span>
            {swapReason === null ? (
              <Btn tone="danger" icon="swap" onClick={() => setSwapReason("")}>
                Swap Daily
              </Btn>
            ) : (
              <form
                className="flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  swap.mutate({ game, date, reason: swapReason }, { onSuccess: () => setSwapReason(null) });
                }}
              >
                <label htmlFor="swap-reason" className="num text-muted text-[12px] font-semibold">
                  What is broken?
                </label>
                <input
                  id="swap-reason"
                  required
                  minLength={3}
                  value={swapReason}
                  onChange={(e) => setSwapReason(e.target.value)}
                  className={`${textareaCls} h-10`}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Btn onClick={() => setSwapReason(null)}>Cancel</Btn>
                  <Btn type="submit" tone="danger" disabled={swap.isPending}>
                    {swap.isPending ? "Swapping" : "Confirm swap"}
                  </Btn>
                </div>
              </form>
            )}
            {swap.data && <span className="text-accent text-[13px] font-semibold">Swapped. The new puzzle is live.</span>}
          </div>
        )}

        {canWrite && p.status !== "retired" && (
          <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
            <Btn
              size="lg"
              disabled={!future || locked || regen.isPending}
              title={locked ? "Locked Dailies change only through Swap Daily" : undefined}
              onClick={() => date && regen.mutate({ date, game })}
            >
              {regen.isPending ? "Generating" : "Regenerate"}
            </Btn>
            <Btn
              size="lg"
              tone="primary"
              disabled={approve.isPending || !review}
              onClick={() => approve.mutate({ note: note ?? undefined, date })}
            >
              {review ? (approve.isPending ? "Checking" : "Approve") : "Approved"}
            </Btn>
          </div>
        )}
      </aside>
    </div>
  );
}

/** The real Board in a 390 × 680 phone frame, with Show solution and Play test. */
function BoardFrame({
  game,
  puzzle,
  solution,
  puzzleId,
  worldColor,
  worldInk,
}: {
  game: string;
  puzzle: unknown;
  solution: unknown;
  puzzleId: string;
  worldColor: string;
  worldInk: string;
}) {
  const Board = BOARDS[game];
  const meta = GAME_BY_ID[game];
  const [mode, setMode] = useState<"puzzle" | "solution" | "play">("puzzle");
  const [round, setRound] = useState(0);
  const [feedback, setFeedback] = useState<{ text: string; tone: FeedbackTone } | null>(null);
  const [controls, setControls] = useState<ControlSpec[]>([]);
  const [said, setSaid] = useState("");
  const solved = useMemo(() => {
    try {
      return SOLVED_STATE[game]?.(puzzle, solution);
    } catch {
      return undefined;
    }
  }, [game, puzzle, solution]);
  // Content games send guesses through the guess transport: check them against this stored puzzle.
  useEffect(() => {
    setGuessTransport((_ref, guess) => api(`/api/admin/puzzles/${puzzleId}/guess`, { json: { guess } }));
    return () => setGuessTransport(null);
  }, [puzzleId]);

  const boardApi = useMemo<BoardApi<unknown>>(
    () => ({
      onMove: () => {},
      onSolved: async (state) => {
        if (mode !== "play") return;
        try {
          const v = await api<{ ok: boolean; reason: string | null }>(`/api/admin/puzzles/${puzzleId}/verify`, { json: { state } });
          setFeedback(
            v.ok
              ? { text: "Server verify accepts this solve.", tone: "success" }
              : { text: `Server verify refused it: ${v.reason ?? "not solved"}.`, tone: "danger" },
          );
        } catch (e) {
          setFeedback({ text: errorText(e), tone: "danger" });
        }
      },
      onFailed: (_s, reason) => setFeedback({ text: reason, tone: "danger" }),
      feedback: (text, tone = "info") => setFeedback({ text, tone }),
      ruleBreak: (message) => setFeedback({ text: message, tone: "danger" }),
      announce: (text) => setSaid(text),
      setControls,
    }),
    [mode, puzzleId],
  );

  const style = {
    "--world": worldColor,
    "--world-ink": worldInk,
    "--world-depth": `color-mix(in srgb, ${worldColor} 55%, #0E0F1A)`,
  } as CSSProperties;
  const showJson = mode === "solution" && solved === undefined;

  return (
    <div
      style={style}
      data-world={meta.world}
      className="bg-bg flex h-[680px] w-full max-w-[390px] shrink-0 flex-col items-center gap-4 overflow-hidden rounded-[36px] px-4 py-[30px] shadow-[0_0_0_2px_var(--line)]"
    >
      <span className="font-display self-start text-[22px] font-black text-[var(--world)] [[data-theme=light]_&]:text-[var(--world-ink)]">
        {meta.name}
      </span>
      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-3 overflow-auto">
        {showJson ? (
          <pre className="num bg-surface w-full flex-1 overflow-auto rounded-[12px] p-3 text-[12px] leading-[1.4] whitespace-pre-wrap">
            {JSON.stringify(solution, null, 1)}
          </pre>
        ) : Board ? (
          <FitWidth>
            <Board
              key={`${mode}:${round}`}
              puzzle={puzzle}
              mode="free"
              initialState={mode === "solution" ? solved : undefined}
              disabled={mode !== "play"}
              api={boardApi}
            />
          </FitWidth>
        ) : (
          <Notice icon="info">This game has no board yet.</Notice>
        )}
        {mode === "play" && controls.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {controls.map((c) => (
              <Btn key={c.id} size="sm" icon={c.icon} disabled={c.disabled} onClick={c.onPress}>
                {c.label}
              </Btn>
            ))}
          </div>
        )}
        {feedback && mode === "play" && (
          <p
            className={`text-center text-[13px] font-semibold ${feedback.tone === "danger" ? "text-danger" : feedback.tone === "success" ? "text-accent" : "text-muted"}`}
          >
            {feedback.text}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Btn
          size="sm"
          icon={mode === "solution" ? "eye-slash" : "eye"}
          aria-pressed={mode === "solution"}
          onClick={() => {
            setFeedback(null);
            setMode(mode === "solution" ? "puzzle" : "solution");
          }}
        >
          {mode === "solution" ? "Hide solution" : "Show solution"}
        </Btn>
        <Btn
          size="sm"
          icon="play"
          aria-pressed={mode === "play"}
          onClick={() => {
            setFeedback(null);
            setControls([]);
            setRound((r) => r + 1);
            setMode("play");
          }}
        >
          {mode === "play" ? "Restart test" : "Play test"}
        </Btn>
      </div>
      <div aria-live="polite" className="sr-only">
        {said}
      </div>
    </div>
  );
}

/**
 * Boards size their cells from the window (min 44 px), so big grids would overflow the 390 px phone frame.
 * This scales the board down to the frame width with a transform, keeping the real component untouched.
 */
function FitWidth({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ width: 0, scale: 1, height: 0 });
  useLayoutEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      // Boards cap themselves at 100% width and scroll; the widest scroll width is their natural size.
      let width = i.scrollWidth;
      i.querySelectorAll<HTMLElement>("*").forEach((el) => (width = Math.max(width, el.scrollWidth)));
      const scale = Math.min(1, o.clientWidth / Math.max(1, width));
      setFit((f) =>
        f.width === width && f.scale === scale && f.height === i.scrollHeight * scale
          ? f
          : { width, scale, height: i.scrollHeight * scale },
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    // The board chunk loads after mount and may keep the same box size as its skeleton.
    const mo = new MutationObserver(measure);
    mo.observe(i, { childList: true, subtree: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, []);
  return (
    <div ref={outer} className="flex w-full justify-center overflow-hidden" style={{ height: fit.height || undefined }}>
      <div ref={inner} className="shrink-0 origin-top" style={{ width: fit.width || "max-content", transform: `scale(${fit.scale})` }}>
        {children}
      </div>
    </div>
  );
}
