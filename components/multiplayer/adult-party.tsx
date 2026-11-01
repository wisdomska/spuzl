"use client";

/**
 * Draw It and Two Truths (18+ party modes, admin setting "features.adultParty"). Shown only to signed-in 18+
 * players; the server enforces every rule again (age gate, turns, timers, text filter, stroke caps). Free text
 * and drawings are shown only while their round runs, each with a Report button.
 */
import { useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/ui/Icon";
import { api, HttpError } from "@/lib/client/api";
import { matchKey } from "@/lib/client/multiplayer";
import { adultPartyCopy as C } from "@/lib/copy/adult-party";
import { TEXT_MAX, partyTextProblem, type PartyTextKind } from "@/lib/party-adult/filter";
import type { AdultMode, PartyMode } from "@/lib/party-adult/modes";
import { BOARD, PEN_COLORS, PEN_WIDTHS, STROKE_LIMITS, strokePath, toStrokes, type Stroke } from "@/lib/party-adult/strokes";
import type { AdultRoundView, MatchPlayerView, MatchView } from "@/lib/multiplayer/types";
import { Avatar, Cta, TopButton } from "./ui";

type Toast = (t: string, k?: "info" | "bad" | "pass") => void;

/** A refusal in the player's words: the server's friendly message, or our copy for its code. */
export function adultErrorText(e: unknown): string {
  if (e instanceof HttpError) {
    if (C.errors[e.code]) return C.errors[e.code];
    if (e.message && e.message !== e.code) return e.message;
  }
  return C.errors.fallback;
}

/** Client-side copy of the server's text check, so a refusal is explained before sending. */
export function textProblemText(text: string, kind: PartyTextKind): string | null {
  const p = partyTextProblem(text, kind);
  if (!p) return null;
  return p === "too_long" ? C.text.too_long(TEXT_MAX[kind]) : C.text[p];
}

export const modeName = (m: PartyMode) => C.modes[m].name;

/* ---------------- Host: mode picker and the one-time notice ---------------- */

export function ModePicker({ value, onChange }: { value: PartyMode; onChange: (m: PartyMode) => void }) {
  const modes: [PartyMode, string][] = [
    ["race", "flag-checkered"],
    ["draw", "paint-brush"],
    ["truths", "question"],
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={C.modes.label}>
        {modes.map(([m, icon]) => {
          const on = value === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${C.modes[m].name}${m === "race" ? "" : `, ${C.modes.badge}`}. ${C.modes[m].hint}`}
              onClick={() => onChange(m)}
              className="press relative flex min-h-[84px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[18px] px-1"
              style={{
                background: on ? "color-mix(in srgb, var(--accent) 14%, var(--bg))" : "var(--surface)",
                boxShadow: on ? "inset 0 0 0 2px var(--accent)" : undefined,
              }}
            >
              <Icon name={icon} size={22} />
              <span className="max-w-full truncate text-[14px] font-semibold">{C.modes[m].name}</span>
              {m !== "race" && (
                <span className="bg-surface-raised text-muted absolute top-1.5 right-1.5 rounded-[6px] px-1.5 text-[12px] font-bold">
                  {C.modes.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-muted text-[14px]">{value === "race" ? C.modes.adultsNote : C.modes[value].hint}</p>
    </div>
  );
}

export function AdultNotice({ onConfirm, onCancel, busy }: { onConfirm: () => void; onCancel: () => void; busy?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button type="button" aria-label={C.notice.cancel} className="absolute inset-0 bg-[rgba(6,7,13,.55)]" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal
        aria-labelledby="adult-notice-title"
        aria-describedby="adult-notice-body"
        className="bg-surface relative flex w-full max-w-[560px] flex-col gap-3 rounded-t-[32px] px-5 pt-3.5 pb-[max(28px,env(safe-area-inset-bottom))]"
      >
        <div className="bg-line h-[5px] w-11 self-center rounded-[3px]" />
        <h2 id="adult-notice-title" className="font-display flex items-center gap-2 text-[22px] font-black">
          <Icon name="shield-check" size={24} className="text-accent" />
          {C.notice.title}
        </h2>
        <p id="adult-notice-body" className="text-[17px] font-semibold">
          {C.notice.body}
        </p>
        <p className="text-muted text-[15px]">{C.notice.more}</p>
        <Cta onClick={onConfirm} disabled={busy}>
          {C.notice.confirm}
        </Cta>
        <Cta tone="raised" onClick={onCancel}>
          {C.notice.cancel}
        </Cta>
      </div>
    </div>
  );
}

/* ---------------- Sheets: report and remove ---------------- */

type Reason = "harassment" | "spam" | "other";

function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button type="button" aria-label={C.report.cancel} className="absolute inset-0 bg-[rgba(6,7,13,.55)]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal
        aria-label={label}
        className="bg-surface relative flex max-h-[85dvh] w-full max-w-[560px] flex-col gap-3 overflow-y-auto rounded-t-[32px] px-5 pt-3.5 pb-[max(28px,env(safe-area-inset-bottom))]"
      >
        <div className="bg-line h-[5px] w-11 flex-none self-center rounded-[3px]" />
        {children}
      </div>
    </div>
  );
}

export interface ReportTarget {
  kind: "drawing" | "statements" | "guess";
  guessId?: number;
  label: string;
}

function ReportSheet({ target, onPick, onClose }: { target: ReportTarget; onPick: (r: Reason) => void; onClose: () => void }) {
  return (
    <Sheet label={C.report.title} onClose={onClose}>
      <h2 className="font-display text-[22px] font-black">{target.label}</h2>
      <p className="text-muted text-[15px]">{C.report.body}</p>
      {(Object.keys(C.report.reasons) as Reason[]).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onPick(r)}
          className="press bg-surface-raised flex min-h-12 items-center gap-3 rounded-[16px] px-4 text-left text-[16px] font-semibold"
        >
          <Icon name="flag" size={18} className="text-danger" />
          {C.report.reasons[r]}
        </button>
      ))}
      <Cta tone="raised" onClick={onClose}>
        {C.report.cancel}
      </Cta>
    </Sheet>
  );
}

/** The flag button next to a drawing, statement set or guess. 44 px target. */
function ReportButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="press text-muted flex size-11 flex-none items-center justify-center rounded-[12px] hover:text-[var(--danger)]"
    >
      <Icon name="flag" size={18} />
    </button>
  );
}

/** Players and points; the host can remove someone. */
export function PlayersSheet({
  view,
  host,
  onKick,
  onClose,
}: {
  view: MatchView;
  host: boolean;
  onKick: (p: MatchPlayerView) => void;
  onClose: () => void;
}) {
  const here = view.players.filter((p) => !p.left && !p.spectator).sort((a, b) => b.points - a.points);
  return (
    <Sheet label={C.round.players} onClose={onClose}>
      <h2 className="font-display text-[22px] font-black">{C.round.players}</h2>
      <ul className="flex flex-col gap-1.5">
        {here.map((p) => (
          <li key={p.id} className="bg-surface-raised flex min-h-12 items-center gap-2.5 rounded-[14px] pr-1 pl-3">
            <Avatar name={p.nickname} color={p.color} size={28} radius={9} />
            <span className="min-w-0 flex-1 truncate text-[16px] font-medium">{p.id === view.me ? "You" : p.nickname}</span>
            <span className="num text-[15px] font-semibold">{C.round.points(p.points)}</span>
            {host && p.id !== view.me ? (
              <button
                type="button"
                aria-label={C.lobby.remove(p.nickname)}
                onClick={() => onKick(p)}
                className="press text-muted flex size-11 items-center justify-center rounded-[12px]"
              >
                <Icon name="user-minus" size={18} />
              </button>
            ) : (
              <span className="size-11" />
            )}
          </li>
        ))}
      </ul>
      <Cta tone="raised" onClick={onClose}>
        {C.report.cancel}
      </Cta>
    </Sheet>
  );
}

export function KickConfirm({ player, onConfirm, onClose }: { player: MatchPlayerView; onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet label={C.kick.title(player.nickname)} onClose={onClose}>
      <h2 className="font-display text-[22px] font-black">{C.kick.title(player.nickname)}</h2>
      <p className="text-muted text-[15px]">{C.kick.body}</p>
      <div className="grid grid-cols-2 gap-2.5">
        <Cta tone="raised" onClick={onClose}>
          {C.kick.cancel}
        </Cta>
        <Cta onClick={onConfirm}>{C.kick.confirm}</Cta>
      </div>
    </Sheet>
  );
}

/* ---------------- The round screen ---------------- */

export function AdultRound({
  view,
  code,
  now,
  host,
  onToast,
  onLeave,
}: {
  view: MatchView;
  code: string;
  now: number;
  host: boolean;
  onToast: Toast;
  onLeave: () => void;
}) {
  const qc = useQueryClient();
  const [report, setReport] = useState<ReportTarget | null>(null);
  const [players, setPlayers] = useState(false);
  const [kick, setKick] = useState<MatchPlayerView | null>(null);
  const r = view.party;
  const refresh = () => qc.invalidateQueries({ queryKey: matchKey(view.id) });
  const post = <T,>(action: string, json: unknown) => api<T>(`/api/v1/rooms/${code}/party/${action}`, { json });
  if (!r) return null;
  const name = (id: string | null) => view.players.find((p) => p.id === id)?.nickname ?? "Someone";
  const isLead = r.leadId === view.me;
  const span = Math.max(1, r.endsAt - r.startedAt);
  const left = Math.max(0, r.endsAt - now);
  const sendReport = async (reason: Reason) => {
    const t = report;
    setReport(null);
    if (!t) return;
    try {
      await post("report", { round: r.round, kind: t.kind, guessId: t.guessId, reason });
      onToast(C.report.done, "info");
    } catch (e) {
      onToast(adultErrorText(e), "bad");
    }
  };
  const doKick = async () => {
    const p = kick;
    setKick(null);
    if (!p) return;
    try {
      await api(`/api/v1/rooms/${code}/kick`, { json: { playerId: p.id } });
      onToast(C.kick.done(p.nickname), "info");
      void refresh();
    } catch (e) {
      onToast(adultErrorText(e), "bad");
    }
  };
  return (
    <div className="flex flex-1 flex-col pb-[max(20px,env(safe-area-inset-bottom))]" data-screen-label={`${modeName(r.mode)} round`}>
      <div className="flex items-center gap-3 px-4 pt-[max(52px,env(safe-area-inset-top))]">
        <TopButton icon="x" label={C.round.leave} onClick={onLeave} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-display truncate text-[18px] font-extrabold">{modeName(r.mode)}</span>
          <span className="text-muted text-[14px] font-medium">{C.round.of(r.round, r.rounds)}</span>
        </div>
        <TopButton icon="users" label={C.round.players} onClick={() => setPlayers(true)} />
      </div>
      {r.phase !== "reveal" && r.phase !== "done" && (
        <div
          className="bg-line mx-4 mt-3 h-2 overflow-hidden rounded-[4px]"
          role="progressbar"
          aria-label={C.round.timeLeft(Math.ceil(left / 1000))}
          aria-valuemin={0}
          aria-valuemax={Math.round(span / 1000)}
          aria-valuenow={Math.ceil(left / 1000)}
        >
          <div
            className="h-full origin-left rounded-[4px]"
            style={{
              transform: `scaleX(${left / span})`,
              background: left < 10_000 ? "var(--danger)" : "var(--accent)",
              transition: "transform 200ms linear",
            }}
          />
        </div>
      )}
      <div className="mt-3 flex flex-1 flex-col gap-3 px-4">
        {r.mode === "draw" ? (
          <DrawIt view={view} r={r} isLead={isLead} name={name} post={post} refresh={refresh} onToast={onToast} onReport={setReport} />
        ) : (
          <TwoTruths view={view} r={r} isLead={isLead} name={name} post={post} refresh={refresh} onToast={onToast} onReport={setReport} />
        )}
        {(r.phase === "reveal" || r.phase === "done") && <Awards view={view} r={r} />}
      </div>
      {report && <ReportSheet target={report} onPick={sendReport} onClose={() => setReport(null)} />}
      {players && (
        <PlayersSheet
          view={view}
          host={host}
          onClose={() => setPlayers(false)}
          onKick={(p) => {
            setPlayers(false);
            setKick(p);
          }}
        />
      )}
      {kick && <KickConfirm player={kick} onConfirm={doKick} onClose={() => setKick(null)} />}
    </div>
  );
}

interface RoundProps {
  view: MatchView;
  r: AdultRoundView;
  isLead: boolean;
  name: (id: string | null) => string;
  post: <T>(action: string, json: unknown) => Promise<T>;
  refresh: () => Promise<unknown>;
  onToast: Toast;
  onReport: (t: ReportTarget) => void;
}

function Awards({ view, r }: { view: MatchView; r: AdultRoundView }) {
  const rows = Object.entries(r.awards ?? {}).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return <p className="text-muted text-center text-[15px]">{C.round.next}</p>;
  return (
    <ul className="flex flex-col gap-1.5" aria-label={C.round.next}>
      {rows.map(([id, pts]) => {
        const p = view.players.find((x) => x.id === id);
        return (
          <li key={id} className="bg-surface flex min-h-11 items-center gap-2.5 rounded-[14px] px-3">
            <Avatar name={p?.nickname ?? "?"} color={p?.color ?? "var(--surface-raised)"} size={26} radius={8} />
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{id === view.me ? "You" : (p?.nickname ?? "Spuzler")}</span>
            <span className="num text-accent text-[16px] font-bold">{C.round.plus(pts)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------- Draw It ---------------- */

function DrawIt({ view, r, isLead, name, post, refresh, onToast, onReport }: RoundProps) {
  const drawing = isLead && r.phase === "play";
  const revealed = r.phase === "reveal" || r.phase === "done";
  return (
    <>
      <div className="flex min-h-11 items-center justify-between gap-2">
        {drawing ? (
          <p className="text-[16px] font-semibold">
            {C.draw.yourWord}: <span className="font-display text-accent text-[22px] font-black">{r.word}</span>
          </p>
        ) : revealed ? (
          <p className="text-[16px] font-semibold" role="status">
            {C.draw.wordWas(r.word ?? "")}
          </p>
        ) : (
          <p className="flex flex-col">
            <span className="text-[16px] font-semibold">{C.draw.drawing(name(r.leadId))}</span>
            {r.shape && (
              <span className="num text-muted text-[15px] tracking-[0.2em]" aria-label={C.draw.blanks(r.shape)}>
                {r.shape.map((n) => "_".repeat(n)).join("  ")}
              </span>
            )}
          </p>
        )}
        {!isLead && r.strokes.length > 0 && (
          <ReportButton
            label={C.draw.reportDrawing}
            onClick={() => onReport({ kind: "drawing", label: `${C.draw.reportDrawing}: ${name(r.leadId)}` })}
          />
        )}
      </div>
      <Canvas strokes={r.strokes} editable={drawing} round={r.round} post={post} refresh={refresh} onToast={onToast} />
      {drawing && <p className="text-muted text-[14px]">{C.draw.youDraw}</p>}
      {!isLead && !revealed && <GuessBox r={r} post={post} refresh={refresh} onToast={onToast} />}
      <Feed view={view} r={r} name={name} onReport={onReport} />
    </>
  );
}

function Canvas({
  strokes,
  editable,
  round,
  post,
  refresh,
  onToast,
}: {
  strokes: Stroke[];
  editable: boolean;
  round: number;
  post: RoundProps["post"];
  refresh: RoundProps["refresh"];
  onToast: Toast;
}) {
  const svg = useRef<SVGSVGElement | null>(null);
  const [color, setColor] = useState(0);
  const [width, setWidth] = useState(1);
  const [path, setPath] = useState<[number, number][] | null>(null);
  const [pending, setPending] = useState<Stroke[]>([]);
  const toBoard = (e: ReactPointerEvent): [number, number] => {
    const b = svg.current!.getBoundingClientRect();
    return [((e.clientX - b.left) / b.width) * BOARD, ((e.clientY - b.top) / b.height) * BOARD];
  };
  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!editable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setPath([toBoard(e)]);
  };
  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!editable || !path) return;
    const p = toBoard(e);
    setPath((x) => (x ? [...x, p] : x));
  };
  const up = async () => {
    if (!editable || !path) return;
    const batch = toStrokes(path, color, width).slice(0, 20);
    setPath(null);
    if (!batch.length) return;
    setPending((x) => [...x, ...batch]);
    try {
      await post("draw", { round, op: "add", strokes: batch });
      await refresh();
    } catch (e) {
      onToast(adultErrorText(e), "bad");
    } finally {
      setPending((x) => x.filter((s) => !batch.includes(s)));
    }
  };
  const op = async (o: "undo" | "clear") => {
    try {
      await post("draw", { round, op: o });
      await refresh();
    } catch (e) {
      onToast(adultErrorText(e), "bad");
    }
  };
  const live = path ? toStrokes(path, color, width, 1) : [];
  const shown = [...strokes, ...pending, ...live];
  const full = strokes.length >= STROKE_LIMITS.strokes;
  return (
    <div className="flex flex-col gap-2">
      <svg
        ref={svg}
        viewBox={`0 0 ${BOARD} ${BOARD}`}
        role="img"
        aria-label={editable ? C.draw.canvasDraw : C.draw.canvas}
        className="bg-surface aspect-square w-full max-w-[520px] self-center rounded-[20px]"
        style={{ touchAction: editable ? "none" : undefined, cursor: editable ? "crosshair" : undefined }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {shown.map((s, i) => (
          <path
            key={i}
            d={strokePath(s)}
            fill="none"
            stroke={PEN_COLORS[s.c]}
            strokeWidth={PEN_WIDTHS[s.w]}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      {editable && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={C.draw.colours}>
            {PEN_COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === i}
                aria-label={C.draw.colourNames[i]}
                onClick={() => setColor(i)}
                className="flex size-11 items-center justify-center rounded-[12px]"
                style={{ boxShadow: color === i ? "inset 0 0 0 2px var(--accent)" : undefined }}
              >
                <span className="size-6 rounded-full" style={{ background: c, boxShadow: "inset 0 0 0 1px var(--line)" }} />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex gap-1.5" role="radiogroup" aria-label={C.draw.widths}>
              {PEN_WIDTHS.map((w, i) => (
                <button
                  key={w}
                  type="button"
                  role="radio"
                  aria-checked={width === i}
                  aria-label={C.draw.widthNames[i]}
                  onClick={() => setWidth(i)}
                  className="bg-surface flex size-11 items-center justify-center rounded-[12px]"
                  style={{ boxShadow: width === i ? "inset 0 0 0 2px var(--accent)" : undefined }}
                >
                  <span className="rounded-full" style={{ width: 4 + i * 6, height: 4 + i * 6, background: "var(--text)" }} />
                </button>
              ))}
            </div>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => op("undo")}
              disabled={!strokes.length}
              aria-label={C.draw.undo}
              className="press bg-surface flex size-11 items-center justify-center rounded-[12px] disabled:opacity-40"
            >
              <Icon name="arrow-counter-clockwise" size={20} />
            </button>
            <button
              type="button"
              onClick={() => op("clear")}
              disabled={!strokes.length}
              aria-label={C.draw.clear}
              className="press bg-surface flex size-11 items-center justify-center rounded-[12px] disabled:opacity-40"
            >
              <Icon name="trash" size={20} />
            </button>
          </div>
          {full && <p className="text-muted text-[14px]">{C.draw.full}</p>}
        </div>
      )}
    </div>
  );
}

function GuessBox({ r, post, refresh, onToast }: Pick<RoundProps, "r" | "post" | "refresh" | "onToast">) {
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (r.iCorrect)
    return (
      <p className="bg-surface text-accent flex min-h-12 items-center gap-2 rounded-[16px] px-4 text-[16px] font-semibold" role="status">
        <Icon name="check" size={18} />
        {C.draw.gotIt}
      </p>
    );
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = textProblemText(text, "guess");
    if (problem) return setErr(problem);
    setBusy(true);
    try {
      const res = await post<{ result: "correct" | "close" | "wrong" }>("guess", { round: r.round, text });
      setText("");
      setErr(null);
      if (res.result === "correct") onToast(C.draw.gotIt, "pass");
      else if (res.result === "close") onToast(C.draw.close, "info");
      await refresh();
    } catch (e2) {
      setErr(adultErrorText(e2));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <label htmlFor="party-guess" className="sr-only">
        {C.draw.guessLabel}
      </label>
      <div className="flex gap-2">
        <input
          id="party-guess"
          value={text}
          maxLength={TEXT_MAX.guess}
          autoComplete="off"
          enterKeyHint="send"
          onChange={(e) => (setText(e.target.value), setErr(null))}
          placeholder={C.draw.guessPlaceholder}
          aria-invalid={!!err}
          aria-describedby={err ? "party-guess-err" : undefined}
          className="bg-surface h-12 min-w-0 flex-1 rounded-[14px] px-3.5 text-[16px] shadow-[inset_0_0_0_1px_var(--line)]"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="toy bg-accent text-on-accent h-12 rounded-[14px] px-4 text-[16px] font-bold [--btn-depth:var(--accent-depth)] disabled:opacity-50"
        >
          {C.draw.send}
        </button>
      </div>
      {err && (
        <p id="party-guess-err" role="alert" className="text-[14px] text-[var(--danger)]">
          {err}
        </p>
      )}
    </form>
  );
}

function Feed({ view, r, name, onReport }: Pick<RoundProps, "view" | "r" | "name" | "onReport">) {
  if (!r.guesses.length) return null;
  return (
    <section aria-label={C.draw.feed} className="flex flex-col gap-1">
      <h3 className="text-muted text-[14px] font-semibold">{C.draw.feed}</h3>
      <ul className="flex max-h-[240px] flex-col gap-1 overflow-y-auto" aria-live="polite">
        {r.guesses.map((g) => (
          <li key={g.id} className="bg-surface flex min-h-11 items-center gap-2 rounded-[12px] pl-3">
            {g.correct ? (
              <span className="text-accent flex flex-1 items-center gap-1.5 text-[15px] font-semibold">
                <Icon name="check" size={16} />
                {g.playerId === view.me ? C.draw.gotIt : C.draw.guessed(name(g.playerId))}
              </span>
            ) : (
              <span className="min-w-0 flex-1 text-[15px] break-words">
                <b className="font-semibold">{g.playerId === view.me ? "You" : name(g.playerId)}:</b> {g.text}
              </span>
            )}
            {!g.correct && g.playerId !== view.me ? (
              <ReportButton
                label={C.draw.reportGuess(name(g.playerId))}
                onClick={() => onReport({ kind: "guess", guessId: g.id, label: C.draw.reportGuess(name(g.playerId)) })}
              />
            ) : (
              <span className="size-11 flex-none" />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------- Two Truths ---------------- */

function TwoTruths({ r, isLead, name, post, refresh, onToast, onReport }: RoundProps) {
  const revealed = r.phase === "reveal" || r.phase === "done";
  if (r.phase === "write")
    return isLead ? (
      <WriteForm r={r} post={post} refresh={refresh} onToast={onToast} />
    ) : (
      <p className="bg-surface text-muted rounded-[16px] px-4 py-6 text-center text-[16px]" role="status">
        {C.truths.writing(name(r.leadId))}
      </p>
    );
  if (revealed && r.skipped) return <p className="text-muted text-center text-[16px]">{C.round.skipped(name(r.leadId))}</p>;
  const statements = r.statements ?? [];
  const voted = r.myPick !== null;
  const count = (i: number) => (r.votes ?? []).filter((v) => v.pick === i).length;
  const vote = async (i: number) => {
    try {
      await post("vote", { round: r.round, pick: i });
      await refresh();
    } catch (e) {
      onToast(adultErrorText(e), "bad");
    }
  };
  return (
    <>
      <div className="flex min-h-11 items-center justify-between gap-2">
        <p className="text-[16px] font-semibold" role="status">
          {isLead ? C.truths.yours : revealed ? C.truths.pick(name(r.leadId)) : voted ? C.truths.voted : C.truths.pick(name(r.leadId))}
        </p>
        {!isLead && statements.length > 0 && (
          <ReportButton
            label={C.truths.reportStatements(name(r.leadId))}
            onClick={() => onReport({ kind: "statements", label: C.truths.reportStatements(name(r.leadId)) })}
          />
        )}
      </div>
      <ol className="flex flex-col gap-2">
        {statements.map((s, i) => {
          const lie = r.lie === i;
          const mine = r.myPick === i;
          const canVote = !isLead && !voted && !revealed && r.phase === "play";
          const tag = revealed || isLead ? (lie ? C.truths.lie : C.truths.truth) : null;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={!canVote}
                aria-label={canVote ? `${C.truths.vote(i)}: ${s}` : undefined}
                aria-pressed={mine}
                onClick={() => vote(i)}
                className="press flex min-h-14 w-full items-center gap-3 rounded-[16px] px-3.5 py-2.5 text-left"
                style={{
                  background: mine ? "color-mix(in srgb, var(--accent) 14%, var(--bg))" : "var(--surface)",
                  boxShadow:
                    (revealed || isLead) && lie ? "inset 0 0 0 2px var(--danger)" : mine ? "inset 0 0 0 2px var(--accent)" : undefined,
                }}
              >
                <span className="num bg-surface-raised flex size-8 flex-none items-center justify-center rounded-[10px] text-[15px] font-bold">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 text-[16px] break-words">{s}</span>
                {tag && (
                  <span className="text-[13px] font-bold" style={{ color: lie ? "var(--danger)" : "var(--text-muted)" }}>
                    {tag}
                    {revealed ? ` · ${C.truths.votes(count(i))}` : ""}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
      {!revealed && <p className="text-muted text-[14px]">{C.truths.votes(r.voters.length)}</p>}
    </>
  );
}

function WriteForm({ r, post, refresh, onToast }: Pick<RoundProps, "r" | "post" | "refresh" | "onToast">) {
  const [lines, setLines] = useState(["", "", ""]);
  const [lie, setLie] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = lines.map((l) => textProblemText(l, "statement")).find(Boolean);
    if (problem) return setErr(problem);
    if (lie === null) return setErr(C.truths.writeHint);
    setBusy(true);
    try {
      await post("statements", { round: r.round, statements: lines, lie });
      await refresh();
    } catch (e2) {
      setErr(adultErrorText(e2));
      onToast(adultErrorText(e2), "bad");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      <h2 className="font-display text-[20px] font-black">{C.truths.write}</h2>
      <p className="text-muted text-[14px]" id="truths-hint">
        {C.truths.writeHint}
      </p>
      {lines.map((l, i) => (
        <div key={i} className="flex items-center gap-2">
          <label className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-[12px]">
            <input
              type="radio"
              name="lie"
              checked={lie === i}
              onChange={() => setLie(i)}
              aria-label={C.truths.markLie(i)}
              className="size-5 accent-[var(--danger)]"
            />
          </label>
          <label htmlFor={`truth-${i}`} className="sr-only">
            {C.truths.statement(i)}
          </label>
          <input
            id={`truth-${i}`}
            value={l}
            maxLength={TEXT_MAX.statement}
            autoComplete="off"
            aria-describedby="truths-hint"
            placeholder={C.truths.statement(i)}
            onChange={(e) => (setLines((x) => x.map((y, j) => (j === i ? e.target.value : y))), setErr(null))}
            className="bg-surface h-12 min-w-0 flex-1 rounded-[14px] px-3.5 text-[16px]"
            style={{ boxShadow: lie === i ? "inset 0 0 0 2px var(--danger)" : "inset 0 0 0 1px var(--line)" }}
          />
        </div>
      ))}
      {err && (
        <p role="alert" className="text-[14px] text-[var(--danger)]">
          {err}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || lines.some((l) => !l.trim()) || lie === null}
        className="toy font-display bg-accent text-on-accent h-[60px] rounded-[20px] text-[17px] font-black [--btn-depth:var(--accent-depth)] disabled:opacity-50"
      >
        {C.truths.submit}
      </button>
    </form>
  );
}

/** Mode line for the lobby card. */
export function adultLobbyLine(mode: AdultMode) {
  return { icon: mode === "draw" ? "paint-brush" : "question", title: C.lobby.line(C.modes[mode].name), sub: C.lobby.sub };
}
