"use client";

import { useState, type CSSProperties } from "react";
import { Icon } from "@/components/ui/Icon";
import { GAME_BY_ID } from "@/lib/catalog";

export type InboxStatus = "your-move" | "their-move" | "finished";

export interface InboxGame {
  id: string;
  /** Board Bay game id: chess, draughts, oware, ludo, fourup, flip */
  game: string;
  opponent: { name: string; initial?: string; color: string };
  /** One line under the title, e.g. "He captured 4. Your move, 22 h left." */
  detail: string;
  status: InboxStatus;
  /** Nudge already sent (their move): the button disables */
  nudged?: boolean;
  /** Their move for 12 h or more: nudging is allowed */
  canNudge?: boolean;
}

export interface YourMoveInboxProps {
  games: InboxGame[];
  onPlay(id: string): void;
  onNudge?(id: string): void;
  onRematch?(id: string): void;
  onNewGame(): void;
  /** Header line under the title */
  note?: string;
}

/** Pre-rendered 3D game tile (public/3d/icons) with the flat Phosphor tile as fallback. */
export function GameTile({ game, size }: { game: string; size: number }) {
  const [failed, setFailed] = useState(false);
  const meta = GAME_BY_ID[game];
  if (failed || !meta)
    return (
      <span aria-hidden className="flex items-center justify-center rounded-[30%]" style={{ width: size, height: size, background: "var(--w-board)", color: "#0E0F1A", boxShadow: "inset -4px -4px 0 rgba(0,0,0,.18), inset 3px 3px 0 rgba(255,255,255,.22)" }}>
        <Icon name={meta?.icon ?? "puzzle-piece"} size={Math.round(size * 0.5)} />
      </span>
    );
  return (
    <span aria-hidden className="relative block" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/3d/icons/${game}.webp`} alt="" onError={() => setFailed(true)} className="pointer-events-none absolute max-w-none" style={{ left: "-21%", top: "-21%", width: "142%", height: "142%" }} />
    </span>
  );
}

const CTA: Record<InboxStatus, { label: string; style: CSSProperties }> = {
  "your-move": { label: "Play", style: { background: "var(--world)", color: "#0E0F1A" } },
  "their-move": { label: "Nudge", style: { background: "var(--surface-raised)", color: "var(--text)" } },
  finished: { label: "Rematch", style: { background: "var(--surface-raised)", color: "var(--accent)" } },
};

/**
 * "Your move" async inbox (Board Games B7). Turn-based games with friends, your move first. Props only:
 * the parent fetches the games and handles Play, Nudge, Rematch and New game.
 */
export function YourMoveInbox({ games, onPlay, onNudge, onRematch, onNewGame, note = "Turn-based games with friends. 24 h per move, nudge after 12." }: YourMoveInboxProps) {
  const order: Record<InboxStatus, number> = { "your-move": 0, "their-move": 1, finished: 2 };
  const sorted = [...games].sort((a, b) => order[a.status] - order[b.status]);
  const waiting = games.filter((g) => g.status === "your-move").length;

  return (
    <section className="flex min-h-full flex-col gap-3 px-4 pt-14 pb-6" style={{ ["--world" as string]: "var(--w-board)" }} aria-labelledby="your-move-title">
      <div className="flex items-center justify-between gap-3">
        <h1 id="your-move-title" className="font-display text-[26px] font-black whitespace-nowrap">
          Your move
        </h1>
        {waiting > 0 && (
          <span className="num rounded-[10px] px-2.5 py-1.5 text-[13px] font-bold whitespace-nowrap" style={{ background: "var(--world)", color: "#0E0F1A" }}>
            {waiting} waiting
          </span>
        )}
      </div>
      <p className="text-[15px] leading-[1.45] text-muted">{note}</p>

      {sorted.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-[20px] bg-surface px-4 py-8 text-center">
          <Icon name="hourglass-medium" size={28} className="text-muted" />
          <span className="text-[16px] font-semibold">No games on the go</span>
          <span className="text-[14px] text-muted">Start one with a friend. They get 24 h for each move.</span>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {sorted.map((g) => {
          const meta = GAME_BY_ID[g.game];
          const mine = g.status === "your-move";
          const cta = CTA[g.status];
          const disabled = g.status === "their-move" && (g.nudged || !g.canNudge || !onNudge);
          const label = g.status === "their-move" && g.nudged ? "Nudged" : cta.label;
          const press = () => (g.status === "your-move" ? onPlay(g.id) : g.status === "their-move" ? onNudge?.(g.id) : onRematch?.(g.id));
          const title = `${meta?.name ?? g.game} vs ${g.opponent.name}`;
          return (
            <li key={g.id} className="flex items-center gap-3 rounded-[20px] p-3" style={mine ? { background: "color-mix(in srgb, var(--world) 14%, var(--bg))", boxShadow: "inset 0 0 0 2px var(--world)" } : { background: "var(--surface)" }}>
              <div className="relative size-[52px] flex-none">
                <GameTile game={g.game} size={52} />
                <span className="font-display absolute -right-[5px] -bottom-[5px] flex size-6 items-center justify-center rounded-[8px] text-[11px] font-black" style={{ background: g.opponent.color, color: "#0E0F1A", boxShadow: "0 0 0 3px var(--bg)" }}>
                  {g.opponent.initial ?? g.opponent.name[0]?.toUpperCase()}
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[16px] font-bold">{title}</span>
                <span className="text-[14px] leading-[1.35] text-muted">{g.detail}</span>
              </div>
              <button
                type="button"
                onClick={press}
                disabled={disabled}
                aria-label={`${label}: ${title}`}
                className="press min-h-11 flex-none rounded-[12px] px-3 text-[14px] font-bold disabled:opacity-60"
                style={cta.style}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onNewGame}
        className="toy font-display mt-auto flex h-[60px] items-center justify-center gap-2.5 rounded-[20px] text-[16px] font-black"
        style={{ background: "var(--accent)", color: "var(--on-accent)", ["--btn-depth" as string]: "var(--accent-depth)", boxShadow: "0 6px 0 var(--accent-depth)" }}
      >
        <Icon name="plus" size={20} />
        New game with a friend
      </button>
    </section>
  );
}

export default YourMoveInbox;
