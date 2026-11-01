"use client";

import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/lib/client/api";
import { useProfile } from "@/lib/client/social";
import { TabPage } from "@/components/meta/TabPage";
import { Bar, ErrorState, Hex, ListSkeleton, StatCard } from "@/components/meta/ui";
import { BadgeGrid, Medallion } from "@/components/meta/Badges";
import { SpuzWear } from "@/components/meta/SpuzWear";
import { StatusShare } from "@/components/share/StatusShare";
import { Icon } from "@/components/ui/Icon";
import { GAME_BY_ID, WORLDS, WORLD_BY_ID, type WorldId } from "@/lib/catalog";
import { formatNumber, formatClock, gmtDate } from "@/lib/format";

const CAL: Record<string, { bg: string; icon?: string; label: string }> = {
  full: { bg: "var(--accent)", icon: "star-four", label: "Full Spuzl" },
  played: { bg: "color-mix(in srgb, var(--accent) 45%, var(--surface))", label: "Played" },
  frozen: { bg: "var(--freeze)", icon: "snowflake", label: "Frozen" },
  missed: { bg: "var(--surface-raised)", label: "Missed" },
  future: { bg: "var(--surface)", label: "Ahead" },
};

function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

/** S2 Profile, own: avatar, level, rank per world, streak calendar, badges by family, per-game stats. */
export default function MePage() {
  const thisMonth = gmtDate().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const me = useMe();
  const q = useProfile(month);
  const d = me.data;
  const p = q.data;
  const monthName = new Date(month + "-01T00:00:00Z").toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
  const sub = [p?.place.school, p?.place.city, d?.rank.name].filter(Boolean).join(" · ");

  return (
    <TabPage label="Your profile">
      {!d || q.isPending ? (
        <ListSkeleton rows={6} height={64} />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <>
          <header className="flex items-center gap-3.5">
            <div
              className="bg-surface flex size-24 shrink-0 items-center justify-center rounded-[30px]"
              style={{ boxShadow: `0 0 0 4px ${d.avatar_color}, 0 0 0 8px var(--bg), 0 0 0 10px var(--gold)` }}
            >
              <SpuzWear
                size={86}
                color={d.avatar_color}
                hat={d.hat}
                mood={d.streak.current >= 7 ? "fire" : "idle"}
                still
                label={`${d.nickname}'s Spuz`}
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h1 className="font-display truncate text-[20px] font-black">{d.nickname}</h1>
              {(sub || d.title) && (
                <p className="text-muted truncate text-[14px] font-medium">{[sub, d.title].filter(Boolean).join(" · ")}</p>
              )}
              <div className="flex items-center gap-2">
                <span className="num text-accent text-[13px] font-semibold">Lv {d.level}</span>
                <Bar value={d.xpInto / Math.max(1, d.xpNeed)} label={`${d.xpInto} of ${d.xpNeed} XP to level ${d.level + 1}`} />
              </div>
            </div>
            <Link
              href="/settings"
              aria-label="Edit profile and settings"
              className="press bg-surface-raised flex size-11 shrink-0 items-center justify-center rounded-[14px]"
            >
              <Icon name="pencil-simple" size={20} />
            </Link>
          </header>

          {d.guest && (
            <Link
              href="/settings#account"
              className="bg-surface flex items-center gap-3 rounded-[16px] px-3.5 py-3"
              style={{ boxShadow: "inset 0 0 0 2px var(--line)" }}
            >
              <Icon name="shield-check" size={22} className="text-accent shrink-0" />
              <span className="flex-1 text-[14px] font-medium">Playing as a guest. Sign in to keep your progress on any phone.</span>
              <Icon name="caret-right" size={16} className="text-muted" />
            </Link>
          )}

          <StatusShare />

          <div className="grid grid-cols-3 gap-2">
            <StatCard value={d.streak.current} label="day streak" color="var(--gold)" />
            <StatCard value={formatNumber(p!.clears)} label="clears" />
            <StatCard
              value={p!.duelRating !== null ? formatNumber(Math.round(p!.duelRating)) : "New"}
              label="duel rating"
              color="var(--accent)"
            />
          </div>

          <section aria-label="Rank per world" className="flex flex-col gap-2">
            <h2 className="text-[16px] font-bold">Rank per world</h2>
            <ul className="grid grid-cols-9 gap-1">
              {p!.worlds.map((w) => {
                const world = WORLD_BY_ID[w.world as WorldId];
                const label = w.rank ? `${w.rank.name}${w.rank.division ? ` ${w.rank.division}` : ""}` : "Locked";
                return (
                  <li key={w.world} className="flex flex-col items-center gap-1" aria-label={`${world.name}: ${label}`}>
                    <Hex w={36} h={40} bg={w.rank ? world.color : "var(--line)"}>
                      <Icon
                        name={w.rank ? world.icon : "lock-simple"}
                        size={16}
                        style={{ color: w.rank ? "#0E0F1A" : "var(--text-muted)" }}
                      />
                    </Hex>
                    <span className="text-muted max-w-full truncate text-[10px] font-semibold" aria-hidden>
                      {w.rank ? w.rank.name : "Locked"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-label="Streak calendar" className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-bold">Streak calendar</h2>
              <div className="flex items-center gap-1">
                <button
                  aria-label="Previous month"
                  onClick={() => setMonth(shiftMonth(month, -1))}
                  className="text-muted flex size-11 items-center justify-center"
                >
                  <Icon name="caret-left" size={16} />
                </button>
                <span className="text-muted min-w-[72px] text-center text-[14px] font-medium">{monthName}</span>
                <button
                  aria-label="Next month"
                  disabled={month >= thisMonth}
                  onClick={() => setMonth(shiftMonth(month, 1))}
                  className="text-muted flex size-11 items-center justify-center disabled:opacity-30"
                >
                  <Icon name="caret-right" size={16} />
                </button>
              </div>
            </div>
            <ol className="grid grid-cols-[repeat(16,1fr)] gap-[3px] sm:grid-cols-[repeat(16,1fr)]">
              {p!.calendar.days.map((c) => {
                const s = CAL[c.state];
                return (
                  <li
                    key={c.date}
                    className="flex aspect-square items-center justify-center rounded-[4px]"
                    style={{ background: s.bg, color: "#0E0F1A" }}
                    aria-label={`${Number(c.date.slice(8))} ${monthName}: ${s.label}`}
                  >
                    {s.icon && <Icon name={s.icon} size={9} />}
                  </li>
                );
              })}
            </ol>
            <div className="text-muted flex gap-3 text-[12px] font-medium" aria-hidden>
              {(["full", "played", "frozen"] as const).map((k) => (
                <span key={k} className="flex items-center gap-1">
                  <span className="size-2.5 rounded-[3px]" style={{ background: CAL[k].bg }} />
                  {CAL[k].label}
                </span>
              ))}
            </div>
          </section>

          {p!.pinned.length > 0 && (
            <section aria-label="Latest badges" className="flex flex-col gap-2">
              <div className="flex justify-between">
                <h2 className="text-[16px] font-bold">Latest badges</h2>
                <a href="#badges" className="text-accent text-[14px] font-medium">
                  All {p!.badges.earned}
                </a>
              </div>
              <div className="flex gap-2.5">
                {p!.pinned.map((b) => (
                  <Medallion key={b.id} b={b} />
                ))}
              </div>
            </section>
          )}

          <section aria-label="Your games" className="flex flex-col gap-2">
            <h2 className="text-[16px] font-bold">Your games</h2>
            {p!.games.length === 0 ? (
              <p className="text-muted bg-surface rounded-[16px] px-3.5 py-3 text-[14px]">Clear a puzzle and your best times land here.</p>
            ) : (
              <table className="bg-surface w-full rounded-[16px] text-left">
                <caption className="sr-only">Clears, best and average time per game</caption>
                <thead className="sr-only">
                  <tr>
                    <th>Game</th>
                    <th>Clears</th>
                    <th>Average</th>
                    <th>Best</th>
                  </tr>
                </thead>
                <tbody>
                  {p!.games.slice(0, 12).map((g) => {
                    const meta = GAME_BY_ID[g.game];
                    const w = WORLDS.find((x) => x.id === meta.world)!;
                    const score = meta.scoring === "score";
                    return (
                      <tr key={g.game} className="h-[42px]">
                        <th scope="row" className="py-0 pl-3 font-normal">
                          <span className="flex items-center gap-2.5">
                            <span
                              className="flex size-[26px] shrink-0 items-center justify-center rounded-[8px]"
                              style={{ background: w.color, color: "#0E0F1A" }}
                            >
                              <Icon name={meta.icon} size={14} />
                            </span>
                            <span className="text-[15px] font-semibold">{meta.name}</span>
                          </span>
                        </th>
                        <td className="num text-muted text-right text-[13px] font-medium whitespace-nowrap">{g.clears} clears</td>
                        <td className="num text-muted pl-2 text-right text-[13px] whitespace-nowrap">
                          {score ? "" : `avg ${formatClock(g.avgMs ?? 0)}`}
                        </td>
                        <td className="num w-[64px] pr-3 text-right text-[14px] font-semibold">
                          {score ? formatNumber(g.bestScore ?? 0) : formatClock(g.bestMs ?? 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section id="badges" aria-label="Badges" className="flex scroll-mt-16 flex-col gap-2">
            <h2 className="text-[16px] font-bold">Badges</h2>
            <BadgeGrid data={p!.badges} />
          </section>
        </>
      )}
    </TabPage>
  );
}
