"use client";

import { useState } from "react";
import { DEFAULT_DRAUGHTS_SIZE, DRAUGHTS_SIZES, type DraughtsSize } from "@/games/draughts/engine";

/** Where the last board picked is kept on this device. */
const KEY = "spuzl.draughtsSize";

const LABEL: Record<DraughtsSize, { name: string; about: string }> = {
  10: { name: "10 × 10", about: "International: kings fly, men capture backward, take the most" },
  8: { name: "8 × 8", about: "English: kings move one square, men capture forward only" },
};

/** The draughts board to play on: 10 × 10 International (the default) or 8 × 8 English, remembered on this device. */
export function useDraughtsSize(): [DraughtsSize, (n: DraughtsSize) => void] {
  const [size, setSize] = useState<DraughtsSize>(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(KEY) === "8" ? 8 : DEFAULT_DRAUGHTS_SIZE;
    } catch {
      return DEFAULT_DRAUGHTS_SIZE;
    }
  });
  const set = (n: DraughtsSize) => {
    setSize(n);
    try {
      localStorage.setItem(KEY, String(n));
    } catch {
      /* private mode: the choice lasts while the page is open */
    }
  };
  return [size, set];
}

/**
 * The board picker before a draughts match (owner, 22 Nov 2026): with friends, against Spuzl and Play live. Both
 * players play the board the match was made with; Play live pairs only people who picked the same one.
 */
export function DraughtsSizePicker({ value, onChange }: { value: DraughtsSize; onChange: (n: DraughtsSize) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p id="draughts-board" className="text-muted text-[13px] font-semibold">
        Board
      </p>
      <div className="bg-bg flex gap-1 rounded-[16px] p-1" role="radiogroup" aria-labelledby="draughts-board">
        {DRAUGHTS_SIZES.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${LABEL[n].name}. ${LABEL[n].about}`}
            onClick={() => onChange(n)}
            className="press num flex min-h-11 flex-1 items-center justify-center rounded-[12px] px-2 text-[15px] font-semibold"
            style={
              value === n
                ? { background: "var(--accent)", color: "var(--ink-on-bright)" }
                : { color: "var(--text-muted)", background: "transparent" }
            }
          >
            {LABEL[n].name}
          </button>
        ))}
      </div>
      <p className="text-muted text-[13px]">{LABEL[value].about}.</p>
    </div>
  );
}
