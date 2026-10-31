"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { WORLDS } from "@/lib/catalog";
import { addDays, isoWeek, mondayOf, shortDay, todayIso, weekRange } from "@/lib/admin/dates";
import { errorText, useAdminAction, useAdminQuery } from "@/lib/client/admin";
import { Btn, Notice, PageTitle, RowsSkeleton, Swatch } from "./ui";

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

const SHORT: Record<string, string> = { easy: "easy", medium: "med", hard: "hard", expert: "expert", mega: "mega" };
const CELL = {
  verified: { icon: "check-circle", cls: "bg-[var(--admin-ok-tint)] text-accent", label: "Scheduled, solver verified" },
  review: { icon: "eye", cls: "bg-[var(--warn-tint)] text-gold", label: "Needs review" },
  missing: { icon: "warning", cls: "bg-[var(--danger-tint)] text-danger", label: "Missing" },
} as const;

/** Content calendar (design: Admin calendar). One week of Dailies per game: verified, needs review or missing. */
export function CalendarView({ canWrite }: { canWrite: boolean }) {
  const [week, setWeek] = useState(() => todayIso());
  const [world, setWorld] = useState("");
  const q = useAdminQuery<Calendar>(["calendar", week, world], `/api/admin/calendar?week=${week}${world ? `&world=${world}` : ""}`);
  const fill = useAdminAction<{ days: number }, { made: number; pending: number }>("POST", "/api/admin/dailies/fill");
  const lock = useAdminAction<{ through: string }, { locked: number }>("POST", "/api/admin/dailies/lock");
  const from = q.data?.from;

  return (
    <div className="flex flex-col gap-3.5 px-6 py-5">
      <PageTitle
        title="Content calendar"
        aside={
          <>
            <label className="bg-surface-raised flex h-9 items-center gap-1.5 rounded-[10px] pl-3 text-[13px] font-semibold">
              <Icon name="funnel" size={14} />
              <span className="sr-only">World</span>
              <select
                value={world}
                onChange={(e) => setWorld(e.target.value)}
                style={{ fontSize: 13 }}
                className="h-9 cursor-pointer appearance-none bg-transparent pr-3 font-semibold outline-none"
              >
                <option value="">All worlds</option>
                {WORLDS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            {canWrite && (
              <>
                <Btn
                  size="sm"
                  icon="lock-simple"
                  disabled={lock.isPending}
                  onClick={() => lock.mutate({ through: addDays(todayIso(), 7) })}
                >
                  Lock next 7 days
                </Btn>
                <Btn size="sm" tone="primary" icon="magic-wand" disabled={fill.isPending} onClick={() => fill.mutate({ days: 21 })}>
                  {fill.isPending ? "Generating" : "Generate gaps"}
                </Btn>
              </>
            )}
          </>
        }
      >
        <span className="text-muted text-[14px] font-medium">{from ? `Week ${isoWeek(from)} · ${weekRange(from)}` : " "}</span>
        <div className="flex">
          <Btn
            size="sm"
            tone="ghost"
            icon="caret-left"
            aria-label="Previous week"
            className="px-0"
            onClick={() => setWeek(addDays(from ?? week, -7))}
          />
          <Btn
            size="sm"
            tone="ghost"
            icon="caret-right"
            aria-label="Next week"
            className="px-0"
            onClick={() => setWeek(addDays(from ?? week, 7))}
          />
          {from && from !== mondayOf(todayIso()) && (
            <Btn size="sm" tone="ghost" onClick={() => setWeek(todayIso())}>
              This week
            </Btn>
          )}
        </div>
      </PageTitle>

      <div aria-live="polite" className="empty:hidden">
        {fill.data && (
          <Notice tone="ok" icon="check-circle">
            Generated {fill.data.made} Dailies{fill.data.pending ? `, ${fill.data.pending} still to do (run again)` : ""}.
          </Notice>
        )}
        {lock.data && (
          <Notice tone="ok" icon="lock-simple">
            Locked {lock.data.locked} Dailies through {shortDay(addDays(todayIso(), 7))}.
          </Notice>
        )}
        {(fill.error || lock.error) && (
          <Notice tone="danger" icon="warning">
            {errorText(fill.error ?? lock.error)}
          </Notice>
        )}
      </div>

      <div className="bg-surface overflow-x-auto rounded-[12px]">
        {q.isPending ? (
          <RowsSkeleton rows={12} height={32} />
        ) : q.error ? (
          <div className="p-3">
            <Notice tone="danger" icon="warning">
              {errorText(q.error)}
            </Notice>
          </div>
        ) : (
          <table className="w-full min-w-[860px] table-fixed border-collapse text-[13px] font-medium">
            <caption className="sr-only">Dailies per game for the week</caption>
            <colgroup>
              <col className="w-[150px]" />
            </colgroup>
            <thead>
              <tr className="bg-surface-raised">
                <th scope="col" className="num text-muted p-2.5 text-left text-[12px] font-semibold">
                  Game
                </th>
                {q.data.days.map((d) => (
                  <th
                    key={d}
                    scope="col"
                    className={`num p-2.5 text-left text-[12px] font-semibold ${d === q.data.today ? "text-accent" : "text-muted"}`}
                  >
                    {shortDay(d)}
                    {d === q.data.today && <span className="sr-only"> (today)</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.data.rows.map((r) => (
                <tr key={r.game}>
                  <th scope="row" className="border-line border-t px-2.5 py-2 text-left">
                    <span className="flex items-center gap-2">
                      <Swatch world={r.world} />
                      <span className="truncate text-[13px] font-semibold">{r.name}</span>
                    </span>
                  </th>
                  {r.cells.map((c) => {
                    const s = CELL[c.state];
                    const text = c.state === "missing" ? "missing" : (SHORT[c.difficulty ?? ""] ?? c.difficulty);
                    return (
                      <td key={c.date} className="border-line border-t border-l p-1.5">
                        <Link
                          href={`/admin/calendar/${r.game}/${c.date}`}
                          aria-label={`${r.name} ${shortDay(c.date)}: ${s.label}${c.difficulty ? `, ${c.difficulty}` : ""}${c.locked ? ", locked" : ""}${c.swapped ? ", swapped" : ""}`}
                          className={`num flex h-[26px] items-center gap-1 rounded-[7px] px-2 text-[12px] font-semibold hover:brightness-125 ${s.cls}`}
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

      <div className="text-muted flex flex-wrap gap-4 text-[13px] font-medium">
        {(["verified", "review", "missing"] as const).map((k) => (
          <span key={k} className="flex items-center gap-1">
            <Icon
              name={CELL[k].icon}
              size={14}
              className={k === "verified" ? "text-accent" : k === "review" ? "text-gold" : "text-danger"}
            />
            {CELL[k].label}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <Icon name="lock-simple" size={14} />
          Locked
        </span>
        <span className="flex items-center gap-1">
          <Icon name="swap" size={14} />
          Swapped
        </span>
      </div>
    </div>
  );
}
