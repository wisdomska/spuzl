"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { GAME_BY_ID } from "@/lib/catalog";
import { dayMonth } from "@/lib/admin/dates";
import { errorText, useAdminAction, useAdminQuery } from "@/lib/client/admin";
import { adminCopy } from "@/lib/copy/admin";
import { PuzzlePreview } from "./PuzzlePreview";
import { StatePill } from "./content-ui";
import { Btn, Empty, Notice, Pill, RowsSkeleton } from "./ui";

export interface Slot {
  slot: {
    date: string;
    game_id: string;
    puzzle_id: string;
    locked: boolean;
    published_at: string | null;
    swapped_from: string | null;
    swapped_at: string | null;
  } | null;
  number: number;
  difficulty: string;
  today: string;
}

const C = adminCopy.dailySlot;

/** A calendar cell opened: the preview when a Daily exists, otherwise a way to fill the gap. */
export function DailySlot({
  game,
  date,
  canWrite,
  canSwap,
  retired = false,
}: {
  game: string;
  date: string;
  canWrite: boolean;
  canSwap: boolean;
  /** Retired game: read-only, with a note saying so. */
  retired?: boolean;
}) {
  const q = useAdminQuery<Slot>(["daily", game, date], `/api/admin/dailies?date=${date}&game=${game}`);
  const gen = useAdminAction<{ date: string; game: string }>("POST", "/api/admin/dailies/regenerate");
  if (q.isPending) return <RowsSkeleton rows={6} height={44} />;
  if (q.error)
    return (
      <div className="p-6">
        <Notice tone="danger" icon="warning">
          {errorText(q.error)}
        </Notice>
      </div>
    );
  const note = retired && (
    <div className="px-6 pt-5">
      <Notice tone="warn" icon="info">
        {adminCopy.retired.slotNote}
      </Notice>
    </div>
  );
  if (q.data.slot)
    return (
      <>
        {note}
        <PuzzlePreview puzzleId={q.data.slot.puzzle_id} game={game} date={date} slot={q.data} canWrite={canWrite} canSwap={canSwap} />
      </>
    );
  const meta = GAME_BY_ID[game];
  return (
    <div className="flex flex-col gap-4 px-4 py-5 md:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/calendar"
          aria-label={C.back}
          className="hover:bg-surface-raised -ml-2 flex size-11 items-center justify-center rounded-[10px]"
        >
          <Icon name="arrow-left" size={20} />
        </Link>
        <h1 className="font-display text-[22px] font-extrabold">
          {meta.name} · {dayMonth(date)}
        </h1>
        <StatePill s={{ ...adminCopy.calendar.cell.missing, tone: "danger", icon: "warning" }} />
        {retired && <Pill tone="neutral">{adminCopy.retired.pill}</Pill>}
      </div>
      {note}
      <div className="bg-surface max-w-[640px] rounded-[16px]">
        <Empty icon="warning">
          <span className="text-text text-[15px] font-semibold">{C.none(meta.name, dayMonth(date), q.data.difficulty)}</span>
          {date > q.data.today ? <span>{C.risk}</span> : <span>{C.past}</span>}
          {canWrite && date > q.data.today && (
            <>
              <Btn tone="primary" size="lg" icon="magic-wand" disabled={gen.isPending} onClick={() => gen.mutate({ date, game })}>
                {gen.isPending ? C.generating : C.generate}
              </Btn>
              <span className="text-[12px]">{C.generateHelp}</span>
            </>
          )}
          <span aria-live="polite" className="text-danger empty:hidden">
            {gen.error ? errorText(gen.error) : ""}
          </span>
        </Empty>
      </div>
    </div>
  );
}
