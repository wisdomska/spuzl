"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "@/components/ui/Icon";

/**
 * In-app banner (Components "Toasts" + G1 offline banner). Tones map onto tokens so both themes work:
 * default = surface-raised; warn = warn-tint with a gold ring (offline, streak at risk);
 * success = success-tint with an accent ring (league promotion).
 * Enter/exit: 8 px drop + fade, 220 ms ease-out; reduced motion keeps the fade only.
 * Announced politely; an action and a dismiss button are optional, both 44 px targets.
 */
export type BannerTone = "default" | "warn" | "success";

const TONE: Record<BannerTone, { bg: string; ring: string; icon: string }> = {
  default: { bg: "var(--surface-raised)", ring: "none", icon: "var(--accent)" },
  warn: { bg: "var(--warn-tint)", ring: "inset 0 0 0 2px var(--gold)", icon: "var(--gold)" },
  success: { bg: "var(--success-tint)", ring: "inset 0 0 0 2px var(--accent)", icon: "var(--accent)" },
};

export interface BannerProps {
  icon: string;
  text: string;
  tone?: BannerTone;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  /** G1 style: tighter padding and radius, used for the offline banner over a board */
  compact?: boolean;
  className?: string;
  testId?: string;
}

export function Banner({ icon, text, tone = "default", actionLabel, onAction, onDismiss, compact, className = "", testId }: BannerProps) {
  const t = TONE[tone];
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={testId}
      className={`text-text flex items-center gap-2.5 text-[15px] leading-snug font-medium ${
        compact ? "min-h-11 rounded-[14px] px-3.5 py-2.5" : "min-h-12 rounded-[16px] py-1 pr-1 pl-3.5"
      } ${className}`}
      style={{ background: t.bg, boxShadow: t.ring }}
    >
      <Icon name={icon} size={20} style={{ color: t.icon, flex: "none" }} />
      <span className="min-w-0 flex-1 py-2">{text}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="press text-accent min-h-11 shrink-0 rounded-[12px] px-3 text-[14px] font-semibold"
        >
          {actionLabel}
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="press text-muted flex size-11 shrink-0 items-center justify-center rounded-[12px]"
        >
          <Icon name="x" size={18} />
        </button>
      )}
    </div>
  );
}

/**
 * A stack of banners with enter/exit motion. Inline by default (in the page flow, for example under
 * the Home HUD); `floating` pins it under the top bar on the toast layer (z 60).
 */
export function BannerStack({
  items,
  floating,
  className = "",
}: {
  items: (BannerProps & { id: string })[];
  floating?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const from = reduce ? "translateY(0px)" : "translateY(-8px)";
  return (
    <div
      className={`flex flex-col gap-2 ${floating ? "fixed inset-x-3 top-[calc(env(safe-area-inset-top)+52px)] mx-auto max-w-[560px]" : ""} ${className}`}
      style={floating ? { zIndex: "var(--z-toast)" } : undefined}
    >
      <AnimatePresence initial={false}>
        {items.map(({ id, ...b }) => (
          <motion.div
            key={id}
            initial={{ opacity: 0, transform: from }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transform: from, transition: { duration: 0.15, ease: [0.23, 1, 0.32, 1] } }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          >
            <Banner {...b} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
