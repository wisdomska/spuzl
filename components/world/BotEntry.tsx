import Link from "next/link";
import type { GameMeta } from "@/lib/catalog";
import { Icon } from "@/components/ui/Icon";
import { boardGames } from "@/lib/copy/board-games";

/**
 * Secondary entry under a game card for games with `botPlay`: a casual full game against the bot.
 * A sibling of the card link (never nested in it), 44 px tall.
 */
export function BotEntry({ meta }: { meta: GameMeta }) {
  if (!meta.botPlay) return null;
  return (
    <Link
      href={`/play/${meta.id}/bot`}
      aria-label={boardGames.bot.entryAria(meta.name)}
      className="press bg-surface flex min-h-11 items-center gap-2.5 rounded-[16px] px-3.5 text-[14px] font-semibold"
    >
      <Icon name="robot" size={20} style={{ color: "var(--world)" }} />
      <span className="flex-1">{boardGames.bot.entry}</span>
      <Icon name="caret-right" size={16} className="text-muted" />
    </Link>
  );
}
