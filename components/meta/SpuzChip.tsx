"use client";

import { memo, type ReactNode } from "react";
import { SpuzWear } from "@/components/meta/SpuzWear";
import { WithMyLook } from "@/components/meta/MySpuz";

export interface SpuzChipProps {
  /** the player's skin colour */
  color: string;
  /** the Shop hat they wear (null or missing: none) */
  hat?: string | null;
  size: number;
  radius?: number;
  /** the signed-in player's own row: wears their live Shop look (the cached profile), the row's look until it loads */
  me?: boolean;
  dim?: boolean;
  /** overlays that may sit outside the chip (emote bubbles, a crown, a presence dot) */
  children?: ReactNode;
}

/**
 * R3-16: a player's avatar in lists (friends, leaderboards, leagues, crews, chat, Party seats, Duel strips): a
 * small still Spuz in their skin colour wearing their hat, on a tint of that colour. It replaces the letter
 * avatar in the same size × size box, so nothing shifts. Decorative: the nickname beside it is the name.
 * Still (no animation) and memoised, so a 50-row leaderboard or a live race rail stays cheap.
 */
export const SpuzChip = memo(function SpuzChip({ color, hat, size, radius, me, dim, children }: SpuzChipProps) {
  const r = radius ?? Math.round(size * 0.3);
  const face = (look: { color: string; hat: string | null }) => (
    <span
      className="absolute inset-0 overflow-hidden"
      style={{ borderRadius: r, background: `color-mix(in srgb, ${look.color} 32%, var(--surface-raised))` }}
    >
      <SpuzWear size={size} color={look.color} hat={look.hat} still />
    </span>
  );
  return (
    <span
      aria-hidden
      data-avatar="spuz"
      className="relative flex flex-none"
      style={{ width: size, height: size, borderRadius: r, opacity: dim ? 0.4 : 1 }}
    >
      {me ? <WithMyLook fallback={{ color, hat: hat ?? null }}>{face}</WithMyLook> : face({ color, hat: hat ?? null })}
      {children}
    </span>
  );
});
