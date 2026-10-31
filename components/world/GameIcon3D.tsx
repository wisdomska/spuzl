import Image from "next/image";
import { Icon } from "@/components/ui/Icon";
import { WORLD_BY_ID, type GameMeta } from "@/lib/catalog";

/**
 * Pre-rendered 3D game tile (scripts/prerender-3d.mjs → public/3d/icons/<id>.webp). The design renders
 * these with three.js; production ships static WebP. Locked games fall back to a flat lock tile.
 */
export function GameIcon3D({ meta, size = 64, locked }: { meta: GameMeta; size?: number; locked?: boolean }) {
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
  return (
    <Image
      src={`/3d/icons/${meta.id}.webp`}
      alt=""
      width={size}
      height={size}
      className="shrink-0"
      style={{ filter: `drop-shadow(0 4px 0 color-mix(in srgb, ${WORLD_BY_ID[meta.world].color} 35%, transparent))` }}
    />
  );
}
