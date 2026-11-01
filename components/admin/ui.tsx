"use client";

/**
 * Admin console primitives (design: SPUZL Admin). Utilitarian and dense: 36 to 44 px controls, r 10 to 12,
 * no toy depth, colour changes only (150 ms). Tokens only, so both themes work.
 */
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

export type PillTone = "ok" | "warn" | "danger" | "neutral";
const PILL: Record<PillTone, string> = {
  ok: "bg-[var(--success-tint)] text-accent",
  warn: "bg-[var(--warn-tint)] text-gold",
  danger: "bg-[var(--danger-tint)] text-danger",
  neutral: "bg-surface-raised text-muted",
};
export function Pill({ tone = "neutral", children, className = "" }: { tone?: PillTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={`num inline-flex items-center gap-1 rounded-[6px] px-2 py-[3px] text-[12px] font-semibold whitespace-nowrap ${PILL[tone]} ${className}`}
    >
      {children}
    </span>
  );
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
