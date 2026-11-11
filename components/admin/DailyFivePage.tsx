"use client";

/**
 * Daily Five scheduler (R2-05, admin cascade): each day's five (stored, or a preview of the auto-pick), its source,
 * lock and plays; re-run the auto-pick, pick games by hand, lock a day so the auto-pick never changes it, run the
 * scheduler, and export or import the schedule as JSON. Every action is role-checked and audited on the server.
 */
import Link from "next/link";
import { useState } from "react";
import { addDays, dayMonth, todayIso } from "@/lib/admin/dates";
import { api, HttpError } from "@/lib/client/api";
import { errorText, useAdminAction, useAdminQuery } from "@/lib/client/admin";
import { adminCopy } from "@/lib/copy/admin";
import { FIVE_SLOTS } from "@/lib/daily-five";
import { GAME_BY_ID, WORLD_BY_ID } from "@/lib/catalog";
import { durationWords } from "@/lib/admin/content-words";
import { Icon } from "@/components/ui/Icon";
import { PageHead, StateGuide, StatePill, type StateWords } from "./content-ui";
import { Btn, Field, Notice, RowsSkeleton, Swatch, inputCls, textareaCls } from "./ui";

const C = adminCopy.dailyFive;
const SOURCE: Record<"preview" | "auto" | "manual", StateWords> = {
  preview: { ...C.sources.preview, tone: "neutral", icon: "circle-dashed" },
  auto: { ...C.sources.auto, tone: "ok", icon: "check-circle" },
  manual: { ...C.sources.manual, tone: "warn", icon: "pencil-simple" },
};
const LOCK: Record<"locked" | "open", StateWords> = {
  locked: { ...C.lockStates.locked, tone: "warn", icon: "lock-simple" },
  open: { ...C.lockStates.open, tone: "neutral", icon: "lock-simple-open" },
};
const GUIDE = [SOURCE.preview, SOURCE.auto, SOURCE.manual, LOCK.locked, LOCK.open];

interface Row {
  date: string;
  slot: number;
  kind: "world" | "bonus";
  world: string;
  game_id: string;
  puzzle_id: string;
  source: "auto" | "manual";
  locked: boolean;
  difficulty?: string;
}
interface Day {
  date: string;
  rows: Row[];
  preview: boolean;
  locked: boolean;
  source: "auto" | "manual" | null;
  attempts: number;
}
interface Data {
  today: string;
  from: string;
  to: string;
  enabled: boolean;
  days: Day[];
  games: { id: string; name: string; world: string; typicalSec: number }[];
}
type Action =
  | { action: "auto"; date: string }
  | { action: "manual"; date: string; games: string[] }
  | { action: "lock"; date: string; locked: boolean }
  | { action: "fill" };

const SPAN = 14;

function say(e: unknown): string {
  return e instanceof HttpError ? (C.errors[e.code] ?? errorText(e)) : errorText(e);
}

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DailyFivePage({ canWrite }: { canWrite: boolean }) {
  const [from, setFrom] = useState(todayIso());
  const q = useAdminQuery<Data>(["daily-five", from], `/api/admin/daily-five?from=${from}&days=${SPAN}`, { keepPrevious: true });
  const act = useAdminAction<Action, { made?: number; repicked?: number }>("POST", "/api/admin/daily-five");
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "danger"; text: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const run = (a: Action, done: string | ((r: { made?: number; repicked?: number }) => string)) => {
    setNote(null);
    act.mutate(a, {
      onSuccess: (r) => {
        setNote({ tone: "ok", text: typeof done === "string" ? done : done(r) });
        setEditing(null);
      },
      onError: (e) => setNote({ tone: "danger", text: say(e) }),
    });
  };

  const exportJson = async () => {
    setNote(null);
    try {
      const r = await api<{ filename: string; json: string }>(`/api/admin/daily-five/export?from=${from}&to=${addDays(from, 30)}`);
      download(r.filename, r.json);
    } catch (e) {
      setNote({ tone: "danger", text: say(e) });
    }
  };

  return (
    <div className="flex min-h-dvh flex-col gap-4 px-4 py-5 md:px-6">
      <PageHead
        title={C.title}
        purpose={C.intro}
        aside={
          canWrite && (
            <Btn
              tone="primary"
              title={C.fillHelp}
              disabled={act.isPending}
              onClick={() => run({ action: "fill" }, (r) => C.filled(r.made ?? 0, r.repicked ?? 0))}
            >
              {C.fill}
            </Btn>
          )
        }
      >
        {q.data && (
          <StatePill
            s={
              q.data.enabled
                ? { label: C.on, meaning: C.onMeaning, tone: "ok", icon: "check-circle" }
                : { label: C.off, meaning: C.offMeaning, tone: "warn", icon: "prohibit" }
            }
          />
        )}
        <Link href="/admin/settings" className="text-muted hover:text-text flex min-h-11 items-center text-[13px] font-semibold underline">
          {C.rulesLink}
        </Link>
      </PageHead>
      <div aria-live="polite" className="empty:hidden">
        {note && (
          <Notice tone={note.tone} icon={note.tone === "ok" ? "check-circle" : "warning"}>
            {note.text}
          </Notice>
        )}
      </div>
      <StateGuide states={GUIDE} />
      <div className="flex flex-wrap items-end gap-2">
        <Field label={C.from} htmlFor="d5-from">
          <input
            id="d5-from"
            type="date"
            value={from}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
            className={`${inputCls} num h-11`}
          />
        </Field>
        <Btn size="lg" icon="caret-left" onClick={() => setFrom(addDays(from, -7))}>
          {C.earlier}
        </Btn>
        <Btn size="lg" onClick={() => setFrom(addDays(from, 7))}>
          {C.later}
          <Icon name="caret-right" size={16} />
        </Btn>
      </div>
      <div className="bg-surface overflow-x-auto rounded-[16px]">
        {q.isPending ? (
          <RowsSkeleton rows={8} height={56} />
        ) : q.error ? (
          <div className="p-3">
            <Notice tone="danger" icon="warning">
              {C.loadError} {say(q.error)}
            </Notice>
          </div>
        ) : (
          <table className="w-full min-w-[860px] border-collapse text-[14px]">
            <thead>
              <tr className="bg-surface-raised text-muted text-left text-[12px]">
                {C.head.map((h, i) => (
                  <th key={i} scope="col" className="px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.data.days.map((d) => (
                <DayRow
                  key={d.date}
                  day={d}
                  today={q.data.today}
                  games={q.data.games}
                  canWrite={canWrite}
                  busy={act.isPending}
                  editing={editing === d.date}
                  onEdit={() => setEditing(editing === d.date ? null : d.date)}
                  onSave={(games) => run({ action: "manual", date: d.date, games }, C.saved(d.date))}
                  onAuto={() => run({ action: "auto", date: d.date }, C.saved(d.date))}
                  onLock={(locked) => run({ action: "lock", date: d.date, locked }, locked ? C.lockedNote(d.date) : C.unlockedNote(d.date))}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
      <details
        className="group bg-surface rounded-[16px] px-4 md:px-5"
        open={importOpen}
        onToggle={(e) => setImportOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="flex min-h-12 cursor-pointer items-center gap-2 text-[15px] font-semibold">{C.backup}</summary>
        <div className="flex flex-col gap-3 pb-4">
          <p className="text-muted text-[13px]">{C.backupIntro}</p>
          <Btn icon="download-simple" className="self-start" onClick={() => void exportJson()}>
            {C.exportJson}
          </Btn>
          {canWrite && <ImportPanel onDone={(t) => setNote(t)} />}
        </div>
      </details>
    </div>
  );
}

function DayRow({
  day,
  today,
  games,
  canWrite,
  busy,
  editing,
  onEdit,
  onSave,
  onAuto,
  onLock,
}: {
  day: Day;
  today: string;
  games: Data["games"];
  canWrite: boolean;
  busy: boolean;
  editing: boolean;
  onEdit: () => void;
  onSave: (games: string[]) => void;
  onAuto: () => void;
  onLock: (locked: boolean) => void;
}) {
  const past = day.date < today;
  const frozen = past || day.locked || day.attempts > 0;
  const why = past ? C.why.past : day.attempts > 0 ? C.why.played : day.locked ? C.why.locked : undefined;
  const source = day.preview ? SOURCE.preview : SOURCE[day.source ?? "auto"];
  return (
    <>
      <tr className="border-line border-t align-top" data-testid={`d5-day-${day.date}`}>
        <th scope="row" className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">
          {dayMonth(day.date)}
          {day.date === today && <span className="text-accent ml-1.5 text-[12px]">{C.today}</span>}
        </th>
        <td className="px-3 py-2.5">
          {day.rows.length ? (
            <ol className="flex flex-wrap gap-x-3 gap-y-1">
              {day.rows.map((r) => (
                <li key={r.slot} className="flex items-center gap-1.5">
                  <Swatch world={r.world} />
                  {r.puzzle_id ? (
                    <Link
                      href={`/admin/puzzles/${r.puzzle_id}`}
                      className="hover:underline"
                      aria-label={C.previewPuzzle(GAME_BY_ID[r.game_id]?.name ?? r.game_id)}
                    >
                      {GAME_BY_ID[r.game_id]?.name ?? r.game_id}
                    </Link>
                  ) : (
                    <span>{GAME_BY_ID[r.game_id]?.name ?? r.game_id}</span>
                  )}
                  {r.kind === "bonus" && <span className="text-muted text-[12px]">{C.bonus}</span>}
                  {r.difficulty && <span className="num text-muted text-[12px]">{r.difficulty}</span>}
                </li>
              ))}
            </ol>
          ) : (
            <span className="text-muted">{C.noGames}</span>
          )}
        </td>
        <td className="px-3 py-2.5">
          <StatePill s={source} />
        </td>
        <td className="px-3 py-2.5">
          <StatePill s={day.locked ? LOCK.locked : LOCK.open} />
        </td>
        <td className="num text-muted px-3 py-2.5 text-right">{C.played(day.attempts)}</td>
        <td className="px-3 py-2.5">
          {canWrite && !past && (
            <div className="flex flex-col items-end gap-1">
              <div className="flex flex-wrap justify-end gap-1.5">
                <Btn size="sm" disabled={busy || frozen} title={why ?? C.repickHelp} onClick={onAuto}>
                  {C.repick}
                </Btn>
                <Btn size="sm" disabled={busy || frozen} title={why} onClick={onEdit} aria-expanded={editing}>
                  {C.edit}
                </Btn>
                <Btn size="sm" tone={day.locked ? "secondary" : "primary"} disabled={busy} onClick={() => onLock(!day.locked)}>
                  {day.locked ? C.unlock : C.lock}
                </Btn>
              </div>
              {why && <span className="text-muted max-w-[260px] text-right text-[12px]">{why}</span>}
            </div>
          )}
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={6} className="bg-bg px-3 py-3">
            <PickForm
              date={day.date}
              initial={day.rows.map((r) => r.game_id)}
              games={games}
              busy={busy}
              onSave={onSave}
              onCancel={onEdit}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function PickForm({
  date,
  initial,
  games,
  busy,
  onSave,
  onCancel,
}: {
  date: string;
  initial: string[];
  games: Data["games"];
  busy: boolean;
  onSave: (games: string[]) => void;
  onCancel: () => void;
}) {
  const [picks, setPicks] = useState<string[]>(() => Array.from({ length: FIVE_SLOTS }, (_, i) => initial[i] ?? ""));
  const valid = picks.every(Boolean) && new Set(picks).size === FIVE_SLOTS;
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave(picks);
      }}
    >
      {picks.map((p, i) => (
        <Field key={i} label={C.slot(i + 1)} htmlFor={`d5-${date}-${i}`}>
          <select
            id={`d5-${date}-${i}`}
            value={p}
            onChange={(e) => setPicks((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))}
            className={`${inputCls} w-44`}
          >
            <option value="">{C.slotEmpty}</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {C.gameOption(
                  g.name,
                  (WORLD_BY_ID as Record<string, { name: string } | undefined>)[g.world]?.name ?? g.world,
                  durationWords(g.typicalSec),
                )}
              </option>
            ))}
          </select>
        </Field>
      ))}
      <Btn type="submit" size="lg" tone="primary" disabled={busy || !valid}>
        {C.save}
      </Btn>
      <Btn size="lg" onClick={onCancel}>
        {C.cancel}
      </Btn>
      {!valid && <p className="text-muted w-full text-[13px]">{C.errors.five_games}</p>}
    </form>
  );
}

function ImportPanel({ onDone }: { onDone: (n: { tone: "ok" | "danger"; text: string }) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const send = async (dryRun: boolean) => {
    setBusy(true);
    setErrors([]);
    try {
      const r = await api<{ valid: number; saved: string[]; skipped: { date: string; reason: string }[] }>("/api/admin/daily-five/import", {
        json: { json: text, dryRun },
      });
      onDone({ tone: "ok", text: dryRun ? C.importValid(r.valid) : C.imported(r.saved.length, r.skipped.length) });
    } catch (e) {
      onDone({ tone: "danger", text: say(e) });
      // The 422 body lists every problem; read it again for the list (api() keeps only the code and message).
      if (e instanceof HttpError && e.code === "invalid_schedule") {
        const res = await fetch("/api/admin/daily-five/import", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ json: text, dryRun: true }),
        });
        const b = (await res.json().catch(() => null)) as { errors?: string[] } | null;
        setErrors(b?.errors ?? []);
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="bg-surface flex flex-col gap-2 rounded-[12px] p-4">
      <Field label={C.importLabel} htmlFor="d5-import" hint={C.importHelp}>
        <textarea id="d5-import" rows={8} value={text} onChange={(e) => setText(e.target.value)} className={`${textareaCls} num`} />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <label className="bg-surface-raised hover:bg-line flex h-10 cursor-pointer items-center rounded-[10px] px-3 text-[13px] font-semibold">
          {C.chooseFile}
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setText(await f.text());
            }}
          />
        </label>
        <Btn disabled={busy || !text} onClick={() => void send(true)}>
          {C.check}
        </Btn>
        <Btn tone="primary" disabled={busy || !text} onClick={() => void send(false)}>
          {C.importNow}
        </Btn>
      </div>
      {errors.length > 0 && (
        <ul className="text-danger list-disc pl-5 text-[13px]">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
