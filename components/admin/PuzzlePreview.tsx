"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BOARDS } from "@/games/board-registry";
import { setGuessTransport } from "@/games/_shared/guess";
import type { BoardApi, ControlSpec, FeedbackTone } from "@/games/types";
import { Icon } from "@/components/ui/Icon";
import { GAME_BY_ID, UI_ACCENT } from "@/lib/catalog";
import { dayMonth } from "@/lib/admin/dates";
import { plainCheck } from "@/lib/admin/content-words";
import { SOLVED_STATE } from "@/lib/admin/solved-state";
import { api } from "@/lib/client/api";
import { errorText, useAdminAction, useAdminQuery } from "@/lib/client/admin";
import { adminCopy } from "@/lib/copy/admin";
import type { Slot } from "./DailySlot";
import { StatePill, TechDetails, TechLine, When, puzzleState } from "./content-ui";
import { Btn, Notice, ReadField, RowsSkeleton, textareaCls } from "./ui";

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

const C = adminCopy.preview;

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
  return C.notApplicable;
}

/**
 * Puzzle preview (design: Admin preview): the game's real Board in a phone frame, the checks in plain words and the
 * publish panel. Show solution renders the solved board where the game has a solved-state shape; Play test lets the
 * reviewer solve it and asks the server's answer checker for the verdict.
 */
export function PuzzlePreview({
  puzzleId,
  game,
  date,
  slot,
  canWrite,
  canSwap,
  backHref,
}: {
  puzzleId: string;
  game: string;
  date?: string;
  slot?: Slot;
  canWrite: boolean;
  canSwap: boolean;
  /** Where Back goes: the puzzle list with the filters and page it was opened from. */
  backHref?: string;
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
  const state = puzzleState(p.status, isToday);
  const tags = [
    p.difficulty,
    date && [0, 6].includes(new Date(date + "T00:00:00Z").getUTCDay()) ? C.weekend : null,
    p.source === "human" ? C.written : C.generated,
  ]
    .filter(Boolean)
    .join(", ");
  const regenBlocked = !future ? C.pastTitle : locked ? C.lockedTitle : undefined;

  return (
    <div className="grid min-h-dvh grid-cols-1 xl:grid-cols-[1fr_420px]">
      <div className="flex min-w-0 flex-col gap-4 px-4 py-5 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={date ? "/admin/calendar" : (backHref ?? "/admin/puzzles")}
            aria-label={C.back}
            className="hover:bg-surface-raised -ml-2 flex size-11 items-center justify-center rounded-[10px]"
          >
            <Icon name="arrow-left" size={20} />
          </Link>
          <h1 className="font-display text-[22px] font-extrabold">
            {meta.name} · {date ? dayMonth(date) : p.difficulty}
          </h1>
          <StatePill s={state} />
          {locked && <StatePill s={{ ...adminCopy.calendar.lockedState, tone: "neutral", icon: "lock-simple" }} />}
          {slot?.slot?.swapped_from && <StatePill s={{ ...adminCopy.calendar.swappedState, tone: "warn", icon: "swap" }} />}
        </div>
        <p className="text-muted max-w-[760px] text-[14px]">{state.meaning}</p>
        <div aria-live="polite" className="empty:hidden">
          {err && (
            <Notice tone="danger" icon="warning">
              {errorText(err)}
            </Notice>
          )}
        </div>
        <div className="flex flex-col gap-5 lg:flex-row">
          <BoardFrame key={p.id} game={game} puzzle={p.data} solution={p.solution} puzzleId={p.id} />
          <section aria-labelledby="checks-title" className="flex min-w-0 flex-1 flex-col gap-2.5">
            <div className="flex flex-col gap-0.5">
              <h2 id="checks-title" className="text-[16px] font-bold">
                {C.checksTitle}
              </h2>
              <p className="text-muted text-[13px]">{C.checksIntro}</p>
            </div>
            {report && (
              <Notice tone={report.ok ? "ok" : "danger"} icon={report.ok ? "check-circle" : "warning"}>
                {report.ok ? C.allPassed : C.hasProblem}
              </Notice>
            )}
            {report ? (
              <ul className="flex flex-col gap-1.5">
                {report.checks.map((raw) => {
                  const c = plainCheck(raw);
                  return (
                    <li key={raw.id} className="bg-surface flex min-h-11 items-start gap-2.5 rounded-[10px] px-3 py-2.5 text-[14px]">
                      <Icon name={CHECK_ICON[c.status].icon} size={18} className={`mt-0.5 ${CHECK_ICON[c.status].cls}`} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-semibold">{c.label}</span>
                        <span className="text-muted text-[13px]">{c.value}</span>
                      </span>
                      <span className={`text-[12px] font-semibold ${CHECK_ICON[c.status].cls}`}>{C.checkStatus[c.status]}</span>
                    </li>
                  );
                })}
              </ul>
            ) : check.isPending ? (
              <RowsSkeleton rows={6} height={44} />
            ) : (
              <Notice icon="info">{C.notChecked}</Notice>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {canWrite && (
                <Btn size="md" icon="arrows-clockwise" disabled={check.isPending} onClick={() => check.mutate()}>
                  {check.isPending ? C.checking : C.runCheck}
                </Btn>
              )}
              {report && (
                <span className="text-muted text-[13px]">
                  {C.checkedAt} <When iso={report.ranAt} />
                </span>
              )}
            </div>
            <TechDetails>
              <TechLine name={C.techPuzzle} value={p.id} />
              <TechLine name={C.techSeed} value={p.seed} />
              <TechLine name={C.techStatus} value={p.status} />
              {report?.checks.map((c) => (
                <TechLine key={c.id} name={c.id} value={C.rawCheck(c.label, c.value)} />
              ))}
            </TechDetails>
          </section>
        </div>
      </div>

      <aside aria-label={C.publish} className="bg-surface border-line flex flex-col gap-3 border-t p-5 xl:border-t-0 xl:border-l">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-display text-[17px] font-extrabold">{C.publish}</h2>
          <p className="text-muted text-[13px]">{C.publishIntro}</p>
        </div>
        {p.status === "retired" && <Notice icon="prohibit">{C.retiredNote}</Notice>}
        <ReadField
          label={C.release}
          value={date ? C.releaseAt(dayMonth(date)) : q.data.dailies.map((d) => dayMonth(d.date)).join(", ") || C.notScheduled}
        />
        <div className="grid grid-cols-2 gap-3">
          <ReadField
            label={C.dailyNumber}
            value={slot ? `#${slot.number}` : q.data.dailies[0] ? `#${q.data.dailies[0].number}` : C.notScheduled}
          />
          <ReadField label={C.grade} value={<span className="num">{C.gradeValue((p.grade / 10).toFixed(1))}</span>} />
          <ReadField label={C.size} value={sizeOf(p.data)} />
          <ReadField label={C.tags} value={tags} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="note" className="text-muted text-[12px] font-semibold">
            {C.reviewerNote}
          </label>
          <textarea
            id="note"
            rows={3}
            readOnly={!canWrite}
            value={note ?? p.reviewer_note ?? ""}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== null && note !== (p.reviewer_note ?? "") && saveNote.mutate({ note })}
            placeholder={canWrite ? C.notePlaceholder : C.noNote}
            className={`${textareaCls} min-h-[80px] resize-y`}
          />
          <span aria-live="polite" className="text-accent text-[12px] font-semibold empty:hidden">
            {saveNote.isSuccess ? C.noteSaved : ""}
          </span>
        </div>

        {canWrite && p.status !== "retired" && (
          <div className="flex flex-col gap-2 rounded-[12px] pt-1">
            <div className="grid grid-cols-2 gap-2">
              <Btn
                size="lg"
                tone="primary"
                disabled={approve.isPending || !review}
                title={!review ? C.alreadyApproved : undefined}
                onClick={() => approve.mutate({ note: note ?? undefined, date })}
              >
                {review ? (approve.isPending ? C.checking : C.approve) : C.approved}
              </Btn>
              {date && (
                <Btn
                  size="lg"
                  disabled={!!regenBlocked || regen.isPending}
                  title={regenBlocked}
                  onClick={() => regen.mutate({ date, game })}
                >
                  {regen.isPending ? C.generating : C.regenerate}
                </Btn>
              )}
            </div>
            <p className="text-muted text-[12px] leading-[1.4]">
              {C.approveHelp} {date ? C.regenerateHelp : ""}
            </p>
          </div>
        )}

        {canWrite && slot?.slot && date && future && (
          <div className="flex flex-col gap-1.5">
            <Btn
              size="md"
              icon={locked ? "lock-simple-open" : "lock-simple"}
              disabled={lock.isPending}
              onClick={() => lock.mutate({ date, game, locked: !locked })}
              className="self-start"
            >
              {locked ? C.unlock : C.lock}
            </Btn>
            <p className="text-muted text-[12px] leading-[1.4]">{C.lockHelp(locked)}</p>
          </div>
        )}

        {canSwap && slot?.slot && date && (isToday || (future && locked)) && (
          <div className="bg-bg flex flex-col gap-2 rounded-[12px] p-3 shadow-[inset_0_0_0_1px_var(--line)]">
            <span className="text-[14px] font-semibold">{C.emergencySwap}</span>
            <span className="text-muted text-[13px] leading-[1.4]">{C.swapIntro(isToday)}</span>
            {swapReason === null ? (
              <Btn tone="danger" icon="swap" onClick={() => setSwapReason("")}>
                {C.swapDaily}
              </Btn>
            ) : (
              <form
                className="flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  swap.mutate({ game, date, reason: swapReason }, { onSuccess: () => setSwapReason(null) });
                }}
              >
                <label htmlFor="swap-reason" className="text-muted text-[12px] font-semibold">
                  {C.whatBroken}
                </label>
                <input
                  id="swap-reason"
                  required
                  minLength={3}
                  value={swapReason}
                  onChange={(e) => setSwapReason(e.target.value)}
                  className={`${textareaCls} h-11`}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Btn onClick={() => setSwapReason(null)}>{C.cancel}</Btn>
                  <Btn type="submit" tone="danger" disabled={swap.isPending}>
                    {swap.isPending ? C.swapping : C.confirmSwap}
                  </Btn>
                </div>
              </form>
            )}
            <span aria-live="polite" className="text-accent text-[13px] font-semibold empty:hidden">
              {swap.data ? C.swappedLive : ""}
            </span>
          </div>
        )}
      </aside>
    </div>
  );
}

/**
 * A board that is not a stored puzzle (the practice board, R2-07), read-only: the real Board in the phone frame with
 * Show solution, but no Play test (there is no stored puzzle for the server to verify against).
 */
export function PracticeBoardPreview({ game, puzzle, solution }: { game: string; puzzle: unknown; solution: unknown }) {
  return <BoardFrame game={game} puzzle={puzzle} solution={solution} puzzleId={null} />;
}

/** The real Board in a 390 × 680 phone frame, with Show solution and (for a stored puzzle) Play test. */
function BoardFrame({ game, puzzle, solution, puzzleId }: { game: string; puzzle: unknown; solution: unknown; puzzleId: string | null }) {
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
    if (!puzzleId) return; // read-only preview: the board is never played, so it never guesses
    setGuessTransport((_ref, guess) => api(`/api/admin/puzzles/${puzzleId}/guess`, { json: { guess } }));
    return () => setGuessTransport(null);
  }, [puzzleId]);

  const boardApi = useMemo<BoardApi<unknown>>(
    () => ({
      onMove: () => {},
      onSolved: async (state) => {
        if (mode !== "play" || !puzzleId) return;
        try {
          const v = await api<{ ok: boolean; reason: string | null }>(`/api/admin/puzzles/${puzzleId}/verify`, { json: { state } });
          setFeedback(v.ok ? { text: C.verifyOk, tone: "success" } : { text: C.verifyRefused(v.reason), tone: "danger" });
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
    "--world": UI_ACCENT,
    "--world-ink": UI_ACCENT,
    "--world-depth": "var(--accent-depth)",
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
          <Notice icon="info">{C.noBoard}</Notice>
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
          {mode === "solution" ? C.hideSolution : C.showSolution}
        </Btn>
        {puzzleId && (
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
            {mode === "play" ? C.restartTest : C.playTest}
          </Btn>
        )}
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
