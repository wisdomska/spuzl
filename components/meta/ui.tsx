"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Spuz, type SpuzMood } from "@/components/brand/Spuz";
import { initial } from "@/lib/social";

export const HEX = "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)";
export const INK = "#0E0F1A";

/** Hexagon emblem (ranks, badges, leagues, crews, quest chain). Optional inner hex for medallions. */
export function Hex({
  w,
  h,
  bg,
  inner,
  innerBg,
  children,
  className = "",
  style,
  label,
}: {
  w: number;
  h: number;
  bg: string;
  inner?: number;
  innerBg?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  label?: string;
}) {
  const content = inner ? (
    <div
      className="flex items-center justify-center"
      style={{ width: inner, height: Math.round((inner * h) / w), clipPath: HEX, background: innerBg, color: INK }}
    >
      {children}
    </div>
  ) : (
    children
  );
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      className={`flex shrink-0 items-center justify-center ${className}`}
      style={{ width: w, height: h, clipPath: HEX, background: bg, color: INK, ...style }}
    >
      {content}
    </div>
  );
}

/** Initial chip in the player's Spuz colour (rows), with an optional presence dot. */
export function AvatarChip({
  nickname,
  color,
  size = 30,
  radius,
  online,
  ring = "var(--bg)",
}: {
  nickname: string;
  color: string;
  size?: number;
  radius?: number;
  online?: boolean | null;
  ring?: string;
}) {
  return (
    <span
      aria-hidden
      className="font-display relative flex shrink-0 items-center justify-center font-black"
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? Math.round(size * 0.3),
        background: color,
        color: INK,
        fontSize: Math.round(size * 0.4),
      }}
    >
      {initial(nickname)}
      {online !== undefined && online !== null && (
        <span
          className="absolute rounded-full"
          style={{
            right: -3,
            bottom: -3,
            width: Math.max(11, size / 3),
            height: Math.max(11, size / 3),
            background: online ? "var(--accent)" : "var(--text-muted)",
            boxShadow: `0 0 0 3px ${ring}`,
          }}
        />
      )}
    </span>
  );
}

/** Accessible switch (52 × 32, lime when on with a check in the knob). */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-150 disabled:opacity-50"
      style={{ background: checked ? "var(--accent)" : "var(--line)" }}
      data-no-tick
    >
      <span
        className="absolute top-1 left-1 flex size-6 items-center justify-center rounded-full transition-transform duration-200"
        style={{
          transform: checked ? "translateX(20px)" : "translateX(0px)",
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
          background: checked ? "var(--bg)" : "var(--text-muted)",
          color: "var(--accent)",
        }}
      >
        {checked && <Icon name="check" size={12} />}
      </span>
    </button>
  );
}

/** Pill tabs (selected = text on surface, light chip). Horizontal scroll on narrow screens. */
export function PillTabs<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: readonly { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
      {items.map((t) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className="press h-11 shrink-0 rounded-[12px] px-3.5 text-[15px] font-semibold transition-colors duration-150"
            style={{ background: on ? "var(--text)" : "var(--surface)", color: on ? "var(--bg)" : "var(--text-muted)" }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Two-up segmented control (Quests | Badges, Practice | Archive). */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: readonly { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="bg-surface flex gap-1 rounded-[16px] p-1">
      {items.map((t) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className="flex h-11 flex-1 items-center justify-center rounded-[12px] text-[15px] font-semibold transition-colors duration-150"
            style={{ background: on ? "var(--surface-raised)" : "transparent", color: on ? "var(--text)" : "var(--text-muted)" }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Progress bar: the fill is a scaleX transform (Handoff: transform and opacity only). */
export function Bar({ value, color = "var(--accent)", height = 8, track = "var(--line)", label }: { value: number; color?: string; height?: number; track?: string; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      role={label ? "progressbar" : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label ? Math.round(v * 100) : undefined}
      className="flex-1 overflow-hidden"
      style={{ height, borderRadius: height / 2, background: track }}
    >
      <div
        className="h-full origin-left transition-transform duration-500"
        style={{ transform: `scaleX(${v})`, background: color, borderRadius: height / 2, transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}
      />
    </div>
  );
}

export function PageTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h1 className="font-display text-[26px] font-black tracking-[-0.01em]">{children}</h1>
      {right}
    </div>
  );
}

export function BackButton({ href, label = "Back" }: { href?: string; label?: string }) {
  const router = useRouter();
  const cls = "press bg-surface-raised flex size-11 shrink-0 items-center justify-center rounded-[14px]";
  if (href)
    return (
      <Link href={href} aria-label={label} className={cls}>
        <Icon name="arrow-left" size={20} />
      </Link>
    );
  return (
    <button aria-label={label} className={cls} onClick={() => (history.length > 1 ? router.back() : router.push("/"))}>
      <Icon name="arrow-left" size={20} />
    </button>
  );
}

export function StatCard({ value, label, color = "var(--text)" }: { value: ReactNode; label: string; color?: string }) {
  return (
    <div className="bg-surface flex min-w-0 flex-col gap-0.5 rounded-[16px] px-3 py-2.5">
      <span className="num truncate text-[20px] font-semibold" style={{ color }}>
        {value}
      </span>
      <span className="text-muted text-[13px] font-medium">{label}</span>
    </div>
  );
}

/** Empty state: Spuz with a mood, a punchy title, one line, one action (States file). */
export function EmptyState({
  mood = "sad",
  title,
  body,
  action,
}: {
  mood?: SpuzMood;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <Spuz mood={mood} size={110} decorative />
      <h2 className="font-display text-[19px] leading-tight font-black text-balance">{title}</h2>
      {body && <p className="text-muted max-w-[300px] text-[15px] leading-snug text-pretty">{body}</p>}
      {action && <div className="mt-2 w-full max-w-[320px]">{action}</div>}
    </div>
  );
}

/** Error state: Spuz squished, "Squish, retry" (States file copy table). */
export function ErrorState({ title = "Squish. That didn't load.", onRetry }: { title?: string; onRetry: () => void }) {
  return (
    <EmptyState
      mood="squish"
      title={title}
      body="Check your connection and try again."
      action={
        <Button className="w-full" onClick={onRetry} icon="arrow-clockwise">
          Try again
        </Button>
      }
    />
  );
}

/** Loading: skeleton rows in the final layout plus Spuz Thinking, after 300 ms (never a spinner). */
export function ListSkeleton({ rows = 6, height = 48 }: { rows?: number; height?: number }) {
  return (
    <div aria-busy aria-label="Loading" className="flex flex-col gap-[3px]">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="rounded-[12px]" style={{ height }} />
      ))}
      <div className="flex justify-center pt-6">
        <Spuz mood="thinking" size={72} decorative />
      </div>
    </div>
  );
}

/** Offline banner (States file): gold ring, wifi-slash. */
export function OfflineBanner({ text = "Offline. Showing what you saw last." }: { text?: string }) {
  return (
    <div
      role="status"
      className="text-gold flex items-center gap-2 rounded-[14px] px-3 py-2 text-[14px] font-medium"
      style={{ background: "var(--warn-tint)", boxShadow: "inset 0 0 0 2px var(--gold)" }}
    >
      <Icon name="wifi-slash" size={18} />
      {text}
    </div>
  );
}
