"use client";

import { useState } from "react";
import { Hex, Bar } from "./ui";
import { Sheet } from "./Sheet";
import { Icon } from "@/components/ui/Icon";
import type { BadgeDTO, BadgesRes } from "@/lib/client/social";

/** Badge medallion tiers (Components file): outer ring + inner hex, plus dots or a star for the tier. */
export const TIER_FILL: Record<BadgeDTO["tier"], { outer: string; inner: string; label: string; marks: string }> = {
  bronze: { outer: "#C08A4A", inner: "#8A5A26", label: "Bronze", marks: "1 dot" },
  silver: { outer: "#C9CCDD", inner: "#8F93AA", label: "Silver", marks: "2 dots" },
  gold: { outer: "#FFC93C", inner: "#C99412", label: "Gold", marks: "3 dots" },
  prism: { outer: "#2FD3E0", inner: "#B8F23A", label: "Prism", marks: "star" },
};

export function Medallion({ b, size = 62 }: { b: Pick<BadgeDTO, "tier" | "icon" | "earned" | "name">; size?: number }) {
  const t = TIER_FILL[b.tier];
  const h = Math.round(size * 1.1);
  const tierMarks = b.tier === "prism" ? 0 : b.tier === "gold" ? 3 : b.tier === "silver" ? 2 : 1;
  return (
    <div className="relative" style={{ width: size, height: h }}>
      <Hex
        w={size}
        h={h}
        bg={b.earned ? t.outer : "var(--line)"}
        inner={Math.round(size * 0.74)}
        innerBg={b.earned ? t.inner : "var(--surface-raised)"}
      >
        <Icon name={b.icon} size={Math.round(size * 0.35)} style={{ color: b.earned ? "#0E0F1A" : "var(--text-muted)", opacity: b.earned ? 1 : 0.7 }} />
      </Hex>
      {/* Tier marks so tiers never rely on colour alone */}
      <span aria-hidden className="absolute inset-x-0 -bottom-1 flex justify-center gap-[3px]">
        {tierMarks === 0 ? (
          <Icon name="star-four" size={10} style={{ color: b.earned ? t.outer : "var(--text-muted)" }} />
        ) : (
          Array.from({ length: tierMarks }, (_, i) => (
            <span key={i} className="size-[5px] rounded-full" style={{ background: b.earned ? t.outer : "var(--text-muted)" }} />
          ))
        )}
      </span>
    </div>
  );
}

/** Badges grid by family with tiers and progress. Secret badges arrive only once earned (server filters). */
export function BadgeGrid({ data }: { data: BadgesRes }) {
  const [open, setOpen] = useState<BadgeDTO | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-[14px]">
        <span className="num text-text font-semibold">{data.earned}</span> earned of {data.total}
        {data.secretsLeft > 0 ? `, plus ${data.secretsLeft} secret ${data.secretsLeft === 1 ? "badge" : "badges"} to find` : ""}
      </p>
      {data.families.map((f) => (
        <section key={f.family} aria-label={f.label} className="flex flex-col gap-2">
          <h3 className="text-[15px] font-bold">{f.label}</h3>
          <ul className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-5">
            {f.badges.map((b) => (
              <li key={b.id}>
                <button
                  onClick={() => setOpen(b)}
                  className="flex w-full flex-col items-center gap-1.5 rounded-[14px] py-1"
                  aria-label={`${b.name}, ${TIER_FILL[b.tier].label}, ${b.earned ? "earned" : b.progress ? `${b.progress.have} of ${b.progress.need}` : "locked"}`}
                >
                  <Medallion b={b} size={54} />
                  <span className="line-clamp-2 text-center text-[12px] leading-tight font-semibold">{b.name}</span>
                  {!b.earned && b.progress && (
                    <span className="flex w-full items-center gap-1 px-1">
                      <Bar value={b.progress.have / b.progress.need} height={4} />
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)} title={open?.name ?? ""} description={open?.description}>
        {open && (
          <div className="flex items-center gap-4 pb-2">
            <Medallion b={open} size={72} />
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="text-[15px] font-semibold">
                {TIER_FILL[open.tier].label}
                {open.secret ? ", secret" : ""}
              </span>
              {open.earned ? (
                <span className="text-accent flex items-center gap-1.5 text-[14px] font-semibold">
                  <Icon name="check-circle" size={16} />
                  Earned {open.earnedAt ? new Date(open.earnedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}
                </span>
              ) : open.progress ? (
                <div className="flex items-center gap-2">
                  <Bar value={open.progress.have / open.progress.need} label={`${open.name} progress`} />
                  <span className="num text-muted text-[13px]">
                    {open.progress.have}/{open.progress.need}
                  </span>
                </div>
              ) : (
                <span className="text-muted text-[14px]">Not yet earned.</span>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
