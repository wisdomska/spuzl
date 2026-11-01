"use client";

import Link from "next/link";
import { use } from "react";
import { useCup } from "@/lib/client/social";
import { HttpError } from "@/lib/client/api";
import { TabPage } from "@/components/meta/TabPage";
import { BackButton, EmptyState, ErrorState, ListSkeleton } from "@/components/meta/ui";
import { CupRows } from "@/components/meta/CupBoard";
import { Icon } from "@/components/ui/Icon";
import { GAME_BY_ID, WORLD_BY_ID } from "@/lib/catalog";
import { formatLeft } from "@/lib/leagues";
import { shortDate } from "@/lib/meta";
import { PLAY_NAV } from "@/lib/analytics/play-nav";

/** School Cup class board on a phone. Teachers get the class code and TV mode. */
export default function CupPage({ params }: PageProps<"/school-cup/[id]">) {
  const { id } = use(params);
  const q = useCup(id, 60_000);
  const c = q.data;
  return (
    <TabPage label="Class board">
      <BackButton href="/school-cup" />
      {q.isError ? (
        q.error instanceof HttpError && q.error.status === 404 ? (
          <EmptyState mood="shocked" title="That class isn't here" body="Ask your teacher for the class code and join from School Cup." />
        ) : (
          <ErrorState onRetry={() => q.refetch()} />
        )
      ) : !c ? (
        <ListSkeleton rows={7} />
      ) : (
        <>
          <header className="flex flex-col gap-1">
            <h1 className="font-display text-[28px] font-black">{c.className}</h1>
            <p className="text-muted text-[15px] font-medium">
              {[c.school, `${c.games.length} ${c.games.length === 1 ? "game" : "games"}`, c.relaxed ? "Relaxed mode" : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </header>
          <div className="flex items-center gap-2">
            {c.games.map((g) => {
              const meta = GAME_BY_ID[g];
              return meta ? (
                <Link
                  key={g}
                  href={`/play/${g}`}
                  {...PLAY_NAV}
                  aria-label={`Play ${meta.name}`}
                  className="press flex size-12 items-center justify-center rounded-[16px]"
                  style={{ background: WORLD_BY_ID[meta.world].color, color: "#0E0F1A" }}
                >
                  <Icon name={meta.icon} size={24} />
                </Link>
              ) : null;
            })}
            <span className="ml-auto flex flex-col items-end">
              <span className="text-muted text-[13px] font-medium">
                {c.startsInMs > 0 ? "Starts in" : c.endsInMs > 0 ? "Ends in" : "Finished"}
              </span>
              <span className="num text-[18px] font-semibold">
                {c.startsInMs > 0 ? formatLeft(c.startsInMs) : c.endsInMs > 0 ? formatLeft(c.endsInMs) : shortDate(c.endsOn ?? c.weekStart)}
              </span>
            </span>
          </div>
          {c.rows.length === 0 ? (
            <EmptyState
              mood="wave"
              title="Nobody's joined yet"
              body={c.code ? `Share the class code ${c.code} with your students.` : undefined}
            />
          ) : (
            <CupRows rows={c.rows} games={c.games.length} />
          )}
          {c.isTeacher && (
            <div className="flex flex-col gap-2.5 pt-2">
              <p className="bg-surface flex items-center justify-between rounded-[16px] px-3.5 py-3 text-[15px] font-semibold">
                Class code
                <span className="font-display text-accent text-[22px] font-black tracking-[0.12em]">{c.code}</span>
              </p>
              <Link
                href={`/school-cup/${c.id}/tv`}
                className="toy bg-accent text-on-accent font-display flex h-14 items-center justify-center gap-2 rounded-[18px] text-[15px] font-extrabold"
                style={{ ["--btn-depth" as string]: "var(--accent-depth)" }}
              >
                <Icon name="television" size={18} />
                TV mode
              </Link>
            </div>
          )}
        </>
      )}
    </TabPage>
  );
}
