"use client";

import { boardGames } from "@/lib/copy/board-games";
import { CAPTURE_ORDER, type CapturedKind } from "./history";
import { CH_N, Piece } from "./Piece";

/**
 * The pieces one side has taken, as small pieces from the set, lowest value first, the same kind overlapping, and the
 * material lead ("+3") on the side that is ahead. `white` is the colour of the captured pieces.
 */
export function CapturedRow({
  pieces,
  white,
  lead,
  sprites,
  size = 16,
}: {
  pieces: readonly CapturedKind[];
  white: boolean;
  lead: number;
  sprites: Set<string> | null;
  size?: number;
}) {
  const groups = CAPTURE_ORDER.map((k) => ({ k, n: pieces.filter((p) => p === k).length })).filter((g) => g.n > 0);
  const list = groups.map((g) => `${g.n} ${CH_N[g.k.toUpperCase()]}${g.n > 1 ? "s" : ""}`).join(", ");
  if (!groups.length && lead <= 0) return null;
  return (
    <span
      className="flex min-w-0 items-center overflow-hidden"
      role="img"
      aria-label={boardGames.chess.captured(list, lead)}
      data-captured={pieces.join("")}
    >
      {groups.map((g, gi) => (
        <span key={g.k} className="flex flex-none items-end" style={{ marginLeft: gi ? 2 : 0 }}>
          {Array.from({ length: g.n }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className="relative block flex-none"
              style={{ width: size, height: size, marginLeft: i ? -Math.round(size * 0.55) : 0 }}
            >
              <Piece ch={white ? g.k.toUpperCase() : g.k} size={size} sprites={sprites} />
            </span>
          ))}
        </span>
      ))}
      {lead > 0 && (
        <span aria-hidden className="num text-muted ml-1 flex-none text-[12px] font-semibold">
          +{lead}
        </span>
      )}
    </span>
  );
}
