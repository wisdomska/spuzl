"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useArchive, type ArchiveRes } from "@/lib/client/social";
import { TabPage } from "@/components/meta/TabPage";
import { BackButton, ErrorState, Segmented } from "@/components/meta/ui";
import { Sheet } from "@/components/meta/Sheet";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { GAME_BY_ID, LAUNCH_IDS, WORLDS, WORLD_BY_ID, gamesInWorld } from "@/lib/catalog";
import { LAUNCH_DATE, formatShort, gmtDate } from "@/lib/format";
import { monthGrid, shortDate } from "@/lib/meta";
import { difficultyForDate } from "@/games/types";

type Day = ArchiveRes["days"][number];
const DOW = ["M", "T", "W", "T", "F", "S", "S"];
const DIFFS = ["easy", "medium", "hard", "expert"] as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function shift(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 7);
}

/** K2 Practice and Archive: endless practice, or replay a past Daily. Last 7 days free; older dates are SPUZL+. */
export default function ArchivePage() {
  return (
    <Suspense>
      <Archive />
    </Suspense>
  );
}

function Archive() {
  const params = useSearchParams();
  const today = gmtDate();
  const thisMonth = today.slice(0, 7);
  const [game, setGame] = useState(params.get("game") && GAME_BY_ID[params.get("game")!] ? params.get("game")! : (LAUNCH_IDS[0] ?? "crownfall"));
  const [tab, setTab] = useState<"practice" | "archive">(params.get("tab") === "practice" ? "practice" : "archive");
  const [month, setMonth] = useState(thisMonth);
  const [sel, setSel] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const q = useArchive(game, month);
  const meta = GAME_BY_ID[game];
  const world = WORLD_BY_ID[meta.world];
  const [y, m] = month.split("-").map(Number);
  const grid = monthGrid(y, m - 1);
  const byDate = new Map((q.data?.days ?? []).map((d) => [d.date, d]));
  const selDay: Day | undefined = sel ? byDate.get(sel) : undefined;
  const monthName = new Date(month + "-01T00:00:00Z").toLocaleDateString("en-GB", { month: "long", year: month.slice(0, 4) === thisMonth.slice(0, 4) ? undefined : "numeric", timeZone: "UTC" });

  return (
    <TabPage label="Practice and Archive">
      <div className="flex items-center gap-3">
        <BackButton />
        <button
          onClick={() => setPicking(true)}
          aria-haspopup="dialog"
          aria-label={`${meta.name}. Pick another game`}
          className="font-display flex min-w-0 items-center gap-2 text-[22px] font-black"
        >
          <span className="world-text truncate" style={{ ["--wc" as string]: world.color, ["--wi" as string]: world.ink }}>
            {meta.name}
          </span>
          <Icon name="caret-down" size={18} className="text-muted" />
        </button>
      </div>
      <Segmented
        label="Mode"
        items={[
          { id: "practice", label: "Practice" },
          { id: "archive", label: "Archive" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "practice" ? (
        <section aria-label="Practice" className="flex flex-col gap-2.5">
          <p className="text-muted text-[15px]">Endless fresh puzzles. 10 XP and 5 Sparks a clear, never on the boards.</p>
          {DIFFS.map((d) => (
            <Link
              key={d}
              href={`/play/${game}?mode=free&difficulty=${d}`}
              className="press bg-surface flex h-14 items-center justify-between rounded-[16px] px-4 text-[16px] font-semibold"
            >
              {cap(d)}
              <Icon name="play" size={18} className="text-accent" />
            </Link>
          ))}
        </section>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <button aria-label="Previous month" disabled={month <= LAUNCH_DATE.slice(0, 7)} onClick={() => setMonth(shift(month, -1))} className="flex size-11 items-center justify-center disabled:opacity-30">
              <Icon name="caret-left" size={20} />
            </button>
            <h2 className="font-display text-[17px] font-extrabold">{monthName}</h2>
            <button aria-label="Next month" disabled={month >= thisMonth} onClick={() => setMonth(shift(month, 1))} className="flex size-11 items-center justify-center disabled:opacity-30">
              <Icon name="caret-right" size={20} />
            </button>
          </div>
          <div role="grid" aria-label={`${meta.name} Dailies, ${monthName}`} className="grid grid-cols-7 gap-1.5">
            {DOW.map((d, i) => (
              <span key={i} aria-hidden className="text-muted text-center text-[12px] font-semibold">
                {d}
              </span>
            ))}
            {q.isPending
              ? grid.map((d, i) => (d ? <Skeleton key={i} className="aspect-square rounded-[12px]" /> : <span key={i} />))
              : grid.map((date, i) => {
                  if (!date) return <span key={i} aria-hidden />;
                  const d = byDate.get(date);
                  if (!d) return <span key={i} />;
                  return <DayCell key={date} d={d} color={world.color} selected={sel === date} onPick={() => setSel(date)} />;
                })}
          </div>
          {q.isError && <ErrorState onRetry={() => q.refetch()} />}
          <div className="text-muted flex flex-wrap gap-3 text-[13px] font-medium" aria-hidden>
            <span className="flex items-center gap-1">
              <Icon name="check-circle" size={14} style={{ color: world.color }} />
              Cleared
            </span>
            <span className="flex items-center gap-1">
              <Icon name="circle-half" size={14} />
              Started
            </span>
            <span className="flex items-center gap-1">
              <Icon name="circle" size={14} />
              Missed
            </span>
            <span className="flex items-center gap-1">
              <Icon name="lock-simple" size={14} />
              SPUZL+
            </span>
          </div>
          {selDay && <DayCard d={selDay} game={game} />}
        </>
      )}

      <Sheet open={picking} onOpenChange={setPicking} title="Pick a game">
        <div className="flex flex-col gap-3">
          {WORLDS.map((w) => (
            <section key={w.id} aria-label={w.name} className="flex flex-col gap-1.5">
              <h3 className="text-muted px-1 text-[13px] font-semibold">{w.name}</h3>
              <div className="grid grid-cols-2 gap-1.5">
                {gamesInWorld(w.id).map((g) => (
                  <button
                    key={g.id}
                    aria-pressed={game === g.id}
                    onClick={() => {
                      setGame(g.id);
                      setSel(null);
                      setPicking(false);
                    }}
                    className="press flex h-11 items-center gap-2 rounded-[12px] px-2.5 text-left text-[14px] font-semibold"
                    style={{ background: game === g.id ? "var(--success-tint)" : "var(--surface-raised)" }}
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-[8px]" style={{ background: w.color, color: "#0E0F1A" }}>
                      <Icon name={g.icon} size={14} />
                    </span>
                    <span className="truncate">{g.name}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Sheet>
    </TabPage>
  );
}

function DayCell({ d, color, selected, onPick }: { d: Day; color: string; selected: boolean; onPick: () => void }) {
  const n = Number(d.date.slice(8));
  const isToday = d.access === "today";
  const locked = d.access === "locked";
  const future = d.access === "future" || d.access === "before";
  const cleared = d.state === "cleared";
  const icon = isToday ? "play" : locked && !cleared ? "lock-simple" : cleared ? "check-circle" : d.state === "started" ? "circle-half" : "circle";
  const status = isToday ? "today" : future ? "not yet" : cleared ? "cleared" : locked ? "locked, SPUZL+" : d.state;
  return (
    <button
      role="gridcell"
      aria-label={`${shortDate(d.date)}, ${status}`}
      aria-selected={selected}
      disabled={future}
      onClick={onPick}
      className="flex aspect-square flex-col items-center justify-center gap-px rounded-[12px]"
      style={{
        background: isToday ? color : cleared ? `color-mix(in srgb, ${color} 22%, var(--surface))` : "var(--surface)",
        color: isToday ? "#0E0F1A" : "var(--text)",
        boxShadow: selected ? "inset 0 0 0 2px var(--accent)" : undefined,
        opacity: future ? 0.35 : locked && !cleared ? 0.6 : 1,
      }}
    >
      <span className="num text-[14px] font-semibold">{n}</span>
      <Icon name={icon} size={11} />
    </button>
  );
}

function DayCard({ d, game }: { d: Day; game: string }) {
  const diff = cap(difficultyForDate(d.date));
  const label = d.state === "cleared" ? `Cleared${d.timeMs ? ` in ${formatShort(d.timeMs)}` : ""}` : d.state === "started" ? "Started" : "Missed";
  if (d.access === "today")
    return (
      <div className="bg-surface flex flex-col gap-2.5 rounded-[20px] p-3.5">
        <div className="flex justify-between">
          <span className="text-[16px] font-bold">Today · {diff}</span>
          <span className="text-muted text-[14px] font-medium">{label === "Missed" ? "Not played" : label}</span>
        </div>
        <Link
          href={`/play/${game}`}
          className="toy bg-accent text-on-accent font-display flex h-[52px] items-center justify-center rounded-[16px] text-[15px] font-extrabold"
          style={{ ["--btn-depth" as string]: "var(--accent-depth)" }}
        >
          Play today&apos;s Daily
        </Link>
      </div>
    );
  return (
    <div className="bg-surface flex flex-col gap-2.5 rounded-[20px] p-3.5">
      <div className="flex justify-between">
        <span className="text-[16px] font-bold">
          {shortDate(d.date)} · {diff}
        </span>
        <span className="text-muted text-[14px] font-medium">{label}</span>
      </div>
      {d.access === "locked" ? (
        <>
          <p className="text-muted text-[14px]">Dailies older than 7 days arrive with SPUZL+. The last 7 days are always free.</p>
          <span className="bg-surface-raised text-muted font-display flex h-[52px] items-center justify-center gap-2 rounded-[16px] text-[15px] font-extrabold">
            <Icon name="lock-simple" size={18} />
            SPUZL+
          </span>
        </>
      ) : (
        <>
          <p className="text-muted text-[14px]">Archive clears earn half XP and no Sparks. They never count for streaks, ratings or boards.</p>
          <Link
            href={`/play/${game}?mode=archive&date=${d.date}`}
            className="toy bg-accent text-on-accent font-display flex h-[52px] items-center justify-center rounded-[16px] text-[15px] font-extrabold"
            style={{ ["--btn-depth" as string]: "var(--accent-depth)" }}
          >
            {d.state === "cleared" ? `Replay ${shortDate(d.date).slice(4)}` : `Play ${shortDate(d.date).slice(4)}`}
          </Link>
        </>
      )}
    </div>
  );
}
