import { Icon } from "@/components/ui/Icon";
import type { GameMeta } from "@/lib/catalog";

/** Cells per side of the sketched board, by engine: a grid puzzle, a board game, or a simple card. */
const CELLS: Record<GameMeta["engine"], number> = { grid: 5, board: 8, word: 5, phaser: 3, custom: 3 };

/**
 * R2-18: a tiny static board for the Continue card. Pure SVG and CSS in the card's own colour (currentColor): a few
 * grid lines (a checker for board games) under the game's icon. It never loads the board's code or art, so Home
 * stays as light as before. Decorative: the card's text names the game.
 */
export function BoardThumb({ meta, size = 44 }: { meta: GameMeta; size?: number }) {
  const n = CELLS[meta.engine];
  const step = 40 / n;
  const lines = Array.from({ length: n - 1 }, (_, i) => 4 + step * (i + 1));
  return (
    <span
      aria-hidden
      data-board-thumb={meta.id}
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-[12px]"
      style={{ width: size, height: size, background: "color-mix(in srgb, currentColor 14%, transparent)" }}
    >
      <svg viewBox="0 0 48 48" width={size} height={size} className="absolute inset-0" fill="none">
        {meta.engine === "board"
          ? Array.from({ length: n * n }, (_, k) =>
              (Math.floor(k / n) + k) % 2 ? (
                <rect
                  key={k}
                  x={4 + (k % n) * step}
                  y={4 + Math.floor(k / n) * step}
                  width={step}
                  height={step}
                  fill="currentColor"
                  opacity={0.12}
                />
              ) : null,
            )
          : lines.map((p) => (
              <g key={p} stroke="currentColor" strokeOpacity={0.22} strokeWidth={1}>
                <line x1={p} y1={4} x2={p} y2={44} />
                <line x1={4} y1={p} x2={44} y2={p} />
              </g>
            ))}
        <rect x={4} y={4} width={40} height={40} rx={6} stroke="currentColor" strokeOpacity={0.3} strokeWidth={1.5} />
      </svg>
      <Icon name={meta.icon} size={Math.round(size * 0.5)} className="relative" />
    </span>
  );
}
