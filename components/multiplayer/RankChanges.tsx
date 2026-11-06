"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import { ALL_WORLDS } from "@/lib/catalog";

interface Change {
  track: string;
  delta: number;
  rounds: number;
}

/**
 * The end of a Duel or Party set: how it moved your rank, per category ("Puzzles rank +6"). The rounds are counted
 * as the set finishes, so this asks a few times until they show up; nothing shows for games against the bot.
 */
export function RankChanges({ matchId, setNo, className }: { matchId: string; setNo: number; className?: string }) {
  const q = useQuery({
    queryKey: ["rank-changes", matchId, setNo],
    queryFn: () => api<{ changes: Change[] }>(`/api/v1/me/rank-changes?match=${matchId}&set=${setNo}`),
    refetchInterval: (s) => ((s.state.data?.changes.length ?? 0) > 0 || s.state.dataUpdateCount > 5 ? false : 1500),
  });
  const changes = (q.data?.changes ?? []).filter((c) => Math.round(c.delta) !== 0);
  if (!changes.length) return null;
  return (
    <div className={`flex flex-wrap justify-center gap-2 ${className ?? ""}`} role="status" aria-live="polite">
      {changes.map((c) => {
        const w = ALL_WORLDS.find((x) => x.id === c.track);
        const d = Math.round(c.delta);
        return (
          <span
            key={c.track}
            className="bg-surface flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold"
            style={{ boxShadow: `inset 0 0 0 2px ${w?.color ?? "var(--line)"}` }}
          >
            {w?.name ?? c.track} rank
            <span className="num" style={{ color: d > 0 ? "var(--accent)" : "var(--danger)" }}>
              {d > 0 ? `+${d}` : d}
            </span>
          </span>
        );
      })}
    </div>
  );
}
