"use client";

import type { ButtonHTMLAttributes } from "react";
import { Icon } from "./Icon";

/** 44 × 44 top-bar button, r 14, surface-raised (Solo Screens game top bar). */
export function IconButton({
  icon,
  label,
  badge,
  tone,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: string; label: string; badge?: number | string; tone?: "gold" }) {
  return (
    <button
      aria-label={badge !== undefined ? `${label}, ${badge} left` : label}
      className={`press bg-surface-raised relative flex size-11 shrink-0 items-center justify-center rounded-[14px] ${tone === "gold" ? "text-gold" : "text-text"} ${className}`}
      {...rest}
    >
      <Icon name={icon} size={20} />
      {badge !== undefined && (
        <span className="num bg-gold absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-[7px] text-[12px] font-bold text-[#0E0F1A]">
          {badge}
        </span>
      )}
    </button>
  );
}
