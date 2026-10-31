import { handle, ok, requirePlayer, todayGmt } from "@/lib/api/server";
import { questsForDate, WEEKLY_CHAIN, type QuestDef } from "@/lib/gamification/quests";
import { questIcon } from "@/lib/meta";
import { msToReset } from "@/lib/format";
import { msToLeagueReset, weekStartOf } from "@/lib/leagues";

export const dynamic = "force-dynamic";

/** GET /api/v1/quests: today's 3 daily quests and the weekly 5-step chain, with progress and claim state. */
export const GET = handle(async () => {
  const { admin, player } = await requirePlayer();
  const today = todayGmt();
  const week = weekStartOf();
  const { data, error } = await admin
    .from("player_quests")
    .select("quest_id, period, progress, target, completed_at, claimed_at")
    .eq("player_id", player.id)
    .in("period", [today, week]);
  if (error) throw error;
  const row = (id: string, period: string) => (data ?? []).find((r) => r.quest_id === id && r.period === period);
  const shape = (q: QuestDef, period: string) => {
    const r = row(q.id, period);
    return {
      id: q.id,
      kind: q.kind,
      step: q.step ?? null,
      title: q.title,
      icon: questIcon(q),
      xp: q.xp,
      sparks: q.sparks,
      progress: Math.min(q.goal.n, r?.progress ?? 0),
      target: q.goal.n,
      completed: !!r?.completed_at,
      claimed: !!r?.claimed_at,
    };
  };
  return ok({
    daily: questsForDate(today).map((q) => shape(q, today)),
    weekly: WEEKLY_CHAIN.map((q) => shape(q, week)),
    resetsInMs: msToReset(),
    weekResetsInMs: msToLeagueReset(),
  });
});
