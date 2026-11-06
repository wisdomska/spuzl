"use client";

import Image from "next/image";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { colourOf, type GameMeta } from "@/lib/catalog";

/**
 * Pre-rendered 3D game tile (scripts/prerender-3d.mjs → public/3d/icons/<id>.webp). The design renders
 * these with three.js; production ships static WebP. Locked games fall back to a flat lock tile.
 *
 * R2-12: if the tile cannot load (a stale cached miss, a game added before its render, a dropped request on patchy
 * data) the flat tile with the game's own Phosphor icon shows instead, so a card never has an empty icon slot.
 */
export function GameIcon3D({ meta, size = 64, locked }: { meta: GameMeta; size?: number; locked?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (locked) {
    return (
      <span
        className="bg-surface-raised text-muted flex shrink-0 items-center justify-center rounded-[16px]"
        style={{ width: size, height: size }}
      >
        <Icon name="lock-simple" size={size * 0.45} />
      </span>
    );
  }
  if (failed === meta.id) {
    return (
      <span
        data-game-icon={meta.id}
        data-fallback=""
        className="text-on-accent flex shrink-0 items-center justify-center rounded-[30%]"
        style={{
          width: size,
          height: size,
          background: colourOf(meta).color,
          boxShadow: "inset -4px -4px 0 rgb(0 0 0 / 0.18), inset 3px 3px 0 rgb(255 255 255 / 0.22)",
        }}
      >
        <Icon name={meta.icon} size={Math.round(size * 0.5)} />
      </span>
    );
  }
  return (
    <Image
      src={`/3d/icons/${meta.id}.webp`}
      alt=""
      width={size}
      height={size}
      data-game-icon={meta.id}
      onError={() => setFailed(meta.id)}
      className="shrink-0"
      style={{ filter: `drop-shadow(0 4px 0 color-mix(in srgb, ${colourOf(meta).color} 35%, transparent))` }}
    />
  );
}
