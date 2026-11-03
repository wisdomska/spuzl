"use client";

import { useEffect } from "react";
import { Icon } from "@/components/ui/Icon";
import { CH_N, Piece } from "./Piece";

/** Promotion choices in the order the big online boards use, from the promotion square inwards. */
export const PROMOTION_ORDER = ["q", "n", "r", "b"] as const;
export type PromotionPiece = (typeof PROMOTION_ORDER)[number];

/**
 * The promotion picker, drawn on the board itself: a column of the four pieces standing on the promotion square
 * and running toward the middle of the board, with a cancel button at the end, over a dimmed board. Tapping the
 * dimmed board or pressing Escape puts the pawn back. Place it inside the board's positioned container.
 */
export function PromotionPicker({
  cell,
  column,
  top,
  white,
  sprites,
  onPick,
  onCancel,
  label = "Promote to",
}: {
  cell: number;
  /** the promotion square's column on screen (0 = left) */
  column: number;
  /** whether the promotion square is on the top row on screen (else the bottom row) */
  top: boolean;
  white: boolean;
  sprites: Set<string> | null;
  onPick: (p: PromotionPiece) => void;
  onCancel: () => void;
  label?: string;
}) {
  useEffect(() => {
    // Escape puts the pawn back; the choices come next in the tab order, right after the board.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const cancelH = Math.round(cell * 0.5);
  const order = top ? PROMOTION_ORDER : [...PROMOTION_ORDER].reverse();
  const items = order.map((p, i) => (
    <button
      key={p}
      type="button"
      aria-label={`${label} ${CH_N[p.toUpperCase()]}`}
      onClick={() => onPick(p)}
      className="press relative flex items-end justify-center"
      style={{ width: cell, height: cell, borderTop: i ? "1px solid rgba(60,40,20,.12)" : undefined, paddingBottom: cell * 0.05 }}
    >
      {/* sprites are 1.4 squares tall: 0.66 of a square keeps the tallest (the queen) inside its slot */}
      <span className="relative block" style={{ width: cell * 0.66, height: cell * 0.66 }}>
        <Piece ch={white ? p.toUpperCase() : p} size={cell * 0.66} sprites={sprites} />
      </span>
    </button>
  ));
  const cancel = (
    <button
      key="cancel"
      type="button"
      aria-label="Cancel promotion"
      onClick={onCancel}
      className="press flex items-center justify-center"
      style={{ width: cell, height: cancelH, background: "#EADFCB", color: "#5A3A22" }}
    >
      <Icon name="x" size={Math.max(16, Math.round(cell * 0.3))} />
    </button>
  );

  return (
    <>
      <button
        type="button"
        aria-label="Cancel promotion"
        tabIndex={-1}
        onClick={onCancel}
        className="absolute inset-0 z-30 rounded-[14px]"
        style={{ background: "rgba(6,7,13,.45)" }}
      />
      <div
        role="group"
        aria-label={label}
        className="absolute z-40 flex flex-col overflow-hidden rounded-[12px]"
        style={{
          left: column * cell,
          ...(top ? { top: 0 } : { bottom: 0 }),
          width: cell,
          background: "#FBF5EA",
          boxShadow: "0 10px 30px rgba(0,0,0,.55)",
        }}
      >
        {top ? [...items, cancel] : [cancel, ...items]}
      </div>
    </>
  );
}
