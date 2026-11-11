"use client";

/**
 * Admin console primitives (design: SPUZL Admin). Calm and tidy: 40 to 44 px controls, cards r 16, no toy depth,
 * colour changes only (150 ms). Tokens only, so both themes work. Written for non-developers: plain words first,
 * technical details folded away (TechDetails).
 */
import Link from "next/link";
import { Modal, ModalActions } from "@/components/ui/Modal";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminCopy } from "@/lib/copy/admin";

type Tone = "primary" | "secondary" | "danger" | "ghost";
const TONE: Record<Tone, string> = {
  primary: "bg-accent text-on-accent font-bold hover:brightness-110",
  secondary: "bg-surface-raised text-text font-semibold hover:bg-line",
  danger: "bg-danger text-[#0E0F1A] font-bold hover:brightness-110",
  ghost: "text-muted font-semibold hover:bg-surface-raised hover:text-text",
};

export function Btn({
  tone = "secondary",
  icon,
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; icon?: string; size?: "sm" | "md" | "lg" }) {
  const h =
    size === "lg"
      ? "h-11 rounded-[12px] px-4 text-[14px]"
      : size === "sm"
        ? "h-9 rounded-[10px] px-3 text-[13px]"
        : "h-10 rounded-[10px] px-3 text-[13px]";
  return (
    <button
      type="button"
      className={`inline-flex min-w-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 ${h} ${TONE[tone]} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
    </button>
  );
}

/**
 * Status pill tones. ok = on, live, done; warn = needs review or waiting; danger = blocked, banned, failed;
 * info = scheduled or upcoming; neutral = off, draft, retired. Each pill carries a word, never colour alone.
 */
export type PillTone = "ok" | "warn" | "danger" | "neutral" | "info";
const PILL: Record<PillTone, string> = {
  ok: "bg-[var(--success-tint)] text-accent",
  warn: "bg-[var(--warn-tint)] text-gold",
  danger: "bg-[var(--danger-tint)] text-danger",
  neutral: "bg-surface-raised text-muted",
  info: "bg-surface-raised text-[var(--freeze)]",
};
const PILL_DOT: Record<PillTone, string> = {
  ok: "bg-accent",
  warn: "bg-gold",
  danger: "bg-danger",
  neutral: "bg-[var(--text-muted)]",
  info: "bg-[var(--freeze)]",
};
export function Pill({
  tone = "neutral",
  dot = false,
  children,
  className = "",
  title,
}: {
  tone?: PillTone;
  /** A small leading dot, for live states (On, Live, Needs review). */
  dot?: boolean;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`num inline-flex items-center gap-1 rounded-[6px] px-2 py-[3px] text-[12px] font-semibold whitespace-nowrap ${PILL[tone]} ${className}`}
    >
      {dot && <span aria-hidden className={`size-1.5 rounded-full ${PILL_DOT[tone]}`} />}
      {children}
    </span>
  );
}

/** The usual status words to pill tones, so the same state looks the same on every page. */
export const STATUS_TONE: Record<string, PillTone> = {
  on: "ok",
  live: "ok",
  approved: "ok",
  done: "ok",
  active: "ok",
  scheduled: "info",
  upcoming: "info",
  in_review: "warn",
  needs_review: "warn",
  pending: "warn",
  new: "warn",
  open: "warn",
  rejected: "danger",
  banned: "danger",
  failed: "danger",
  off: "neutral",
  draft: "neutral",
  retired: "neutral",
  ended: "neutral",
  disabled: "neutral",
};

/**
 * Page header: the title, one plain sentence on what the page is for, and the page's main actions on the right.
 * `children` sits under the purpose line (a filters summary, when it last updated and so on).
 */
export function PageHeader({
  title,
  purpose,
  aside,
  children,
}: {
  title: string;
  purpose?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="font-display text-[22px] font-extrabold tracking-[-0.01em]">{title}</h1>
        {aside && <div className="ml-auto flex flex-wrap items-center gap-2">{aside}</div>}
      </div>
      {purpose && <p className="text-muted max-w-[72ch] text-[14px] leading-[1.45]">{purpose}</p>}
      {children}
    </header>
  );
}

/** A titled card that groups related things. `description` is one plain line under the heading. */
export function Section({
  title,
  description,
  aside,
  children,
  id,
  className = "",
  level = 2,
}: {
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
  /** Heading level, so headings stay in order (2 under the page title, 3 inside another section). */
  level?: 2 | 3;
}) {
  const H = level === 2 ? "h2" : "h3";
  const hid = id ? `${id}-h` : undefined;
  return (
    <section id={id} aria-labelledby={hid} className={`bg-surface flex min-w-0 flex-col gap-3 rounded-[16px] p-4 sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <H id={hid} className="font-display text-[16px] font-extrabold">
            {title}
          </H>
          {description && <p className="text-muted text-[13px] leading-[1.4]">{description}</p>}
        </div>
        {aside && <div className="flex flex-wrap items-center gap-2">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

/**
 * One number that matters: a plain label, the big value, an optional change against the previous period and an
 * optional one-line meaning. With `href` the whole card links to the matching list.
 */
export function StatCard({
  value,
  label,
  hint,
  href,
  tone = "neutral",
  change,
  icon,
  inset = false,
}: {
  value: ReactNode;
  label: string;
  hint?: ReactNode;
  href?: string;
  /** warn/danger colour the number when something needs doing; ok when all is well. */
  tone?: PillTone;
  /** e.g. { text: "12% more than last week", dir: "up" }; `good` flips the colour when down is the good way. */
  change?: { text: string; dir: "up" | "down" | "flat"; good?: boolean };
  icon?: string;
  /** Inside a Section (already on the surface colour): sit on the page colour instead. */
  inset?: boolean;
}) {
  const valueTone = tone === "warn" ? "text-gold" : tone === "danger" ? "text-danger" : tone === "ok" ? "text-accent" : "";
  const good = change ? (change.good ?? change.dir === "up") : false;
  const body = (
    <>
      <span className="text-muted flex items-center gap-1.5 text-[13px] font-semibold">
        {icon && <Icon name={icon} size={16} />}
        {label}
      </span>
      <span className={`num text-[28px] leading-none font-semibold tracking-[-0.01em] ${valueTone}`}>
        {typeof value === "number" ? fmtNum(value) : value}
      </span>
      {change && (
        <span
          className={`num flex items-center gap-1 text-[12px] font-semibold ${change.dir === "flat" ? "text-muted" : good ? "text-accent" : "text-danger"}`}
        >
          {change.dir !== "flat" && <Icon name={change.dir === "up" ? "arrow-up" : "arrow-down"} size={12} />}
          {change.text}
        </span>
      )}
      {hint && <span className="text-muted text-[12px] leading-[1.35]">{hint}</span>}
    </>
  );
  const cls = `${inset ? "bg-bg" : "bg-surface"} flex min-h-[104px] min-w-0 flex-col gap-2 rounded-[16px] p-4`;
  return href ? (
    <Link href={href} className={`${cls} hover:bg-surface-raised`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Label and value pairs (a definition list): two columns on wide screens, stacked on phones. */
export function KeyValue({
  items,
  className = "",
}: {
  items: { label: string; value: ReactNode; hint?: ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={`grid grid-cols-1 gap-x-4 gap-y-1 text-[14px] sm:grid-cols-[minmax(140px,auto)_1fr] sm:gap-y-2.5 ${className}`}>
      {items.map((it) => (
        <div key={it.label} className="contents">
          <dt className="text-muted pt-1.5 font-semibold sm:pt-0">{it.label}</dt>
          <dd className="flex min-w-0 flex-col gap-0.5 break-words">
            <span>{it.value}</span>
            {it.hint && <span className="text-muted text-[12px]">{it.hint}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Raw ids, keys, JSON and exact formulas, folded away (native details/summary: keyboard and screen-reader friendly).
 * Never the default view.
 */
export function TechDetails({ summary, children, className = "" }: { summary?: string; children: ReactNode; className?: string }) {
  return (
    <details className={`group/tech text-[13px] ${className}`}>
      <summary className="text-muted hover:text-text inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-[8px] font-semibold select-none [&::-webkit-details-marker]:hidden">
        <Icon name="caret-right" size={14} className="transition-transform duration-150 group-open/tech:rotate-90" />
        {summary ?? adminCopy.ui.techDetails}
      </summary>
      <div className="bg-bg text-muted mt-1.5 flex flex-col gap-1.5 rounded-[10px] p-3 font-mono text-[12px] break-all">{children}</div>
    </details>
  );
}

/** An empty list or panel: what will appear here, and what to do about it. */
export function EmptyState({
  icon = "check-circle",
  title,
  children,
  action,
}: {
  icon?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <Icon name={icon} size={28} className="text-muted" />
      <p className="text-[15px] font-semibold">{title}</p>
      {children && <p className="text-muted max-w-[52ch] text-[14px] leading-[1.45]">{children}</p>}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

/** "2 hours ago", with the exact GMT time on hover. */
export function Ago({ iso, now }: { iso: string | null | undefined; now?: number }) {
  if (!iso) return <span className="text-muted">{adminCopy.ui.never}</span>;
  return (
    <time dateTime={iso} title={exactTime(iso)}>
      {timeAgo(iso, now)}
    </time>
  );
}

/* ---------- Human formats (principle 5). Pure. ---------- */

/** 12345 → "12,345"; anything that isn't a number → "–". */
export const fmtNum = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("en-US") : "–");

/** 0.4567 → "46%"; with a denominator, (3, 4) → "75%". A zero denominator reads "0%". */
export function fmtPct(n: number, d?: number): string {
  const v = d === undefined ? n : d > 0 ? n / d : 0;
  return `${Math.round(100 * v)}%`;
}

/** 80,000 ms → "1 min 20 s"; 4,000 → "4 s"; 3,720,000 → "1 h 2 min". */
export function fmtDuration(ms: number | null | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "–";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 ? `${m} min ${s % 60} s` : `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-11" or an ISO time → "Wed 11 Nov" (GMT, the console's day). */
export function fmtDay(iso: string): string {
  const d = new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso);
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MO[d.getUTCMonth()]}`;
}

/** "Wed 11 Nov 2026, 14:05 GMT" */
export function exactTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${fmtDay(iso)} ${d.getUTCFullYear()}, ${hh}:${mm} GMT`;
}

/** "just now", "5 minutes ago", "2 hours ago", "yesterday", "3 days ago", then the date. Future times read "in 2 hours". */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = now - Date.parse(iso);
  const future = diff < 0;
  const m = Math.round(Math.abs(diff) / 60_000);
  const say = (n: number, unit: string) => {
    const t = `${n} ${unit}${n === 1 ? "" : "s"}`;
    return future ? `in ${t}` : `${t} ago`;
  };
  if (m < 1) return "just now";
  if (m < 60) return say(m, "minute");
  const h = Math.round(m / 60);
  if (h < 24) return say(h, "hour");
  const d = Math.round(h / 24);
  if (d === 1) return future ? "tomorrow" : "yesterday";
  if (d < 14) return say(d, "day");
  return fmtDay(iso);
}

export function PageTitle({ title, children, aside }: { title: string; children?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h1 className="font-display text-[20px] font-extrabold tracking-[-0.01em]">{title}</h1>
      {children}
      {aside && <div className="ml-auto flex flex-wrap items-center gap-2">{aside}</div>}
    </div>
  );
}

/** Segmented tabs (moderation): surface track, raised active tab. */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { id: T; label: string; count?: number }[];
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="bg-surface flex gap-1 rounded-[10px] p-[3px]">
      {items.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`flex h-[38px] items-center gap-1.5 rounded-[8px] px-2.5 text-[13px] font-semibold ${value === t.id ? "bg-surface-raised text-text" : "text-muted hover:text-text"}`}
        >
          {t.label}
          {t.count ? <span className="num text-muted text-[12px]">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, hint, htmlFor }: { label: string; children: ReactNode; hint?: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="num text-muted text-[12px] font-semibold">
        {label}
      </label>
      {children}
      {hint && <span className="text-muted text-[12px]">{hint}</span>}
    </div>
  );
}

export const inputCls =
  "bg-bg h-10 rounded-[10px] px-3 text-[14px] shadow-[inset_0_0_0_1px_var(--line)] outline-none placeholder:text-muted focus-visible:shadow-[inset_0_0_0_2px_var(--accent)]";
export const textareaCls =
  "bg-bg w-full rounded-[10px] px-3 py-2.5 text-[14px] leading-[1.4] shadow-[inset_0_0_0_1px_var(--line)] outline-none placeholder:text-muted focus-visible:shadow-[inset_0_0_0_2px_var(--accent)]";

export function ReadField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="num text-muted text-[12px] font-semibold">{label}</span>
      <div className="bg-bg flex min-h-10 items-center rounded-[10px] px-3 text-[14px] font-medium shadow-[inset_0_0_0_1px_var(--line)]">
        {value}
      </div>
    </div>
  );
}

export function Notice({
  tone = "neutral",
  icon,
  children,
  action,
}: {
  tone?: PillTone;
  icon?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const ring = tone === "danger" ? "var(--danger)" : tone === "warn" ? "var(--gold)" : tone === "ok" ? "var(--accent)" : "var(--line)";
  const bg =
    tone === "danger"
      ? "var(--danger-tint)"
      : tone === "warn"
        ? "var(--warn-tint)"
        : tone === "ok"
          ? "var(--success-tint)"
          : "var(--surface)";
  const fg = tone === "danger" ? "text-danger" : tone === "warn" ? "text-gold" : tone === "ok" ? "text-accent" : "text-muted";
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className="flex items-center gap-2.5 rounded-[12px] px-3.5 py-3 text-[14px] font-medium"
      style={{ background: bg, boxShadow: `inset 0 0 0 1px ${ring}` }}
    >
      {icon && <Icon name={icon} size={20} className={fg} />}
      <span className="flex-1">{children}</span>
      {action}
    </div>
  );
}

/** Table skeleton rows (shown after 300 ms, never a spinner). */
export function RowsSkeleton({ rows = 8, height = 40 }: { rows?: number; height?: number }) {
  return (
    <div className="flex flex-col gap-1.5 p-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="bg-surface-raised rounded-[8px]" style={{ height }} />
      ))}
    </div>
  );
}

export function Empty({ icon = "check-circle", children }: { icon?: string; children: ReactNode }) {
  return (
    <div className="text-muted flex flex-col items-center gap-2 px-6 py-12 text-center text-[14px]">
      <Icon name={icon} size={28} />
      {children}
    </div>
  );
}

export function Forbidden({ what }: { what: string }) {
  return (
    <div className="p-6">
      <Notice tone="warn" icon="lock-simple">
        {adminCopy.common.forbidden(what)}
      </Notice>
    </div>
  );
}

/** World swatch (10 px square, r 3) used beside game names. */
export function Swatch({ world }: { world: string }) {
  return <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: `var(--w-${world})` }} />;
}

/**
 * A plain confirmation for an action with consequences: what will happen, in words, and a verb on the button.
 * (ConfirmDialog is the heavier one, with a required reason, for player actions.) Focus is trapped and returns on close.
 */
export function Confirm({
  open,
  title,
  body,
  confirmLabel,
  danger = false,
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      kind="dialog"
      role="alertdialog"
      size="sm"
      open={open}
      onOpenChange={(o) => !o && onCancel()}
      dismissible={!busy}
      title={title}
      description={body}
      footer={
        <ModalActions>
          <Btn size="lg" onClick={onCancel} disabled={busy}>
            {adminCopy.ui.cancel}
          </Btn>
          <Btn size="lg" tone={danger ? "danger" : "primary"} disabled={busy} onClick={onConfirm}>
            {busy ? adminCopy.ui.working : confirmLabel}
          </Btn>
        </ModalActions>
      }
    />
  );
}
