"use client";

import { useState } from "react";
import { CLOCK_MINUTES, clockMinutes, type BayGame } from "@/lib/multiplayer/bay";

const KEY = (game: BayGame) => `spuzl.clock.${game}`;

/** The player's last time control for a game on this device (or the game's default). */
export function savedMinutes(game: BayGame): number {
  try {
    const v = Number(localStorage.getItem(KEY(game)));
    return clockMinutes(game, Number.isFinite(v) && v > 0 ? v : null);
  } catch {
    return clockMinutes(game);
  }
}

function remember(game: BayGame, minutes: number) {
  try {
    localStorage.setItem(KEY(game), String(minutes));
  } catch {
    /* private mode: the choice just isn't remembered */
  }
}

/** Remembered time control for `game`, kept in step when the game changes. */
export function useMinutes(game: BayGame): [number, (m: number) => void] {
  const [state, setState] = useState(() => ({ game, minutes: typeof window === "undefined" ? clockMinutes(game) : savedMinutes(game) }));
  const minutes = state.game === game ? state.minutes : savedMinutes(game);
  if (state.game !== game) setState({ game, minutes });
  return [
    minutes,
    (m: number) => {
      remember(game, m);
      setState({ game, minutes: m });
    },
  ];
}

/** Live time control chips: minutes per player, the few each game offers (lib/multiplayer/bay CLOCK_MINUTES). */
export function TimePicker({ game, value, onChange }: { game: BayGame; value: number; onChange: (m: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p id={`clock-${game}`} className="text-muted text-[13px] font-semibold">
        Time per player
      </p>
      <div className="bg-bg flex gap-1 rounded-[16px] p-1" role="radiogroup" aria-labelledby={`clock-${game}`}>
        {CLOCK_MINUTES[game].map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={value === m}
            aria-label={`${m} minutes`}
            onClick={() => onChange(m)}
            className="press num flex h-11 flex-1 items-center justify-center rounded-[12px] text-[15px] font-semibold"
            style={
              value === m
                ? { background: "var(--w-board)", color: "var(--ink-on-bright)" }
                : { color: "var(--text-muted)", background: "transparent" }
            }
          >
            {m} min
          </button>
        ))}
      </div>
    </div>
  );
}
