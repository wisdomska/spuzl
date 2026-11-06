"use client";

export interface LudoKicks {
  backKick: boolean;
  sideKick: boolean;
  homeKick: boolean;
}
export const NO_KICKS: LudoKicks = { backKick: false, sideKick: false, homeKick: false };

const RULES = [
  ["backKick", "Back-kick", "Move back by your roll to take a rival behind you"],
  ["sideKick", "Side-kick", "Take a rival straight across the lane from where you land"],
  ["homeKick", "Home-kick", "Run up a rival's home column on an exact roll to take a piece there"],
] as const;

/** `back,side` in a link (Play live from the new-game sheet), back to the switches. */
export const kicksToParam = (k: LudoKicks) =>
  RULES.filter(([key]) => k[key])
    .map(([key]) => key.replace("Kick", ""))
    .join(",");
export const kicksFromParam = (s: string | null): LudoKicks => {
  const on = new Set((s ?? "").split(","));
  return { backKick: on.has("back"), sideKick: on.has("side"), homeKick: on.has("home") };
};

/**
 * Ludo match setup, shown before every Ludo match starts (with friends, against the Practice bot, and Play live):
 * how many players (2 to 4, not for Play live, which pairs two people) and the house rules, which apply to
 * everyone at the table, bots included.
 */
export function LudoSetup({
  kicks,
  onKicks,
  seats,
  onSeats,
}: {
  kicks: LudoKicks;
  onKicks: (k: LudoKicks) => void;
  seats?: number;
  onSeats?: (n: number) => void;
}) {
  return (
    <div className="flex w-full flex-col gap-3">
      {onSeats && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-muted pb-1 text-[13px] font-semibold">Players</legend>
          <div className="bg-bg flex gap-1 rounded-[16px] p-1" role="radiogroup" aria-label="Players">
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={seats === n}
                onClick={() => onSeats(n)}
                className="flex h-11 flex-1 items-center justify-center rounded-[12px] text-[15px] font-semibold"
                style={seats === n ? { background: "var(--surface-raised)" } : { color: "var(--text-muted)" }}
              >
                {n} players
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-muted pb-1 text-[13px] font-semibold">House rules (for everyone, bots included)</legend>
        {RULES.map(([k, label, hint]) => (
          <label key={k} className="bg-surface-raised flex min-h-12 cursor-pointer items-center gap-3 rounded-[14px] px-3 py-2 text-left">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-semibold">{label}</span>
              <span className="text-muted text-[13px]">{hint}</span>
            </span>
            <input
              type="checkbox"
              checked={kicks[k]}
              onChange={(e) => onKicks({ ...kicks, [k]: e.target.checked })}
              className="size-5 flex-none accent-[var(--accent)]"
            />
          </label>
        ))}
      </fieldset>
    </div>
  );
}
