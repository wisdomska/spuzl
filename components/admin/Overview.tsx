"use client";

import Link from "next/link";
import { addDays, todayIso } from "@/lib/admin/dates";
import { AGE_BANDS, ACCOUNT_TYPES } from "@/lib/admin/player-filters";
import { can, type Role } from "@/lib/admin/roles";
import { useAdminQuery } from "@/lib/client/admin";
import { Icon } from "@/components/ui/Icon";
import { adminCopy } from "@/lib/copy/admin";
import { fmtNum, fmtPct, Notice, PageHeader, RowsSkeleton, Section, StatCard, TechDetails } from "./ui";

const C = adminCopy.overview;

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
  kpis: { dau: number; open_reports: number; flagged: number; players_now?: number; dau_yesterday?: number; clears_today?: number };
  /**
   * R2-ADMIN: devices with push alerts on, and those a push reached in the last 30 days (absent on older servers);
   * round 3 item 13: the distinct players behind each (null until the database has svc_admin_push_players).
   */
  push?: { devices: number; reached30d: number; players?: number | null; playersReached30d?: number | null };
  /** R4-02: contact-form messages still marked new (null without the role or the table; absent on older servers). */
  newFeedback?: number | null;
  /** Admin overhaul: the rest of today's to-do, each null when the role cannot open that page (absent on older servers). */
  attention?: {
    puzzlesToReview: number | null;
    contentToReview: number | null;
    joinRequestsToday: number | null;
    joinRequestsWaiting: number | null;
  };
}

interface Todo {
  key: string;
  icon: string;
  count: number;
  label: string;
  hint: string;
  action: string;
  href: string;
  /** Information rather than work (join requests): never counted as waiting, never coloured. */
  info?: boolean;
}

/**
 * Admin home (admin overhaul). Most important first: what needs attention today (reports, flagged scores, feedback,
 * puzzles and content to review, join requests), then today's and this week's numbers in plain words, who plays,
 * notifications, and shortcuts for the role. Each number links to the matching list where there is one.
 */
export function Overview({ role, canModerate }: { role?: Role; canModerate?: boolean }) {
  const q = useAdminQuery<OverviewData>(["overview"], "/api/admin/overview", { refetchInterval: 60_000 });
  // `canModerate` is the older prop; the role decides when it is given.
  const mod = role ? can(role, "moderation.read") : !!canModerate;
  return (
    <div className="flex flex-col gap-4 px-4 py-5 sm:px-6">
      <PageHeader title={C.title} purpose={C.intro} />
      {q.isPending ? (
        <RowsSkeleton rows={4} height={104} />
      ) : q.error ? (
        <Notice tone="danger" icon="warning">
          {C.error}
        </Notice>
      ) : (
        <Body d={q.data} role={role} mod={mod} />
      )}
    </div>
  );
}

function Body({ d, role, mod }: { d: OverviewData; role?: Role; mod: boolean }) {
  const p = d.players;
  const a = d.attention;
  const todos: Todo[] = [
    {
      key: "reports",
      icon: "shield-check",
      count: d.kpis.open_reports,
      ...C.todo.reports,
      href: mod ? "/admin/moderation" : "/admin/players?reports=open",
    },
    {
      key: "flagged",
      icon: "flag",
      count: d.kpis.flagged,
      ...C.todo.flagged,
      href: mod ? "/admin/moderation?tab=flagged" : "/admin/players?status=flagged",
    },
  ];
  if (typeof d.newFeedback === "number")
    todos.push({ key: "feedback", icon: "chat-circle-text", count: d.newFeedback, ...C.todo.feedback, href: "/admin/feedback?status=new" });
  if (typeof a?.puzzlesToReview === "number")
    todos.push({
      key: "puzzles",
      icon: "puzzle-piece",
      count: a.puzzlesToReview,
      ...C.todo.puzzles,
      href: "/admin/puzzles?status=in_review",
    });
  if (typeof a?.contentToReview === "number")
    todos.push({ key: "content", icon: "note-pencil", count: a.contentToReview, ...C.todo.content, href: "/admin/content?tab=review" });
  if (typeof a?.joinRequestsToday === "number")
    todos.push({
      key: "joins",
      icon: "hand-waving",
      count: a.joinRequestsToday,
      label: C.todo.joins.label,
      hint: C.todo.joins.hint(fmtNum(a.joinRequestsWaiting ?? 0)),
      action: C.todo.joins.action,
      href: `/admin/join-requests?from=${today()}`,
      info: true,
    });
  const waiting = todos.filter((t) => !t.info && t.count > 0);
  // Work waiting first (biggest first), then the clear ones, then information.
  const ordered = [
    ...waiting.sort((x, y) => y.count - x.count),
    ...todos.filter((t) => !t.info && t.count === 0),
    ...todos.filter((t) => t.info),
  ];

  const push = d.push;
  const perPlayer = push && typeof push.players === "number";
  const links = role
    ? (
        [
          ["players", "/admin/players", "magnifying-glass", "players.read"],
          ["calendar", "/admin/calendar", "calendar-blank", "calendar.read"],
          ["metrics", "/admin/metrics", "chart-bar", "metrics.read"],
          ["flags", "/admin/flags", "toggle-right", "flags.write"],
          ["team", "/admin/team", "user-plus", "team.manage"],
        ] as const
      ).filter(([, , , perm]) => can(role, perm))
    : [];

  return (
    <>
      <Section
        id="ov-attention"
        title={C.attention}
        description={C.attentionIntro}
        aside={waiting.length === 0 ? undefined : <span className="text-muted text-[12px]">{C.updated}</span>}
      >
        {waiting.length === 0 && (
          <p role="status" className="text-accent flex items-center gap-2 text-[14px] font-semibold">
            <Icon name="check-circle" size={20} />
            {C.allClear}
          </p>
        )}
        <ul className="flex flex-col">
          {ordered.map((t) => (
            <TodoRow key={t.key} t={t} />
          ))}
        </ul>
      </Section>

      <Section id="ov-today" title={C.today} description={C.todayIntro}>
        <div className="grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2 xl:grid-cols-4">
          {typeof d.kpis.players_now === "number" && (
            <Card value={d.kpis.players_now} label={C.playingNow} hint={C.playingNowHint} icon="pulse" />
          )}
          <Card
            value={d.kpis.dau}
            label={C.dau}
            hint={typeof d.kpis.dau_yesterday === "number" ? C.dauHint(fmtNum(d.kpis.dau_yesterday)) : undefined}
            icon="game-controller"
          />
          <Card
            value={p.active_today}
            label={C.activeToday}
            hint={C.activeTodayHint}
            href={`/admin/players?activeFrom=${today()}&sort=last_active&dir=desc`}
            icon="users"
          />
          <Card
            value={p.new_today}
            label={C.newToday}
            hint={C.newTodayHint}
            href={`/admin/players?joinedFrom=${today()}`}
            icon="user-plus"
          />
          {typeof d.kpis.clears_today === "number" && (
            <Card value={d.kpis.clears_today} label={C.dailyClears} hint={C.dailyClearsHint} icon="check-circle" />
          )}
        </div>
      </Section>

      <Section id="ov-week" title={C.week} description={C.weekIntro}>
        <div className="grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2">
          <Card
            value={p.active_7d}
            label={C.active7d}
            hint={C.active7dHint}
            href={`/admin/players?activeFrom=${daysAgo(6)}&sort=last_active&dir=desc`}
          />
          <Card value={p.new_7d} label={C.new7d} hint={C.new7dHint} href={`/admin/players?joinedFrom=${daysAgo(6)}`} />
        </div>
      </Section>

      <Section id="ov-who" title={C.who} description={C.whoIntro}>
        <div className="grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2 xl:grid-cols-4">
          <Card value={p.players} label={C.players} href="/admin/players" />
          <Card value={p.signed_in} label={C.signedIn} hint={C.signedInHint} />
          <Card value={p.guests} label={C.guests} hint={C.guestsHint} href="/admin/players?account=guest" />
          <Card value={p.banned} label={C.banned} hint={C.bannedHint} href="/admin/players?status=banned" />
        </div>
        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          <Split
            title={C.method}
            id="ov-method"
            total={p.players}
            parts={ACCOUNT_TYPES.map((t) => ({ label: C.accounts[t], value: p.by_method[t] ?? 0, href: `/admin/players?account=${t}` }))}
          />
          <Split
            title={C.ageBands}
            id="ov-age"
            note={C.ageHint}
            total={p.players}
            parts={AGE_BANDS.map((b) => ({
              label: C.ages[b] ?? b,
              value: p.by_age[b] ?? 0,
              href: `/admin/players?age=${encodeURIComponent(b)}`,
            }))}
          />
        </div>
      </Section>

      {push && (
        <Section id="ov-alerts" title={C.alerts} description={C.alertsIntro}>
          <div className="grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2">
            {perPlayer ? (
              <>
                <Card value={push.players!} label={C.pushPlayers} hint={C.pushPlayersHint} icon="bell" />
                {typeof push.playersReached30d === "number" && (
                  <Card value={push.playersReached30d} label={C.pushPlayersReached} hint={C.pushPlayersReachedHint} icon="bell-ringing" />
                )}
              </>
            ) : (
              <>
                <Card value={push.devices} label={C.pushDevices} hint={C.pushDevicesHint} icon="bell" />
                <Card value={push.reached30d} label={C.pushReached} hint={C.pushReachedHint} icon="bell-ringing" />
              </>
            )}
          </div>
          {perPlayer && (
            <TechDetails summary={C.devicesSummary}>
              <span className="font-ui">
                {C.pushDevices}: <span className="num">{fmtNum(push.devices)}</span>. {C.pushDevicesHint}
              </span>
              <span className="font-ui">
                {C.pushReached}: <span className="num">{fmtNum(push.reached30d)}</span>. {C.pushReachedHint}
              </span>
            </TechDetails>
          )}
        </Section>
      )}

      {links.length > 0 && (
        <Section id="ov-links" title={C.shortcuts}>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {links.map(([key, href, icon]) => (
              <li key={key}>
                <Link href={href} className="bg-bg hover:bg-surface-raised flex min-h-[64px] items-center gap-3 rounded-[12px] p-3">
                  <Icon name={icon} size={22} className="text-accent" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[14px] font-semibold">{C.links[key].label}</span>
                    <span className="text-muted text-[12px] leading-[1.35]">{C.links[key].hint}</span>
                  </span>
                  <Icon name="caret-right" size={16} className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

function TodoRow({ t }: { t: Todo }) {
  const busy = !t.info && t.count > 0;
  return (
    <li className="border-line flex flex-wrap items-center gap-x-3 gap-y-2 border-t py-3 first:border-t-0 first:pt-0 last:pb-0">
      <span
        aria-hidden
        className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] ${busy ? "text-gold bg-[var(--warn-tint)]" : "bg-surface-raised text-muted"}`}
      >
        <Icon name={t.icon} size={20} />
      </span>
      <span className="flex min-w-0 flex-1 basis-[220px] flex-col">
        <span className="flex items-baseline gap-2 text-[15px] font-semibold">
          <span className={`num text-[20px] ${busy ? "text-gold" : t.info ? "" : "text-muted"}`}>{fmtNum(t.count)}</span>
          <span>{t.label}</span>
        </span>
        <span className="text-muted text-[13px] leading-[1.4]">{!t.info && t.count === 0 ? C.nothing : t.hint}</span>
      </span>
      <Link
        href={t.href}
        className={`inline-flex h-11 items-center gap-1.5 rounded-[10px] px-3.5 text-[13px] font-bold whitespace-nowrap sm:h-10 ${
          busy ? "bg-accent text-on-accent hover:brightness-110" : "bg-surface-raised text-text hover:bg-line font-semibold"
        }`}
      >
        {t.action}
        <Icon name="arrow-right" size={14} />
      </Link>
    </li>
  );
}

function Card(props: { value: number; label: string; hint?: string; href?: string; icon?: string }) {
  return <StatCard {...props} inset />;
}

/** A labelled split as bars with the number and share in text, so nothing relies on colour or length alone. */
function Split({
  title,
  id,
  note,
  parts,
  total,
}: {
  title: string;
  id: string;
  note?: string;
  parts: { label: string; value: number; href: string }[];
  total: number;
}) {
  return (
    <section aria-labelledby={id} className="bg-bg flex flex-col gap-3 rounded-[16px] p-4">
      <div className="flex flex-col gap-0.5">
        <h3 id={id} className="font-display text-[15px] font-extrabold">
          {title}
        </h3>
        {note && <p className="text-muted text-[12px] leading-[1.4]">{note}</p>}
      </div>
      <ul className="flex flex-col gap-2.5">
        {parts.map((s) => (
          <li key={s.label} className="flex flex-col gap-1">
            <Link
              href={s.href}
              aria-label={C.shareAria(s.label, fmtNum(s.value), fmtPct(s.value, total))}
              className="flex min-h-9 items-center justify-between gap-2 text-[14px] font-semibold hover:underline"
            >
              <span>{s.label}</span>
              <span className="num text-muted text-[13px]">{C.share(fmtNum(s.value), fmtPct(s.value, total))}</span>
            </Link>
            <span aria-hidden className="bg-surface-raised h-2 overflow-hidden rounded-full">
              <span className="bg-accent block h-full rounded-full" style={{ width: fmtPct(s.value, total) }} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const today = () => todayIso();
const daysAgo = (n: number) => addDays(todayIso(), -n);
