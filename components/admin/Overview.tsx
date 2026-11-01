"use client";

import Link from "next/link";
import { addDays, todayIso } from "@/lib/admin/dates";
import { AGE_BANDS, ACCOUNT_TYPES } from "@/lib/admin/player-filters";
import { errorText, useAdminQuery } from "@/lib/client/admin";
import { adminCopy } from "@/lib/copy/admin";
import { Notice, PageTitle, RowsSkeleton } from "./ui";

const C = adminCopy.overview;
const P = adminCopy.players;
const fmt = (n: number) => n.toLocaleString("en-US");
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((100 * n) / d)}%` : "0%");

interface OverviewData {
  players: {
    players: number;
    guests: number;
    signed_in: number;
    by_method: Record<(typeof ACCOUNT_TYPES)[number], number>;
    by_age: Record<(typeof AGE_BANDS)[number], number>;
    new_today: number;
    new_7d: number;
    active_today: number;
    active_7d: number;
    banned: number;
  };
  kpis: { dau: number; open_reports: number; flagged: number };
}

function Tile({ value, label, href }: { value: number; label: string; href?: string }) {
  const body = (
    <>
      <span className="num text-[26px] font-semibold tracking-[-0.01em]">{fmt(value)}</span>
      <span className="text-muted text-[13px] font-medium">{label}</span>
    </>
  );
  const cls = "bg-surface flex min-h-[88px] flex-col justify-between gap-1 rounded-[12px] p-4";
  return href ? (
    <Link href={href} className={`${cls} hover:bg-surface-raised`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** A labelled split as bars with the number and share in text, so nothing relies on colour or length alone. */
function Split({
  title,
  id,
  parts,
  total,
}: {
  title: string;
  id: string;
  parts: { label: string; value: number; href: string }[];
  total: number;
}) {
  return (
    <section aria-labelledby={id} className="bg-surface flex flex-col gap-3 rounded-[12px] p-4">
      <h2 id={id} className="font-display text-[16px] font-extrabold">
        {title}
      </h2>
      <ul className="flex flex-col gap-2.5">
        {parts.map((p) => (
          <li key={p.label} className="flex flex-col gap-1">
            <Link href={p.href} className="flex items-center justify-between text-[14px] font-semibold hover:underline">
              <span>{p.label}</span>
              <span className="num text-muted text-[13px]">{C.share(fmt(p.value), pct(p.value, total))}</span>
            </Link>
            <span aria-hidden className="bg-bg h-2 overflow-hidden rounded-full">
              <span className="bg-accent block h-full rounded-full" style={{ width: pct(p.value, total) }} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Admin home (owner request): player totals, guests against signed-in players, new and active players, the sign-in
 * method and age band splits, and the moderation counts from live ops. Each number links to the matching filtered list.
 */
export function Overview({ canModerate }: { canModerate: boolean }) {
  const q = useAdminQuery<OverviewData>(["overview"], "/api/admin/overview", { refetchInterval: 60_000 });
  return (
    <div className="flex flex-col gap-3.5 px-4 py-5 sm:px-6">
      <PageTitle title={C.title}>
        <span className="text-muted text-[14px]">{C.intro}</span>
      </PageTitle>
      {q.isPending ? (
        <RowsSkeleton rows={4} height={88} />
      ) : q.error ? (
        <Notice tone="danger" icon="warning">
          {errorText(q.error)}
        </Notice>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <Tile value={q.data.players.players} label={C.players} href="/admin/players" />
            <Tile value={q.data.players.guests} label={C.guests} href="/admin/players?account=guest" />
            <Tile value={q.data.players.signed_in} label={C.signedIn} />
            <Tile value={q.data.kpis.dau} label={C.dau} />
            <Tile value={q.data.players.new_today} label={C.newToday} href={`/admin/players?joinedFrom=${today()}`} />
            <Tile value={q.data.players.new_7d} label={C.new7d} href={`/admin/players?joinedFrom=${daysAgo(6)}`} />
            <Tile
              value={q.data.players.active_today}
              label={C.activeToday}
              href={`/admin/players?activeFrom=${today()}&sort=last_active&dir=desc`}
            />
            <Tile
              value={q.data.players.active_7d}
              label={C.active7d}
              href={`/admin/players?activeFrom=${daysAgo(6)}&sort=last_active&dir=desc`}
            />
          </div>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
            <Tile
              value={q.data.kpis.open_reports}
              label={C.openReports}
              href={canModerate ? "/admin/moderation" : "/admin/players?reports=open"}
            />
            <Tile
              value={q.data.kpis.flagged}
              label={C.flagged}
              href={canModerate ? "/admin/moderation?tab=flagged" : "/admin/players?status=flagged"}
            />
            <Tile value={q.data.players.banned} label={C.banned} href="/admin/players?status=banned" />
          </div>
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            <Split
              title={C.method}
              id="ov-method"
              total={q.data.players.players}
              parts={ACCOUNT_TYPES.map((t) => ({
                label: P.accounts[t],
                value: q.data.players.by_method[t] ?? 0,
                href: `/admin/players?account=${t}`,
              }))}
            />
            <Split
              title={C.ageBands}
              id="ov-age"
              total={q.data.players.players}
              parts={AGE_BANDS.map((a) => ({
                label: a,
                value: q.data.players.by_age[a] ?? 0,
                href: `/admin/players?age=${encodeURIComponent(a)}`,
              }))}
            />
          </div>
        </>
      )}
    </div>
  );
}

const today = () => todayIso();
const daysAgo = (n: number) => addDays(todayIso(), -n);
