import Image from "next/image";
import Link from "next/link";
import type { GameMeta } from "@/lib/catalog";
import { durationLabel, defaultMetaFor } from "@/lib/games-meta";

/** A game in a public list: its tile, name, card line and typical time, linking to its page (/games/<id>). */
export function GameLinkCard({ game: g }: { game: GameMeta }) {
  return (
    <li>
      <Link
        href={`/games/${g.id}`}
        className="press bg-surface border-line hover:border-accent flex min-h-[76px] items-center gap-3 rounded-[20px] border p-3"
      >
        <Image src={`/3d/icons/${g.id}.webp`} alt={`${g.name} game icon`} width={52} height={52} className="shrink-0 rounded-[14px]" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-display text-[17px] leading-tight font-black">{g.name}</span>
          <span className="text-muted text-[14px] leading-snug">
            {g.blurb} · {durationLabel(defaultMetaFor(g.id).typicalSec)}
          </span>
        </span>
      </Link>
    </li>
  );
}
