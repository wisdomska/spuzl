import { labCopy as T } from "@/lib/copy/lab";
import { isLabGame } from "@/lib/catalog";

/** Show the lab tag for this game? Lab games only (players see them only while "features.labGames" has them). */
export const showsLabTag = (id: string) => isLabGame(id);

/**
 * "NEW": a small tag on lab games (All games and Library rows and cards, world tiles, the game header). Gold on the
 * raised surface (both themes keep 4.5:1). The word is part of the surrounding link's accessible name. Renders
 * nothing for a live game.
 */
export function LabTag({ id, compact = false, className = "" }: { id: string; compact?: boolean; className?: string }) {
  if (!showsLabTag(id)) return null;
  return (
    <span
      data-lab-tag
      className={`bg-surface-raised text-gold inline-flex shrink-0 items-center rounded-[8px] font-black tracking-[0.06em] whitespace-nowrap ${compact ? "h-4 px-1 text-[11px] leading-4" : "h-6 px-2 text-[12px] leading-4"} ${className}`}
      style={{ boxShadow: "inset 0 0 0 1px var(--gold)" }}
    >
      {/* Spaces around the word keep it apart from the text around the tag in an accessible name. */}
      <span> {T.tag} </span>
    </span>
  );
}
