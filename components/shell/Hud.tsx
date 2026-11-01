"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { formatNumber } from "@/lib/format";

/** Home HUD: level ring (conic progress), streak chip, Sparks chip. Lime chrome only. */
export function LevelRing({
  level,
  pct,
  color,
  initial,
  size = 48,
}: {
  level: number;
  pct: number;
  color: string;
  initial: string;
  size?: number;
}) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <Link
      href="/me"
      aria-label={`Level ${level}, ${Math.round(p)}% to next level`}
      className="relative flex items-center justify-center rounded-full"
      style={{ width: size, height: size, background: `conic-gradient(var(--accent) 0 ${p}%, var(--line) ${p}% 100%)` }}
    >
      <span
        aria-hidden
        className="font-display flex items-center justify-center rounded-[12px] text-[18px] font-black text-[#0E0F1A]"
        style={{ width: size - 8, height: size - 8, background: color }}
      >
        {initial}
      </span>
      <span
        className="num bg-accent text-on-accent absolute -right-1 -bottom-1 flex h-[22px] min-w-[22px] items-center justify-center rounded-[8px] px-1 text-[12px] font-bold"
        style={{ boxShadow: "0 0 0 3px var(--bg)" }}
      >
        {level}
      </span>
    </Link>
  );
}

export function StreakChip({ streak, atRisk }: { streak: number; atRisk?: boolean }) {
  return (
    <div
      aria-label={`${streak} day streak${atRisk ? ", at risk" : ""}`}
      className="bg-surface-raised flex h-10 items-center gap-1.5 rounded-[14px] px-3"
      style={{ boxShadow: atRisk ? "inset 0 0 0 2px color-mix(in srgb, var(--gold) 33%, transparent)" : undefined }}
    >
      <Icon name="fire" size={20} style={{ color: "var(--gold)", opacity: atRisk ? 0.55 : 1 }} />
      <span className="num text-[17px] font-semibold">{streak}</span>
      {atRisk && <Icon name="moon" size={14} className="text-muted" />}
    </div>
  );
}

export function SparksChip({ sparks }: { sparks: number }) {
  return (
    <Link
      href="/shop"
      aria-label={`${formatNumber(sparks)} Sparks`}
      className="bg-surface-raised flex h-10 items-center gap-1.5 rounded-[14px] px-3"
      data-wallet
    >
      <Icon name="lightning" size={18} style={{ color: "var(--gold)" }} />
      <span className="num text-gold text-[17px] font-semibold">{formatNumber(sparks)}</span>
    </Link>
  );
}
