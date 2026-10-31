"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { GAME_BY_ID } from "@/lib/catalog";
import { dayMonth } from "@/lib/admin/dates";
import { errorText, useAdminAction, useAdminQuery } from "@/lib/client/admin";
import { PuzzlePreview } from "./PuzzlePreview";
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

/** A calendar cell opened: the preview when a Daily exists, otherwise a way to fill the gap. */
export function DailySlot({ game, date, canWrite, canSwap }: { game: string; date: string; canWrite: boolean; canSwap: boolean }) {
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
  if (q.data.slot)
    return <PuzzlePreview puzzleId={q.data.slot.puzzle_id} game={game} date={date} slot={q.data} canWrite={canWrite} canSwap={canSwap} />;
  const meta = GAME_BY_ID[game];
  return (
    <div className="flex flex-col gap-4 px-6 py-5">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/calendar"
          aria-label="Back to the calendar"
          className="hover:bg-surface-raised -ml-2 flex size-11 items-center justify-center rounded-[10px]"
        >
          <Icon name="arrow-left" size={20} />
        </Link>
        <h1 className="font-display text-[20px] font-extrabold">
          {meta.name} · {dayMonth(date)}
        </h1>
        <Pill tone="danger">missing</Pill>
      </div>
      <div className="bg-surface max-w-[640px] rounded-[12px]">
        <Empty icon="warning">
          <span>
            No Daily is scheduled for {meta.name} on {dayMonth(date)} ({q.data.difficulty}).
          </span>
          {canWrite && date > q.data.today && (
            <Btn tone="primary" icon="magic-wand" disabled={gen.isPending} onClick={() => gen.mutate({ date, game })}>
              {gen.isPending ? "Generating" : "Generate a verified puzzle"}
            </Btn>
          )}
          {gen.error && <span className="text-danger">{errorText(gen.error)}</span>}
        </Empty>
      </div>
    </div>
  );
}
