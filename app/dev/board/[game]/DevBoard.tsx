"use client";

import { useRouter } from "next/navigation";
import { GameShell } from "@/components/game/GameShell";
import { BOARDS } from "@/games/board-registry";
import { GAME_BY_ID } from "@/lib/catalog";
import { LOGIC } from "@/games/logic-registry";

export function DevBoard({ id, puzzle, solution }: { id: string; puzzle: unknown; solution: unknown }) {
  const router = useRouter();
  return (
    <GameShell
      meta={GAME_BY_ID[id]}
      Board={BOARDS[id]}
      puzzle={puzzle}
      mode="free"
      label="Dev fixture"
      requestHint={async (state) => {
        const l = (await LOGIC[id]()).default;
        return l.hint?.(puzzle, solution, state) ?? null;
      }}
      onSolved={() => {}}
      onExit={() => router.back()}
    />
  );
}
