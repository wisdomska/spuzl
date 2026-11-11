"use client";

/**
 * Small layout pieces for the Games and content pages (admin overhaul, Nov 2026): a page head with its one-line
 * purpose, titled sections, a folded "Technical details" box, status pills that explain themselves, a guide to what
 * each status means, and times written as "2 hours ago" with the exact time on hover. Local to these pages so they
 * never depend on the shared ui.tsx changing underneath them.
 */
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { ago, exactTime } from "@/lib/admin/content-words";
import { adminCopy } from "@/lib/copy/admin";
import { Pill, type PillTone } from "./ui";

const G = adminCopy.contentCommon;

/** The page title, one line saying what the page is for, and the page's main buttons. */
export function PageHead({
  title,
  purpose,
  aside,
  children,
}: {
  title: string;
  purpose: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="font-display text-[22px] font-extrabold tracking-[-0.01em]">{title}</h1>
        {children}
        {aside && <div className="ml-auto flex flex-wrap items-center gap-2">{aside}</div>}
      </div>
      <p className="text-muted max-w-[760px] text-[14px] leading-[1.45]">{purpose}</p>
    </header>
  );
}

/** A titled card: the heading, an optional line under it, then the content. */
export function Section({
  title,
  intro,
  aside,
  children,
  id,
  className = "",
}: {
  title: string;
  intro?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  const hid = id ? `${id}-title` : undefined;
  return (
    <section
      aria-labelledby={hid}
      aria-label={hid ? undefined : title}
      className={`bg-surface flex flex-col gap-3 rounded-[16px] p-4 md:p-5 ${className}`}
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id={hid} className="text-[16px] font-bold">
            {title}
          </h2>
          {intro && <p className="text-muted text-[13px] leading-[1.45]">{intro}</p>}
        </div>
        {aside && <div className="flex flex-wrap items-center gap-2">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

/** Raw ids, keys and JSON: there when needed, folded away by default. */
export function TechDetails({ children, summary = G.technical }: { children: ReactNode; summary?: string }) {
  return (
    <details className="group text-[13px]">
      <summary className="text-muted hover:text-text flex min-h-11 w-fit cursor-pointer items-center gap-1.5 font-semibold">
        <Icon name="caret-right" size={12} className="transition-transform group-open:rotate-90" />
        {summary}
      </summary>
      <div className="text-muted flex flex-col gap-1.5 pb-1 pl-4">{children}</div>
    </details>
  );
}

/** One "name: value" line inside Technical details. */
export function TechLine({ name, value }: { name: string; value: ReactNode }) {
  return (
    <span className="flex flex-wrap gap-x-2">
      <span className="font-semibold">{name}</span>
      <code className="num break-all">{value}</code>
    </span>
  );
}

export interface StateWords {
  label: string;
  tone: PillTone;
  icon?: string;
  /** what the state means for players, one line */
  meaning: string;
}

/** A status pill with an icon (never colour alone) and its meaning on hover and for screen readers. */
export function StatePill({ s, className = "" }: { s: StateWords; className?: string }) {
  return (
    <span title={s.meaning} className={`inline-flex ${className}`}>
      <Pill tone={s.tone}>
        {s.icon && <Icon name={s.icon} size={12} />}
        {s.label}
        <span className="sr-only">: {s.meaning}</span>
      </Pill>
    </span>
  );
}

/** "What do these labels mean?": every status of a page with its meaning for players. */
export function StateGuide({ states, title = G.guide }: { states: StateWords[]; title?: string }) {
  return (
    <details className="group bg-surface rounded-[12px] px-4 text-[13px]">
      <summary className="hover:text-text text-muted flex min-h-11 cursor-pointer items-center gap-1.5 font-semibold">
        <Icon name="info" size={16} />
        {title}
        <Icon name="caret-down" size={12} className="ml-auto transition-transform group-open:rotate-180" />
      </summary>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 pb-3 sm:grid-cols-[auto_1fr]">
        {states.map((s) => (
          <div key={s.label} className="contents">
            <dt>
              <Pill tone={s.tone}>
                {s.icon && <Icon name={s.icon} size={12} />}
                {s.label}
              </Pill>
            </dt>
            <dd className="text-muted mb-1 sm:mb-0">{s.meaning}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** "2 hours ago", with the exact GMT time on hover. */
export function When({ iso, className = "" }: { iso: string; className?: string }) {
  return (
    <time dateTime={iso} title={exactTime(iso)} className={className}>
      {ago(iso)}
    </time>
  );
}
