"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useBoard, type BoardRes, type BoardRow } from "@/lib/client/social";
import { TabPage } from "@/components/meta/TabPage";
import { AvatarChip, EmptyState, ErrorState, ListSkeleton, PageTitle, PillTabs } from "@/components/meta/ui";
import { Sheet } from "@/components/meta/Sheet";
import { Icon } from "@/components/ui/Icon";
import { GAME_BY_ID, LAUNCH_IDS, WORLDS, gamesInWorld } from "@/lib/catalog";
import { SCOPES, SCOPE_LABEL, addDays, shortDate, type Scope } from "@/lib/meta";
import { formatNumber, formatShort, gmtDate } from "@/lib/format";
import { ordinal } from "@/lib/leagues";

const NEEDS: Record<NonNullable<BoardRes["needs"]>, { title: string; body: string; href: string; cta: string }> = {
  crew: { title: "No crew yet", body: "Start one or join with a code, then race your crew every day.", href: "/crews", cta: "Find a crew" },
  school: { title: "No school board yet", body: "Join your class challenge with the code your teacher shares.", href: "/school-cup", cta: "Enter a class code" },
  city: { title: "Add your city", body: "Pick your city in Settings to see who's fastest near you.", href: "/settings#place", cta: "Open Settings" },
  country: { title: "Add your country", body: "Pick your country in Settings to see your country's board.", href: "/settings#place", cta: "Open Settings" },
};

function valueText(r: BoardRow, scoring: BoardRes["scoring"]) {
  if (scoring === "score") return `${formatNumber(r.value)}`;
  if (scoring === "overall") return `${r.clears} · ${formatShort(r.timeMs)}`;
  return formatShort(r.value);
}
function valueLabel(r: BoardRow, scoring: BoardRes["scoring"]) {
  if (scoring === "score") return `${formatNumber(r.value)} points`;
  if (scoring === "overall") return `${r.clears} clears, ${formatShort(r.timeMs)} total`;
  return `time ${formatShort(r.value)}`;
}

/** S1 Leaderboards: per game per day and overall; friends, crew, school, city, country, global; "you" pinned. */
export default function LeaderboardsPage() {
  const today = gmtDate();
  const [scope, setScope] = useState<Scope>("friends");
  const [game, setGame] = useState<string>(LAUNCH_IDS[0] ?? "crownfall");
  const [date, setDate] = useState(today);
  const [picking, setPicking] = useState(false);
  const q = useBoard(game, scope, date);
  const d = q.data;
  const meta = game === "overall" ? null : GAME_BY_ID[game];
  const world = meta ? WORLDS.find((w) => w.id === meta.world)! : null;
  const rows = d?.rows ?? [];
  const podium = rows.length >= 3 ? rows.slice(0, 3) : [];
  const list = rows.length >= 3 ? rows.slice(3) : rows;
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  // Pin "you" only while your own row is off screen.
  const listRef = useRef<HTMLDivElement>(null);
  const [meVisible, setMeVisible] = useState(false);
  useEffect(() => {
    const el = listRef.current?.querySelector("[data-me]");
    if (!el) {
      setMeVisible(false);
      return;
    }
    const io = new IntersectionObserver(([e]) => setMeVisible(e.isIntersecting), { rootMargin: "0px 0px -160px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [d]);

  return (
    <TabPage label="Leaderboards">
      <PageTitle>Leaderboards</PageTitle>
      <PillTabs label="Board scope" items={SCOPES.map((s) => ({ id: s, label: SCOPE_LABEL[s] }))} value={scope} onChange={setScope} />
      <div className="flex gap-2">
        <button
          onClick={() => setPicking(true)}
          className="press bg-surface flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[14px] px-3 text-[15px] font-semibold"
          aria-haspopup="dialog"
          aria-label={`Game: ${meta?.name ?? "All games"}. Change`}
        >
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-[8px]"
            style={{ background: world?.color ?? "var(--accent)", color: "#0E0F1A" }}
          >
            <Icon name={meta?.icon ?? "trophy"} size={14} />
          </span>
          <span className="truncate">{meta?.name ?? "All games"}</span>
          <Icon name="caret-down" size={16} className="text-muted ml-auto" />
        </button>
        <label className="bg-surface relative flex h-11 items-center gap-2 rounded-[14px] px-3 text-[15px] font-semibold">
          <span className="sr-only">Day</span>
          <select
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="appearance-none bg-transparent pr-6 text-[15px] font-semibold outline-none"
          >
            {dates.map((x, i) => (
              <option key={x} value={x} className="bg-surface">
                {i === 0 ? "Today" : i === 1 ? "Yesterday" : shortDate(x)}
              </option>
            ))}
          </select>
          <Icon name="caret-down" size={16} className="text-muted pointer-events-none absolute right-3" />
        </label>
      </div>

      {q.isPending ? (
        <ListSkeleton rows={8} />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : d?.needs ? (
        <EmptyState
          mood="thinking"
          title={NEEDS[d.needs].title}
          body={NEEDS[d.needs].body}
          action={
            <Link href={NEEDS[d.needs].href} className="toy bg-surface-raised font-display flex h-14 items-center justify-center rounded-[18px] text-[15px] font-extrabold">
              {NEEDS[d.needs].cta}
            </Link>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          mood="wave"
          title="Nobody yet. Be first."
          body={date === today ? "Clear today's Daily and your time leads the board." : "No clears on this board that day."}
          action={
            date === today && meta ? (
              <Link
                href={`/play/${meta.id}`}
                className="toy bg-accent text-on-accent font-display flex h-[60px] items-center justify-center rounded-[20px] text-[16px] font-black"
                style={{ ["--btn-depth" as string]: "var(--accent-depth)" }}
              >
                Play {meta.name}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div ref={listRef} className="flex flex-col gap-3">
          <p className="text-muted flex items-center gap-1.5 text-[14px] font-medium">
            <Icon name="seal-check" size={16} className="text-accent" />
            {d?.context ? `${d.context} · ` : ""}
            {formatNumber(d?.total ?? 0)} {d?.total === 1 ? "Spuzler" : "Spuzlers"} played
          </p>
          {podium.length === 3 && <Podium rows={podium} scoring={d!.scoring} />}
          <ol className="flex flex-col gap-[3px]" aria-label="Board" start={podium.length ? 4 : 1}>
            {list.map((r) => (
              <li key={r.id}>
                <Row r={r} scoring={d!.scoring} />
              </li>
            ))}
          </ol>
          <div aria-hidden className="h-16" />
        </div>
      )}

      {d && !d.needs && !meVisible && (
        <div className="fixed inset-x-3 bottom-[92px] z-20 mx-auto max-w-[536px] lg:sticky lg:inset-x-auto lg:bottom-4 lg:w-full lg:max-w-none">
          {d.me ? (
            <div
              className="flex h-14 items-center gap-2.5 rounded-[16px] px-3"
              style={{ background: "var(--success-tint)", boxShadow: "inset 0 0 0 2px var(--accent), 0 -10px 24px var(--bg)" }}
              aria-label={`You are ${ordinal(d.me.pos)} of ${d.total}, top ${d.me.top} percent, ${valueLabel(d.me, d.scoring)}`}
            >
              <span className="num text-accent w-[26px] text-[14px] font-semibold">{d.me.pos}</span>
              <AvatarChip nickname={d.me.nickname} color={d.me.color} size={30} radius={9} />
              <span className="flex-1 text-[15px] font-bold">You</span>
              <span className="text-muted text-[13px] font-medium">top {d.me.top}%</span>
              <span className="num text-[15px] font-semibold">{valueText(d.me, d.scoring)}</span>
            </div>
          ) : rows.length > 0 && date === today && meta ? (
            <Link
              href={`/play/${meta.id}`}
              className="bg-surface flex h-14 items-center gap-2.5 rounded-[16px] px-3 text-[15px] font-semibold"
              style={{ boxShadow: "inset 0 0 0 2px var(--line), 0 -10px 24px var(--bg)" }}
            >
              <Icon name="play" size={18} className="text-accent" />
              <span className="flex-1">You&apos;re not on this board yet</span>
              <span className="text-accent">Play {meta.name}</span>
            </Link>
          ) : null}
        </div>
      )}

      <Sheet open={picking} onOpenChange={setPicking} title="Pick a board">
        <div className="-mx-1 flex flex-col gap-3">
          <button
            onClick={() => {
              setGame("overall");
              setPicking(false);
            }}
            className="press bg-surface-raised flex h-12 items-center gap-2.5 rounded-[14px] px-3 text-[15px] font-semibold"
            aria-pressed={game === "overall"}
          >
            <Icon name="trophy" size={18} className="text-accent" />
            All games, most clears
          </button>
          {WORLDS.map((w) => (
            <section key={w.id} aria-label={w.name} className="flex flex-col gap-1.5">
              <h3 className="text-muted px-1 text-[13px] font-semibold">{w.name}</h3>
              <div className="grid grid-cols-2 gap-1.5">
                {gamesInWorld(w.id).map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      setGame(g.id);
                      setPicking(false);
                    }}
                    aria-pressed={game === g.id}
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

function Row({ r, scoring }: { r: BoardRow; scoring: BoardRes["scoring"] }) {
  return (
    <Link
      href={r.me ? "/me" : `/u/${r.nickname}`}
      data-me={r.me || undefined}
      className="flex h-12 items-center gap-2.5 rounded-[12px] px-2.5"
      style={{ background: r.me ? "var(--success-tint)" : "var(--surface)" }}
      aria-label={`${ordinal(r.pos)}, ${r.me ? "you" : r.nickname}, ${valueLabel(r, scoring)}`}
    >
      <span className="num text-muted w-[26px] text-[14px] font-semibold">{r.pos}</span>
      <AvatarChip nickname={r.nickname} color={r.color} size={30} radius={9} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold">{r.me ? "You" : r.nickname}</span>
        {r.sub && <span className="text-muted truncate text-[12px] font-medium">{r.sub}</span>}
      </span>
      <span className="num text-[15px] font-semibold">{valueText(r, scoring)}</span>
    </Link>
  );
}

const POD = [
  { size: 52, h: 46, ring: "var(--pos-2)" },
  { size: 62, h: 66, ring: "var(--pos-1)" },
  { size: 48, h: 32, ring: "var(--pos-3)" },
];

function Podium({ rows, scoring }: { rows: BoardRow[]; scoring: BoardRes["scoring"] }) {
  const order = [rows[1], rows[0], rows[2]];
  return (
    <ol className="flex items-end justify-center gap-2 px-0 pt-1.5 pb-3" aria-label="Top 3">
      {order.map((r, i) => (
        <li key={r.id} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" aria-label={`${ordinal(r.pos)}, ${r.me ? "you" : r.nickname}, ${valueLabel(r, scoring)}`}>
          <Link href={r.me ? "/me" : `/u/${r.nickname}`} data-me={r.me || undefined} className="flex flex-col items-center gap-1.5" aria-hidden tabIndex={-1}>
            <span
              className="font-display flex items-center justify-center rounded-[18px] text-[20px] font-black"
              style={{ width: POD[i].size, height: POD[i].size, background: r.color, color: "#0E0F1A", boxShadow: `0 0 0 3px var(--bg), 0 0 0 6px ${POD[i].ring}` }}
            >
              {r.nickname[0]?.toUpperCase()}
            </span>
            <span className="max-w-full truncate text-[14px] font-semibold">{r.me ? "You" : r.nickname}</span>
          </Link>
          <div
            aria-hidden
            className="num flex w-full justify-center rounded-t-[14px] pt-2 text-[14px] font-semibold"
            style={{ height: POD[i].h, background: POD[i].ring, color: "#0E0F1A" }}
          >
            {valueText(r, scoring)}
          </div>
        </li>
      ))}
    </ol>
  );
}
