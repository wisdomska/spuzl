"use client";

/**
 * Small building blocks for the admin Players area (Players, a player's page, Reports, Join requests, Feedback):
 * a page head with its purpose line, titled cards, labelled facts, a folded "Technical details" box and a time that
 * reads "2 hours ago" with the exact GMT time on hover. Tokens only, so both themes work.
 */
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { exactTime, timeAgo } from "@/lib/admin/people-format";
import { adminCopy } from "@/lib/copy/admin";

/** Title, one purpose line, optional count beside the title and actions on the right. */
export function PageHead({ title, purpose, meta, aside }: { title: string; purpose: ReactNode; meta?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="font-display text-[22px] font-extrabold tracking-[-0.01em]">{title}</h1>
        {meta}
        {aside && <div className="ml-auto flex flex-wrap items-center gap-2">{aside}</div>}
      </div>
      <p className="text-muted max-w-[72ch] text-[14px] leading-snug">{purpose}</p>
    </header>
  );
}

/** A titled card. `hint` is one muted line under the title saying what the card is for. */
export function Card({
  title,
  id,
  hint,
  aside,
  children,
  className = "",
}: {
  title: string;
  id: string;
  hint?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={id} className={`bg-surface flex min-w-0 flex-col gap-3 rounded-[16px] p-4 sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id={id} className="font-display text-[16px] font-extrabold">
            {title}
          </h2>
          {hint && <p className="text-muted text-[13px] leading-snug">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** One labelled fact: a short label, the value big enough to read, and an optional line saying what it means. */
export function Fact({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "danger" | "warn" | "ok" }) {
  const fg = tone === "danger" ? "text-danger" : tone === "warn" ? "text-gold" : tone === "ok" ? "text-accent" : "";
  return (
    <div className="bg-bg flex min-w-0 flex-col gap-1 rounded-[12px] p-3">
      <span className="text-muted text-[12px] font-semibold">{label}</span>
      <span className={`text-[16px] leading-tight font-bold break-words ${fg}`}>{value}</span>
      {hint && <span className="text-muted text-[12px] leading-snug">{hint}</span>}
    </div>
  );
}

/** A number with its label underneath (progress figures). */
export function Figure({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="bg-bg flex flex-col gap-0.5 rounded-[12px] p-3">
      <span className="num text-[20px] leading-tight font-bold">{value}</span>
      <span className="text-muted text-[12px] font-medium">{label}</span>
    </div>
  );
}

/** Raw ids, keys and data, folded away by default (native details, keyboard reachable). */
export function TechDetails({ children, label = adminCopy.players.tech.title }: { children: ReactNode; label?: string }) {
  return (
    <details className="group bg-bg rounded-[12px] text-[13px]">
      <summary className="text-muted hover:text-text flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-[12px] px-3 font-semibold focus-visible:outline-2 focus-visible:outline-[var(--accent)] [&::-webkit-details-marker]:hidden">
        <Icon name="caret-right" size={14} className="transition-transform duration-150 group-open:rotate-90" />
        {label}
      </summary>
      <div className="flex flex-col gap-1.5 px-3 pb-3">{children}</div>
    </details>
  );
}

/** A key and its raw value inside Technical details. */
export function TechRow({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap gap-x-2">
      <span className="text-muted font-semibold">{k}</span>
      <span className="num min-w-0 break-all">{v}</span>
    </div>
  );
}

/** "2 hours ago", with the exact GMT time on hover and for screen readers via the time element. */
export function When({ iso, fallback = "", className = "" }: { iso: string | null | undefined; fallback?: string; className?: string }) {
  if (!iso) return <span className={className}>{fallback}</span>;
  return (
    <time dateTime={iso} title={exactTime(iso)} className={className}>
      {timeAgo(iso)}
    </time>
  );
}
