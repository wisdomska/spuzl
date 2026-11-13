"use client";

import { SortHead } from "./SortHeader";
import { sortBy, useLocalSort } from "./useLocalSort";
import type { SortSpec } from "@/lib/admin/sorting";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { WORLDS } from "@/lib/catalog";
import { addDays, isoWeek, mondayOf, shortDay, todayIso, weekRange } from "@/lib/admin/dates";
import { errorText, useAdminAction, useAdminQuery } from "@/lib/client/admin";
import { adminCopy } from "@/lib/copy/admin";
import { PageHead, StateGuide, type StateWords } from "./content-ui";
import { Btn, Notice, RowsSkeleton, Swatch } from "./ui";
import { Select } from "@/components/ui/Select";

interface Cell {
  date: string;
  state: "verified" | "review" | "missing";
  puzzleId?: string;
  difficulty?: string | null;
  locked?: boolean;
  swapped?: boolean;
}
interface Calendar {
  from: string;
  days: string[];
  today: string;
  rows: { game: string; name: string; world: string; cells: Cell[] }[];
}

const C = adminCopy.calendar;
const SHORT: Record<string, string> = C.short;
const CELL = {
  verified: { icon: "check-circle", cls: "bg-[var(--admin-ok-tint)] text-accent", ...C.cell.verified },
  review: { icon: "hourglass", cls: "bg-[var(--warn-tint)] text-gold", ...C.cell.review },
  missing: { icon: "warning", cls: "bg-[var(--danger-tint)] text-danger", ...C.cell.missing },
} as const;
/** A day column sorts the games that need attention first. */
const STATE_RANK: Record<string, number> = { missing: 0, review: 1, verified: 2 };
const CAL_SORT: SortSpec<string> = { keys: [], default: "game", dir: "asc" };

const GUIDE: StateWords[] = [
  { ...C.cell.verified, tone: "ok", icon: "check-circle" },
  { ...C.cell.review, tone: "warn", icon: "hourglass" },
  { ...C.cell.missing, tone: "danger", icon: "warning" },
  { ...C.lockedState, tone: "neutral", icon: "lock-simple" },
  { ...C.swappedState, tone: "neutral", icon: "swap" },
];

/** Daily calendar (design: Admin calendar). One week of Dailies per game: ready, needs review or missing. */
export function CalendarView({ canWrite }: { canWrite: boolean }) {
  const [week, setWeek] = useState(() => todayIso());
  const [world, setWorld] = useState("");
  // Sort by game name, or by a day (puzzles needing attention first) (owner, 13 Nov 2026).
  const sort = useLocalSort(CAL_SORT);
  const q = useAdminQuery<Calendar>(["calendar", week, world], `/api/admin/calendar?week=${week}${world ? `&world=${world}` : ""}`);
  const fill = useAdminAction<{ days: number }, { made: number; pending: number }>("POST", "/api/admin/dailies/fill");
  const lock = useAdminAction<{ through: string }, { locked: number }>("POST", "/api/admin/dailies/lock");
  const from = q.data?.from;
  const totals = useMemo(() => {
    const t = { verified: 0, review: 0, missing: 0 };
    for (const r of q.data?.rows ?? []) for (const c of r.cells) t[c.state]++;
    return t;
  }, [q.data]);

  return (
    <div className="flex flex-col gap-4 px-4 py-5 md:px-6">
      <PageHead
        title={C.title}
        purpose={C.intro}
        aside={
          canWrite && (
            <>
              <Btn
                icon="lock-simple"
                title={C.lockHelp}
                disabled={lock.isPending}
                onClick={() => lock.mutate({ through: addDays(todayIso(), 7) })}
              >
                {C.lock}
              </Btn>
              <Btn
                tone="primary"
                icon="magic-wand"
                title={C.generateHelp}
                disabled={fill.isPending}
                onClick={() => fill.mutate({ days: 21 })}
              >
                {fill.isPending ? C.generating : C.generate}
              </Btn>
            </>
          )
        }
      />
      {canWrite && (
        <p className="text-muted -mt-2 text-[13px]">
          <b className="text-text font-semibold">{C.generate}:</b> {C.generateHelp} <b className="text-text font-semibold">{C.lock}:</b>{" "}
          {C.lockHelp}
        </p>
      )}

      <div aria-live="polite" className="empty:hidden">
        {fill.data && (
          <Notice tone="ok" icon="check-circle">
            {C.generated(fill.data.made, fill.data.pending)}
          </Notice>
        )}
        {lock.data && (
          <Notice tone="ok" icon="lock-simple">
            {C.locked(lock.data.locked, shortDay(addDays(todayIso(), 7)))}
          </Notice>
        )}
        {(fill.error || lock.error) && (
          <Notice tone="danger" icon="warning">
            {errorText(fill.error ?? lock.error)}
          </Notice>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center">
          <Btn tone="ghost" icon="caret-left" aria-label={C.prev} onClick={() => setWeek(addDays(from ?? week, -7))} />
          <span className="num min-w-[150px] text-center text-[14px] font-semibold">
            {from ? C.week(isoWeek(from), weekRange(from)) : " "}
          </span>
          <Btn tone="ghost" icon="caret-right" aria-label={C.next} onClick={() => setWeek(addDays(from ?? week, 7))} />
        </div>
        {from && from !== mondayOf(todayIso()) && (
          <Btn tone="ghost" onClick={() => setWeek(todayIso())}>
            {C.thisWeek}
          </Btn>
        )}
        <Select
          aria-label={C.world}
          value={world}
          onValueChange={setWorld}
          options={[
            { value: "", label: C.allWorlds },
            ...WORLDS.map((w) => ({
              value: w.id,
              textValue: w.name,
              label: (
                <span className="flex items-center gap-2">
                  <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: `var(--w-${w.id})` }} />
                  {w.name}
                </span>
              ),
            })),
          ]}
          className="ml-auto h-11 w-44 font-semibold"
        />
      </div>

      {q.data && (
        <Notice
          tone={totals.missing ? "danger" : totals.review ? "warn" : "ok"}
          icon={totals.missing || totals.review ? "info" : "check-circle"}
        >
          {totals.missing || totals.review ? C.summary(totals.verified, totals.review, totals.missing) : C.allGood}
        </Notice>
      )}

      <div className="bg-surface relative overflow-x-auto rounded-[16px]">
        {q.isPending ? (
          <RowsSkeleton rows={12} height={32} />
        ) : q.error ? (
          <div className="p-3">
            <Notice tone="danger" icon="warning">
              {C.loadError} {errorText(q.error)}
            </Notice>
          </div>
        ) : (
          <table className="w-full min-w-[860px] table-fixed border-collapse text-[13px] font-medium">
            <caption className="sr-only">{C.caption}</caption>
            <colgroup>
              <col className="w-[150px]" />
            </colgroup>
            <SortHead
              cols={[
                { label: adminCopy.common.game, sort: "game" },
                ...q.data.days.map((d) => ({
                  label: `${shortDay(d)}${d === q.data.today ? ` (${C.today})` : ""}`,
                  sort: d,
                  className: d === q.data.today ? "text-accent" : "",
                })),
              ]}
              sort={sort}
            />
            <tbody>
              {sortBy(q.data.rows, sort, (r, k) =>
                k === "game" ? r.name : STATE_RANK[r.cells.find((c) => c.date === k)?.state ?? "verified"],
              ).map((r) => (
                <tr key={r.game}>
                  <th scope="row" className="border-line border-t px-2.5 py-2 text-left">
                    <span className="flex items-center gap-2">
                      <Swatch world={r.world} />
                      <span className="truncate text-[13px] font-semibold">{r.name}</span>
                    </span>
                  </th>
                  {r.cells.map((c) => {
                    const s = CELL[c.state];
                    const text = c.state === "missing" ? C.missingShort : (SHORT[c.difficulty ?? ""] ?? c.difficulty);
                    return (
                      <td key={c.date} className="border-line border-t border-l p-1.5">
                        <Link
                          href={`/admin/calendar/${r.game}/${c.date}`}
                          aria-label={C.cellAria(r.name, shortDay(c.date), s.label, c.difficulty, c.locked, c.swapped)}
                          title={s.meaning}
                          className={`num flex h-8 items-center gap-1 rounded-[7px] px-2 text-[12px] font-semibold hover:brightness-125 ${s.cls}`}
                        >
                          <Icon name={s.icon} size={12} />
                          <span className="truncate">{text}</span>
                          {(c.locked || c.swapped) && (
                            <span className="ml-auto flex items-center gap-0.5 opacity-70">
                              {c.swapped && <Icon name="swap" size={11} />}
                              {c.locked && <Icon name="lock-simple" size={11} />}
                            </span>
                          )}
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ul aria-label={adminCopy.contentCommon.guide} className="text-muted flex flex-wrap gap-4 text-[13px] font-medium">
        {GUIDE.map((g) => (
          <li key={g.label} className="flex items-center gap-1" title={g.meaning}>
            <Icon
              name={g.icon ?? "info"}
              size={14}
              className={g.tone === "ok" ? "text-accent" : g.tone === "warn" ? "text-gold" : g.tone === "danger" ? "text-danger" : ""}
            />
            {g.label}
          </li>
        ))}
      </ul>
      <StateGuide states={GUIDE} />
    </div>
  );
}
